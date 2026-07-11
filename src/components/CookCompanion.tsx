"use client";

import { useEffect, useRef, useState } from "react";
import type { Recipe } from "@/lib/types";
import type {
  ChatContentBlock,
  ChatMessage,
  CompanionRecipe,
  CompanionResponse,
  CompanionState,
  HostedSessionResponse,
} from "@/lib/companion/types";
import { initialCompanionState } from "@/lib/companion/types";
import {
  BYOK_DEFAULTS,
  inspectByokEndpoint,
  loadByokConfig,
  saveByokConfig,
  sendDirectTurn,
  type ByokConfig,
  type ByokEndpointDisclosure,
  type ByokProvider,
} from "@/lib/companion/client";

const HOSTED_NOTICE_VERSION = "2026-07-phase2-v1";
const HOSTED_NOTICE_KEY = "cook-anything.companion.hosted-notice";

const ERROR_COPY: Record<string, string> = {
  not_configured:
    "The hosted companion is unavailable while its security controls are being verified. Connect your own API key under settings, or use normal Cook Mode.",
  bad_api_key: "The provider rejected that API key. Check it under settings.",
  invalid_endpoint: "That provider endpoint is invalid or unsafe. Use HTTPS without embedded credentials, a query or a fragment.",
  rate_limited: "Too many requests right now. Wait a moment and try again.",
  overloaded: "The model provider is overloaded. Try again shortly.",
  busy: "The hosted kitchen is at capacity. Try again shortly.",
  daily_limit: "The hosted companion reached today’s safety limit. Connect your own key or use Cook Mode.",
  session_limit: "This hosted cooking session reached its turn limit. Close it and begin a fresh session.",
  session_expired: "That hosted session expired. A new one will be created when you send again.",
  hosted_text_only: "Hosted mode is text-only. Connect your own vision-capable key to send photos.",
  payload_too_large: "That request is too large.",
  recipe_not_found: "The trusted cooking snapshot for this recipe could not be loaded.",
  forbidden: "The companion’s security checks blocked this request.",
};

interface Bubble {
  role: "user" | "assistant";
  text: string;
  imageUrl?: string;
}

interface CompressedPhoto {
  media_type: string;
  data: string;
}

interface SpeechRecognitionResultEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

async function compressImage(file: File): Promise<CompressedPhoto> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("image_context_unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    return { media_type: "image/jpeg", data: dataUrl.split(",")[1] ?? "" };
  } finally {
    bitmap.close();
  }
}

function leanHistory(messages: ChatMessage[]): ChatMessage[] {
  const recent = messages.slice(-16);
  return recent.map((message, index) => {
    if (typeof message.content === "string" || index === recent.length - 1) return message;
    return {
      role: message.role,
      content: message.content.map((block): ChatContentBlock =>
        block.type === "image" ? { type: "text", text: "[photo sent earlier]" } : block,
      ),
    };
  });
}

function freshTurnId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

export default function CookCompanion({
  recipe,
  companionRecipe,
}: {
  recipe: Recipe;
  companionRecipe: CompanionRecipe;
}) {
  const [open, setOpen] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<CompressedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [byok, setByok] = useState<ByokConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHostedNotice, setShowHostedNotice] = useState(false);

  const historyRef = useRef<ChatMessage[]>([]);
  const hostedSessionReadyRef = useRef(false);
  const hostedNoticeAcceptedRef = useRef(false);
  const stateRef = useRef<CompanionState>(initialCompanionState(companionRecipe));
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const launchRef = useRef<HTMLButtonElement>(null);
  const [, forceRender] = useState(0);
  const state = stateRef.current;

  useEffect(() => {
    setByok(loadByokConfig());
    try {
      hostedNoticeAcceptedRef.current = window.localStorage.getItem(HOSTED_NOTICE_KEY) === HOSTED_NOTICE_VERSION;
    } catch {
      hostedNoticeAcceptedRef.current = false;
    }
  }, []);

  useEffect(() => {
    hostedSessionReadyRef.current = false;
    stateRef.current = initialCompanionState(companionRecipe);
    historyRef.current = [];
    setBubbles([]);
    setPendingPhoto(null);
  }, [companionRecipe]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const requestWakeLock = () => {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      (navigator as Navigator & {
        wakeLock: { request: (type: string) => Promise<{ release: () => Promise<void> }> };
      }).wakeLock.request("screen").then((lock) => {
        wakeLockRef.current = lock;
      }).catch(() => undefined);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void closeCompanion();
    };
    requestWakeLock();
    document.addEventListener("visibilitychange", requestWakeLock);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("visibilitychange", requestWakeLock);
      document.removeEventListener("keydown", onKeyDown);
      wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      window.speechSynthesis?.cancel();
      launchRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, busy, showHostedNotice]);

  function acceptState(next: CompanionState | null) {
    if (!next || next.recipe_id !== companionRecipe.recipe_id) return;
    stateRef.current = next;
    forceRender((value) => value + 1);
  }

  function say(text: string) {
    if (!speak || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }

  async function readJson<T>(response: Response): Promise<T> {
    if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
      throw new Error(ERROR_COPY.not_configured);
    }
    return response.json() as Promise<T>;
  }

  async function closeHostedSession(): Promise<void> {
    if (!hostedSessionReadyRef.current) return;
    hostedSessionReadyRef.current = false;
    await fetch("/api/companion/session", { method: "DELETE" }).catch(() => undefined);
  }

  async function closeCompanion(): Promise<void> {
    await closeHostedSession();
    setOpen(false);
  }

  async function ensureHostedSession(): Promise<void> {
    if (hostedSessionReadyRef.current) return;
    const response = await fetch("/api/companion/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipe_id: companionRecipe.recipe_id }),
    });
    const data = await readJson<HostedSessionResponse>(response);
    if (!response.ok || data.error) {
      throw new Error(ERROR_COPY[data.error ?? ""] ?? "The hosted session could not be started.");
    }
    acceptState(data.state);
    hostedSessionReadyRef.current = true;
  }

  async function hostedTurn(message: string): Promise<CompanionResponse> {
    await ensureHostedSession();
    const clientTurnId = freshTurnId();
    const execute = async () => {
      const response = await fetch("/api/companion/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, client_turn_id: clientTurnId }),
      });
      return { response, data: await readJson<CompanionResponse>(response) };
    };

    let result = await execute();
    if (result.data.error === "session_expired") {
      hostedSessionReadyRef.current = false;
      await ensureHostedSession();
      result = await execute();
    }
    if (!result.response.ok || result.data.error) {
      throw new Error(ERROR_COPY[result.data.error ?? ""] ?? "The companion request failed.");
    }
    return result.data;
  }

  async function send(text: string, photo: CompressedPhoto | null = null) {
    const trimmed = text.trim();
    if ((!trimmed && !photo) || busy) return;
    if (!byok && !hostedNoticeAcceptedRef.current) {
      setShowHostedNotice(true);
      return;
    }
    if (!byok && photo) {
      setShowSettings(true);
      setBubbles((current) => [...current, { role: "assistant", text: `⚠️ ${ERROR_COPY.hosted_text_only}` }]);
      return;
    }

    const blocks: ChatContentBlock[] = [];
    if (photo) blocks.push({ type: "image", source: { type: "base64", ...photo } });
    blocks.push({ type: "text", text: trimmed || "Here is a kitchen photo. What should I do next?" });
    const userMessage: ChatMessage = { role: "user", content: photo ? blocks : trimmed };

    historyRef.current = [...historyRef.current, userMessage];
    setBubbles((current) => [...current, {
      role: "user",
      text: trimmed || "Photo check-in",
      ...(photo ? { imageUrl: `data:${photo.media_type};base64,${photo.data}` } : {}),
    }]);
    setInput("");
    setPendingPhoto(null);
    setBusy(true);

    try {
      const data = byok
        ? await sendDirectTurn(byok, companionRecipe, stateRef.current, leanHistory(historyRef.current))
        : await hostedTurn(trimmed);
      if (data.error || !data.reply) {
        throw new Error(ERROR_COPY[data.error ?? ""] ?? "The companion returned no usable reply.");
      }
      historyRef.current = [...historyRef.current, { role: "assistant", content: data.reply }];
      acceptState(data.state);
      setBubbles((current) => [...current, { role: "assistant", text: data.reply }]);
      say(data.reply);
    } catch (cause) {
      historyRef.current = historyRef.current.slice(0, -1);
      const message = cause instanceof Error ? cause.message : "Network error. Try again.";
      if (message === ERROR_COPY.not_configured) setShowSettings(true);
      setBubbles((current) => [...current, { role: "assistant", text: `⚠️ ${message}` }]);
    } finally {
      setBusy(false);
    }
  }

  function start() {
    setOpen(true);
    if (bubbles.length > 0) return;
    if (!byok && !hostedNoticeAcceptedRef.current) {
      setShowHostedNotice(true);
      return;
    }
    void send(`I’m cooking ${recipe.title} for ${recipe.servings}. I’m at the start. What is my first move?`);
  }

  function acceptHostedNotice() {
    hostedNoticeAcceptedRef.current = true;
    try {
      window.localStorage.setItem(HOSTED_NOTICE_KEY, HOSTED_NOTICE_VERSION);
    } catch {
      // The current browser session may still proceed.
    }
    setShowHostedNotice(false);
    if (bubbles.length === 0) {
      void send(`I’m cooking ${recipe.title} for ${recipe.servings}. I’m at the start. What is my first move?`);
    }
  }

  function toggleVoiceInput() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const browser = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) {
      setBubbles((current) => [...current, { role: "assistant", text: "⚠️ Voice input is not supported in this browser." }]);
      return;
    }
    const recognition = new Constructor();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
      setListening(false);
      if (transcript) void send(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  async function onPhotoPicked(file: File | undefined) {
    if (!file) return;
    if (!byok) {
      setShowSettings(true);
      setBubbles((current) => [...current, { role: "assistant", text: `⚠️ ${ERROR_COPY.hosted_text_only}` }]);
      return;
    }
    try {
      setPendingPhoto(await compressImage(file));
    } catch {
      setBubbles((current) => [...current, { role: "assistant", text: "⚠️ That photo could not be prepared. Try another image." }]);
    }
  }

  if (!open) {
    return (
      <button
        ref={launchRef}
        onClick={start}
        className="no-print min-h-12 w-full rounded-card border-2 border-turmeric bg-card px-6 py-3 text-center font-semibold text-turmeric-deep shadow-lift transition-colors hover:bg-turmeric-tint sm:w-auto"
      >
        Cook with the companion
        <span className="ml-2 rounded-full bg-turmeric-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">beta</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-rice pb-[env(safe-area-inset-bottom)]" role="dialog" aria-modal="true" aria-label={`Cooking ${recipe.title} with the companion`}>
      <header className="flex items-center justify-between gap-2 border-b border-cardamom px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="font-display truncate text-lg leading-tight">{recipe.title}</p>
          <p className="truncate text-xs text-tamarind-faint">
            Stage: <strong className="text-turmeric-deep">{state.stage}</strong> · serves {state.servings}
            {!byok ? " · hosted text-only" : byok.remember ? " · key remembered on device" : " · session-only key"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => setShowSettings((value) => !value)} className="min-h-11 min-w-11 rounded-full border border-cardamom bg-card px-3 text-sm" aria-label="Companion API settings">⚙️</button>
          <button onClick={() => setSpeak((value) => !value)} className="min-h-11 min-w-11 rounded-full border border-cardamom bg-card px-3 text-sm" aria-pressed={speak} aria-label="Read replies aloud">{speak ? "🔊" : "🔇"}</button>
          <button onClick={() => setShowLedger((value) => !value)} className="min-h-11 rounded-full border border-cardamom bg-card px-3 text-xs font-medium">Swaps{state.substitution_ledger.length ? ` (${state.substitution_ledger.length})` : ""}</button>
          <button onClick={() => void closeCompanion()} className="min-h-11 min-w-11 rounded-full border border-cardamom bg-card px-3 text-sm" aria-label="Close companion and erase hosted session">✕</button>
        </div>
      </header>

      <div className="rail flex gap-1.5 overflow-x-auto px-4 pt-2" aria-label="Cooking stages">
        {companionRecipe.stages.map((stage) => (
          <span key={stage} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${stage === state.stage ? "bg-turmeric text-tamarind" : "bg-rice-deep text-tamarind-faint"}`}>{stage.replace(/_/g, " ")}</span>
        ))}
      </div>

      <div className="mx-4 mt-2 rounded-card border border-cardamom bg-rice-deep/50 px-3 py-2 text-xs text-tamarind-soft">
        Allergen assessment: {companionRecipe.trust.allergen_status}. This is not an allergen-free guarantee. Check exact product labels before relying on a recipe or substitution.
      </div>

      {showHostedNotice && !byok && (
        <HostedConsent
          onAccept={acceptHostedNotice}
          onUseOwnKey={() => {
            setShowHostedNotice(false);
            setShowSettings(true);
          }}
        />
      )}

      {showSettings && (
        <ByokSettings
          byok={byok}
          onSave={(config, remember) => {
            const saved = saveByokConfig(config, remember);
            setByok(saved);
            setShowSettings(false);
            setShowHostedNotice(false);
            void closeHostedSession();
            if (saved) {
              setBubbles((current) => [...current, {
                role: "assistant",
                text: `Your ${saved.provider === "anthropic" ? "Anthropic" : "custom provider"} key is connected for this ${saved.remember ? "device" : "page session"}. Send a message when ready.`,
              }]);
            }
          }}
          onClear={() => {
            saveByokConfig(null);
            setByok(null);
          }}
        />
      )}

      {showLedger && (
        <div className="border-b border-cardamom bg-turmeric-tint/40 px-4 py-3 text-sm">
          {state.substitution_ledger.length === 0 ? (
            <p className="text-tamarind-faint">No swaps yet. Replacements can change allergens, so check their labels.</p>
          ) : (
            <ul className="space-y-1">
              {state.substitution_ledger.map((entry, index) => (
                <li key={`${entry.original}-${index}`}>
                  <strong>{entry.original}</strong> → {entry.now}{entry.qty ? ` (${entry.qty})` : ""}
                  {entry.constraint && <span className="block text-xs text-tamarind-faint">{entry.constraint}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        <div className="mx-auto max-w-2xl space-y-3">
          {bubbles.map((bubble, index) => (
            <div key={`${bubble.role}-${index}`} className={`flex ${bubble.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-card px-4 py-2.5 text-[15px] leading-relaxed ${bubble.role === "user" ? "bg-turmeric-tint text-tamarind" : "bg-card shadow-lift"}`}>
                {bubble.imageUrl && <img src={bubble.imageUrl} alt="Your kitchen attachment" className="mb-2 max-h-48 rounded-lg" />}
                <p className="whitespace-pre-wrap">{bubble.text}</p>
              </div>
            </div>
          ))}
          {busy && <div className="flex justify-start"><div className="rounded-card bg-card px-4 py-2.5 shadow-lift" aria-label="Companion is thinking">···</div></div>}
        </div>
      </main>

      <div className="rail flex gap-2 overflow-x-auto px-4 pb-2">
        {["Where am I?", "Done, what’s next?", "I don’t have an ingredient", "Something went wrong"].map((question) => (
          <button key={question} onClick={() => void send(question)} disabled={busy || showHostedNotice} className="min-h-10 shrink-0 rounded-full border border-cardamom bg-card px-3 text-xs font-medium text-tamarind-soft disabled:opacity-40">{question}</button>
        ))}
      </div>

      <footer className="border-t border-cardamom p-3">
        {pendingPhoto && (
          <div className="mb-2 flex items-center gap-2 px-1">
            <img src={`data:${pendingPhoto.media_type};base64,${pendingPhoto.data}`} alt="Photo ready to send" className="h-12 w-12 rounded-lg object-cover" />
            <span className="text-xs text-tamarind-faint">Photo attached. Add a question or send it.</span>
            <button onClick={() => setPendingPhoto(null)} className="ml-auto min-h-10 px-2 text-xs underline">Remove</button>
          </div>
        )}
        <form className="flex items-center gap-2" onSubmit={(event) => {
          event.preventDefault();
          void send(input, pendingPhoto);
        }}>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => void onPhotoPicked(event.target.files?.[0])} />
          <button type="button" onClick={() => byok ? fileRef.current?.click() : setShowSettings(true)} className="min-h-11 min-w-11 rounded-full border border-cardamom bg-card text-lg" aria-label={byok ? "Attach a kitchen photo" : "Connect your own key to attach photos"}>📷</button>
          <button type="button" onClick={toggleVoiceInput} className={`min-h-11 min-w-11 rounded-full border text-lg ${listening ? "border-chilli bg-chilli-tint" : "border-cardamom bg-card"}`} aria-label={listening ? "Stop voice input" : "Start voice input"} aria-pressed={listening}>{listening ? "⏹" : "🎤"}</button>
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={listening ? "Listening…" : "Ask, or say what happened…"} maxLength={2000} className="min-w-0 flex-1 rounded-full border border-cardamom bg-card px-4 py-2.5 text-[15px] outline-none focus:border-turmeric" enterKeyHint="send" />
          <button type="submit" disabled={busy || showHostedNotice || (!input.trim() && !pendingPhoto)} className="min-h-11 rounded-full bg-turmeric px-4 font-semibold text-tamarind disabled:opacity-40">Send</button>
        </form>
      </footer>
    </div>
  );
}

function HostedConsent({ onAccept, onUseOwnKey }: { onAccept: () => void; onUseOwnKey: () => void }) {
  return (
    <div className="border-b border-cardamom bg-card px-4 py-4 text-sm">
      <p className="font-semibold">Before using hosted text</p>
      <p className="mt-1 max-w-3xl text-tamarind-soft">
        Your message, selected recipe, recent conversation context and temporary cooking state may be processed through Cloudflare and the configured AI provider or private bridge. Hosted mode accepts no photos. Inactive sessions are configured for deletion after about two hours; closing the companion requests earlier deletion.
      </p>
      <p className="mt-2 text-xs text-tamarind-faint">Do not send secrets, medical information or identity documents. Recipe trust remains limited to the evidence shown on the page.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button onClick={onAccept} className="min-h-11 rounded-full bg-turmeric px-4 font-semibold text-tamarind">Continue with hosted text</button>
        <button onClick={onUseOwnKey} className="min-h-11 rounded-full border border-cardamom bg-rice px-4 font-semibold">Use my own key instead</button>
      </div>
    </div>
  );
}

function ByokSettings({
  byok,
  onSave,
  onClear,
}: {
  byok: ByokConfig | null;
  onSave: (config: ByokConfig, remember: boolean) => void;
  onClear: () => void;
}) {
  const [provider, setProvider] = useState<ByokProvider>(byok?.provider ?? "anthropic");
  const [apiKey, setApiKey] = useState(byok?.apiKey ?? "");
  const [model, setModel] = useState(byok?.model ?? BYOK_DEFAULTS.anthropic.model);
  const [baseUrl, setBaseUrl] = useState(byok?.baseUrl ?? BYOK_DEFAULTS["openai-compatible"].baseUrl!);
  const [remember, setRemember] = useState(Boolean(byok?.remember));
  const [trustEndpoint, setTrustEndpoint] = useState(false);
  const [error, setError] = useState("");

  let disclosure: ByokEndpointDisclosure | null = null;
  if (provider === "openai-compatible") {
    try {
      disclosure = inspectByokEndpoint(baseUrl);
    } catch {
      disclosure = null;
    }
  }

  function switchProvider(next: ByokProvider) {
    setProvider(next);
    setTrustEndpoint(false);
    setError("");
    if (!byok || byok.provider !== next) setModel(BYOK_DEFAULTS[next].model);
  }

  function save() {
    setError("");
    if (provider === "openai-compatible") {
      if (!disclosure) {
        setError(ERROR_COPY.invalid_endpoint);
        return;
      }
      if (disclosure.requiresConfirmation && !trustEndpoint) {
        setError(`Confirm that you trust ${disclosure.hostname} before sending it your API key.`);
        return;
      }
    }
    onSave({
      provider,
      apiKey: apiKey.trim(),
      model: model.trim(),
      ...(provider === "openai-compatible" ? { baseUrl: disclosure!.normalizedUrl } : {}),
    }, remember);
  }

  return (
    <div className="border-b border-cardamom bg-card px-4 py-3 text-sm">
      <p className="font-semibold">Connect your API key</p>
      <p className="mt-0.5 text-xs text-tamarind-faint">Calls go directly from this browser to the selected provider. The key stays in memory unless you explicitly remember it.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label>
          <span className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Provider</span>
          <select value={provider} onChange={(event) => switchProvider(event.target.value as ByokProvider)} className="mt-1 w-full rounded-card border border-cardamom bg-rice px-3 py-2">
            <option value="anthropic">Claude (Anthropic)</option>
            <option value="openai-compatible">OpenAI-compatible</option>
          </select>
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Model</span>
          <input value={model} onChange={(event) => setModel(event.target.value)} placeholder={provider === "anthropic" ? "claude-sonnet-4-6" : "model id"} className="mt-1 w-full rounded-card border border-cardamom bg-rice px-3 py-2" />
        </label>
        <label className="sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">API key</span>
          <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={provider === "anthropic" ? "sk-ant-…" : "sk-…"} autoComplete="off" className="mt-1 w-full rounded-card border border-cardamom bg-rice px-3 py-2" />
        </label>
        {provider === "openai-compatible" && (
          <label className="sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Base URL</span>
            <input value={baseUrl} onChange={(event) => {
              setBaseUrl(event.target.value);
              setTrustEndpoint(false);
            }} placeholder="https://api.openai.com/v1" className="mt-1 w-full rounded-card border border-cardamom bg-rice px-3 py-2" />
          </label>
        )}
      </div>

      {provider === "anthropic" ? (
        <p className="mt-2 rounded-card bg-rice-deep px-3 py-2 text-xs text-tamarind-soft">Your key will be sent directly to api.anthropic.com.</p>
      ) : disclosure ? (
        <div className="mt-2 rounded-card bg-rice-deep px-3 py-2 text-xs text-tamarind-soft">
          <p>{disclosure.warning}</p>
          {disclosure.requiresConfirmation && (
            <label className="mt-2 flex items-start gap-2">
              <input type="checkbox" checked={trustEndpoint} onChange={(event) => setTrustEndpoint(event.target.checked)} className="mt-0.5" />
              <span>I trust {disclosure.hostname} to receive this API key and my companion content.</span>
            </label>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-chilli">Enter a valid HTTPS endpoint. Plain HTTP is allowed only for localhost.</p>
      )}

      <label className="mt-3 flex items-start gap-2 rounded-card border border-cardamom p-3 text-xs">
        <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="mt-0.5" />
        <span><strong>Remember key on this device.</strong> This stores the raw key in this browser until you disconnect or clear browser data. Code running on this site could access it.</span>
      </label>
      <p className="mt-2 text-xs text-tamarind-faint">Photo check-ins require a vision-capable model. Provider usage may be billed to your account.</p>
      {error && <p className="mt-2 text-xs font-medium text-chilli">{error}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} disabled={!apiKey.trim() || !model.trim()} className="min-h-11 rounded-full bg-turmeric px-4 font-semibold text-tamarind disabled:opacity-40">Use key</button>
        {byok && <button onClick={onClear} className="min-h-11 px-2 text-xs text-chilli underline">Disconnect and forget key</button>}
      </div>
    </div>
  );
}

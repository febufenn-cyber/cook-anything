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
    "The hosted companion is temporarily unavailable while its security controls are being verified. Connect your own API key under ⚙️, or use normal Cook Mode.",
  bad_api_key: "The API key was rejected by the provider — check it under ⚙️.",
  invalid_endpoint: "That provider endpoint is invalid or unsafe. Use HTTPS, with no embedded password, query or fragment.",
  rate_limited: "Too many requests right now — wait a moment and try again.",
  overloaded: "The companion provider is overloaded — try again shortly.",
  busy: "The hosted kitchen is at capacity — try again shortly.",
  daily_limit: "The hosted companion has reached today’s safety limit. You can connect your own API key under ⚙️.",
  session_limit: "This hosted cooking session reached its turn limit. Close it and begin a fresh session.",
  session_expired: "That hosted session expired. I’ll start a fresh one when you send again.",
  hosted_text_only: "Hosted mode is text-only. Connect your own vision-capable API key under ⚙️ to send photos.",
  payload_too_large: "That request is too large.",
  recipe_not_found: "I couldn’t load the trusted cooking snapshot for this recipe.",
  forbidden: "This request was blocked by the companion’s security checks.",
};

async function compressImage(file: File): Promise<{ media_type: string; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  return { media_type: "image/jpeg", data: dataUrl.split(",")[1] };
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

interface Bubble {
  role: "user" | "assistant";
  text: string;
  imageUrl?: string;
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
  const [pendingPhoto, setPendingPhoto] = useState<{ media_type: string; data: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [byok, setByok] = useState<ByokConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHostedNotice, setShowHostedNotice] = useState(false);
  const [hostedNoticeAccepted, setHostedNoticeAccepted] = useState(false);

  const historyRef = useRef<ChatMessage[]>([]);
  const hostedSessionReadyRef = useRef(false);
  const hostedNoticeAcceptedRef = useRef(false);
  const stateRef = useRef<CompanionState>(initialCompanionState(companionRecipe));
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [, forceRender] = useState(0);
  const state = stateRef.current;

  useEffect(() => {
    setByok(loadByokConfig());
    try {
      const accepted = window.localStorage.getItem(HOSTED_NOTICE_KEY) === HOSTED_NOTICE_VERSION;
      hostedNoticeAcceptedRef.current = accepted;
      setHostedNoticeAccepted(accepted);
    } catch {
      hostedNoticeAcceptedRef.current = false;
    }
  }, []);

  useEffect(() => {
    hostedSessionReadyRef.current = false;
    stateRef.current = initialCompanionState(companionRecipe);
    historyRef.current = [];
    setBubbles([]);
  }, [companionRecipe]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    if ("wakeLock" in navigator) {
      (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<{ release: () => Promise<void> }> } })
        .wakeLock.request("screen")
        .then((lock) => { wakeLockRef.current = lock; })
        .catch(() => {});
    }
    return () => {
      document.body.style.overflow = "";
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
    };
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, busy, showHostedNotice]);

  function say(text: string) {
    if (!speak || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }

  function acceptState(next: CompanionState | null) {
    if (next && next.recipe_id === companionRecipe.recipe_id) {
      stateRef.current = next;
      forceRender((value) => value + 1);
    }
  }

  async function readJsonResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) throw new Error(ERROR_COPY.not_configured);
    return response.json() as Promise<T>;
  }

  async function closeHostedSession(): Promise<void> {
    if (!hostedSessionReadyRef.current) return;
    hostedSessionReadyRef.current = false;
    await fetch("/api/companion/session", { method: "DELETE" }).catch(() => undefined);
  }

  async function ensureHostedSession(): Promise<void> {
    if (hostedSessionReadyRef.current) return;
    const response = await fetch("/api/companion/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipe_id: companionRecipe.recipe_id }),
    });
    const data = await readJsonResponse<HostedSessionResponse>(response);
    if (!response.ok || data.error) throw new Error(ERROR_COPY[data.error ?? ""] ?? "Couldn’t start the hosted session.");
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
      return { response, data: await readJsonResponse<CompanionResponse>(response) };
    };
    let result = await execute();
    if (result.data.error === "session_expired") {
      hostedSessionReadyRef.current = false;
      await ensureHostedSession();
      result = await execute();
    }
    if (!result.response.ok || result.data.error) {
      throw new Error(ERROR_COPY[result.data.error ?? ""] ?? "Something went wrong — try again.");
    }
    return result.data;
  }

  async function send(text: string, photo?: { media_type: string; data: string } | null) {
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

    setBusy(true);
    setInput("");
    setPendingPhoto(null);
    const blocks: ChatContentBlock[] = [];
    if (photo) blocks.push({ type: "image", source: { type: "base64", ...photo } });
    blocks.push({ type: "text", text: trimmed || "Here’s a photo — what do you see?" });
    const userMessage: ChatMessage = { role: "user", content: photo ? blocks : trimmed };
    historyRef.current = [...historyRef.current, userMessage];
    setBubbles((current) => [
      ...current,
      {
        role: "user",
        text: trimmed || "📷 photo",
        ...(photo ? { imageUrl: `data:${photo.media_type};base64,${photo.data}` } : {}),
      },
    ]);

    try {
      const data = byok
        ? await sendDirectTurn(byok, companionRecipe, stateRef.current, leanHistory(historyRef.current))
        : await hostedTurn(trimmed);
      if (data.error === "not_configured") setShowSettings(true);
      if (data.error || !data.reply) throw new Error(ERROR_COPY[data.error ?? ""] ?? "Something went wrong — try again.");
      historyRef.current = [...historyRef.current, { role: "assistant", content: data.reply }];
      acceptState(data.state);
      setBubbles((current) => [...current, { role: "assistant", text: data.reply }]);
      say(data.reply);
    } catch (cause) {
      historyRef.current = historyRef.current.slice(0, -1);
      const message = cause instanceof Error ? cause.message : "Network hiccup — try again.";
      if (message === ERROR_COPY.not_configured) setShowSettings(true);
      setBubbles((current) => [...current, { role: "assistant", text: `⚠️ ${message}` }]);
    } finally {
      setBusy(false);
    }
  }

  function acceptHostedNotice() {
    hostedNoticeAcceptedRef.current = true;
    setHostedNoticeAccepted(true);
    setShowHostedNotice(false);
    try { window.localStorage.setItem(HOSTED_NOTICE_KEY, HOSTED_NOTICE_VERSION); } catch { /* session still allowed */ }
    if (bubbles.length === 0) {
      void send(`I’m cooking ${recipe.title} for ${recipe.servings}. I’m at the start — what’s my first move?`);
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
      setBubbles((current) => [...current, { role: "assistant", text: "⚠️ Voice input isn’t supported in this browser — type instead." }]);
      return;
    }
    const recognition = new Constructor();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(" ");
      setListening(false);
      void send(transcript);
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
      setBubbles((current) => [...current, { role: "assistant", text: "⚠️ Couldn’t read that photo — try another." }]);
    }
  }

  function start() {
    setOpen(true);
    if (bubbles.length > 0) return;
    if (!byok && !hostedNoticeAcceptedRef.current) {
      setShowHostedNotice(true);
      return;
    }
    void send(`I’m cooking ${recipe.title} for ${recipe.servings}. I’m at the start — what’s my first move?`);
  }

  if (!open) {
    return (
      <button
        onClick={start}
        className="no-print w-full rounded-card border-2 border-turmeric bg-card px-6 py-3 text-center font-semibold text-turmeric-deep shadow-lift transition-colors hover:bg-turmeric-tint sm:w-auto"
      >
        🍳 Cook with the companion
        <span className="ml-2 rounded-full bg-turmeric-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">beta</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-rice" role="dialog" aria-label={`Cooking ${recipe.title} with the companion`}>
      <div className="flex items-center justify-between gap-2 border-b border-cardamom px-4 py-3">
        <div className="min-w-0">
          <p className="font-display truncate text-lg leading-tight">{recipe.title}</p>
          <p className="truncate text-xs text-tamarind-faint">
            Stage: <span className="font-semibold text-turmeric-deep">{state.stage}</span>
            {" · "}serves {state.servings}
            {!byok && <span>{" · "}hosted text-only</span>}
            {byok?.remember && <span>{" · "}key remembered on device</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setShowSettings((value) => !value)}
            className={`relative rounded-full border px-3 py-1.5 text-sm font-medium ${showSettings ? "border-turmeric bg-turmeric-tint" : "border-cardamom bg-card"}`}
            aria-label="API key settings"
            title={byok ? `Using your key (${byok.provider})` : "Connect your API key"}
          >
            ⚙️
            {byok && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-curry" aria-hidden />}
          </button>
          <button
            onClick={() => setSpeak((value) => !value)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${speak ? "border-turmeric bg-turmeric-tint text-turmeric-deep" : "border-cardamom bg-card"}`}
            aria-pressed={speak}
            title="Read replies aloud"
          >
            {speak ? "🔊" : "🔇"}
          </button>
          <button onClick={() => setShowLedger((value) => !value)} className="rounded-full border border-cardamom bg-card px-3 py-1.5 text-sm font-medium">
            Swaps{state.substitution_ledger.length > 0 ? ` (${state.substitution_ledger.length})` : ""}
          </button>
          <button
            onClick={() => { void closeHostedSession(); setOpen(false); }}
            className="rounded-full border border-cardamom bg-card px-3 py-1.5 text-sm font-medium"
            aria-label="Close companion and erase hosted session"
          >✕</button>
        </div>
      </div>

      <div className="rail flex gap-1.5 overflow-x-auto px-4 pt-2" aria-hidden>
        {companionRecipe.stages.map((stage) => (
          <span key={stage} className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${stage === state.stage ? "bg-turmeric text-tamarind" : "bg-rice-deep text-tamarind-faint"}`}>
            {stage.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      <div className="mx-4 mt-2 rounded-card border border-cardamom bg-rice-deep/50 px-3 py-2 text-xs text-tamarind-soft">
        Allergen status: {companionRecipe.trust.allergen_status}. This is not an allergen-free guarantee. Check exact product labels before relying on any recipe or substitution.
      </div>

      {showHostedNotice && !byok && (
        <HostedConsent
          accepted={hostedNoticeAccepted}
          onAccept={acceptHostedNotice}
          onUseOwnKey={() => { setShowHostedNotice(false); setShowSettings(true); }}
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
              setBubbles((current) => [
                ...current,
                {
                  role: "assistant",
                  text: `Your ${saved.provider === "anthropic" ? "Anthropic" : "custom provider"} key is connected for this ${saved.remember ? "device" : "page session"}. Send a message when you’re ready.`,
                },
              ]);
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
            <p className="text-tamarind-faint">No swaps yet — every replacement can change allergens, so check its label.</p>
          ) : (
            <ul className="space-y-1">
              {state.substitution_ledger.map((entry, index) => (
                <li key={`${entry.original}-${index}`}>
                  <span className="font-medium">{entry.original}</span>
                  <span className="text-tamarind-soft"> → {entry.now}{entry.qty ? ` (${entry.qty})` : ""}</span>
                  {entry.constraint && <span className="block text-xs text-tamarind-faint">{entry.constraint}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-3">
          {bubbles.map((bubble, index) => (
            <div key={index} className={`flex ${bubble.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-card px-4 py-2.5 text-[15px] leading-relaxed ${bubble.role === "user" ? "bg-turmeric-tint text-tamarind" : "bg-card shadow-lift"}`}>
                {bubble.imageUrl && <img src={bubble.imageUrl} alt="Your kitchen" className="mb-2 max-h-48 rounded-lg" />}
                <p className="whitespace-pre-wrap">{bubble.text}</p>
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-card bg-card px-4 py-2.5 shadow-lift" aria-label="Companion is thinking">···</div>
            </div>
          )}
        </div>
      </div>

      <div className="rail flex gap-2 overflow-x-auto px-4 pb-2">
        {["Where am I?", "Done, what’s next?", "I don’t have an ingredient", "Something went wrong"].map((question) => (
          <button key={question} onClick={() => void send(question)} disabled={busy} className="shrink-0 rounded-full border border-cardamom bg-card px-3 py-1.5 text-xs font-medium text-tamarind-soft disabled:opacity-40">
            {question}
          </button>
        ))}
      </div>

      <div className="border-t border-cardamom p-3">
        {pendingPhoto && (
          <div className="mb-2 flex items-center gap-2 px-1">
            <img src={`data:${pendingPhoto.media_type};base64,${pendingPhoto.data}`} alt="Photo ready to send" className="h-12 w-12 rounded-lg object-cover" />
            <span className="text-xs text-tamarind-faint">Photo attached — add a question or send.</span>
            <button onClick={() => setPendingPhoto(null)} className="ml-auto text-xs underline">remove</button>
          </div>
        )}
        <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); void send(input, pendingPhoto); }}>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => void onPhotoPicked(event.target.files?.[0])} />
          <button
            type="button"
            onClick={() => byok ? fileRef.current?.click() : setShowSettings(true)}
            className="shrink-0 rounded-full border border-cardamom bg-card p-2.5 text-lg"
            aria-label={byok ? "Send a photo" : "Connect your own key to send photos"}
            title={byok ? "Show me your pan or ingredient" : "Hosted mode is text-only; connect your own key for photos"}
          >📷</button>
          <button type="button" onClick={toggleVoiceInput} className={`shrink-0 rounded-full border p-2.5 text-lg ${listening ? "border-chilli bg-chilli-tint" : "border-cardamom bg-card"}`} aria-label={listening ? "Stop listening" : "Speak instead of typing"} aria-pressed={listening}>
            {listening ? "⏹" : "🎤"}
          </button>
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={listening ? "Listening…" : "Ask, or say what happened…"} maxLength={2000} className="min-w-0 flex-1 rounded-full border border-cardamom bg-card px-4 py-2.5 text-[15px] outline-none focus:border-turmeric" enterKeyHint="send" />
          <button type="submit" disabled={busy || (!input.trim() && !pendingPhoto)} className="shrink-0 rounded-full bg-turmeric px-4 py-2.5 font-semibold text-tamarind disabled:opacity-40">Send</button>
        </form>
      </div>
    </div>
  );
}

function HostedConsent({
  accepted,
  onAccept,
  onUseOwnKey,
}: {
  accepted: boolean;
  onAccept: () => void;
  onUseOwnKey: () => void;
}) {
  return (
    <div className="border-b border-cardamom bg-card px-4 py-4 text-sm">
      <p className="font-semibold">Before using the hosted companion</p>
      <p className="mt-1 max-w-3xl text-tamarind-soft">
        Your text messages, selected recipe, recent conversation context and temporary cooking state may be processed through Cloudflare and the configured AI provider or private bridge. Hosted mode accepts no photos. Inactive hosted sessions are configured to be deleted after about two hours; closing this panel requests earlier deletion.
      </p>
      <p className="mt-2 text-xs text-tamarind-faint">
        The recipe is {accepted ? "already covered by the current notice" : "not cook-tested unless the trust panel explicitly says so"}. Do not send secrets, medical information or identity documents.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button onClick={onAccept} className="rounded-full bg-turmeric px-4 py-2 font-semibold text-tamarind">Continue with hosted text</button>
        <button onClick={onUseOwnKey} className="rounded-full border border-cardamom bg-rice px-4 py-2 font-semibold">Use my own key instead</button>
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
      if (!disclosure) return setError(ERROR_COPY.invalid_endpoint);
      if (disclosure.requiresConfirmation && !trustEndpoint) {
        return setError(`Confirm that you trust ${disclosure.hostname} before sending it your API key.`);
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
      <p className="mt-0.5 text-xs text-tamarind-faint">
        Calls go directly from this browser to the provider below. The key stays only in memory by default and disappears when this page session ends.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Provider</span>
          <select value={provider} onChange={(event) => switchProvider(event.target.value as ByokProvider)} className="mt-1 w-full rounded-card border border-cardamom bg-rice px-3 py-2">
            <option value="anthropic">Claude (Anthropic)</option>
            <option value="openai-compatible">OpenAI-compatible</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Model</span>
          <input value={model} onChange={(event) => setModel(event.target.value)} placeholder={provider === "anthropic" ? "claude-sonnet-4-6" : "model id"} className="mt-1 w-full rounded-card border border-cardamom bg-rice px-3 py-2" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">API key</span>
          <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={provider === "anthropic" ? "sk-ant-…" : "sk-…"} autoComplete="off" className="mt-1 w-full rounded-card border border-cardamom bg-rice px-3 py-2" />
        </label>
        {provider === "openai-compatible" && (
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Base URL</span>
            <input value={baseUrl} onChange={(event) => { setBaseUrl(event.target.value); setTrustEndpoint(false); }} placeholder="https://api.openai.com/v1" className="mt-1 w-full rounded-card border border-cardamom bg-rice px-3 py-2" />
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
              <span>I trust {disclosure.hostname} to receive and process this API key and my companion content.</span>
            </label>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-chilli">Enter a valid HTTPS endpoint. Plain HTTP is allowed only for localhost.</p>
      )}

      <label className="mt-3 flex items-start gap-2 rounded-card border border-cardamom p-3 text-xs">
        <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="mt-0.5" />
        <span>
          <strong>Remember key on this device.</strong> This stores the raw key in this browser until you disconnect it or clear browser data. Code running on this site could access it.
        </span>
      </label>
      <p className="mt-2 text-xs text-tamarind-faint">Photo check-ins require a vision-capable BYOK model. Provider usage may be billed to your account.</p>
      {error && <p className="mt-2 text-xs font-medium text-chilli">{error}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} disabled={!apiKey.trim() || !model.trim()} className="rounded-full bg-turmeric px-4 py-2 font-semibold text-tamarind disabled:opacity-40">Use key</button>
        {byok && <button onClick={onClear} className="text-xs text-chilli underline">Disconnect &amp; forget key</button>}
      </div>
    </div>
  );
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> }>) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

"use client";

/**
 * Cooking Companion: a live, hands-on cooking chat for one recipe.
 * Full-screen overlay (like CookMode) with photo check-ins, optional voice
 * in/out, the substitution ledger, and model-maintained session state.
 * Talks to POST /api/companion (Cloudflare Worker).
 */
import { useEffect, useRef, useState } from "react";
import type { Recipe } from "@/lib/types";
import type {
  ChatContentBlock,
  ChatMessage,
  CompanionRecipe,
  CompanionResponse,
  CompanionState,
} from "@/lib/companion/types";
import { initialCompanionState } from "@/lib/companion/types";
import {
  BYOK_DEFAULTS,
  loadByokConfig,
  saveByokConfig,
  sendDirectTurn,
  type ByokConfig,
  type ByokProvider,
} from "@/lib/companion/client";

const ERROR_COPY: Record<string, string> = {
  not_configured:
    "This site doesn't have a hosted companion key. Tap ⚙️ and connect your own API key — it stays in your browser.",
  bad_api_key: "The API key was rejected by the provider — check it under ⚙️.",
  rate_limited: "The kitchen is busy right now — give it a few seconds and try again.",
  overloaded: "The companion is overloaded right now — try again in a moment.",
  payload_too_large: "That photo is too large — try again; it should compress automatically.",
};

/** Downscale a photo to ≤1280px JPEG so payloads stay small on kitchen wifi. */
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

/** Strip image data from all but the last message to keep request bodies lean. */
function leanHistory(messages: ChatMessage[]): ChatMessage[] {
  const recent = messages.slice(-16);
  return recent.map((m, i) => {
    if (typeof m.content === "string" || i === recent.length - 1) return m;
    return {
      role: m.role,
      content: m.content.map((b): ChatContentBlock =>
        b.type === "image" ? { type: "text", text: "[photo sent earlier]" } : b,
      ),
    };
  });
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

  const historyRef = useRef<ChatMessage[]>([]);
  const stateRef = useRef<CompanionState>(initialCompanionState(companionRecipe));
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [, forceRender] = useState(0);
  const state = stateRef.current;

  useEffect(() => {
    setByok(loadByokConfig());
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    if ("wakeLock" in navigator) {
      (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } })
        .wakeLock.request("screen")
        .then((l) => { wakeLockRef.current = l; })
        .catch(() => {});
    }
    return () => {
      document.body.style.overflow = "";
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, busy]);

  function say(text: string) {
    if (!speak || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }

  async function send(text: string, photo?: { media_type: string; data: string } | null) {
    const trimmed = text.trim();
    if ((!trimmed && !photo) || busy) return;
    setBusy(true);
    setInput("");
    setPendingPhoto(null);

    const blocks: ChatContentBlock[] = [];
    if (photo) blocks.push({ type: "image", source: { type: "base64", ...photo } });
    blocks.push({ type: "text", text: trimmed || "Here's a photo — what do you see?" });
    const userMessage: ChatMessage = { role: "user", content: photo ? blocks : trimmed };
    historyRef.current = [...historyRef.current, userMessage];
    setBubbles((b) => [
      ...b,
      {
        role: "user",
        text: trimmed || "📷 photo",
        ...(photo ? { imageUrl: `data:${photo.media_type};base64,${photo.data}` } : {}),
      },
    ]);

    try {
      let data: CompanionResponse;
      if (byok) {
        // User's own key: straight from their browser to their provider.
        data = await sendDirectTurn(byok, companionRecipe, stateRef.current, leanHistory(historyRef.current));
      } else {
        const res = await fetch("/api/companion", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            recipe: companionRecipe,
            state: stateRef.current,
            messages: leanHistory(historyRef.current),
          }),
        });
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          // next dev / static preview without the Worker in front
          setShowSettings(true);
          throw new Error(ERROR_COPY.not_configured);
        }
        data = (await res.json()) as CompanionResponse;
      }
      if (data.error === "not_configured") setShowSettings(true);
      if (data.error || !data.reply) {
        throw new Error(ERROR_COPY[data.error ?? ""] ?? "Something went wrong — try that again.");
      }
      historyRef.current = [...historyRef.current, { role: "assistant", content: data.reply }];
      if (data.state && data.state.recipe_id === companionRecipe.recipe_id) {
        stateRef.current = data.state;
        forceRender((n) => n + 1);
      }
      setBubbles((b) => [...b, { role: "assistant", text: data.reply }]);
      say(data.reply);
    } catch (err) {
      // Failed turns don't poison the conversation history
      historyRef.current = historyRef.current.slice(0, -1);
      const message = err instanceof Error ? err.message : "Network hiccup — try again.";
      setBubbles((b) => [...b, { role: "assistant", text: `⚠️ ${message}` }]);
    } finally {
      setBusy(false);
    }
  }

  function toggleVoiceInput() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setBubbles((b) => [...b, { role: "assistant", text: "⚠️ Voice input isn't supported in this browser — type instead." }]);
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setListening(false);
      void send(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function onPhotoPicked(file: File | undefined) {
    if (!file) return;
    try {
      setPendingPhoto(await compressImage(file));
    } catch {
      setBubbles((b) => [...b, { role: "assistant", text: "⚠️ Couldn't read that photo — try another." }]);
    }
  }

  function start() {
    setOpen(true);
    if (bubbles.length === 0) {
      void send(
        `I'm cooking ${recipe.title} for ${recipe.servings}. I'm at the start — what's my first move?`,
      );
    }
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
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 border-b border-cardamom px-4 py-3">
        <div className="min-w-0">
          <p className="font-display truncate text-lg leading-tight">{recipe.title}</p>
          <p className="truncate text-xs text-tamarind-faint">
            Stage: <span className="font-semibold text-turmeric-deep">{state.stage}</span>
            {" · "}serves {state.servings}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`relative rounded-full border px-3 py-1.5 text-sm font-medium ${showSettings ? "border-turmeric bg-turmeric-tint" : "border-cardamom bg-card"}`}
            aria-label="API key settings"
            title={byok ? `Using your key (${byok.provider})` : "Connect your API key"}
          >
            ⚙️
            {byok && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-curry" aria-hidden />}
          </button>
          <button
            onClick={() => setSpeak((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${speak ? "border-turmeric bg-turmeric-tint text-turmeric-deep" : "border-cardamom bg-card"}`}
            aria-pressed={speak}
            title="Read replies aloud"
          >
            {speak ? "🔊" : "🔇"}
          </button>
          <button
            onClick={() => setShowLedger((v) => !v)}
            className="rounded-full border border-cardamom bg-card px-3 py-1.5 text-sm font-medium"
          >
            Swaps{state.substitution_ledger.length > 0 ? ` (${state.substitution_ledger.length})` : ""}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full border border-cardamom bg-card px-3 py-1.5 text-sm font-medium"
            aria-label="Close companion"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Stage strip */}
      <div className="rail flex gap-1.5 overflow-x-auto px-4 pt-2" aria-hidden>
        {companionRecipe.stages.map((s) => (
          <span
            key={s}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              s === state.stage ? "bg-turmeric text-tamarind" : "bg-rice-deep text-tamarind-faint"
            }`}
          >
            {s.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      {/* BYOK settings */}
      {showSettings && (
        <ByokSettings
          byok={byok}
          onSave={(cfg) => {
            saveByokConfig(cfg);
            setByok(cfg);
            setShowSettings(false);
          }}
          onClear={() => {
            saveByokConfig(null);
            setByok(null);
          }}
        />
      )}

      {/* Ledger drawer */}
      {showLedger && (
        <div className="border-b border-cardamom bg-turmeric-tint/40 px-4 py-3 text-sm">
          {state.substitution_ledger.length === 0 ? (
            <p className="text-tamarind-faint">No swaps yet — tell me what you&apos;re missing and we&apos;ll sort it.</p>
          ) : (
            <ul className="space-y-1">
              {state.substitution_ledger.map((entry, i) => (
                <li key={i}>
                  <span className="font-medium">{entry.original}</span>
                  <span className="text-tamarind-soft"> → {entry.now}{entry.qty ? ` (${entry.qty})` : ""}</span>
                  {entry.constraint && <span className="block text-xs text-tamarind-faint">{entry.constraint}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Chat thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-3">
          {bubbles.map((b, i) => (
            <div key={i} className={`flex ${b.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-card px-4 py-2.5 text-[15px] leading-relaxed ${
                  b.role === "user" ? "bg-turmeric-tint text-tamarind" : "bg-card shadow-lift"
                }`}
              >
                {b.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.imageUrl} alt="Your kitchen photo" className="mb-2 max-h-48 rounded-lg" />
                )}
                <p className="whitespace-pre-wrap">{b.text}</p>
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-card bg-card px-4 py-2.5 shadow-lift">
                <span className="inline-flex gap-1 text-tamarind-faint" aria-label="Companion is thinking">
                  <span className="animate-bounce">·</span>
                  <span className="animate-bounce [animation-delay:120ms]">·</span>
                  <span className="animate-bounce [animation-delay:240ms]">·</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="rail flex gap-2 overflow-x-auto px-4 pb-2">
        {["Where am I?", "Done, what's next?", "I don't have an ingredient", "Something went wrong"].map((q) => (
          <button
            key={q}
            onClick={() => void send(q)}
            disabled={busy}
            className="shrink-0 rounded-full border border-cardamom bg-card px-3 py-1.5 text-xs font-medium text-tamarind-soft disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-cardamom p-3">
        {pendingPhoto && (
          <div className="mb-2 flex items-center gap-2 px-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:${pendingPhoto.media_type};base64,${pendingPhoto.data}`}
              alt="Photo ready to send"
              className="h-12 w-12 rounded-lg object-cover"
            />
            <span className="text-xs text-tamarind-faint">Photo attached — add a question or just send.</span>
            <button onClick={() => setPendingPhoto(null)} className="ml-auto text-xs underline">remove</button>
          </div>
        )}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); void send(input, pendingPhoto); }}
        >
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => void onPhotoPicked(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="shrink-0 rounded-full border border-cardamom bg-card p-2.5 text-lg"
            aria-label="Send a photo"
            title="Show me your pan / ingredient"
          >
            📷
          </button>
          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`shrink-0 rounded-full border p-2.5 text-lg ${listening ? "border-chilli bg-chilli-tint" : "border-cardamom bg-card"}`}
            aria-label={listening ? "Stop listening" : "Speak instead of typing"}
            aria-pressed={listening}
          >
            {listening ? "⏹" : "🎤"}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? "Listening…" : "Ask, or say what happened…"}
            className="min-w-0 flex-1 rounded-full border border-cardamom bg-card px-4 py-2.5 text-[15px] outline-none focus:border-turmeric"
            enterKeyHint="send"
          />
          <button
            type="submit"
            disabled={busy || (!input.trim() && !pendingPhoto)}
            className="shrink-0 rounded-full bg-turmeric px-4 py-2.5 font-semibold text-tamarind disabled:opacity-40"
          >
            Send
          </button>
        </form>
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
  onSave: (cfg: ByokConfig) => void;
  onClear: () => void;
}) {
  const [provider, setProvider] = useState<ByokProvider>(byok?.provider ?? "anthropic");
  const [apiKey, setApiKey] = useState(byok?.apiKey ?? "");
  const [model, setModel] = useState(byok?.model ?? BYOK_DEFAULTS.anthropic.model);
  const [baseUrl, setBaseUrl] = useState(byok?.baseUrl ?? BYOK_DEFAULTS["openai-compatible"].baseUrl!);

  function switchProvider(p: ByokProvider) {
    setProvider(p);
    if (!byok || byok.provider !== p) setModel(BYOK_DEFAULTS[p].model);
  }

  return (
    <div className="border-b border-cardamom bg-card px-4 py-3 text-sm">
      <p className="font-semibold">Connect your API key</p>
      <p className="mt-0.5 text-xs text-tamarind-faint">
        Bring your own key from any compatible provider. It&apos;s stored only in this browser and sent
        only to your provider — never to this site.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Provider</span>
          <select
            value={provider}
            onChange={(e) => switchProvider(e.target.value as ByokProvider)}
            className="mt-1 w-full rounded-card border border-cardamom bg-rice px-3 py-2"
          >
            <option value="anthropic">Claude (Anthropic)</option>
            <option value="openai-compatible">OpenAI-compatible (OpenAI, OpenRouter, Groq…)</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Model</span>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={provider === "anthropic" ? "claude-sonnet-4-6" : "model id, e.g. gpt-5.5"}
            className="mt-1 w-full rounded-card border border-cardamom bg-rice px-3 py-2"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">API key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === "anthropic" ? "sk-ant-…" : "sk-…"}
            autoComplete="off"
            className="mt-1 w-full rounded-card border border-cardamom bg-rice px-3 py-2"
          />
        </label>
        {provider === "openai-compatible" && (
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Base URL</span>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="mt-1 w-full rounded-card border border-cardamom bg-rice px-3 py-2"
            />
          </label>
        )}
      </div>
      <p className="mt-2 text-xs text-tamarind-faint">
        Photo check-ins need a vision-capable model. Calls are pay-per-use on your provider account.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() =>
            onSave({
              provider,
              apiKey: apiKey.trim(),
              model: model.trim(),
              ...(provider === "openai-compatible" ? { baseUrl: baseUrl.trim() } : {}),
            })
          }
          disabled={!apiKey.trim() || !model.trim()}
          className="rounded-full bg-turmeric px-4 py-2 font-semibold text-tamarind disabled:opacity-40"
        >
          Save key
        </button>
        {byok && (
          <button onClick={onClear} className="text-xs text-chilli underline">
            Disconnect &amp; forget key
          </button>
        )}
      </div>
    </div>
  );
}

/* Minimal Web Speech API surface (not in TS DOM lib) */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

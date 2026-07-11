/**
 * Bring-your-own-key companion client. When the user connects their own API
 * key, companion turns go DIRECTLY from their browser to their provider —
 * the key is kept in localStorage on their device and never touches our
 * servers. Without a connected key, the UI falls back to the site-hosted
 * Worker endpoint (/api/companion), which a deployment may or may not have
 * configured.
 *
 * Two provider shapes cover practically everything:
 *  - "anthropic": the Claude API (CORS-enabled for BYOK browser apps via the
 *    anthropic-dangerous-direct-browser-access header).
 *  - "openai-compatible": any /chat/completions endpoint — OpenAI,
 *    OpenRouter, Groq, a local Ollama/LM Studio, etc.
 */
import type {
  ChatContentBlock,
  ChatMessage,
  CompanionRecipe,
  CompanionResponse,
  CompanionState,
} from "./types";
import { buildRecipeSystemText, buildStateSystemText, parseStateBlock } from "./prompt";

export type ByokProvider = "anthropic" | "openai-compatible";

export interface ByokConfig {
  provider: ByokProvider;
  apiKey: string;
  model: string;
  /** Only for openai-compatible; no trailing slash, e.g. https://api.openai.com/v1 */
  baseUrl?: string;
}

export const BYOK_DEFAULTS: Record<ByokProvider, { model: string; baseUrl?: string }> = {
  anthropic: { model: "claude-sonnet-4-6" },
  "openai-compatible": { model: "", baseUrl: "https://api.openai.com/v1" },
};

const STORAGE_KEY = "cook-anything.companion.byok";

export function loadByokConfig(): ByokConfig | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as ByokConfig;
    return cfg.apiKey && cfg.model && cfg.provider ? cfg : null;
  } catch {
    return null;
  }
}

export function saveByokConfig(cfg: ByokConfig | null): void {
  try {
    if (cfg) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode) — session-only usage still works upstream */
  }
}

function errorForStatus(status: number): string {
  if (status === 401 || status === 403) return "bad_api_key";
  if (status === 429) return "rate_limited";
  if (status === 529) return "overloaded";
  return "upstream_error";
}

async function anthropicTurn(
  cfg: ByokConfig,
  recipe: CompanionRecipe,
  state: CompanionState,
  messages: ChatMessage[],
): Promise<CompanionResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 700,
      system: [
        { type: "text", text: buildRecipeSystemText(recipe), cache_control: { type: "ephemeral" } },
        { type: "text", text: buildStateSystemText(state) },
      ],
      messages,
    }),
  });
  if (!res.ok) return { reply: "", state: null, error: errorForStatus(res.status) };
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const rawText = data.content.filter((b) => b.type === "text" && b.text).map((b) => b.text).join("\n");
  return { ...parseStateBlock(rawText) };
}

type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function toOpenAiContent(content: string | ChatContentBlock[]): string | OpenAiContentPart[] {
  if (typeof content === "string") return content;
  return content.map((b): OpenAiContentPart =>
    b.type === "text"
      ? { type: "text", text: b.text }
      : { type: "image_url", image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } },
  );
}

async function openAiCompatibleTurn(
  cfg: ByokConfig,
  recipe: CompanionRecipe,
  state: CompanionState,
  messages: ChatMessage[],
): Promise<CompanionResponse> {
  const baseUrl = (cfg.baseUrl || BYOK_DEFAULTS["openai-compatible"].baseUrl!).replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: `${buildRecipeSystemText(recipe)}\n\n${buildStateSystemText(state)}` },
        ...messages.map((m) => ({ role: m.role, content: toOpenAiContent(m.content) })),
      ],
    }),
  });
  if (!res.ok) return { reply: "", state: null, error: errorForStatus(res.status) };
  const data = (await res.json()) as {
    choices?: { message?: { content?: string | { type: string; text?: string }[] } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  const rawText =
    typeof content === "string"
      ? content
      : (content ?? []).filter((p) => p.type === "text" && p.text).map((p) => p.text).join("\n");
  if (!rawText) return { reply: "", state: null, error: "upstream_error" };
  return { ...parseStateBlock(rawText) };
}

/** One companion turn straight from the browser using the user's own key. */
export async function sendDirectTurn(
  cfg: ByokConfig,
  recipe: CompanionRecipe,
  state: CompanionState,
  messages: ChatMessage[],
): Promise<CompanionResponse> {
  return cfg.provider === "anthropic"
    ? anthropicTurn(cfg, recipe, state, messages)
    : openAiCompatibleTurn(cfg, recipe, state, messages);
}

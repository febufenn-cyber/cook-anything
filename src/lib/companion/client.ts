/**
 * Bring-your-own-key companion client. Calls go directly from the browser to
 * the selected provider. Keys live only in memory unless the user explicitly
 * chooses to remember the key on this device.
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
  /** True only when the user explicitly opted into persistent browser storage. */
  remember?: boolean;
}

export interface ByokEndpointDisclosure {
  normalizedUrl: string;
  hostname: string;
  requiresConfirmation: boolean;
  warning: string;
}

export const BYOK_DEFAULTS: Record<ByokProvider, { model: string; baseUrl?: string }> = {
  anthropic: { model: "claude-sonnet-4-6" },
  "openai-compatible": { model: "", baseUrl: "https://api.openai.com/v1" },
};

const STORAGE_KEY = "cook-anything.companion.byok.v2";
const LEGACY_STORAGE_KEY = "cook-anything.companion.byok";
let sessionConfig: ByokConfig | null = null;

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

export function inspectByokEndpoint(baseUrl: string): ByokEndpointDisclosure {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl.trim());
  } catch {
    throw new Error("invalid_endpoint");
  }
  if (parsed.username || parsed.password || parsed.hash || parsed.search) throw new Error("invalid_endpoint");
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback(parsed.hostname))) {
    throw new Error("invalid_endpoint");
  }
  const normalizedUrl = parsed.toString().replace(/\/$/, "");
  const knownOpenAi = parsed.protocol === "https:" && parsed.hostname === "api.openai.com";
  return {
    normalizedUrl,
    hostname: parsed.hostname,
    requiresConfirmation: !knownOpenAi,
    warning: knownOpenAi
      ? "Your key will be sent directly from this browser to api.openai.com."
      : `Your key will be sent directly from this browser to ${parsed.hostname}. Only continue if you trust that server.`,
  };
}

export function normalizeByokConfig(config: ByokConfig): ByokConfig {
  if (config.provider !== "anthropic" && config.provider !== "openai-compatible") throw new Error("invalid_endpoint");
  const apiKey = config.apiKey.trim();
  const model = config.model.trim();
  if (!apiKey || !model || apiKey.length > 1_000 || model.length > 200) throw new Error("invalid_endpoint");
  if (config.provider === "anthropic") {
    return { provider: "anthropic", apiKey, model, remember: Boolean(config.remember) };
  }
  const disclosure = inspectByokEndpoint(config.baseUrl || BYOK_DEFAULTS["openai-compatible"].baseUrl!);
  return {
    provider: "openai-compatible",
    apiKey,
    model,
    baseUrl: disclosure.normalizedUrl,
    remember: Boolean(config.remember),
  };
}

export function loadByokConfig(): ByokConfig | null {
  if (sessionConfig) return sessionConfig;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Remove the legacy always-persistent key rather than silently retaining it.
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      return null;
    }
    const parsed = JSON.parse(raw) as ByokConfig;
    const config = normalizeByokConfig({ ...parsed, remember: true });
    sessionConfig = config;
    return config;
  } catch {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* unavailable */ }
    return null;
  }
}

export function saveByokConfig(config: ByokConfig | null, remember = false): ByokConfig | null {
  if (!config) {
    sessionConfig = null;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch { /* storage unavailable */ }
    return null;
  }

  const normalized = normalizeByokConfig({ ...config, remember });
  sessionConfig = normalized;
  try {
    if (remember) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    else window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // The in-memory session remains usable even when persistent storage fails.
  }
  return normalized;
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
  const rawText = data.content.filter((block) => block.type === "text" && block.text).map((block) => block.text).join("\n");
  return { ...parseStateBlock(rawText) };
}

type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function toOpenAiContent(content: string | ChatContentBlock[]): string | OpenAiContentPart[] {
  if (typeof content === "string") return content;
  return content.map((block): OpenAiContentPart =>
    block.type === "text"
      ? { type: "text", text: block.text }
      : { type: "image_url", image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` } },
  );
}

async function openAiCompatibleTurn(
  cfg: ByokConfig,
  recipe: CompanionRecipe,
  state: CompanionState,
  messages: ChatMessage[],
): Promise<CompanionResponse> {
  const disclosure = inspectByokEndpoint(cfg.baseUrl || BYOK_DEFAULTS["openai-compatible"].baseUrl!);
  const res = await fetch(`${disclosure.normalizedUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: `${buildRecipeSystemText(recipe)}\n\n${buildStateSystemText(state)}` },
        ...messages.map((message) => ({ role: message.role, content: toOpenAiContent(message.content) })),
      ],
    }),
  });
  if (!res.ok) return { reply: "", state: null, error: errorForStatus(res.status) };
  const data = (await res.json()) as {
    choices?: { message?: { content?: string | { type: string; text?: string }[] } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  const rawText = typeof content === "string"
    ? content
    : (content ?? []).filter((part) => part.type === "text" && part.text).map((part) => part.text).join("\n");
  if (!rawText) return { reply: "", state: null, error: "upstream_error" };
  return { ...parseStateBlock(rawText) };
}

export async function sendDirectTurn(
  config: ByokConfig,
  recipe: CompanionRecipe,
  state: CompanionState,
  messages: ChatMessage[],
): Promise<CompanionResponse> {
  let cfg: ByokConfig;
  try {
    cfg = normalizeByokConfig(config);
  } catch {
    return { reply: "", state: null, error: "invalid_endpoint" };
  }
  return cfg.provider === "anthropic"
    ? anthropicTurn(cfg, recipe, state, messages)
    : openAiCompatibleTurn(cfg, recipe, state, messages);
}

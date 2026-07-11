import { buildRecipeSystemText, buildStateSystemText, parseStateBlock } from "../src/lib/companion/prompt";
import type {
  ChatMessage,
  CompanionState,
  TrustedCompanionRecipe,
} from "../src/lib/companion/types";
import type { Env } from "./env";
import { sha256Hex } from "./security";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 700;
const UPSTREAM_TIMEOUT_MS = 90_000;
const MAX_UPSTREAM_TEXT_CHARS = 100_000;

export interface ExecutionResult {
  reply: string;
  candidateState: CompanionState | null;
  backendSessionId?: string;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeProviderError(status: number): string {
  if (status === 401 || status === 403) return "upstream_auth";
  if (status === 429) return "rate_limited";
  if (status === 529) return "overloaded";
  return "upstream_error";
}

async function executeThroughBridge(
  env: Env,
  recipe: TrustedCompanionRecipe,
  state: CompanionState,
  message: string,
  backendSessionId?: string,
): Promise<ExecutionResult> {
  if (!env.COMPANION_UPSTREAM || !env.COMPANION_UPSTREAM_SIGNING_SECRET) {
    throw new Error("bridge_not_configured");
  }

  const requestId = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1_000).toString();
  const body = JSON.stringify({
    schema_version: 1,
    request_id: requestId,
    system: buildRecipeSystemText(recipe),
    state_system: buildStateSystemText(state),
    message,
    backend_session_id: backendSessionId ?? null,
  });
  const bodyHash = await sha256Hex(body);
  const signature = await hmacSha256Hex(
    env.COMPANION_UPSTREAM_SIGNING_SECRET,
    `${requestId}.${timestamp}.${bodyHash}`,
  );

  let response: Response;
  try {
    response = await fetchWithTimeout(`${env.COMPANION_UPSTREAM.replace(/\/$/, "")}/turn`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
        "x-timestamp": timestamp,
        "x-body-sha256": bodyHash,
        "x-signature": signature,
      },
      body,
    });
  } catch {
    throw new Error("upstream_error");
  }

  const data = (await response.json().catch(() => null)) as
    | { result?: unknown; backend_session_id?: unknown; error?: unknown }
    | null;
  if (!response.ok || !data || typeof data.result !== "string") {
    const error = typeof data?.error === "string" ? data.error : normalizeProviderError(response.status);
    throw new Error(error);
  }
  if (data.result.length > MAX_UPSTREAM_TEXT_CHARS) throw new Error("upstream_error");

  const parsed = parseStateBlock(data.result);
  return {
    reply: parsed.reply,
    candidateState: parsed.state,
    ...(typeof data.backend_session_id === "string" && data.backend_session_id.length <= 200
      ? { backendSessionId: data.backend_session_id }
      : {}),
  };
}

async function executeThroughAnthropic(
  env: Env,
  recipe: TrustedCompanionRecipe,
  state: CompanionState,
  history: ChatMessage[],
  message: string,
): Promise<ExecutionResult> {
  if (!env.ANTHROPIC_API_KEY) throw new Error("not_configured");

  let response: Response;
  try {
    response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.COMPANION_MODEL || DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: "text",
            text: buildRecipeSystemText(recipe),
            cache_control: { type: "ephemeral" },
          },
          { type: "text", text: buildStateSystemText(state) },
        ],
        messages: [...history, { role: "user", content: message }],
      }),
    });
  } catch {
    throw new Error("upstream_error");
  }

  if (!response.ok) throw new Error(normalizeProviderError(response.status));
  const data = (await response.json()) as { content?: { type?: unknown; text?: unknown }[] };
  const rawText = (data.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n");
  if (!rawText || rawText.length > MAX_UPSTREAM_TEXT_CHARS) throw new Error("upstream_error");

  const parsed = parseStateBlock(rawText);
  return { reply: parsed.reply, candidateState: parsed.state };
}

/**
 * Executes one text-only hosted turn. The caller owns recipe resolution,
 * session history, idempotency, state validation, and global capacity leases.
 */
export async function executeHostedTurn(
  env: Env,
  recipe: TrustedCompanionRecipe,
  state: CompanionState,
  history: ChatMessage[],
  message: string,
  backendSessionId?: string,
): Promise<ExecutionResult> {
  return env.COMPANION_UPSTREAM
    ? executeThroughBridge(env, recipe, state, message, backendSessionId)
    : executeThroughAnthropic(env, recipe, state, history, message);
}

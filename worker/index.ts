/**
 * Cook Anything Worker: serves the static export (ASSETS binding) and hosts
 * POST /api/companion — the Cooking Companion endpoint. The Anthropic API key
 * lives here as a secret (`wrangler secret put ANTHROPIC_API_KEY`); nothing
 * key-shaped ever reaches the client.
 */
import { buildRecipeSystemText, buildStateSystemText, parseStateBlock } from "../src/lib/companion/prompt";
import type { CompanionRequest, CompanionResponse } from "../src/lib/companion/types";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  ANTHROPIC_API_KEY?: string;
  /** Override the default model without a redeploy of code */
  COMPANION_MODEL?: string;
  /**
   * Subscription bridge (bridge/server.mjs on a VPS): when set, turns are
   * proxied there and run through headless Claude Code on a Claude
   * subscription instead of the API. e.g. https://companion-bridge.robofox.online
   */
  COMPANION_UPSTREAM?: string;
  COMPANION_UPSTREAM_TOKEN?: string;
}

const MAX_BODY_BYTES = 2_500_000; // one downscaled photo + history, generously
const MAX_MESSAGES = 40;
const MAX_TOKENS = 700;
const DEFAULT_MODEL = "claude-sonnet-4-6";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function jsonResponse(body: CompanionResponse, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/** Subscription mode: proxy the turn to the VPS bridge running Claude Code. */
async function bridgeTurn(env: Env, body: CompanionRequest): Promise<Response> {
  const upstream = env.COMPANION_UPSTREAM!.replace(/\/$/, "");
  let res: globalThis.Response;
  try {
    res = await fetch(`${upstream}/turn`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-bridge-token": env.COMPANION_UPSTREAM_TOKEN ?? "",
      },
      body: JSON.stringify({
        system: buildRecipeSystemText(body.recipe),
        state_system: buildStateSystemText(body.state),
        messages: body.messages,
        bridge_session_id: body.bridge_session_id ?? null,
      }),
    });
  } catch {
    return jsonResponse({ reply: "", state: null, error: "upstream_error" }, 502);
  }
  const data = (await res.json().catch(() => null)) as
    | { result?: string; session_id?: string | null; error?: string }
    | null;
  if (!res.ok || !data || data.error || !data.result) {
    return jsonResponse({ reply: "", state: null, error: data?.error ?? "upstream_error" }, 502);
  }
  const { reply, state } = parseStateBlock(data.result);
  return jsonResponse({ reply, state, ...(data.session_id ? { bridge_session_id: data.session_id } : {}) });
}

async function handleCompanion(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ reply: "", state: null, error: "method_not_allowed" }, 405);
  }
  if (!env.COMPANION_UPSTREAM && !env.ANTHROPIC_API_KEY) {
    return jsonResponse({ reply: "", state: null, error: "not_configured" }, 503);
  }
  const bodyText = await request.text();
  if (bodyText.length > MAX_BODY_BYTES) {
    return jsonResponse({ reply: "", state: null, error: "payload_too_large" }, 413);
  }

  let body: CompanionRequest;
  try {
    body = JSON.parse(bodyText) as CompanionRequest;
  } catch {
    return jsonResponse({ reply: "", state: null, error: "bad_json" }, 400);
  }
  if (!body?.recipe?.recipe_id || !Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonResponse({ reply: "", state: null, error: "bad_request" }, 400);
  }
  const messages = body.messages.slice(-MAX_MESSAGES);

  if (env.COMPANION_UPSTREAM) {
    return bridgeTurn(env, { ...body, messages });
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
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
          text: buildRecipeSystemText(body.recipe),
          // The prompt + recipe are identical across a session's turns — cache them.
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: buildStateSystemText(body.state) },
      ],
      messages,
    }),
  });

  if (!anthropicRes.ok) {
    const status = anthropicRes.status;
    const error =
      status === 401 ? "bad_api_key" : status === 429 ? "rate_limited" : status === 529 ? "overloaded" : "upstream_error";
    return jsonResponse({ reply: "", state: null, error }, status === 429 || status === 529 ? 503 : 502);
  }

  const data = (await anthropicRes.json()) as {
    content: { type: string; text?: string }[];
  };
  const rawText = data.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n");
  const { reply, state } = parseStateBlock(rawText);
  return jsonResponse({ reply, state });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/companion") {
      try {
        return await handleCompanion(request, env);
      } catch {
        return jsonResponse({ reply: "", state: null, error: "internal" }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};

import type { CompanionResponse, HostedSessionResponse } from "../src/lib/companion/types";
import { CompanionGate, CompanionSession } from "./companion-session";
import type { Env } from "./env";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  jsonResponse,
  parseCookie,
  readSmallJson,
  sessionCookie,
  sha256Hex,
  validateRecipeId,
  validateTrustedRecipe,
  validateTurnInput,
} from "./security";

export { CompanionGate, CompanionSession };

function hostedCompanionEnabled(env: Env): boolean {
  return env.HOSTED_COMPANION_ENABLED === "true";
}

function boundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function sessionTtl(env: Env): number {
  return boundedInt(env.COMPANION_SESSION_TTL_SECONDS, 7_200, 300, 86_400);
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function hostedDisabledResponse(): Response {
  return jsonResponse({ reply: "", state: null, error: "not_configured" }, 503);
}

async function rateLimitKey(scope: string, subject: string): Promise<string> {
  return `${scope}:${await sha256Hex(subject)}`;
}

function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

async function loadTrustedRecipe(request: Request, env: Env, recipeId: string) {
  const assetUrl = new URL(`/companion-recipes/${recipeId}.json`, request.url);
  const assetResponse = await env.ASSETS.fetch(new Request(assetUrl.toString(), {
    headers: { accept: "application/json" },
  }));
  if (!assetResponse.ok) return null;
  const raw = await assetResponse.json().catch(() => null);
  return validateTrustedRecipe(raw, recipeId);
}

async function handleCreateSession(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ state: null, error: "method_not_allowed" }, 405);
  if (!hostedCompanionEnabled(env)) return hostedDisabledResponse();
  if (!sameOrigin(request)) return jsonResponse({ state: null, error: "forbidden" }, 403);

  const createLimit = await env.COMPANION_SESSION_RATE_LIMITER.limit({
    key: await rateLimitKey("session-create-ip", clientIp(request)),
  });
  if (!createLimit.success) return jsonResponse({ state: null, error: "rate_limited" }, 429);

  let raw: unknown;
  try {
    raw = await readSmallJson(request, 1_024);
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "bad_request";
    return jsonResponse({ state: null, error }, error === "payload_too_large" ? 413 : 400);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return jsonResponse({ state: null, error: "bad_request" }, 400);
  }
  const record = raw as Record<string, unknown>;
  if (Object.keys(record).length !== 1) return jsonResponse({ state: null, error: "bad_request" }, 400);
  const recipeId = validateRecipeId(record.recipe_id);
  if (!recipeId) return jsonResponse({ state: null, error: "bad_request" }, 400);

  const recipe = await loadTrustedRecipe(request, env, recipeId);
  if (!recipe) return jsonResponse({ state: null, error: "recipe_not_found" }, 404);

  const sessionId = crypto.randomUUID();
  const session = env.COMPANION_SESSIONS.get(env.COMPANION_SESSIONS.idFromName(sessionId));
  const initialized = await session.fetch("https://companion-session/initialize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(recipe),
  });
  const body = (await initialized.json().catch(() => null)) as HostedSessionResponse | null;
  if (!initialized.ok || !body) return jsonResponse({ state: null, error: body?.error ?? "internal" }, 500);

  return jsonResponse(body, 201, { "set-cookie": sessionCookie(sessionId, sessionTtl(env)) });
}

async function handleTurn(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ reply: "", state: null, error: "method_not_allowed" }, 405);
  if (!hostedCompanionEnabled(env)) return hostedDisabledResponse();
  if (!sameOrigin(request)) return jsonResponse({ reply: "", state: null, error: "forbidden" }, 403);

  const sessionId = parseCookie(request, SESSION_COOKIE);
  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return jsonResponse(
      { reply: "", state: null, error: "session_expired" },
      401,
      { "set-cookie": clearSessionCookie() },
    );
  }

  const [ipLimit, sessionLimit] = await Promise.all([
    env.COMPANION_TURN_RATE_LIMITER.limit({
      key: await rateLimitKey("turn-ip", clientIp(request)),
    }),
    env.COMPANION_TURN_RATE_LIMITER.limit({
      key: await rateLimitKey("turn-session", sessionId),
    }),
  ]);
  if (!ipLimit.success || !sessionLimit.success) {
    return jsonResponse({ reply: "", state: null, error: "rate_limited" }, 429);
  }

  let raw: unknown;
  try {
    raw = await readSmallJson(request);
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "bad_request";
    return jsonResponse({ reply: "", state: null, error }, error === "payload_too_large" ? 413 : 400);
  }
  const input = validateTurnInput(raw);
  if (!input) return jsonResponse({ reply: "", state: null, error: "bad_request" }, 400);

  const session = env.COMPANION_SESSIONS.get(env.COMPANION_SESSIONS.idFromName(sessionId));
  const response = await session.fetch("https://companion-session/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const headers = new Headers(response.headers);
  headers.set(
    "set-cookie",
    response.status === 401 ? clearSessionCookie() : sessionCookie(sessionId, sessionTtl(env)),
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleCloseSession(request: Request, env: Env): Promise<Response> {
  if (request.method !== "DELETE") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!sameOrigin(request)) return jsonResponse({ error: "forbidden" }, 403);

  const sessionId = parseCookie(request, SESSION_COOKIE);
  if (sessionId && /^[0-9a-f-]{36}$/i.test(sessionId)) {
    const session = env.COMPANION_SESSIONS.get(env.COMPANION_SESSIONS.idFromName(sessionId));
    await session.fetch("https://companion-session/close", { method: "DELETE" }).catch(() => undefined);
  }
  return jsonResponse({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
}

function legacyCompanionResponse(env: Env): Response {
  if (!hostedCompanionEnabled(env)) return hostedDisabledResponse();
  const body: CompanionResponse = { reply: "", state: null, error: "session_api_required" };
  return jsonResponse(body, 426);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/companion/session") {
        return request.method === "DELETE"
          ? handleCloseSession(request, env)
          : handleCreateSession(request, env);
      }
      if (url.pathname === "/api/companion/turn") return handleTurn(request, env);
      if (url.pathname === "/api/companion") return legacyCompanionResponse(env);
      if (url.pathname === "/api/bridge-origin") {
        return jsonResponse({ error: "quick_tunnel_discovery_removed" }, 410);
      }
      return env.ASSETS.fetch(request);
    } catch {
      if (url.pathname.startsWith("/api/companion")) {
        return jsonResponse({ reply: "", state: null, error: "internal" }, 500);
      }
      return jsonResponse({ error: "internal" }, 500);
    }
  },
};

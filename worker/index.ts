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

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
].join("; ");

function hostedCompanionEnabled(env: Env): boolean {
  return env.HOSTED_COMPANION_ENABLED === "true";
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The private subscription bridge announces its current quick-tunnel origin
 * here, signed with the shared HMAC secret (COMPANION_UPSTREAM_SIGNING_SECRET).
 * The URL is public but useless without a valid signature — security rests on
 * the HMAC, not on hiding the URL. The Worker persists the origin to KV, which
 * executeHostedTurn reads. Only trycloudflare origins are accepted.
 */
async function handleBridgeOrigin(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  const secret = env.COMPANION_UPSTREAM_SIGNING_SECRET;
  if (!secret || !env.COMPANION_CONFIG) return jsonResponse({ error: "not_configured" }, 503);

  let body: unknown;
  try {
    body = await readSmallJson(request, 512);
  } catch {
    return jsonResponse({ error: "bad_request" }, 400);
  }
  const origin = (body as { origin?: unknown })?.origin;
  const timestamp = request.headers.get("x-timestamp");
  const signature = request.headers.get("x-signature");
  if (typeof origin !== "string" || !timestamp || !signature) return jsonResponse({ error: "bad_request" }, 400);
  if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin)) return jsonResponse({ error: "bad_origin" }, 400);

  const ts = Number(timestamp);
  if (!Number.isInteger(ts) || Math.abs(Math.floor(Date.now() / 1_000) - ts) > 120) {
    return jsonResponse({ error: "expired" }, 401);
  }
  const expected = await hmacSha256Hex(secret, `${timestamp}.${origin}`);
  if (!timingSafeEqualHex(signature, expected)) return jsonResponse({ error: "unauthorized" }, 401);

  await env.COMPANION_CONFIG.put("companion_bridge_origin", origin);
  return jsonResponse({ ok: true }, 200);
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

function secureAssetResponse(response: Response, pathname = "/"): Response {
  const headers = new Headers(response.headers);
  // Content-hashed build assets are safe to cache aggressively; everything
  // else keeps the asset layer's conservative revalidation defaults.
  if (pathname.startsWith("/_next/static/")) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  }
  headers.set("content-security-policy", CONTENT_SECURITY_POLICY);
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("permissions-policy", "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()");
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-resource-policy", "same-origin");
  if (new URL(response.url || "https://assets.invalid").protocol === "https:") {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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
      if (url.pathname === "/api/companion/bridge-origin") {
        return handleBridgeOrigin(request, env);
      }
      if (url.pathname === "/api/bridge-origin") {
        return jsonResponse({ error: "quick_tunnel_discovery_removed" }, 410);
      }
      return secureAssetResponse(await env.ASSETS.fetch(request), url.pathname);
    } catch {
      if (url.pathname.startsWith("/api/companion")) {
        return jsonResponse({ reply: "", state: null, error: "internal" }, 500);
      }
      return jsonResponse({ error: "internal" }, 500);
    }
  },
};

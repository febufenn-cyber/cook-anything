"use client";

import { assertSyncPayloadSafe } from "./security";
import type { AuthSession, AuthUser } from "./types";

const SESSION_KEY = "cook-anything.auth.session";
const PKCE_KEY = "cook-anything.auth.pkce-verifier";
const AUTH_EVENT = "cook-anything:auth";

interface RawAuthUser {
  id?: unknown;
  email?: unknown;
  user_metadata?: { full_name?: unknown; name?: unknown };
}

interface RawAuthResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  expires_at?: unknown;
  token_type?: unknown;
  user?: RawAuthUser;
}

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "") ?? "";
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || ""
  ).trim();
  return { url, key };
}

export function isCloudSyncConfigured(): boolean {
  const { url, key } = config();
  try {
    return Boolean(key && new URL(url).protocol === "https:");
  } catch {
    return false;
  }
}

function authHeaders(accessToken?: string): HeadersInit {
  const { key } = config();
  return {
    apikey: key,
    "content-type": "application/json",
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function responseJson(response: Response): Promise<unknown> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const object = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const message = [object.msg, object.message, object.error_description, object.error]
      .find((item): item is string => typeof item === "string") ?? `cloud_request_failed_${response.status}`;
    throw new Error(message.slice(0, 240));
  }
  return data;
}

function parseUser(raw: RawAuthUser | undefined): AuthUser {
  if (!raw || typeof raw.id !== "string") throw new Error("invalid_auth_user");
  const metadata = raw.user_metadata ?? {};
  const displayName = [metadata.full_name, metadata.name].find((item): item is string => typeof item === "string") ?? null;
  return {
    id: raw.id,
    email: typeof raw.email === "string" ? raw.email : null,
    displayName,
  };
}

function parseAuthResponse(raw: unknown): AuthSession {
  if (!raw || typeof raw !== "object") throw new Error("invalid_auth_response");
  const value = raw as RawAuthResponse;
  if (typeof value.access_token !== "string" || typeof value.refresh_token !== "string") throw new Error("invalid_auth_response");
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const expiresAt = typeof value.expires_at === "number"
    ? value.expires_at
    : nowSeconds + (typeof value.expires_in === "number" ? value.expires_in : 3_600);
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresAt,
    tokenType: typeof value.token_type === "string" ? value.token_type : "bearer",
    user: parseUser(value.user),
  };
}

function emitAuth(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EVENT));
}

export function subscribeAuth(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const storage = (event: StorageEvent) => {
    if (event.key === SESSION_KEY) listener();
  };
  window.addEventListener(AUTH_EVENT, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(AUTH_EVENT, listener);
    window.removeEventListener("storage", storage);
  };
}

/** Auth tokens are intentionally validated separately and are never accepted as sync payloads. */
export function loadStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? "null") as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const session = value as Partial<AuthSession>;
    if (typeof session.accessToken !== "string" || session.accessToken.length > 20_000) return null;
    if (typeof session.refreshToken !== "string" || session.refreshToken.length > 20_000) return null;
    if (typeof session.expiresAt !== "number" || !Number.isFinite(session.expiresAt)) return null;
    if (session.tokenType !== "bearer" && session.tokenType !== "Bearer") return null;
    if (!session.user || typeof session.user.id !== "string" || session.user.id.length > 100) return null;
    if (session.user.email !== null && typeof session.user.email !== "string") return null;
    if (session.user.displayName !== null && typeof session.user.displayName !== "string") return null;
    return session as AuthSession;
  } catch {
    return null;
  }
}

function saveSession(session: AuthSession): AuthSession {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    emitAuth();
  }
  return session;
}

export function clearStoredSession(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(PKCE_KEY);
    emitAuth();
  }
}

async function fetchUser(accessToken: string): Promise<AuthUser> {
  const { url } = config();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: authHeaders(accessToken),
    cache: "no-store",
  });
  return parseUser(await responseJson(response) as RawAuthUser);
}

export async function refreshSession(session = loadStoredSession()): Promise<AuthSession | null> {
  if (!session || !isCloudSyncConfigured()) return null;
  const { url } = config();
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: session.refreshToken }),
    cache: "no-store",
  });
  return saveSession(parseAuthResponse(await responseJson(response)));
}

export async function getValidSession(): Promise<AuthSession | null> {
  const session = loadStoredSession();
  if (!session) return null;
  if (session.expiresAt <= Math.floor(Date.now() / 1_000) + 60) {
    try { return await refreshSession(session); } catch { clearStoredSession(); return null; }
  }
  return session;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64Url(bytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export async function beginOAuth(provider: "google" | "apple"): Promise<void> {
  if (!isCloudSyncConfigured()) throw new Error("cloud_sync_not_configured");
  const { url } = config();
  const redirectTo = `${window.location.origin}/account/`;
  const pkce = await createPkce();
  window.sessionStorage.setItem(PKCE_KEY, pkce.verifier);
  const authorize = new URL(`${url}/auth/v1/authorize`);
  authorize.searchParams.set("provider", provider);
  authorize.searchParams.set("redirect_to", redirectTo);
  authorize.searchParams.set("code_challenge", pkce.challenge);
  authorize.searchParams.set("code_challenge_method", "s256");
  window.location.assign(authorize.toString());
}

export async function sendMagicLink(email: string): Promise<void> {
  if (!isCloudSyncConfigured()) throw new Error("cloud_sync_not_configured");
  const normalized = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized) || normalized.length > 254) throw new Error("invalid_email");
  const { url } = config();
  const response = await fetch(`${url}/auth/v1/otp`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: normalized,
      create_user: true,
      email_redirect_to: `${window.location.origin}/account/`,
    }),
    cache: "no-store",
  });
  await responseJson(response);
}

async function exchangePkceCode(code: string): Promise<AuthSession> {
  const verifier = window.sessionStorage.getItem(PKCE_KEY);
  if (!verifier) throw new Error("missing_pkce_verifier");
  const { url } = config();
  const response = await fetch(`${url}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    cache: "no-store",
  });
  window.sessionStorage.removeItem(PKCE_KEY);
  return saveSession(parseAuthResponse(await responseJson(response)));
}

export async function consumeAuthRedirect(): Promise<AuthSession | null> {
  if (typeof window === "undefined" || !isCloudSyncConfigured()) return null;
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (code) {
    const session = await exchangePkceCode(code);
    url.searchParams.delete("code");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    return session;
  }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  const user = await fetchUser(accessToken);
  const session = saveSession({
    accessToken,
    refreshToken,
    expiresAt: Math.floor(Date.now() / 1_000) + Number(hash.get("expires_in") || 3_600),
    tokenType: hash.get("token_type") || "bearer",
    user,
  });
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  return session;
}

export async function signOutCloud(): Promise<void> {
  const session = loadStoredSession();
  if (session && isCloudSyncConfigured()) {
    const { url } = config();
    await fetch(`${url}/auth/v1/logout`, {
      method: "POST",
      headers: authHeaders(session.accessToken),
      cache: "no-store",
    }).catch(() => undefined);
  }
  clearStoredSession();
}

export async function callCloudRpc<T>(name: string, parameters: Record<string, unknown>): Promise<T> {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error("invalid_rpc_name");
  assertSyncPayloadSafe(parameters);
  const session = await getValidSession();
  if (!session) throw new Error("authentication_required");
  const { url } = config();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      ...authHeaders(session.accessToken),
      prefer: "return=representation",
    },
    body: JSON.stringify(parameters),
    cache: "no-store",
  });
  return await responseJson(response) as T;
}

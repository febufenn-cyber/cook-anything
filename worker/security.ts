import type {
  CompanionResponse,
  CompanionState,
  HostedSessionResponse,
  LedgerEntry,
  TrustedCompanionRecipe,
} from "../src/lib/companion/types";

export const SESSION_COOKIE = "__Host-ca_companion_session";
export const MAX_PUBLIC_BODY_BYTES = 8_192;
export const MAX_USER_MESSAGE_CHARS = 2_000;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function isBoundedString(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= max && (allowEmpty || value.length > 0);
}

function isStringArray(value: unknown, maxItems: number, maxChars: number): value is string[] {
  return Array.isArray(value) && value.length <= maxItems && value.every((item) => isBoundedString(item, maxChars));
}

export function jsonResponse(
  body: CompanionResponse | HostedSessionResponse | Record<string, unknown>,
  status = 200,
  extraHeaders?: HeadersInit,
): Response {
  const headers = new Headers(JSON_HEADERS);
  if (extraHeaders) new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(body), { status, headers });
}

export async function readSmallJson(request: Request, maxBytes = MAX_PUBLIC_BODY_BYTES): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw new Error("payload_too_large");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error("payload_too_large");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("bad_json");
  }
}

export function validateRecipeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 120 ? value : null;
}

export function validateTurnInput(value: unknown): { message: string; client_turn_id: string } | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["message", "client_turn_id"])) return null;
  if (!isBoundedString(value.message, MAX_USER_MESSAGE_CHARS)) return null;
  const message = value.message.trim();
  if (!message || message.includes("\0")) return null;
  if (!isBoundedString(value.client_turn_id, 100)) return null;
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(value.client_turn_id)) return null;
  return { message, client_turn_id: value.client_turn_id };
}

export function validateTrustedRecipe(value: unknown, expectedId?: string): TrustedCompanionRecipe | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, [
    "recipe_id", "title", "base_servings", "spice_level", "cookware", "stages",
    "ingredients", "steps", "substitution_notes", "indian_kitchen_adaptation", "version",
  ])) return null;

  const recipeId = validateRecipeId(value.recipe_id);
  if (!recipeId || (expectedId && recipeId !== expectedId)) return null;
  if (!isBoundedString(value.title, 200)) return null;
  if (!Number.isFinite(value.base_servings) || Number(value.base_servings) < 1 || Number(value.base_servings) > 100) return null;
  if (!isBoundedString(value.spice_level, 50)) return null;
  if (!isStringArray(value.cookware, 30, 100)) return null;
  if (!isStringArray(value.stages, 40, 80) || value.stages.length === 0) return null;
  if (!Array.isArray(value.ingredients) || value.ingredients.length === 0 || value.ingredients.length > 150) return null;
  if (!Array.isArray(value.steps) || value.steps.length === 0 || value.steps.length > 150) return null;
  if (!isBoundedString(value.version, 64) || !/^[a-f0-9]{64}$/.test(value.version)) return null;
  if (value.substitution_notes !== undefined && !isBoundedString(value.substitution_notes, 8_000, true)) return null;
  if (value.indian_kitchen_adaptation !== undefined && value.indian_kitchen_adaptation !== null && !isBoundedString(value.indian_kitchen_adaptation, 8_000, true)) return null;

  const ingredientOk = value.ingredients.every((raw) => {
    if (!isRecord(raw)) return false;
    if (!hasOnlyKeys(raw, [
      "name", "slug", "ta", "hi", "qty", "unit", "role", "criticality", "heat_stability",
      "stage", "visual_checks", "subs", "notes",
    ])) return false;
    if (!isBoundedString(raw.name, 200) || !isBoundedString(raw.slug, 120)) return false;
    if (raw.ta !== null && !isBoundedString(raw.ta, 200, true)) return false;
    if (raw.hi !== null && !isBoundedString(raw.hi, 200, true)) return false;
    if (raw.qty !== null && (!Number.isFinite(raw.qty) || Math.abs(Number(raw.qty)) > 1_000_000)) return false;
    if (raw.unit !== null && !isBoundedString(raw.unit, 80, true)) return false;
    if (!isBoundedString(raw.role, 40) || !isBoundedString(raw.criticality, 40) || !isBoundedString(raw.heat_stability, 40)) return false;
    if (!isBoundedString(raw.stage, 80)) return false;
    if (raw.visual_checks !== undefined && !isStringArray(raw.visual_checks, 10, 500)) return false;
    if (raw.notes !== undefined && !isBoundedString(raw.notes, 1_000, true)) return false;
    if (raw.subs !== undefined) {
      if (!Array.isArray(raw.subs) || raw.subs.length > 20) return false;
      if (!raw.subs.every((sub) => isRecord(sub) && hasOnlyKeys(sub, ["name", "notes"]) && isBoundedString(sub.name, 200) && (sub.notes === undefined || isBoundedString(sub.notes, 1_000, true)))) return false;
    }
    return true;
  });
  if (!ingredientOk) return null;

  const stepIds = new Set<string>();
  const stepsOk = value.steps.every((raw) => {
    if (!isRecord(raw) || !hasOnlyKeys(raw, ["id", "stage", "text", "timer_minutes"])) return false;
    if (!isBoundedString(raw.id, 100) || stepIds.has(raw.id)) return false;
    stepIds.add(raw.id);
    if (!isBoundedString(raw.stage, 80) || !isBoundedString(raw.text, 4_000)) return false;
    if (raw.timer_minutes !== undefined && (!Number.isFinite(raw.timer_minutes) || Number(raw.timer_minutes) < 0 || Number(raw.timer_minutes) > 1_440)) return false;
    return true;
  });
  return stepsOk ? (value as unknown as TrustedCompanionRecipe) : null;
}

function validateLedgerEntry(value: unknown): value is LedgerEntry {
  if (!isRecord(value) || !hasOnlyKeys(value, ["original", "now", "qty", "constraint", "cascade"])) return false;
  return isBoundedString(value.original, 200)
    && isBoundedString(value.now, 200)
    && (value.qty === undefined || isBoundedString(value.qty, 200, true))
    && (value.constraint === undefined || isBoundedString(value.constraint, 500, true))
    && (value.cascade === undefined || isBoundedString(value.cascade, 500, true));
}

export function validateCompanionState(value: unknown, recipe: TrustedCompanionRecipe): CompanionState | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, [
    "recipe_id", "servings", "stage", "steps_done", "current_step",
    "substitution_ledger", "flags", "timers",
  ])) return null;
  if (value.recipe_id !== recipe.recipe_id) return null;
  if (!Number.isFinite(value.servings) || Number(value.servings) < 1 || Number(value.servings) > 100) return null;
  if (!isBoundedString(value.stage, 80) || !recipe.stages.includes(value.stage)) return null;

  const stepIds = new Set(recipe.steps.map((step) => step.id));
  if (!isStringArray(value.steps_done, recipe.steps.length, 100) || !value.steps_done.every((id) => stepIds.has(id))) return null;
  if (!isBoundedString(value.current_step, 100) || (!stepIds.has(value.current_step) && value.current_step !== "start")) return null;

  if (!Array.isArray(value.substitution_ledger) || value.substitution_ledger.length > 20 || !value.substitution_ledger.every(validateLedgerEntry)) return null;
  if (!isStringArray(value.flags, 20, 300)) return null;
  if (!Array.isArray(value.timers) || value.timers.length > 5) return null;
  if (!value.timers.every((timer) => isRecord(timer)
    && hasOnlyKeys(timer, ["label", "remaining_s"])
    && isBoundedString(timer.label, 100)
    && Number.isInteger(timer.remaining_s)
    && Number(timer.remaining_s) >= 0
    && Number(timer.remaining_s) <= 86_400)) return null;

  return value as unknown as CompanionState;
}

export function parseCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookie(value: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

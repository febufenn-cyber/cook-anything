import type { CompanionState, LedgerEntry, TrustedCompanionRecipe } from "../src/lib/companion/types";

export const SESSION_COOKIE = "__Host-ca_companion_session";
export const MAX_PUBLIC_BODY_BYTES = 8_192;
export const MAX_USER_MESSAGE_CHARS = 2_000;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

const INGREDIENT_ROLES = new Set([
  "BASE", "AROMATIC", "ACID", "HEAT", "SWEET", "UMAMI_SALT",
  "THICKENER", "COATING", "FAT", "GARNISH",
]);
const CRITICALITIES = new Set(["STRUCTURAL", "FLAVOR", "OPTIONAL"]);
const HEAT_STABILITIES = new Set(["COOK_STABLE", "ADD_LATE"]);
const ALLERGENS = new Set([
  "dairy", "gluten", "nuts", "peanuts", "soy", "egg", "fish", "shellfish", "sesame", "mustard",
]);
const ALLERGEN_STATUSES = new Set(["derived", "reviewed", "incomplete", "unknown"]);
const COOK_TEST_STATUSES = new Set(["not_cook_tested", "partially_cook_tested", "cook_tested"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function isBoundedString(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= max && (allowEmpty || value.length > 0);
}

function isFiniteNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isStringArray(value: unknown, maxItems: number, maxChars: number): value is string[] {
  return Array.isArray(value)
    && value.length <= maxItems
    && value.every((item) => isBoundedString(item, maxChars));
}

function hasStringPrefix(next: string[], previous: string[]): boolean {
  return previous.every((value, index) => next[index] === value);
}

function hasLedgerPrefix(next: LedgerEntry[], previous: LedgerEntry[]): boolean {
  return previous.every((value, index) => JSON.stringify(next[index]) === JSON.stringify(value));
}

export function jsonResponse(body: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(JSON_HEADERS);
  if (extraHeaders) new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(body), { status, headers });
}

export async function readSmallJson(request: Request, maxBytes = MAX_PUBLIC_BODY_BYTES): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error("payload_too_large");
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
  return value.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : null;
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

function validateIngredient(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, [
    "name", "slug", "ta", "hi", "qty", "unit", "role", "criticality",
    "heat_stability", "stage", "visual_checks", "subs", "notes",
  ])) return false;
  if (!isBoundedString(value.name, 200) || !isBoundedString(value.slug, 120)) return false;
  if (value.ta !== null && !isBoundedString(value.ta, 200, true)) return false;
  if (value.hi !== null && !isBoundedString(value.hi, 200, true)) return false;
  if (value.qty !== null && !isFiniteNumber(value.qty, -1_000_000, 1_000_000)) return false;
  if (value.unit !== null && !isBoundedString(value.unit, 80, true)) return false;
  if (!isBoundedString(value.role, 40) || !INGREDIENT_ROLES.has(value.role)) return false;
  if (!isBoundedString(value.criticality, 40) || !CRITICALITIES.has(value.criticality)) return false;
  if (!isBoundedString(value.heat_stability, 40) || !HEAT_STABILITIES.has(value.heat_stability)) return false;
  if (!isBoundedString(value.stage, 80)) return false;
  if (value.visual_checks !== undefined && !isStringArray(value.visual_checks, 10, 500)) return false;
  if (value.notes !== undefined && !isBoundedString(value.notes, 1_000, true)) return false;
  if (value.subs !== undefined) {
    if (!Array.isArray(value.subs) || value.subs.length > 20) return false;
    if (!value.subs.every((sub) => isRecord(sub)
      && hasOnlyKeys(sub, ["name", "notes"])
      && isBoundedString(sub.name, 200)
      && (sub.notes === undefined || isBoundedString(sub.notes, 1_000, true)))) return false;
  }
  return true;
}

function validateTrust(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "allergen_status", "contains_allergens", "cross_contact_notes", "safety_warnings",
    "critical_checks", "cook_test_status", "provenance_summary", "substitution_warning",
  ])) return false;
  if (!isBoundedString(value.allergen_status, 30) || !ALLERGEN_STATUSES.has(value.allergen_status)) return false;
  if (!isStringArray(value.contains_allergens, 20, 40)
    || !value.contains_allergens.every((allergen) => ALLERGENS.has(allergen))) return false;
  if (!isStringArray(value.cross_contact_notes, 10, 1_000)) return false;
  if (!isStringArray(value.safety_warnings, 20, 1_000)) return false;
  if (!isStringArray(value.critical_checks, 20, 1_000)) return false;
  if (!isBoundedString(value.cook_test_status, 40) || !COOK_TEST_STATUSES.has(value.cook_test_status)) return false;
  if (!isBoundedString(value.provenance_summary, 1_000)) return false;
  if (!isBoundedString(value.substitution_warning, 1_000)) return false;
  return true;
}

export function validateTrustedRecipe(value: unknown, expectedId?: string): TrustedCompanionRecipe | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, [
    "recipe_id", "title", "base_servings", "spice_level", "cookware", "stages",
    "ingredients", "steps", "trust", "substitution_notes", "indian_kitchen_adaptation", "version",
  ])) return null;

  const recipeId = validateRecipeId(value.recipe_id);
  if (!recipeId || (expectedId !== undefined && recipeId !== expectedId)) return null;
  if (!isBoundedString(value.title, 200)) return null;
  if (!isFiniteNumber(value.base_servings, 1, 100)) return null;
  if (!isBoundedString(value.spice_level, 50)) return null;
  if (!isStringArray(value.cookware, 30, 100)) return null;
  if (!isStringArray(value.stages, 40, 80) || value.stages.length === 0) return null;
  if (!Array.isArray(value.ingredients) || value.ingredients.length === 0 || value.ingredients.length > 150) return null;
  if (!value.ingredients.every(validateIngredient)) return null;
  if (!Array.isArray(value.steps) || value.steps.length === 0 || value.steps.length > 150) return null;
  if (!validateTrust(value.trust)) return null;
  if (!isBoundedString(value.version, 64) || !/^[a-f0-9]{64}$/.test(value.version)) return null;
  if (value.substitution_notes !== undefined && !isBoundedString(value.substitution_notes, 8_000, true)) return null;
  if (value.indian_kitchen_adaptation !== undefined
    && value.indian_kitchen_adaptation !== null
    && !isBoundedString(value.indian_kitchen_adaptation, 8_000, true)) return null;

  const stageSet = new Set(value.stages);
  const stepIds = new Set<string>();
  const stepsOk = value.steps.every((step) => {
    if (!isRecord(step) || !hasOnlyKeys(step, ["id", "stage", "text", "timer_minutes"])) return false;
    if (!isBoundedString(step.id, 100) || stepIds.has(step.id)) return false;
    if (!isBoundedString(step.stage, 80) || !stageSet.has(step.stage)) return false;
    if (!isBoundedString(step.text, 4_000)) return false;
    if (step.timer_minutes !== undefined && !isFiniteNumber(step.timer_minutes, 0, 1_440)) return false;
    stepIds.add(step.id);
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
  if (!isFiniteNumber(value.servings, 1, 100)) return null;
  if (!isBoundedString(value.stage, 80) || !recipe.stages.includes(value.stage)) return null;

  const stepIds = new Set(recipe.steps.map((step) => step.id));
  if (!isStringArray(value.steps_done, recipe.steps.length, 100)) return null;
  if (new Set(value.steps_done).size !== value.steps_done.length) return null;
  if (!value.steps_done.every((id) => stepIds.has(id))) return null;
  if (!isBoundedString(value.current_step, 100)) return null;
  if (!stepIds.has(value.current_step) && value.current_step !== "start") return null;

  if (!Array.isArray(value.substitution_ledger)
    || value.substitution_ledger.length > 20
    || !value.substitution_ledger.every(validateLedgerEntry)) return null;
  if (!isStringArray(value.flags, 20, 300)) return null;
  if (!Array.isArray(value.timers) || value.timers.length > 5) return null;
  if (!value.timers.every((timer) => isRecord(timer)
    && hasOnlyKeys(timer, ["label", "remaining_s"])
    && isBoundedString(timer.label, 100)
    && typeof timer.remaining_s === "number"
    && Number.isInteger(timer.remaining_s)
    && timer.remaining_s >= 0
    && timer.remaining_s <= 86_400)) return null;

  return value as unknown as CompanionState;
}

/** Enforce monotonic, one-action-at-a-time model state transitions. */
export function validateCompanionStateTransition(
  value: unknown,
  previous: CompanionState,
  recipe: TrustedCompanionRecipe,
): CompanionState | null {
  const next = validateCompanionState(value, recipe);
  if (!next) return null;

  if (!hasStringPrefix(next.steps_done, previous.steps_done)) return null;
  if (next.steps_done.length > previous.steps_done.length + 1) return null;
  if (!hasLedgerPrefix(next.substitution_ledger, previous.substitution_ledger)) return null;
  if (next.substitution_ledger.length > previous.substitution_ledger.length + 2) return null;
  if (!hasStringPrefix(next.flags, previous.flags)) return null;
  if (next.flags.length > previous.flags.length + 2) return null;

  const previousStage = recipe.stages.indexOf(previous.stage);
  const nextStage = recipe.stages.indexOf(next.stage);
  if (nextStage < previousStage || nextStage > previousStage + 1) return null;

  const stepIndex = new Map(recipe.steps.map((step, index) => [step.id, index]));
  const previousStep = previous.current_step === "start" ? -1 : stepIndex.get(previous.current_step);
  const nextStep = next.current_step === "start" ? -1 : stepIndex.get(next.current_step);
  if (previousStep === undefined || nextStep === undefined) return null;
  if (nextStep < previousStep || nextStep > previousStep + 1) return null;
  if (next.steps_done.some((id) => (stepIndex.get(id) ?? Number.POSITIVE_INFINITY) > nextStep)) return null;

  return next;
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

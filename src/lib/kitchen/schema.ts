import {
  KITCHEN_EXPORT_FORMAT,
  KITCHEN_SCHEMA_VERSION,
  type KitchenExport,
  type LocalKitchenProfile,
  type ShoppingListItem,
} from "./types";

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const SAFE_UNITS = new Set(["g", "kg", "ml", "l", "piece"]);

export function isoNow(): string {
  return new Date().toISOString();
}

export function createDefaultKitchenProfile(now = isoNow()): LocalKitchenProfile {
  return {
    schemaVersion: KITCHEN_SCHEMA_VERSION,
    profileId: "local",
    pantryProfile: "minimal",
    cookware: [],
    dietaryPreferences: [],
    allergensToAvoid: [],
    excludedIngredients: [],
    preferredLanguages: ["en"],
    preferredCuisines: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeIngredientSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function assertPlainData(value: unknown, depth = 0): void {
  if (depth > 12) throw new Error("import_too_deep");
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return;
  if (Array.isArray(value)) {
    if (value.length > 20_000) throw new Error("import_too_large");
    value.forEach((item) => assertPlainData(item, depth + 1));
    return;
  }
  if (typeof value !== "object") throw new Error("invalid_import");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error("invalid_import");
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error("invalid_import");
    if (/api.?key|authorization|cookie|session.?token/i.test(key)) throw new Error("secret_field_forbidden");
    assertPlainData(child, depth + 1);
  }
}

function isIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function parseKitchenExport(raw: string): KitchenExport {
  if (raw.length > 5_000_000) throw new Error("import_too_large");
  const parsed = JSON.parse(raw) as unknown;
  assertPlainData(parsed);
  if (!parsed || typeof parsed !== "object") throw new Error("invalid_import");
  const value = parsed as Partial<KitchenExport>;
  if (value.format !== KITCHEN_EXPORT_FORMAT) throw new Error("invalid_import_format");
  if (value.schemaVersion !== KITCHEN_SCHEMA_VERSION) {
    if (typeof value.schemaVersion === "number" && value.schemaVersion > KITCHEN_SCHEMA_VERSION) throw new Error("future_schema");
    throw new Error("unsupported_schema");
  }
  if (!isIso(value.createdAt)) throw new Error("invalid_import");
  const arrays = [value.pantry, value.savedRecipes, value.history, value.shoppingList, value.mealPlan];
  if (arrays.some((item) => !Array.isArray(item))) throw new Error("invalid_import");
  if (value.profile !== null && (typeof value.profile !== "object" || value.profile?.profileId !== "local")) throw new Error("invalid_import");
  return value as KitchenExport;
}

function sourceKey(item: ShoppingListItem): string {
  return item.sources
    .map((source) => `${source.recipeId ?? ""}|${source.mealPlanId ?? ""}|${source.reason}`)
    .sort()
    .join(";");
}

export function mergeShoppingItems(items: ShoppingListItem[]): ShoppingListItem[] {
  const merged = new Map<string, ShoppingListItem>();
  for (const item of items) {
    const identity = item.ingredientSlug || item.customLabel?.trim().toLowerCase();
    if (!identity) continue;
    const canAggregate = Boolean(item.ingredientSlug && item.quantity !== undefined && item.unit && SAFE_UNITS.has(item.unit));
    const key = canAggregate
      ? `${identity}|${item.unit}|${item.status}`
      : `${identity}|${item.unit ?? ""}|${item.quantity ?? ""}|${item.status}|${sourceKey(item)}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item, sources: [...item.sources] });
      continue;
    }
    const sourceMap = new Map(existing.sources.map((source) => [`${source.recipeId ?? ""}|${source.mealPlanId ?? ""}|${source.reason}`, source]));
    item.sources.forEach((source) => sourceMap.set(`${source.recipeId ?? ""}|${source.mealPlanId ?? ""}|${source.reason}`, source));
    merged.set(key, {
      ...existing,
      quantity: canAggregate ? (existing.quantity ?? 0) + (item.quantity ?? 0) : existing.quantity,
      sources: [...sourceMap.values()],
      updatedAt: existing.updatedAt > item.updatedAt ? existing.updatedAt : item.updatedAt,
    });
  }
  return [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function publicKitchenExport(exported: KitchenExport): KitchenExport {
  const clone = structuredClone(exported);
  assertPlainData(clone);
  return clone;
}

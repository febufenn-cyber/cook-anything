import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  KITCHEN_EXPORT_FORMAT,
  KITCHEN_SCHEMA_VERSION,
  type KitchenExport,
  type ShoppingListItem,
} from "../src/lib/kitchen/types";
import {
  assertPlainData,
  createDefaultKitchenProfile,
  mergeShoppingItems,
  normalizeIngredientSlug,
  parseKitchenExport,
} from "../src/lib/kitchen/schema";

const now = "2026-07-12T00:00:00.000Z";

const profile = createDefaultKitchenProfile(now);
assert.equal(profile.profileId, "local");
assert.equal(profile.schemaVersion, KITCHEN_SCHEMA_VERSION);
assert.equal(profile.pantryProfile, "minimal");
assert.equal(normalizeIngredientSlug("  Leftover Rice  "), "leftover-rice");
assert.equal(normalizeIngredientSlug("முட்டை"), "", "non-Latin free text must not become a fake canonical slug");

const baseExport: KitchenExport = {
  format: KITCHEN_EXPORT_FORMAT,
  schemaVersion: KITCHEN_SCHEMA_VERSION,
  createdAt: now,
  profile,
  pantry: [],
  savedRecipes: [],
  history: [],
  shoppingList: [],
  mealPlan: [],
};
assert.deepEqual(parseKitchenExport(JSON.stringify(baseExport)), baseExport);

assert.throws(
  () => parseKitchenExport(JSON.stringify({ ...baseExport, schemaVersion: KITCHEN_SCHEMA_VERSION + 1 })),
  /future_schema/,
);
assert.throws(
  () => parseKitchenExport(JSON.stringify({ ...baseExport, apiKey: "secret" })),
  /secret_field_forbidden/,
);
assert.throws(
  () => parseKitchenExport(JSON.stringify({ ...baseExport, format: "other" })),
  /invalid_import_format/,
);
assert.throws(() => assertPlainData(Object.create({ poisoned: true })), /invalid_import/);
assert.throws(() => assertPlainData({ constructor: { prototype: { polluted: true } } }), /invalid_import/);

function shopping(overrides: Partial<ShoppingListItem>): ShoppingListItem {
  return {
    id: `item-${Math.random()}`,
    ingredientSlug: "rice",
    quantity: 500,
    unit: "g",
    status: "needed",
    sources: [{ recipeId: "recipe-a", reason: "Missing for A" }],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const aggregated = mergeShoppingItems([
  shopping({ id: "a", quantity: 500 }),
  shopping({ id: "b", quantity: 250, sources: [{ recipeId: "recipe-b", reason: "Missing for B" }] }),
]);
assert.equal(aggregated.length, 1);
assert.equal(aggregated[0].quantity, 750);
assert.equal(aggregated[0].sources.length, 2);

const incompatible = mergeShoppingItems([
  shopping({ id: "c", quantity: 2, unit: "cup" }),
  shopping({ id: "d", quantity: 300, unit: "g" }),
]);
assert.equal(incompatible.length, 2, "unsafe volume/weight conversions must remain separate");

const custom = mergeShoppingItems([
  shopping({ id: "e", ingredientSlug: undefined, customLabel: "Bread", quantity: undefined, unit: undefined }),
  shopping({ id: "f", ingredientSlug: undefined, customLabel: "Bread", quantity: undefined, unit: undefined, sources: [{ reason: "Manual second entry" }] }),
]);
assert.equal(custom.length, 2, "custom items with different sources must not be silently collapsed");

const serviceWorker = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
assert.match(serviceWorker, /url\.pathname\.startsWith\("\/companion-recipes\/"\)/);
assert.match(serviceWorker, /request\.headers\.has\("authorization"\)/);
assert.match(serviceWorker, /request\.headers\.has\("x-api-key"\)/);
assert.ok(!serviceWorker.includes("api.anthropic.com"));
assert.ok(!serviceWorker.includes("api.openai.com"));

const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "manifest.webmanifest"), "utf8")) as { start_url?: string; display?: string };
assert.equal(manifest.start_url, "/");
assert.equal(manifest.display, "standalone");

console.log("Phase 4 local-kitchen tests passed.");

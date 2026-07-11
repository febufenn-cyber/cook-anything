import assert from "node:assert/strict";
import { inspectByokEndpoint, normalizeByokConfig } from "../src/lib/companion/client";
import { deriveRecipeTrust } from "../src/lib/trust/policy";
import type { IngredientDef, Recipe } from "../src/lib/types";

const defs: IngredientDef[] = [
  {
    slug: "milk",
    name: "Milk",
    ta: null,
    hi: null,
    category: "dairy",
    pantryStaple: false,
    aliases: [],
    allergens: ["dairy"],
  },
  {
    slug: "rice",
    name: "Rice",
    ta: null,
    hi: null,
    category: "grain",
    pantryStaple: false,
    aliases: [],
    allergens: [],
  },
  {
    slug: "chicken",
    name: "Chicken",
    ta: null,
    hi: null,
    category: "meat",
    pantryStaple: false,
    aliases: [],
    allergens: [],
  },
  {
    slug: "oil",
    name: "Oil",
    ta: null,
    hi: null,
    category: "oil",
    pantryStaple: true,
    aliases: [],
    allergens: [],
  },
];
const ingredientDefs = new Map(defs.map((definition) => [definition.slug, definition]));

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "ca-test-dish",
    slug: "test-dish",
    title: "Test Dish",
    nativeTitle: null,
    description: "A sufficiently descriptive test recipe for the trust policy suite.",
    cuisine: "tamil",
    country: "india",
    region: null,
    language: "en",
    mealType: ["dinner"],
    dietType: ["vegetarian"],
    difficulty: "easy",
    spiceLevel: "mild",
    budgetLevel: "budget",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
    servings: 2,
    ingredients: [
      { name: "Milk", normalizedName: "milk", quantity: 1, unit: "cup", optional: false },
      { name: "Rice", normalizedName: "rice", quantity: 1, unit: "cup", optional: false },
      { name: "Oil", normalizedName: "oil", quantity: 1, unit: "tbsp", optional: false },
    ],
    steps: [
      { order: 1, text: "Wash and prepare all of the ingredients carefully." },
      { order: 2, text: "Cook the ingredients over a controlled heat until ready." },
      { order: 3, text: "Finish the dish and serve it while it is warm." },
    ],
    cookware: ["saucepan"],
    methods: ["simmering"],
    tags: [],
    allergens: [],
    nutrition: null,
    substitutions: [],
    culturalNote: null,
    regionalVariation: null,
    indianKitchenAdaptation: null,
    source: "Cook Anything original formulation",
    sourceUrl: null,
    license: "original",
    author: "Cook Anything",
    verificationStatus: "ai_drafted",
    image: null,
    imageLicense: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function trustFor(value: Recipe) {
  return deriveRecipeTrust(value, ingredientDefs, "a".repeat(64), value.updatedAt);
}

const conservative = trustFor(recipe());
assert.equal(conservative.verification.cookTestStatus, "not_cook_tested");
assert.equal(conservative.verification.editorialStatus, "unreviewed");
assert.deepEqual(conservative.allergen.contains, ["dairy"]);
assert.equal(conservative.allergen.status, "derived");
assert.ok(conservative.publication.warnings.some((warning) => warning.includes("omitted taxonomy-derived")));
assert.equal(conservative.publication.eligible, true);

const veganConflict = trustFor(recipe({ dietType: ["vegan"] }));
assert.equal(veganConflict.publication.eligible, false);
assert.ok(veganConflict.dietary.conflicts.some((conflict) => conflict.includes("Claims vegan")));

const meatConflict = trustFor(recipe({
  dietType: ["vegetarian"],
  ingredients: [
    { name: "Chicken", normalizedName: "chicken", quantity: 500, unit: "g", optional: false },
    { name: "Rice", normalizedName: "rice", quantity: 1, unit: "cup", optional: false },
    { name: "Oil", normalizedName: "oil", quantity: 1, unit: "tbsp", optional: false },
  ],
  methods: ["deep-frying"],
}));
assert.equal(meatConflict.publication.eligible, false);
assert.ok(meatConflict.safety.hazards.includes("raw_poultry"));
assert.ok(meatConflict.safety.hazards.includes("hot_oil"));
assert.ok(meatConflict.safety.hazards.includes("cross_contamination"));

const missingTaxonomy = trustFor(recipe({
  ingredients: [
    { name: "Mystery powder", normalizedName: "mystery-powder", quantity: 1, unit: "tsp", optional: false },
    { name: "Rice", normalizedName: "rice", quantity: 1, unit: "cup", optional: false },
    { name: "Oil", normalizedName: "oil", quantity: 1, unit: "tbsp", optional: false },
  ],
}));
assert.equal(missingTaxonomy.allergen.status, "incomplete");
assert.equal(missingTaxonomy.publication.eligible, false);

const blockedLicense = trustFor(recipe({ license: "all-rights-reserved" }));
assert.equal(blockedLicense.provenance.licenseStatus, "blocked");
assert.equal(blockedLicense.publication.eligible, false);

const importedWithoutSource = trustFor(recipe({
  license: "CC-BY-4.0",
  verificationStatus: "open_license_imported",
  sourceUrl: null,
}));
assert.equal(importedWithoutSource.publication.eligible, false);
assert.ok(importedWithoutSource.publication.blockers.some((blocker) => blocker.includes("source URL")));

const fakeVerified = trustFor(recipe({ verificationStatus: "verified" }));
assert.equal(fakeVerified.publication.eligible, false);
assert.ok(fakeVerified.publication.blockers.some((blocker) => blocker.includes("version-bound evidence")));

const openAi = inspectByokEndpoint("https://api.openai.com/v1/");
assert.equal(openAi.hostname, "api.openai.com");
assert.equal(openAi.requiresConfirmation, false);
assert.equal(openAi.normalizedUrl, "https://api.openai.com/v1");

const custom = inspectByokEndpoint("https://models.example.com/v1");
assert.equal(custom.requiresConfirmation, true);
assert.ok(custom.warning.includes("models.example.com"));

assert.throws(() => inspectByokEndpoint("http://models.example.com/v1"), /invalid_endpoint/);
assert.throws(() => inspectByokEndpoint("javascript:alert(1)"), /invalid_endpoint/);
assert.throws(() => inspectByokEndpoint("https://user:pass@models.example.com/v1"), /invalid_endpoint/);
assert.throws(() => inspectByokEndpoint("https://models.example.com/v1?redirect=evil"), /invalid_endpoint/);
assert.equal(inspectByokEndpoint("http://localhost:11434/v1").hostname, "localhost");

const normalized = normalizeByokConfig({
  provider: "openai-compatible",
  apiKey: " secret ",
  model: " model-id ",
  baseUrl: "https://models.example.com/v1/",
});
assert.equal(normalized.apiKey, "secret");
assert.equal(normalized.model, "model-id");
assert.equal(normalized.baseUrl, "https://models.example.com/v1");
assert.equal(normalized.remember, false);

console.log("Phase 2 trust tests passed.");

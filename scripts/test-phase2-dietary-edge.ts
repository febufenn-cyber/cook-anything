import assert from "node:assert/strict";
import { deriveRecipeTrust } from "../src/lib/trust/policy";
import type { IngredientDef, Recipe } from "../src/lib/types";

const base: Recipe = {
  id: "ca-edge",
  slug: "edge",
  title: "Dietary Edge",
  nativeTitle: null,
  description: "A complete recipe-shaped fixture used for dietary trust regression tests.",
  cuisine: "test",
  country: "test",
  region: null,
  language: "en",
  mealType: ["snack"],
  dietType: ["vegan"],
  difficulty: "easy",
  spiceLevel: "none",
  budgetLevel: "budget",
  prepTimeMinutes: 5,
  cookTimeMinutes: 5,
  totalTimeMinutes: 10,
  servings: 1,
  ingredients: [],
  steps: [
    { order: 1, text: "Prepare the ingredients carefully before cooking." },
    { order: 2, text: "Cook the mixture until it reaches the intended texture." },
    { order: 3, text: "Finish the dish and serve it immediately." },
  ],
  cookware: ["bowl"],
  methods: ["mixing"],
  tags: [],
  allergens: [],
  nutrition: null,
  substitutions: [],
  culturalNote: null,
  regionalVariation: null,
  indianKitchenAdaptation: null,
  source: "Cook Anything test fixture",
  sourceUrl: null,
  license: "original",
  author: "Cook Anything",
  verificationStatus: "ai_drafted",
  image: null,
  imageLicense: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

function ingredient(slug: string, category: IngredientDef["category"], allergens: IngredientDef["allergens"]): IngredientDef {
  return { slug, name: slug, ta: null, hi: null, category, pantryStaple: false, aliases: [], allergens };
}

function assess(slug: string, definition: IngredientDef) {
  return deriveRecipeTrust(
    { ...base, ingredients: [{ name: slug, normalizedName: slug, quantity: 1, unit: "tbsp", optional: false }] },
    new Map([[slug, definition]]),
    "b".repeat(64),
    base.updatedAt,
  );
}

const honey = assess("honey", ingredient("honey", "sweetener", []));
assert.equal(honey.dietary.derivedPrimary, "vegetarian");
assert.equal(honey.publication.eligible, false, "honey must conflict with a vegan claim");

const fishSauce = assess("fish-sauce", ingredient("fish-sauce", "condiment", ["fish"]));
assert.equal(fishSauce.dietary.derivedPrimary, "pescatarian");
assert.equal(fishSauce.publication.eligible, false, "fish sauce must conflict with a vegan claim");
assert.ok(fishSauce.safety.hazards.includes("seafood"));

const mayonnaise = assess("mayonnaise", ingredient("mayonnaise", "condiment", ["egg"]));
assert.equal(mayonnaise.dietary.derivedPrimary, "eggetarian");
assert.equal(mayonnaise.publication.eligible, false, "egg-containing condiment must conflict with a vegan claim");
assert.ok(mayonnaise.safety.hazards.includes("egg"));

console.log("Phase 2 dietary-edge tests passed.");

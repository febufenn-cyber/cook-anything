import assert from "node:assert/strict";
import {
  applyIngredientCorrections,
  applyRecipeCorrections,
  corpusCorrectionSummary,
} from "../src/lib/corpus-corrections";
import type { IngredientDef, Recipe } from "../src/lib/types";

const coconutMilk: IngredientDef = {
  slug: "coconut-milk",
  name: "Coconut milk",
  ta: "thengai paal",
  hi: "nariyal doodh",
  category: "dairy",
  pantryStaple: false,
  aliases: [],
  allergens: [],
};
assert.equal(applyIngredientCorrections(coconutMilk).category, "condiment");

const recipe = {
  slug: "chinese-congee",
  dietType: ["vegetarian"],
} as unknown as Recipe;
assert.deepEqual(applyRecipeCorrections(recipe).dietType, ["eggetarian"]);
assert.deepEqual(applyRecipeCorrections({ ...recipe, slug: "unrelated" }).dietType, ["vegetarian"]);

const summary = corpusCorrectionSummary();
assert.equal(summary.version, 1);
assert.ok(summary.recipeDietCorrections.includes("italian-potato-gnocchi"));
assert.ok(summary.ingredientCategoryCorrections.includes("coconut-milk"));

console.log("Corpus correction tests passed.");

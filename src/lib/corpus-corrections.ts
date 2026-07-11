import type { DietType, IngredientDef, Recipe } from "./types";

/**
 * Small, explicit migration overlay for source records whose classification is
 * known to be wrong but whose large batch files have not yet been rewritten.
 * Every consumer—pages, search, trust and companion snapshots—must use these
 * helpers so one correction cannot diverge across product surfaces.
 */
const RECIPE_DIET_CORRECTIONS: Readonly<Record<string, DietType[]>> = {
  "chinese-congee": ["eggetarian"],
  "latin-corn-pancakes": ["eggetarian"],
  "malay-roti-canai": ["eggetarian"],
  "italian-potato-gnocchi": ["eggetarian"],
};

const INGREDIENT_CATEGORY_CORRECTIONS: Readonly<Record<string, IngredientDef["category"]>> = {
  "coconut-milk": "condiment",
};

export const CORPUS_CORRECTION_VERSION = 1;

export function applyRecipeCorrections(recipe: Recipe): Recipe {
  const dietType = RECIPE_DIET_CORRECTIONS[recipe.slug];
  if (!dietType) return recipe;
  return { ...recipe, dietType: [...dietType] };
}

export function applyIngredientCorrections(ingredient: IngredientDef): IngredientDef {
  const category = INGREDIENT_CATEGORY_CORRECTIONS[ingredient.slug];
  if (!category || category === ingredient.category) return ingredient;
  return { ...ingredient, category };
}

export function corpusCorrectionSummary(): {
  version: number;
  recipeDietCorrections: string[];
  ingredientCategoryCorrections: string[];
} {
  return {
    version: CORPUS_CORRECTION_VERSION,
    recipeDietCorrections: Object.keys(RECIPE_DIET_CORRECTIONS).sort(),
    ingredientCategoryCorrections: Object.keys(INGREDIENT_CATEGORY_CORRECTIONS).sort(),
  };
}

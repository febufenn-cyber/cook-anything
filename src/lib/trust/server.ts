import { createHash } from "node:crypto";
import type { IngredientDef, Recipe } from "../types";
import { deriveRecipeTrust } from "./policy";
import type { RecipeTrustRecord } from "./types";

export function recipeContentVersion(recipe: Recipe): string {
  return createHash("sha256").update(JSON.stringify(recipe)).digest("hex");
}

export function buildRecipeTrustRecord(
  recipe: Recipe,
  ingredientDefs: Map<string, IngredientDef>,
  generatedAt = recipe.updatedAt,
): RecipeTrustRecord {
  return deriveRecipeTrust(recipe, ingredientDefs, recipeContentVersion(recipe), generatedAt);
}

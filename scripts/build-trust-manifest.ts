import fs from "node:fs";
import path from "node:path";
import { getAllRecipes, getIngredients } from "../src/lib/data";
import { buildRecipeTrustRecord } from "../src/lib/trust/server";
import type { PublicTrustManifest } from "../src/lib/trust/types";

const output = path.join(process.cwd(), "public", "trust-manifest.json");
const generatedAt = new Date().toISOString();
const ingredientDefs = new Map(getIngredients().map((ingredient) => [ingredient.slug, ingredient]));
const recipes = Object.fromEntries(
  getAllRecipes().map((recipe) => [
    recipe.slug,
    buildRecipeTrustRecord(recipe, ingredientDefs, generatedAt),
  ]),
);
const manifest: PublicTrustManifest = { schemaVersion: 1, generatedAt, recipes };

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(manifest)}\n`, "utf8");
console.log(`Built trust manifest for ${Object.keys(recipes).length} recipes.`);

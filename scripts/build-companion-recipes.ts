import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getAllRecipes, getIngredients } from "../src/lib/data";
import { toCompanionRecipe } from "../src/lib/companion/adapt";
import type { TrustedCompanionRecipe } from "../src/lib/companion/types";

const outputDir = path.join(process.cwd(), "public", "companion-recipes");
const ingredientDefs = new Map(getIngredients().map((ingredient) => [ingredient.slug, ingredient]));
const recipes = getAllRecipes();

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const manifest: { recipe_id: string; version: string }[] = [];

for (const recipe of recipes) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipe.slug)) {
    throw new Error(`Unsafe companion recipe slug: ${recipe.slug}`);
  }

  const companionRecipe = toCompanionRecipe(recipe, ingredientDefs);
  const canonical = JSON.stringify(companionRecipe);
  const version = createHash("sha256").update(canonical).digest("hex");
  const trusted: TrustedCompanionRecipe = { ...companionRecipe, version };

  fs.writeFileSync(
    path.join(outputDir, `${recipe.slug}.json`),
    `${JSON.stringify(trusted)}\n`,
    "utf8",
  );
  manifest.push({ recipe_id: recipe.slug, version });
}

fs.writeFileSync(
  path.join(outputDir, "index.json"),
  `${JSON.stringify({ schema_version: 1, recipes: manifest })}\n`,
  "utf8",
);

console.log(`Built ${manifest.length} trusted companion recipe snapshots.`);

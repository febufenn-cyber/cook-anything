import fs from "node:fs";
import path from "node:path";
import { getAllRecipes, getIngredients } from "../src/lib/data";
import { buildRecipeTrustRecord } from "../src/lib/trust/server";

const root = path.join(__dirname, "..");
const recipesDir = path.join(root, "data", "recipes");
const ingredientDefs = new Map(getIngredients().map((ingredient) => [ingredient.slug, ingredient]));
const sourceFileBySlug = new Map<string, string>();

for (const file of fs.readdirSync(recipesDir).filter((name) => name.endsWith(".json"))) {
  const recipes = JSON.parse(fs.readFileSync(path.join(recipesDir, file), "utf8")) as { slug?: string }[];
  for (const recipe of recipes) if (recipe.slug) sourceFileBySlug.set(recipe.slug, file);
}

let errors = 0;
let warnings = 0;

for (const recipe of getAllRecipes()) {
  const trust = buildRecipeTrustRecord(recipe, ingredientDefs, recipe.updatedAt);
  const location = sourceFileBySlug.get(recipe.slug) ?? "unknown-file";
  for (const blocker of trust.publication.blockers) {
    console.error(`  ERROR [${recipe.slug} @ ${location}]: ${blocker}`);
    if (blocker.startsWith("Claims ")) {
      const classification = recipe.ingredients.map((ingredient) => {
        const definition = ingredientDefs.get(ingredient.normalizedName);
        return `${ingredient.normalizedName}:${definition?.category ?? "missing"}`;
      });
      console.error(`    ingredients: ${classification.join(", ")}`);
    }
    errors += 1;
  }
  for (const warning of trust.publication.warnings) {
    console.warn(`  warn  [${recipe.slug} @ ${location}]: ${warning}`);
    warnings += 1;
  }

  if (trust.allergen.status === "unknown" || trust.allergen.status === "incomplete") {
    console.error(`  ERROR [${recipe.slug} @ ${location}]: allergen assessment is ${trust.allergen.status}`);
    errors += 1;
  }
  if (trust.verification.boundRecipeVersion !== trust.recipeVersion) {
    console.error(`  ERROR [${recipe.slug} @ ${location}]: verification evidence is not bound to the current recipe version`);
    errors += 1;
  }
  if (trust.provenance.licenseStatus === "unknown" || trust.provenance.licenseStatus === "blocked") {
    console.error(`  ERROR [${recipe.slug} @ ${location}]: provenance license status is ${trust.provenance.licenseStatus}`);
    errors += 1;
  }
}

console.log(`\ncheck-trust: ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors > 0 ? 1 : 0);

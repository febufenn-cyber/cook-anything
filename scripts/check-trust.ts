import { getAllRecipes, getIngredients } from "../src/lib/data";
import { buildRecipeTrustRecord } from "../src/lib/trust/server";

const ingredientDefs = new Map(getIngredients().map((ingredient) => [ingredient.slug, ingredient]));
let errors = 0;
let warnings = 0;

for (const recipe of getAllRecipes()) {
  const trust = buildRecipeTrustRecord(recipe, ingredientDefs, recipe.updatedAt);
  for (const blocker of trust.publication.blockers) {
    console.error(`  ERROR [${recipe.slug}]: ${blocker}`);
    errors += 1;
  }
  for (const warning of trust.publication.warnings) {
    console.warn(`  warn  [${recipe.slug}]: ${warning}`);
    warnings += 1;
  }

  if (trust.allergen.status === "unknown" || trust.allergen.status === "incomplete") {
    console.error(`  ERROR [${recipe.slug}]: allergen assessment is ${trust.allergen.status}`);
    errors += 1;
  }
  if (trust.verification.boundRecipeVersion !== trust.recipeVersion) {
    console.error(`  ERROR [${recipe.slug}]: verification evidence is not bound to the current recipe version`);
    errors += 1;
  }
  if (trust.provenance.licenseStatus === "unknown" || trust.provenance.licenseStatus === "blocked") {
    console.error(`  ERROR [${recipe.slug}]: provenance license status is ${trust.provenance.licenseStatus}`);
    errors += 1;
  }
}

console.log(`\ncheck-trust: ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors > 0 ? 1 : 0);

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.join(__dirname, "..");
const recipeDir = path.join(root, "data", "recipes");
const seen = new Map<string, { slug: string; file: string }>();
let errors = 0;
let total = 0;

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

for (const filename of fs.readdirSync(recipeDir).filter((name) => name.endsWith(".json")).sort()) {
  const file = path.join(recipeDir, filename);
  const recipes = JSON.parse(fs.readFileSync(file, "utf8")) as any[];
  for (const recipe of recipes) {
    total += 1;
    const fingerprintPayload = {
      title: normalizeText(recipe.title),
      cuisine: recipe.cuisine,
      ingredients: (recipe.ingredients ?? []).map((ingredient: any) => ({
        slug: ingredient.normalizedName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        optional: Boolean(ingredient.optional),
        notes: normalizeText(ingredient.notes),
      })),
      steps: (recipe.steps ?? []).map((step: any) => normalizeText(step.text)),
    };
    const fingerprint = createHash("sha256").update(JSON.stringify(fingerprintPayload)).digest("hex");
    const prior = seen.get(fingerprint);
    if (prior) {
      console.error(`  ERROR [${recipe.slug}]: exact recipe duplicate of ${prior.slug} (${prior.file})`);
      errors += 1;
    } else {
      seen.set(fingerprint, { slug: recipe.slug, file: filename });
    }
  }
}

console.log(`\ncheck-exact-duplicates: ${total} recipes — ${errors} exact duplicate(s)`);
process.exit(errors > 0 ? 1 : 0);

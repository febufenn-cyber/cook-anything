/**
 * seed-recipes.ts — reports seed coverage across cuisines, meal types, diets
 * and key categories, and highlights the thinnest areas to generate next.
 *
 * Usage: npx tsx scripts/seed-recipes.ts
 */
import fs from "node:fs";
import path from "node:path";
import { CUISINES } from "../src/lib/canon";

const ROOT = path.join(__dirname, "..");
const RECIPES_DIR = path.join(ROOT, "data", "recipes");

const seen = new Set<string>();
const recipes: any[] = [];
for (const f of fs.readdirSync(RECIPES_DIR).filter((x) => x.endsWith(".json"))) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECIPES_DIR, f), "utf8"))) {
    if (seen.has(r.slug)) continue;
    seen.add(r.slug);
    recipes.push(r);
  }
}

const count = (fn: (r: any) => boolean) => recipes.filter(fn).length;
const byCuisine = new Map<string, number>();
for (const c of CUISINES) byCuisine.set(c, 0);
for (const r of recipes) byCuisine.set(r.cuisine, (byCuisine.get(r.cuisine) ?? 0) + 1);

console.log(`Seed database: ${recipes.length} recipes\n`);
console.log("By cuisine (thinnest first):");
for (const [c, n] of [...byCuisine.entries()].sort((a, b) => a[1] - b[1])) {
  console.log(`  ${String(n).padStart(4)}  ${c}`);
}

console.log("\nKey categories:");
const cats: [string, (r: any) => boolean][] = [
  ["vegetarian/vegan", (r) => r.dietType.includes("vegetarian") || r.dietType.includes("vegan")],
  ["chicken", (r) => r.ingredients.some((i: any) => i.normalizedName === "chicken")],
  ["egg", (r) => r.ingredients.some((i: any) => i.normalizedName === "egg")],
  ["rice", (r) => r.ingredients.some((i: any) => ["rice", "basmati-rice", "idli-rice"].includes(i.normalizedName))],
  ["fish/seafood", (r) => r.ingredients.some((i: any) => ["fish", "prawn", "crab", "squid"].includes(i.normalizedName))],
  ["paneer", (r) => r.ingredients.some((i: any) => i.normalizedName === "paneer")],
  ["dal/pulses", (r) => r.ingredients.some((i: any) => String(i.normalizedName).includes("dal") || ["chickpea", "rajma", "moong-dal"].includes(i.normalizedName))],
  ["quick (<=30 min)", (r) => r.totalTimeMinutes <= 30],
  ["budget", (r) => r.budgetLevel === "budget"],
  ["festival", (r) => r.tags.includes("festival")],
  ["street food", (r) => r.tags.includes("street-food")],
  ["breakfast", (r) => r.mealType.includes("breakfast")],
  ["dessert", (r) => r.mealType.includes("dessert")],
  ["high protein", (r) => r.dietType.includes("high_protein")],
  ["bachelor-friendly", (r) => r.tags.includes("bachelor-friendly")],
  ["indian-kitchen adaptation", (r) => Boolean(r.indianKitchenAdaptation)],
];
for (const [name, fn] of cats) console.log(`  ${String(count(fn)).padStart(4)}  ${name}`);

const thin = [...byCuisine.entries()].filter(([, n]) => n < 8).map(([c]) => c);
if (thin.length) {
  console.log(`\nThin coverage (<8 recipes): ${thin.join(", ")}`);
  console.log("Generate next batches for these — see docs/SCALING.md for the batch-generation workflow.");
}

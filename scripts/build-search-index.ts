/**
 * build-search-index.ts — compiles the compact client-side index used by
 * /what-can-i-cook and /search into public/search-index.json.
 * Runs automatically before `next build` (npm prebuild hook).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const RECIPES_DIR = path.join(ROOT, "data", "recipes");
const TAXO = path.join(ROOT, "data", "taxonomy");
const OUT = path.join(ROOT, "public", "search-index.json");

type AnyRecipe = Record<string, any>;

const files = fs.readdirSync(RECIPES_DIR).filter((f) => f.endsWith(".json"));
const seen = new Set<string>();
const recipes: AnyRecipe[] = [];
for (const f of files) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECIPES_DIR, f), "utf8"))) {
    if (seen.has(r.slug)) continue;
    seen.add(r.slug);
    recipes.push(r);
  }
}

const ingredients = JSON.parse(fs.readFileSync(path.join(TAXO, "ingredients.json"), "utf8"));
const cuisines = JSON.parse(fs.readFileSync(path.join(TAXO, "cuisines.json"), "utf8"));

const index = {
  generatedAt: new Date().toISOString(),
  ingredients: ingredients.map((i: AnyRecipe) => ({
    slug: i.slug,
    name: i.name,
    ta: i.ta,
    hi: i.hi,
    aliases: i.aliases,
    pantryStaple: i.pantryStaple,
  })),
  cuisineNames: Object.fromEntries(cuisines.map((c: AnyRecipe) => [c.slug, c.name])),
  recipes: recipes.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    nativeTitle: r.nativeTitle,
    cuisine: r.cuisine,
    country: r.country,
    region: r.region,
    mealType: r.mealType,
    dietType: r.dietType,
    difficulty: r.difficulty,
    spiceLevel: r.spiceLevel,
    budgetLevel: r.budgetLevel,
    totalTimeMinutes: r.totalTimeMinutes,
    servings: r.servings,
    req: [...new Set(r.ingredients.filter((i: AnyRecipe) => !i.optional).map((i: AnyRecipe) => i.normalizedName))],
    opt: [...new Set(r.ingredients.filter((i: AnyRecipe) => i.optional).map((i: AnyRecipe) => i.normalizedName))],
    subs: r.substitutions.map((s: AnyRecipe) => [s.ingredient, s.substitute]),
    cookware: r.cookware,
    methods: r.methods,
    tags: r.tags,
    allergens: r.allergens,
    verificationStatus: r.verificationStatus,
  })),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(index));
const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log(`build-search-index: ${index.recipes.length} recipes, ${index.ingredients.length} ingredients -> public/search-index.json (${kb} KB)`);

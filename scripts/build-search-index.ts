/**
 * build-search-index.ts — compiles the compact client-side index used by
 * /what-can-i-cook and /search into public/search-index.json.
 *
 * Phase 3 adds deterministic ingredient importance, feasible substitution
 * metadata and a corpus version without changing the canonical recipe JSON.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const RECIPES_DIR = path.join(ROOT, "data", "recipes");
const TAXO = path.join(ROOT, "data", "taxonomy");
const OUT = path.join(ROOT, "public", "search-index.json");

const SCHEMA_VERSION = 3;
const IMPORTANCE_WEIGHT = {
  identity: 8,
  structural: 5,
  important: 3,
  flavour: 1.5,
  optional: 0.25,
  pantry: 0,
} as const;

type AnyRecipe = Record<string, any>;
type Importance = keyof typeof IMPORTANCE_WEIGHT;
type Quality = "equivalent" | "good" | "workable" | "identity_change";

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const files = fs.readdirSync(RECIPES_DIR).filter((file) => file.endsWith(".json")).sort();
const seen = new Set<string>();
const recipes: AnyRecipe[] = [];
for (const file of files) {
  for (const recipe of JSON.parse(fs.readFileSync(path.join(RECIPES_DIR, file), "utf8"))) {
    if (seen.has(recipe.slug)) throw new Error(`duplicate slug reached search-index build: ${recipe.slug}`);
    seen.add(recipe.slug);
    recipes.push(recipe);
  }
}

const ingredients = JSON.parse(fs.readFileSync(path.join(TAXO, "ingredients.json"), "utf8")) as AnyRecipe[];
const cuisines = JSON.parse(fs.readFileSync(path.join(TAXO, "cuisines.json"), "utf8")) as AnyRecipe[];
const ingredientBySlug = new Map(ingredients.map((ingredient) => [ingredient.slug, ingredient]));

const aliasEntries = ingredients
  .flatMap((ingredient) => {
    const terms = [
      ingredient.slug.replace(/-/g, " "),
      ingredient.name.replace(/\s*\(.*\)\s*/g, ""),
      ingredient.ta,
      ingredient.hi,
      ...(ingredient.aliases ?? []),
    ]
      .filter(Boolean)
      .map((term: string) => normalise(term))
      .filter((term: string) => term.length >= 2);
    return [...new Set(terms)].map((term) => ({ term, slug: ingredient.slug }));
  })
  .sort((a, b) => b.term.length - a.term.length);

function titleMentionsIngredient(recipe: AnyRecipe, ingredient: AnyRecipe): boolean {
  const title = normalise(`${recipe.title ?? ""} ${recipe.nativeTitle ?? ""}`);
  const terms = [
    ingredient.slug.replace(/-/g, " "),
    ingredient.name.replace(/\s*\(.*\)\s*/g, ""),
    ingredient.ta,
    ingredient.hi,
    ...(ingredient.aliases ?? []),
  ]
    .filter(Boolean)
    .map((term: string) => normalise(term))
    .filter((term: string) => term.length >= 3);
  return terms.some((term) => new RegExp(`(?:^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\s)`).test(title));
}

function importanceFor(recipe: AnyRecipe, ingredient: AnyRecipe, index: number): Importance {
  if (ingredient.optional) return "optional";
  const definition = ingredientBySlug.get(ingredient.normalizedName);
  if (definition?.pantryStaple) return "pantry";
  if (definition && titleMentionsIngredient(recipe, definition)) return "identity";

  const category = definition?.category;
  if (["meat", "seafood", "egg", "grain", "pulse"].includes(category)) return "structural";
  if (category === "dairy" && /paneer|cheese|curd|yog|cream|milk|khoya/.test(ingredient.normalizedName)) {
    return index <= 2 ? "structural" : "important";
  }
  if (index === 0 && !["spice", "herb", "oil", "condiment", "sweetener"].includes(category)) return "structural";
  if (index <= 2 || ["vegetable", "fruit", "nut"].includes(category)) return "important";
  return "flavour";
}

function replacementSlugs(text: string): string[] {
  const source = ` ${normalise(text)} `;
  const found: string[] = [];
  for (const entry of aliasEntries) {
    if (found.includes(entry.slug)) continue;
    if (source.includes(` ${entry.term} `)) found.push(entry.slug);
    if (found.length >= 3) break;
  }
  return found;
}

function substitutionQuality(
  sourceSlug: string,
  replacements: string[],
  ingredientMeta: Record<string, { importance: Importance; weight: number }>,
): Quality {
  if (replacements.includes(sourceSlug)) return "equivalent";
  const source = ingredientBySlug.get(sourceSlug);
  const sourceCategory = source?.category;
  const replacementCategories = replacements
    .map((slug) => ingredientBySlug.get(slug)?.category)
    .filter(Boolean);
  if (replacements.length && replacementCategories.every((category) => category === sourceCategory)) return "good";
  if (ingredientMeta[sourceSlug]?.importance === "identity") return "identity_change";
  return replacements.length ? "workable" : "workable";
}

const compactRecipes = recipes.map((recipe) => {
  const requiredIngredients = recipe.ingredients.filter((ingredient: AnyRecipe) => !ingredient.optional);
  const optionalIngredients = recipe.ingredients.filter((ingredient: AnyRecipe) => ingredient.optional);
  const ingredientMeta: Record<string, { importance: Importance; weight: number }> = {};

  recipe.ingredients.forEach((ingredient: AnyRecipe, index: number) => {
    const importance = importanceFor(recipe, ingredient, index);
    const existing = ingredientMeta[ingredient.normalizedName];
    if (!existing || IMPORTANCE_WEIGHT[importance] > existing.weight) {
      ingredientMeta[ingredient.normalizedName] = { importance, weight: IMPORTANCE_WEIGHT[importance] };
    }
  });

  const subMeta = recipe.substitutions.map((substitution: AnyRecipe) => {
    const replacements = replacementSlugs(`${substitution.substitute ?? ""} ${substitution.notes ?? ""}`);
    return {
      ingredient: substitution.ingredient,
      substitute: substitution.substitute,
      replacementSlugs: replacements,
      quality: substitutionQuality(substitution.ingredient, replacements, ingredientMeta),
    };
  });

  return {
    id: recipe.id,
    slug: recipe.slug,
    title: recipe.title,
    nativeTitle: recipe.nativeTitle,
    cuisine: recipe.cuisine,
    country: recipe.country,
    region: recipe.region,
    mealType: recipe.mealType,
    dietType: recipe.dietType,
    difficulty: recipe.difficulty,
    spiceLevel: recipe.spiceLevel,
    budgetLevel: recipe.budgetLevel,
    totalTimeMinutes: recipe.totalTimeMinutes,
    servings: recipe.servings,
    req: [...new Set(requiredIngredients.map((ingredient: AnyRecipe) => ingredient.normalizedName))],
    opt: [...new Set(optionalIngredients.map((ingredient: AnyRecipe) => ingredient.normalizedName))],
    subs: recipe.substitutions.map((substitution: AnyRecipe) => [substitution.ingredient, substitution.substitute]),
    ingredientMeta,
    subMeta,
    cookware: recipe.cookware,
    methods: recipe.methods,
    tags: recipe.tags,
    allergens: recipe.allergens,
    verificationStatus: recipe.verificationStatus,
  };
});

const corpusVersion = createHash("sha256")
  .update(JSON.stringify({ recipes: compactRecipes, ingredients }))
  .digest("hex")
  .slice(0, 20);

const index = {
  schemaVersion: SCHEMA_VERSION,
  corpusVersion,
  generatedAt: new Date().toISOString(),
  ingredients: ingredients.map((ingredient) => ({
    slug: ingredient.slug,
    name: ingredient.name,
    ta: ingredient.ta,
    hi: ingredient.hi,
    aliases: ingredient.aliases,
    pantryStaple: ingredient.pantryStaple,
    category: ingredient.category,
    allergens: ingredient.allergens,
  })),
  cuisineNames: Object.fromEntries(cuisines.map((cuisine) => [cuisine.slug, cuisine.name])),
  recipes: compactRecipes,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(index));
const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log(
  `build-search-index: schema ${SCHEMA_VERSION}, corpus ${corpusVersion}, ${index.recipes.length} recipes, ${index.ingredients.length} ingredients -> public/search-index.json (${kb} KB)`,
);

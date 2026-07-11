/**
 * Server-side data layer. Reads the JSON data store at build time.
 * All functions are cached per-process — safe for static generation.
 *
 * The upgrade path to Supabase/Postgres: swap these loaders for DB queries
 * (schema mirror in db/schema.sql); every consumer takes typed objects.
 */
import fs from "node:fs";
import path from "node:path";
import type {
  Recipe, IngredientDef, CuisineDef, CountryDef, RegionDef, MethodDef,
  DietDef, CookwareDef, TagDef, CollectionDef, RecipeIndexEntry,
} from "./types";
import { applyIngredientCorrections, applyRecipeCorrections } from "./corpus-corrections";

const ROOT = process.cwd();
const TAXO = path.join(ROOT, "data", "taxonomy");
const RECIPES_DIR = path.join(ROOT, "data", "recipes");

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

let _recipes: Recipe[] | null = null;
export function getAllRecipes(): Recipe[] {
  if (_recipes) return _recipes;
  const files = fs.readdirSync(RECIPES_DIR).filter((file) => file.endsWith(".json")).sort();
  const all: Recipe[] = [];
  const seen = new Map<string, string>();
  for (const file of files) {
    for (const rawRecipe of readJson<Recipe[]>(path.join(RECIPES_DIR, file))) {
      const prior = seen.get(rawRecipe.slug);
      if (prior) throw new Error(`Duplicate recipe slug "${rawRecipe.slug}" in ${prior} and ${file}`);
      seen.set(rawRecipe.slug, file);
      all.push(applyRecipeCorrections(rawRecipe));
    }
  }
  all.sort((a, b) => a.title.localeCompare(b.title));
  _recipes = all;
  return all;
}

export function getRecipeBySlug(slug: string): Recipe | undefined {
  return getAllRecipes().find((recipe) => recipe.slug === slug);
}

let _ingredients: IngredientDef[] | null = null;
export function getIngredients(): IngredientDef[] {
  return (_ingredients ??= readJson<IngredientDef[]>(path.join(TAXO, "ingredients.json")).map(applyIngredientCorrections));
}
export function getIngredient(slug: string) {
  return getIngredients().find((ingredient) => ingredient.slug === slug);
}

let _cuisines: CuisineDef[] | null = null;
export function getCuisines(): CuisineDef[] {
  return (_cuisines ??= readJson<CuisineDef[]>(path.join(TAXO, "cuisines.json")));
}
export function getCuisine(slug: string) {
  return getCuisines().find((cuisine) => cuisine.slug === slug);
}

let _countries: CountryDef[] | null = null;
export function getCountries(): CountryDef[] {
  return (_countries ??= readJson<CountryDef[]>(path.join(TAXO, "countries.json")));
}
export function getCountry(slug: string) {
  return getCountries().find((country) => country.slug === slug);
}

let _regions: RegionDef[] | null = null;
export function getRegions(): RegionDef[] {
  return (_regions ??= readJson<RegionDef[]>(path.join(TAXO, "regions.json")));
}
export function getRegion(slug: string) {
  return getRegions().find((region) => region.slug === slug);
}

let _methods: MethodDef[] | null = null;
export function getMethods(): MethodDef[] {
  return (_methods ??= readJson<MethodDef[]>(path.join(TAXO, "methods.json")));
}
export function getMethod(slug: string) {
  return getMethods().find((method) => method.slug === slug);
}

let _diets: DietDef[] | null = null;
export function getDiets(): DietDef[] {
  return (_diets ??= readJson<DietDef[]>(path.join(TAXO, "diets.json")));
}
export function getDiet(slug: string) {
  return getDiets().find((diet) => diet.slug === slug);
}

let _cookware: CookwareDef[] | null = null;
export function getCookware(): CookwareDef[] {
  return (_cookware ??= readJson<CookwareDef[]>(path.join(TAXO, "cookware.json")));
}

let _tags: TagDef[] | null = null;
export function getTags(): TagDef[] {
  return (_tags ??= readJson<TagDef[]>(path.join(TAXO, "tags.json")));
}

let _collections: CollectionDef[] | null = null;
export function getCollections(): CollectionDef[] {
  return (_collections ??= readJson<CollectionDef[]>(path.join(TAXO, "collections.json")));
}
export function getCollection(slug: string) {
  return getCollections().find((collection) => collection.slug === slug);
}

/** Recipes matching a collection's rule groups (OR across groups, AND within). */
export function getCollectionRecipes(collection: CollectionDef): Recipe[] {
  return getAllRecipes().filter((recipe) =>
    collection.rules.some((rule) => {
      if (rule.tags && !rule.tags.some((tag) => recipe.tags.includes(tag))) return false;
      if (rule.cuisines && !rule.cuisines.includes(recipe.cuisine)) return false;
      if (rule.methods && !rule.methods.some((method) => recipe.methods.includes(method))) return false;
      if (rule.dietTypes && !rule.dietTypes.some((diet) => recipe.dietType.includes(diet as never))) return false;
      if (rule.mealTypes && !rule.mealTypes.some((meal) => recipe.mealType.includes(meal as never))) return false;
      if (rule.budgetLevels && !rule.budgetLevels.includes(recipe.budgetLevel)) return false;
      if (rule.maxTotalTimeMinutes && recipe.totalTimeMinutes > rule.maxTotalTimeMinutes) return false;
      if (
        rule.ingredients
        && !rule.ingredients.some((ingredient) => recipe.ingredients.some((item) => item.normalizedName === ingredient))
      ) return false;
      return true;
    }),
  );
}

export function getRecipesByCuisine(slug: string): Recipe[] {
  return getAllRecipes().filter((recipe) => recipe.cuisine === slug);
}
export function getRecipesByCountry(slug: string): Recipe[] {
  return getAllRecipes().filter((recipe) => recipe.country === slug);
}
export function getRecipesByRegion(slug: string): Recipe[] {
  return getAllRecipes().filter((recipe) => recipe.region === slug);
}
export function getRecipesByMethod(slug: string): Recipe[] {
  return getAllRecipes().filter((recipe) => recipe.methods.includes(slug));
}
export function getRecipesByDiet(slug: string): Recipe[] {
  return getAllRecipes().filter((recipe) => recipe.dietType.includes(slug as never));
}
export function getRecipesByIngredient(slug: string): Recipe[] {
  return getAllRecipes().filter((recipe) => recipe.ingredients.some((ingredient) => ingredient.normalizedName === slug));
}

/** Compact index entry for client-side matching/search. */
export function toIndexEntry(recipe: Recipe): RecipeIndexEntry {
  const req = [...new Set(recipe.ingredients.filter((ingredient) => !ingredient.optional).map((ingredient) => ingredient.normalizedName))];
  const opt = [...new Set(recipe.ingredients.filter((ingredient) => ingredient.optional).map((ingredient) => ingredient.normalizedName))];
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
    req,
    opt,
    subs: recipe.substitutions.map((substitution) => [substitution.ingredient, substitution.substitute] as [string, string]),
    cookware: recipe.cookware,
    methods: recipe.methods,
    tags: recipe.tags,
    allergens: recipe.allergens,
    verificationStatus: recipe.verificationStatus,
  };
}

/** Related recipes: same cuisine first, then shared main ingredients. */
export function getRelatedRecipes(recipe: Recipe, limit = 6): Recipe[] {
  const mains = new Set(recipe.ingredients.filter((ingredient) => !ingredient.optional).map((ingredient) => ingredient.normalizedName));
  return getAllRecipes()
    .filter((candidate) => candidate.slug !== recipe.slug)
    .map((candidate) => {
      const shared = candidate.ingredients.filter((ingredient) => mains.has(ingredient.normalizedName)).length;
      const sameCuisine = candidate.cuisine === recipe.cuisine ? 3 : 0;
      return { recipe: candidate, score: shared + sameCuisine };
    })
    .filter((candidate) => candidate.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((candidate) => candidate.recipe);
}

/** Same dish family across other cultures: shared key ingredients, different cuisine. */
export function getCrossCultureRecipes(recipe: Recipe, limit = 4): Recipe[] {
  const mains = new Set(recipe.ingredients.filter((ingredient) => !ingredient.optional).map((ingredient) => ingredient.normalizedName));
  return getAllRecipes()
    .filter((candidate) => candidate.slug !== recipe.slug && candidate.cuisine !== recipe.cuisine)
    .map((candidate) => ({
      recipe: candidate,
      shared: candidate.ingredients.filter((ingredient) =>
        mains.has(ingredient.normalizedName) && !["salt", "oil", "water"].includes(ingredient.normalizedName),
      ).length,
    }))
    .filter((candidate) => candidate.shared >= 3)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map((candidate) => candidate.recipe);
}

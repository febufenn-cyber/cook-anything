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

const ROOT = process.cwd();
const TAXO = path.join(ROOT, "data", "taxonomy");
const RECIPES_DIR = path.join(ROOT, "data", "recipes");

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

let _recipes: Recipe[] | null = null;
export function getAllRecipes(): Recipe[] {
  if (_recipes) return _recipes;
  const files = fs.readdirSync(RECIPES_DIR).filter((f) => f.endsWith(".json")).sort();
  const all: Recipe[] = [];
  const seen = new Map<string, string>();
  for (const f of files) {
    for (const r of readJson<Recipe[]>(path.join(RECIPES_DIR, f))) {
      const prior = seen.get(r.slug);
      if (prior) throw new Error(`Duplicate recipe slug "${r.slug}" in ${prior} and ${f}`);
      seen.set(r.slug, f);
      all.push(r);
    }
  }
  all.sort((a, b) => a.title.localeCompare(b.title));
  _recipes = all;
  return all;
}

export function getRecipeBySlug(slug: string): Recipe | undefined {
  return getAllRecipes().find((r) => r.slug === slug);
}

let _ingredients: IngredientDef[] | null = null;
export function getIngredients(): IngredientDef[] {
  return (_ingredients ??= readJson<IngredientDef[]>(path.join(TAXO, "ingredients.json")));
}
export function getIngredient(slug: string) {
  return getIngredients().find((i) => i.slug === slug);
}

let _cuisines: CuisineDef[] | null = null;
export function getCuisines(): CuisineDef[] {
  return (_cuisines ??= readJson<CuisineDef[]>(path.join(TAXO, "cuisines.json")));
}
export function getCuisine(slug: string) {
  return getCuisines().find((c) => c.slug === slug);
}

let _countries: CountryDef[] | null = null;
export function getCountries(): CountryDef[] {
  return (_countries ??= readJson<CountryDef[]>(path.join(TAXO, "countries.json")));
}
export function getCountry(slug: string) {
  return getCountries().find((c) => c.slug === slug);
}

let _regions: RegionDef[] | null = null;
export function getRegions(): RegionDef[] {
  return (_regions ??= readJson<RegionDef[]>(path.join(TAXO, "regions.json")));
}
export function getRegion(slug: string) {
  return getRegions().find((r) => r.slug === slug);
}

let _methods: MethodDef[] | null = null;
export function getMethods(): MethodDef[] {
  return (_methods ??= readJson<MethodDef[]>(path.join(TAXO, "methods.json")));
}
export function getMethod(slug: string) {
  return getMethods().find((m) => m.slug === slug);
}

let _diets: DietDef[] | null = null;
export function getDiets(): DietDef[] {
  return (_diets ??= readJson<DietDef[]>(path.join(TAXO, "diets.json")));
}
export function getDiet(slug: string) {
  return getDiets().find((d) => d.slug === slug);
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
  return getCollections().find((c) => c.slug === slug);
}

/** Recipes matching a collection's rule groups (OR across groups, AND within). */
export function getCollectionRecipes(col: CollectionDef): Recipe[] {
  return getAllRecipes().filter((r) =>
    col.rules.some((rule) => {
      if (rule.tags && !rule.tags.some((t) => r.tags.includes(t))) return false;
      if (rule.cuisines && !rule.cuisines.includes(r.cuisine)) return false;
      if (rule.methods && !rule.methods.some((m) => r.methods.includes(m))) return false;
      if (rule.dietTypes && !rule.dietTypes.some((d) => r.dietType.includes(d as never))) return false;
      if (rule.mealTypes && !rule.mealTypes.some((m) => r.mealType.includes(m as never))) return false;
      if (rule.budgetLevels && !rule.budgetLevels.includes(r.budgetLevel)) return false;
      if (rule.maxTotalTimeMinutes && r.totalTimeMinutes > rule.maxTotalTimeMinutes) return false;
      if (
        rule.ingredients &&
        !rule.ingredients.some((ing) => r.ingredients.some((ri) => ri.normalizedName === ing))
      )
        return false;
      return true;
    }),
  );
}

export function getRecipesByCuisine(slug: string): Recipe[] {
  return getAllRecipes().filter((r) => r.cuisine === slug);
}
export function getRecipesByCountry(slug: string): Recipe[] {
  return getAllRecipes().filter((r) => r.country === slug);
}
export function getRecipesByRegion(slug: string): Recipe[] {
  return getAllRecipes().filter((r) => r.region === slug);
}
export function getRecipesByMethod(slug: string): Recipe[] {
  return getAllRecipes().filter((r) => r.methods.includes(slug));
}
export function getRecipesByDiet(slug: string): Recipe[] {
  return getAllRecipes().filter((r) => r.dietType.includes(slug as never));
}
export function getRecipesByIngredient(slug: string): Recipe[] {
  return getAllRecipes().filter((r) => r.ingredients.some((i) => i.normalizedName === slug));
}

/** Compact index entry for client-side matching/search. */
export function toIndexEntry(r: Recipe): RecipeIndexEntry {
  const req = [...new Set(r.ingredients.filter((i) => !i.optional).map((i) => i.normalizedName))];
  const opt = [...new Set(r.ingredients.filter((i) => i.optional).map((i) => i.normalizedName))];
  return {
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
    req,
    opt,
    subs: r.substitutions.map((s) => [s.ingredient, s.substitute] as [string, string]),
    cookware: r.cookware,
    methods: r.methods,
    tags: r.tags,
    allergens: r.allergens,
    verificationStatus: r.verificationStatus,
  };
}

/** Related recipes: same cuisine first, then shared main ingredients. */
export function getRelatedRecipes(recipe: Recipe, limit = 6): Recipe[] {
  const mains = new Set(recipe.ingredients.filter((i) => !i.optional).map((i) => i.normalizedName));
  return getAllRecipes()
    .filter((r) => r.slug !== recipe.slug)
    .map((r) => {
      const shared = r.ingredients.filter((i) => mains.has(i.normalizedName)).length;
      const sameCuisine = r.cuisine === recipe.cuisine ? 3 : 0;
      return { r, score: shared + sameCuisine };
    })
    .filter((x) => x.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.r);
}

/** Same dish family across other cultures: shared key ingredients, different cuisine. */
export function getCrossCultureRecipes(recipe: Recipe, limit = 4): Recipe[] {
  const mains = new Set(recipe.ingredients.filter((i) => !i.optional).map((i) => i.normalizedName));
  return getAllRecipes()
    .filter((r) => r.slug !== recipe.slug && r.cuisine !== recipe.cuisine)
    .map((r) => ({
      r,
      shared: r.ingredients.filter((i) => mains.has(i.normalizedName) && !["salt", "oil", "water"].includes(i.normalizedName)).length,
    }))
    .filter((x) => x.shared >= 3)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map((x) => x.r);
}

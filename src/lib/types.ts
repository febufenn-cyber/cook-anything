/**
 * Cook Anything — canonical data model.
 *
 * This is the single source of truth for the recipe platform's shapes.
 * A Postgres-compatible mirror of this schema lives in db/schema.sql for the
 * Supabase upgrade path. Seed data is stored as JSON batch files under
 * data/recipes/ and validated by scripts/validate-recipes.ts.
 */

export type VerificationStatus =
  | "ai_drafted"
  | "editor_needed"
  | "community_submitted"
  | "public_domain_imported"
  | "open_license_imported"
  | "licensed_partner"
  | "verified";

export type Difficulty = "easy" | "medium" | "hard";
export type SpiceLevel = "none" | "mild" | "medium" | "hot" | "very_hot";
export type BudgetLevel = "budget" | "moderate" | "premium";

export type MealType =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "dessert"
  | "side"
  | "drink"
  | "tiffin";

export type DietType =
  | "vegetarian"
  | "vegan"
  | "eggetarian"
  | "non_vegetarian"
  | "pescatarian"
  | "high_protein"
  | "low_carb"
  | "gluten_free_placeholder"
  | "dairy_free_placeholder"
  | "diabetic_friendly_placeholder";

export type Allergen =
  | "dairy"
  | "gluten"
  | "nuts"
  | "peanuts"
  | "soy"
  | "egg"
  | "fish"
  | "shellfish"
  | "sesame"
  | "mustard";

export type Unit =
  | "g"
  | "kg"
  | "ml"
  | "l"
  | "tsp"
  | "tbsp"
  | "cup"
  | "piece"
  | "whole"
  | "clove"
  | "sprig"
  | "leaf"
  | "pinch"
  | "handful"
  | "inch"
  | "cm"
  | "slice"
  | "bunch"
  | "can"
  | "to_taste";

export interface RecipeIngredient {
  /** Display name as a cook would say it, e.g. "curd (thick, sour)" */
  name: string;
  /** Slug from data/taxonomy/ingredients.json, e.g. "curd". Drives matching. */
  normalizedName: string;
  quantity: number | null;
  unit: Unit | null;
  optional: boolean;
  notes?: string;
}

export interface RecipeStep {
  order: number;
  text: string;
  /** Minutes for a timer if this step involves timed waiting/cooking. */
  timerMinutes?: number;
  /** Method slug from data/taxonomy/methods.json if the step is method-defining. */
  method?: string;
}

export interface Substitution {
  /** normalizedName of the ingredient being replaced */
  ingredient: string;
  /** What to use instead (free text, may reference another normalizedName) */
  substitute: string;
  notes?: string;
}

export interface Nutrition {
  /** All values are per-serving ESTIMATES unless recipe is `verified`. */
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  isEstimate: boolean;
}

export interface Translations {
  /** BCP-47 language code -> translated strings. Structure-ready; filled later. */
  [lang: string]: {
    title?: string;
    description?: string;
    ingredientNames?: string[];
    stepTexts?: string[];
  };
}

export interface Recipe {
  id: string;
  slug: string;
  title: string;
  /** Name in the dish's own language/script, e.g. "மிளகு கோழி வறுவல்" */
  nativeTitle: string | null;
  description: string;
  /** Slug from data/taxonomy/cuisines.json */
  cuisine: string;
  /** Slug from data/taxonomy/countries.json */
  country: string;
  /** Slug from data/taxonomy/regions.json, or null */
  region: string | null;
  /** BCP-47 code of the primary authored language */
  language: string;
  mealType: MealType[];
  dietType: DietType[];
  difficulty: Difficulty;
  spiceLevel: SpiceLevel;
  budgetLevel: BudgetLevel;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes: number;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  /** Slugs from data/taxonomy/cookware.json */
  cookware: string[];
  /** Slugs from data/taxonomy/methods.json */
  methods: string[];
  /** Slugs from data/taxonomy/tags.json */
  tags: string[];
  allergens: Allergen[];
  nutrition: Nutrition | null;
  substitutions: Substitution[];
  culturalNote: string | null;
  regionalVariation: string | null;
  /** How to make this in an Indian home kitchen (kadai/tawa/cooker, local names, budget swaps) */
  indianKitchenAdaptation: string | null;
  /** Provenance: where this recipe's text came from */
  source: string;
  sourceUrl: string | null;
  /** e.g. "original", "CC0", "CC-BY-4.0", "public-domain", "all-rights-reserved" */
  license: string;
  author: string;
  verificationStatus: VerificationStatus;
  image: string | null;
  imageLicense: string | null;
  translations?: Translations;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------- Taxonomy shapes ------------------------- */

export interface IngredientDef {
  slug: string;
  name: string;
  /** Tamil name (Latin script) */
  ta: string | null;
  /** Hindi name (Latin script) */
  hi: string | null;
  category:
    | "vegetable"
    | "fruit"
    | "meat"
    | "seafood"
    | "dairy"
    | "grain"
    | "pulse"
    | "spice"
    | "herb"
    | "oil"
    | "condiment"
    | "nut"
    | "sweetener"
    | "egg"
    | "other";
  /** Assumed present in most kitchens (salt, water, oil) — never counted as "missing" */
  pantryStaple: boolean;
  /** Alternate spellings/names that should normalize to this slug */
  aliases: string[];
  allergens: Allergen[];
}

export interface CuisineDef {
  slug: string;
  name: string;
  /** Country slug, or null for umbrella cuisines (mediterranean, middle-eastern) */
  country: string | null;
  region: string | null;
  blurb: string;
  /** Signature ingredient slugs for internal linking */
  signatureIngredients: string[];
}

export interface CountryDef {
  slug: string;
  name: string;
  continent: string;
  blurb: string;
  cuisines: string[];
}

export interface RegionDef {
  slug: string;
  name: string;
  country: string;
  blurb: string;
}

export interface MethodDef {
  slug: string;
  name: string;
  blurb: string;
  /** Indian-kitchen equivalent note, e.g. oven -> kadai dum */
  indianEquivalent: string | null;
}

export interface DietDef {
  slug: DietType;
  name: string;
  blurb: string;
  isPlaceholderLabel: boolean;
}

export interface CookwareDef {
  slug: string;
  name: string;
  ta: string | null;
  hi: string | null;
  westernEquivalent: string | null;
}

export interface TagDef {
  slug: string;
  name: string;
  blurb: string;
}

export interface CollectionDef {
  slug: string;
  name: string;
  intro: string;
  /** Filter rules — a recipe belongs if it matches ANY rule group (each group is AND-ed) */
  rules: {
    tags?: string[];
    cuisines?: string[];
    methods?: string[];
    dietTypes?: string[];
    ingredients?: string[];
    mealTypes?: string[];
    maxTotalTimeMinutes?: number;
    budgetLevels?: BudgetLevel[];
  }[];
  relatedCollections: string[];
}

/* ------------------------- Matching shapes ------------------------- */

export interface MatchResult {
  recipe: RecipeIndexEntry;
  matched: string[];
  missing: string[];
  missingOptional: string[];
  substitutable: { ingredient: string; substitute: string }[];
  /** 0..1 — share of required ingredients covered (subs count at partial weight) */
  score: number;
  /** Human-readable reason this recipe matched */
  reason: string;
}

/** Compact entry used in the client-side search index (public/search-index.json) */
export interface RecipeIndexEntry {
  id: string;
  slug: string;
  title: string;
  nativeTitle: string | null;
  cuisine: string;
  country: string;
  region: string | null;
  mealType: MealType[];
  dietType: DietType[];
  difficulty: Difficulty;
  spiceLevel: SpiceLevel;
  budgetLevel: BudgetLevel;
  totalTimeMinutes: number;
  servings: number;
  /** required normalized ingredient slugs */
  req: string[];
  /** optional normalized ingredient slugs */
  opt: string[];
  /** substitutions as [ingredientSlug, substituteText] pairs */
  subs: [string, string][];
  cookware: string[];
  methods: string[];
  tags: string[];
  allergens: Allergen[];
  verificationStatus: VerificationStatus;
}

/**
 * The "What can I cook?" deterministic matching engine.
 *
 * Phase 3 ranks recognisable dishes rather than raw row overlap: identity and
 * structural ingredients matter more, substitutions count only when the user
 * actually has the replacement, pantry assumptions are disclosed, and hard
 * safety constraints filter instead of merely lowering a score.
 */
import type {
  FeasibleSubstitution,
  IngredientImportance,
  MatchBucket,
  MatchResult,
  RecipeIndexEntry,
  SubstitutionQuality,
} from "./types";

const DEFAULT_WEIGHTS: Record<IngredientImportance, number> = {
  identity: 8,
  structural: 5,
  important: 3,
  flavour: 1.5,
  optional: 0.25,
  pantry: 0,
};

const SUBSTITUTION_CREDIT: Record<SubstitutionQuality, number> = {
  equivalent: 0.9,
  good: 0.7,
  workable: 0.45,
  identity_change: 0.1,
};

const BUCKET_ORDER: Record<MatchBucket, number> = {
  ready: 0,
  very_close: 1,
  substitutable: 2,
  needs_shopping: 3,
};

const SPECIAL_COOKWARE = new Set(["oven", "air-fryer", "grill", "tandoor", "pressure-cooker", "idli-steamer", "steamer"]);
const INPUT_STOP_WORDS = new Set([
  "i", "have", "got", "with", "and", "some", "little", "a", "an", "the", "of", "leftover",
  "fresh", "small", "medium", "large", "one", "two", "three", "four", "five", "few", "about",
  "iruku", "irukku", "irukku", "hai", "hain", "mera", "mere", "konjam", "oru", "sila",
]);
const MEASUREMENT_WORDS = new Set([
  "g", "gram", "grams", "kg", "kilogram", "kilograms", "ml", "l", "litre", "liter", "cup", "cups",
  "tsp", "teaspoon", "teaspoons", "tbsp", "tablespoon", "tablespoons", "piece", "pieces", "packet",
  "packets", "bunch", "handful", "pinch", "spoon", "spoons", "small", "medium", "large",
]);

export interface PantryIngredient {
  slug: string;
  pantryStaple: boolean;
}

export interface MatchOptions {
  /** Ingredient slugs the user has. */
  have: string[];
  /** User-selected assumptions; these are disclosed on every result. */
  pantrySlugs: Set<string>;
  /** Hard filter: recipes containing any selected allergen are removed. */
  excludeAllergens?: string[];
  /** Hard filter: recipes containing an excluded ingredient are removed. */
  excludeIngredients?: string[];
  /** Special equipment the user says is available. Basic pots/pans remain assumed. */
  availableCookware?: string[];
  /** When true, recipes requiring unavailable special equipment are removed. */
  strictCookware?: boolean;
  maxTimeMinutes?: number;
  dietTypes?: string[];
  cuisines?: string[];
  maxMissing?: number;
}

export interface UnlockSuggestion {
  ingredient: string;
  score: number;
  recipesUnlocked: number;
  examples: string[];
}

export interface IngredientParseSuggestion {
  input: string;
  slugs: string[];
}

export interface IngredientParseResult {
  slugs: string[];
  unknown: string[];
  ambiguous: IngredientParseSuggestion[];
  suggestions: IngredientParseSuggestion[];
}

export type IngredientAliasMap = Map<string, string> & {
  candidateSlugs?: Map<string, string[]>;
  allTerms?: string[];
};

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ingredientMeta(recipe: RecipeIndexEntry, slug: string): { importance: IngredientImportance; weight: number } {
  const indexed = recipe.ingredientMeta?.[slug];
  if (indexed) return indexed;
  if (recipe.opt.includes(slug)) return { importance: "optional", weight: DEFAULT_WEIGHTS.optional };
  return { importance: "important", weight: DEFAULT_WEIGHTS.important };
}

function structuredSubstitutions(recipe: RecipeIndexEntry) {
  if (recipe.subMeta?.length) return recipe.subMeta;
  return recipe.subs.map(([ingredient, substitute]) => ({
    ingredient,
    substitute,
    replacementSlugs: [],
    quality: "workable" as const,
  }));
}

function unavailableSpecialCookware(recipe: RecipeIndexEntry, available: Set<string>): string[] {
  if (available.size === 0) return [];
  return recipe.cookware.filter((item) => SPECIAL_COOKWARE.has(item) && !available.has(item));
}

function bucketFor(
  missingIdentity: boolean,
  missingWeight: number,
  feasibleSubs: FeasibleSubstitution[],
  unavailableCookware: string[],
): MatchBucket {
  if (!missingIdentity && missingWeight === 0 && unavailableCookware.length === 0) return "ready";
  if (!missingIdentity && missingWeight <= DEFAULT_WEIGHTS.important && unavailableCookware.length === 0) return "very_close";
  if (!missingIdentity && feasibleSubs.some((sub) => sub.available) && missingWeight <= DEFAULT_WEIGHTS.structural) {
    return "substitutable";
  }
  return "needs_shopping";
}

function reasonFor(result: Pick<MatchResult, "bucket" | "matchedWeight" | "totalWeight" | "missingDetails" | "substitutable" | "unavailableCookware">): string {
  const coverage = result.totalWeight > 0 ? Math.round((result.matchedWeight / result.totalWeight) * 100) : 0;
  if (result.bucket === "ready") return "Ready to cook — every essential ingredient is covered";
  if (result.bucket === "very_close") {
    const missing = result.missingDetails[0];
    return missing ? `Very close — only ${missing.importance} ${missing.ingredient} is still needed` : `Very close — ${coverage}% of the important recipe is covered`;
  }
  if (result.bucket === "substitutable") {
    const available = result.substitutable.filter((sub) => sub.available).length;
    return `Possible with ${available} replacement${available === 1 ? "" : "s"} already in your kitchen`;
  }
  if (result.unavailableCookware.length) return `Needs equipment: ${result.unavailableCookware.join(", ")}`;
  const essential = result.missingDetails.filter((item) => item.essential).length;
  return `Needs shopping — ${essential} essential item${essential === 1 ? "" : "s"} missing`;
}

export function matchRecipes(recipes: RecipeIndexEntry[], opts: MatchOptions): MatchResult[] {
  const have = new Set(opts.have);
  const excludedIngredients = new Set(opts.excludeIngredients ?? []);
  const excludedAllergens = new Set(opts.excludeAllergens ?? []);
  const availableCookware = new Set(opts.availableCookware ?? []);
  const results: MatchResult[] = [];

  for (const recipe of recipes) {
    if (excludedAllergens.size && recipe.allergens.some((allergen) => excludedAllergens.has(allergen))) continue;
    if (excludedIngredients.size && [...recipe.req, ...recipe.opt].some((slug) => excludedIngredients.has(slug))) continue;
    if (opts.maxTimeMinutes && recipe.totalTimeMinutes > opts.maxTimeMinutes) continue;
    if (opts.dietTypes?.length && !opts.dietTypes.some((diet) => recipe.dietType.includes(diet as never))) continue;
    if (opts.cuisines?.length && !opts.cuisines.includes(recipe.cuisine)) continue;

    const unavailableCookware = unavailableSpecialCookware(recipe, availableCookware);
    if (opts.strictCookware && unavailableCookware.length) continue;

    const matched: string[] = [];
    const assumedPantry: string[] = [];
    const missingDetails: MatchResult["missingDetails"] = [];
    const feasibleSubs: FeasibleSubstitution[] = [];
    const substitutions = structuredSubstitutions(recipe);
    let matchedWeight = 0;
    let totalWeight = 0;

    for (const slug of recipe.req) {
      const meta = ingredientMeta(recipe, slug);
      if (meta.importance === "pantry" || meta.weight === 0) {
        if (!have.has(slug) && opts.pantrySlugs.has(slug)) assumedPantry.push(slug);
        continue;
      }
      totalWeight += meta.weight;
      if (have.has(slug)) {
        matched.push(slug);
        matchedWeight += meta.weight;
        continue;
      }
      if (opts.pantrySlugs.has(slug)) {
        assumedPantry.push(slug);
        matchedWeight += meta.weight;
        continue;
      }

      const candidates = substitutions.filter((substitution) => substitution.ingredient === slug);
      let bestCredit = 0;
      for (const candidate of candidates) {
        const available = candidate.replacementSlugs.some((replacement) => have.has(replacement));
        feasibleSubs.push({ ...candidate, available });
        if (available) bestCredit = Math.max(bestCredit, SUBSTITUTION_CREDIT[candidate.quality]);
      }
      if (bestCredit > 0) {
        matchedWeight += meta.weight * bestCredit;
      } else {
        missingDetails.push({
          ingredient: slug,
          importance: meta.importance,
          weight: meta.weight,
          essential: meta.importance === "identity" || meta.importance === "structural",
        });
      }
    }

    if (matched.length === 0) continue;
    if (opts.maxMissing !== undefined && missingDetails.length > opts.maxMissing) continue;

    const missingOptional = recipe.opt.filter((slug) => !have.has(slug) && !opts.pantrySlugs.has(slug));
    const missingIdentity = missingDetails.some((item) => item.importance === "identity");
    const missingWeight = missingDetails.reduce((sum, item) => sum + item.weight, 0);
    const cookwarePenalty = Math.min(0.3, unavailableCookware.length * 0.12);
    const identityPenalty = missingIdentity ? 0.25 : 0;
    const score = Math.max(0, Math.min(1, (totalWeight ? matchedWeight / totalWeight : 0) - cookwarePenalty - identityPenalty));
    const bucket = bucketFor(missingIdentity, missingWeight, feasibleSubs, unavailableCookware);

    const result: MatchResult = {
      recipe,
      matched,
      missing: missingDetails.map((item) => item.ingredient),
      missingOptional,
      substitutable: feasibleSubs,
      score,
      reason: "",
      bucket,
      missingDetails,
      assumedPantry,
      unavailableCookware,
      matchedWeight,
      totalWeight,
    };
    result.reason = reasonFor(result);
    results.push(result);
  }

  const sorted = results.sort((a, b) => {
    return BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket]
      || b.score - a.score
      || a.missingDetails.filter((item) => item.essential).length - b.missingDetails.filter((item) => item.essential).length
      || a.recipe.totalTimeMinutes - b.recipe.totalTimeMinutes
      || a.recipe.title.localeCompare(b.recipe.title);
  });

  return diversifyMatches(sorted);
}

/** Prevent one dish family or cuisine from flooding the first screen. */
export function diversifyMatches(results: MatchResult[], windowSize = 36): MatchResult[] {
  const pool = results.slice(0, Math.min(windowSize * 3, results.length));
  const tail = results.slice(pool.length);
  const selected: MatchResult[] = [];
  const familyCount = new Map<string, number>();
  const cuisineCount = new Map<string, number>();

  const family = (title: string) => normalise(title)
    .replace(/\b(easy|quick|spicy|classic|traditional|homestyle|restaurant|style|recipe|simple)\b/g, "")
    .trim();

  while (pool.length && selected.length < windowSize) {
    let bestIndex = 0;
    let bestPenalty = Number.POSITIVE_INFINITY;
    for (let index = 0; index < pool.length; index += 1) {
      const candidate = pool[index];
      const key = family(candidate.recipe.title);
      const penalty = (familyCount.get(key) ?? 0) * 8 + (cuisineCount.get(candidate.recipe.cuisine) ?? 0) * 1.5 + index * 0.01;
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestIndex = index;
      }
    }
    const [chosen] = pool.splice(bestIndex, 1);
    selected.push(chosen);
    const key = family(chosen.recipe.title);
    familyCount.set(key, (familyCount.get(key) ?? 0) + 1);
    cuisineCount.set(chosen.recipe.cuisine, (cuisineCount.get(chosen.recipe.cuisine) ?? 0) + 1);
  }

  return [...selected, ...pool, ...tail];
}

/** Rank one extra ingredient by how much weighted feasibility it unlocks. */
export function suggestUnlockIngredients(recipes: RecipeIndexEntry[], opts: MatchOptions, limit = 3): UnlockSuggestion[] {
  const have = new Set(opts.have);
  const candidates = new Map<string, { score: number; recipes: Set<string>; examples: string[] }>();

  for (const recipe of recipes) {
    if (opts.excludeAllergens?.length && recipe.allergens.some((allergen) => opts.excludeAllergens!.includes(allergen))) continue;
    if (opts.dietTypes?.length && !opts.dietTypes.some((diet) => recipe.dietType.includes(diet as never))) continue;
    const existingWeight = recipe.req.reduce((sum, slug) => have.has(slug) ? sum + ingredientMeta(recipe, slug).weight : sum, 0);
    if (existingWeight === 0) continue;

    for (const slug of recipe.req) {
      if (have.has(slug) || opts.pantrySlugs.has(slug)) continue;
      const meta = ingredientMeta(recipe, slug);
      if (meta.importance === "flavour" || meta.importance === "pantry") continue;
      const entry = candidates.get(slug) ?? { score: 0, recipes: new Set<string>(), examples: [] };
      const overlapFactor = Math.min(1, existingWeight / Math.max(meta.weight, 1));
      entry.score += meta.weight * (0.5 + overlapFactor);
      entry.recipes.add(recipe.slug);
      if (entry.examples.length < 3) entry.examples.push(recipe.title);
      candidates.set(slug, entry);
    }
  }

  return [...candidates.entries()]
    .map(([ingredient, value]) => ({ ingredient, score: value.score, recipesUnlocked: value.recipes.size, examples: value.examples }))
    .sort((a, b) => b.score - a.score || b.recipesUnlocked - a.recipesUnlocked || a.ingredient.localeCompare(b.ingredient))
    .slice(0, limit);
}

function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[b.length];
}

function fuzzyCandidates(term: string, aliasMap: IngredientAliasMap): string[] {
  const normalised = normalise(term);
  if (normalised.length < 3) return [];
  let bestDistance = Number.POSITIVE_INFINITY;
  const slugs = new Set<string>();
  for (const alias of aliasMap.allTerms ?? [...aliasMap.keys()]) {
    if (Math.abs(alias.length - normalised.length) > 2) continue;
    const distance = levenshtein(alias, normalised);
    const threshold = normalised.length <= 5 ? 1 : 2;
    if (distance > threshold) continue;
    if (distance < bestDistance) {
      bestDistance = distance;
      slugs.clear();
    }
    if (distance === bestDistance) {
      for (const slug of aliasMap.candidateSlugs?.get(alias) ?? [aliasMap.get(alias)!]) if (slug) slugs.add(slug);
    }
  }
  return [...slugs].slice(0, 3);
}

/**
 * Natural free-text parsing: quantities/connectors are ignored, longest aliases
 * are matched first, duplicate aliases become explicit ambiguity, and typos are
 * suggested rather than silently rewritten.
 */
export function parseIngredientInput(input: string, aliasMap: IngredientAliasMap): IngredientParseResult {
  let remaining = ` ${normalise(input.replace(/[½¼¾⅓⅔]/g, " ").replace(/\b\d+(?:[./]\d+)?\b/g, " "))} `;
  const slugs: string[] = [];
  const ambiguous: IngredientParseSuggestion[] = [];
  const terms = [...(aliasMap.allTerms ?? aliasMap.keys())].sort((a, b) => b.length - a.length);

  for (const term of terms) {
    const matcher = new RegExp(`(?:^|\\s)${escapeRegex(term)}(?=$|\\s)`, "g");
    if (!matcher.test(remaining)) continue;
    matcher.lastIndex = 0;
    const candidates = aliasMap.candidateSlugs?.get(term) ?? (aliasMap.get(term) ? [aliasMap.get(term)!] : []);
    if (candidates.length === 1) {
      if (!slugs.includes(candidates[0])) slugs.push(candidates[0]);
    } else if (candidates.length > 1) {
      ambiguous.push({ input: term, slugs: candidates });
    }
    remaining = remaining.replace(matcher, " ").replace(/\s+/g, " ");
  }

  const leftovers = normalise(remaining)
    .split(" ")
    .filter(Boolean)
    .filter((word) => !INPUT_STOP_WORDS.has(word) && !MEASUREMENT_WORDS.has(word));
  const unknown = [...new Set(leftovers)];
  const suggestions = unknown
    .map((term) => ({ input: term, slugs: fuzzyCandidates(term, aliasMap) }))
    .filter((suggestion) => suggestion.slugs.length > 0);
  const suggestedTerms = new Set(suggestions.map((suggestion) => suggestion.input));

  return {
    slugs,
    unknown: unknown.filter((term) => !suggestedTerms.has(term)),
    ambiguous,
    suggestions,
  };
}

/** Build a normalized alias index from English, Tamil/Tanglish, Hindi/Hinglish and declared aliases. */
export function buildAliasMap(
  ingredients: { slug: string; name: string; ta: string | null; hi: string | null; aliases: string[] }[],
): IngredientAliasMap {
  const candidates = new Map<string, string[]>();
  for (const ingredient of ingredients) {
    const keys = [
      ingredient.slug.replace(/-/g, " "),
      ingredient.name.replace(/\s*\(.*\)\s*/g, ""),
      ingredient.ta,
      ingredient.hi,
      ...ingredient.aliases,
    ].filter(Boolean) as string[];
    for (const raw of keys) {
      const key = normalise(raw);
      if (!key) continue;
      const values = candidates.get(key) ?? [];
      if (!values.includes(ingredient.slug)) values.push(ingredient.slug);
      candidates.set(key, values);
    }
  }

  const map = new Map<string, string>() as IngredientAliasMap;
  for (const [key, values] of candidates) if (values.length === 1) map.set(key, values[0]);
  map.candidateSlugs = candidates;
  map.allTerms = [...candidates.keys()];
  return map;
}

export function rankIngredientSuggestions<T extends { slug: string; name: string; ta: string | null; hi: string | null; aliases: string[] }>(
  query: string,
  ingredients: T[],
  excluded: Set<string>,
  limit = 6,
): T[] {
  const q = normalise(query);
  if (q.length < 2) return [];
  return ingredients
    .filter((ingredient) => !excluded.has(ingredient.slug))
    .map((ingredient) => {
      const terms = [ingredient.slug.replace(/-/g, " "), ingredient.name, ingredient.ta, ingredient.hi, ...ingredient.aliases]
        .filter(Boolean)
        .map((term) => normalise(String(term)));
      const prefix = terms.some((term) => term.startsWith(q));
      const contains = terms.some((term) => term.includes(q));
      const distance = Math.min(...terms.map((term) => levenshtein(q, term.slice(0, Math.max(q.length, Math.min(term.length, q.length + 2))))));
      return { ingredient, score: prefix ? 0 : contains ? 1 : distance <= 2 ? 2 + distance : 99 };
    })
    .filter((entry) => entry.score < 99)
    .sort((a, b) => a.score - b.score || a.ingredient.name.localeCompare(b.ingredient.name))
    .slice(0, limit)
    .map((entry) => entry.ingredient);
}

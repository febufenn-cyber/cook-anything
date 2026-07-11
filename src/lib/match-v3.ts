import type {
  FeasibleSubstitution,
  IngredientImportance,
  MatchBucket,
  MatchResult,
  RecipeIndexEntry,
  SubstitutionQuality,
} from "./types";

const WEIGHT: Record<IngredientImportance, number> = {
  identity: 8,
  structural: 5,
  important: 3,
  flavour: 1.5,
  optional: 0.25,
  pantry: 0.5,
};
const SUB_CREDIT: Record<SubstitutionQuality, number> = {
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
const SPECIAL_COOKWARE = new Set([
  "oven", "air-fryer", "grill", "tandoor", "pressure-cooker", "idli-steamer", "steamer",
]);
const STOP_WORDS = new Set([
  "i", "have", "got", "with", "and", "some", "little", "a", "an", "the", "of", "leftover",
  "fresh", "small", "medium", "large", "one", "two", "three", "four", "five", "few", "about",
  "iruku", "irukku", "hai", "hain", "mera", "mere", "konjam", "oru", "sila",
]);
const UNIT_WORDS = new Set([
  "g", "gram", "grams", "kg", "kilogram", "kilograms", "ml", "l", "litre", "liter", "cup", "cups",
  "tsp", "teaspoon", "teaspoons", "tbsp", "tablespoon", "tablespoons", "piece", "pieces", "packet",
  "packets", "bunch", "handful", "pinch", "spoon", "spoons",
]);

export interface PantryIngredient {
  slug: string;
  pantryStaple: boolean;
}

export interface MatchOptions {
  have: string[];
  pantrySlugs: Set<string>;
  excludeAllergens?: string[];
  excludeIngredients?: string[];
  /** Undefined means "equipment not declared"; [] means "no special equipment available". */
  availableCookware?: string[];
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

function metaFor(recipe: RecipeIndexEntry, slug: string): { importance: IngredientImportance; weight: number } {
  const indexed = recipe.ingredientMeta?.[slug];
  if (indexed) {
    return {
      importance: indexed.importance,
      weight: indexed.importance === "pantry" ? WEIGHT.pantry : indexed.weight,
    };
  }
  if (recipe.opt.includes(slug)) return { importance: "optional", weight: WEIGHT.optional };
  return { importance: "important", weight: WEIGHT.important };
}

function substitutionsFor(recipe: RecipeIndexEntry) {
  return recipe.subMeta?.length
    ? recipe.subMeta
    : recipe.subs.map(([ingredient, substitute]) => ({
        ingredient,
        substitute,
        replacementSlugs: [],
        quality: "workable" as const,
      }));
}

function unavailableEquipment(recipe: RecipeIndexEntry, declared: boolean, available: Set<string>): string[] {
  if (!declared) return [];
  return recipe.cookware.filter((item) => SPECIAL_COOKWARE.has(item) && !available.has(item));
}

function chooseBucket(
  missingIdentity: boolean,
  missingWeight: number,
  substitutions: FeasibleSubstitution[],
  unavailable: string[],
): MatchBucket {
  if (unavailable.length) return "needs_shopping";
  if (substitutions.some((substitution) => substitution.available)) return "substitutable";
  if (!missingIdentity && missingWeight === 0) return "ready";
  if (!missingIdentity && missingWeight <= WEIGHT.important) return "very_close";
  return "needs_shopping";
}

function reasonFor(result: MatchResult): string {
  const coverage = result.totalWeight ? Math.round((result.matchedWeight / result.totalWeight) * 100) : 0;
  if (result.bucket === "ready") return "Ready to cook — every required item is present or explicitly assumed";
  if (result.bucket === "substitutable") {
    const count = result.substitutable.filter((substitution) => substitution.available).length;
    return `Possible with ${count} replacement${count === 1 ? "" : "s"} already in your kitchen`;
  }
  if (result.bucket === "very_close") {
    const item = result.missingDetails[0];
    return item
      ? `Very close — only ${item.ingredient} (${item.importance}) is still needed`
      : `Very close — ${coverage}% weighted coverage`;
  }
  if (result.unavailableCookware.length) return `Needs equipment: ${result.unavailableCookware.join(", ")}`;
  const essential = result.missingDetails.filter((item) => item.essential).length;
  return `Needs shopping — ${essential} essential item${essential === 1 ? "" : "s"} missing`;
}

export function matchRecipes(recipes: RecipeIndexEntry[], options: MatchOptions): MatchResult[] {
  const have = new Set(options.have);
  const excludedIngredients = new Set(options.excludeIngredients ?? []);
  const excludedAllergens = new Set(options.excludeAllergens ?? []);
  const equipmentDeclared = options.availableCookware !== undefined;
  const availableEquipment = new Set(options.availableCookware ?? []);
  const results: MatchResult[] = [];

  for (const recipe of recipes) {
    if (recipe.allergens.some((allergen) => excludedAllergens.has(allergen))) continue;
    if ([...recipe.req, ...recipe.opt].some((slug) => excludedIngredients.has(slug))) continue;
    if (options.maxTimeMinutes && recipe.totalTimeMinutes > options.maxTimeMinutes) continue;
    if (options.dietTypes?.length && !options.dietTypes.some((diet) => recipe.dietType.includes(diet as never))) continue;
    if (options.cuisines?.length && !options.cuisines.includes(recipe.cuisine)) continue;

    const unavailableCookware = unavailableEquipment(recipe, equipmentDeclared, availableEquipment);
    if (options.strictCookware && unavailableCookware.length) continue;

    const matched: string[] = [];
    const assumedPantry: string[] = [];
    const missingDetails: MatchResult["missingDetails"] = [];
    const feasibleSubstitutions: FeasibleSubstitution[] = [];
    const substitutions = substitutionsFor(recipe);
    let matchedWeight = 0;
    let totalWeight = 0;

    for (const slug of recipe.req) {
      const meta = metaFor(recipe, slug);
      const effectiveWeight = Math.max(0.01, meta.weight);
      totalWeight += effectiveWeight;

      if (have.has(slug)) {
        matched.push(slug);
        matchedWeight += effectiveWeight;
        continue;
      }
      if (options.pantrySlugs.has(slug)) {
        assumedPantry.push(slug);
        matchedWeight += effectiveWeight;
        continue;
      }

      const candidates = substitutions.filter((substitution) => substitution.ingredient === slug);
      let bestCredit = 0;
      for (const candidate of candidates) {
        const available = candidate.replacementSlugs.some((replacement) => have.has(replacement));
        feasibleSubstitutions.push({ ...candidate, available });
        if (available) bestCredit = Math.max(bestCredit, SUB_CREDIT[candidate.quality]);
      }

      if (bestCredit > 0) {
        matchedWeight += effectiveWeight * bestCredit;
      } else {
        missingDetails.push({
          ingredient: slug,
          importance: meta.importance,
          weight: effectiveWeight,
          essential: meta.importance === "identity" || meta.importance === "structural",
        });
      }
    }

    if (matchedWeight <= 0) continue;
    if (options.maxMissing !== undefined && missingDetails.length > options.maxMissing) continue;

    const missingOptional = recipe.opt.filter((slug) => !have.has(slug) && !options.pantrySlugs.has(slug));
    const missingIdentity = missingDetails.some((item) => item.importance === "identity");
    const missingWeight = missingDetails.reduce((sum, item) => sum + item.weight, 0);
    const cookwarePenalty = Math.min(0.3, unavailableCookware.length * 0.12);
    const identityPenalty = missingIdentity ? 0.25 : 0;
    const score = Math.max(0, Math.min(1, matchedWeight / totalWeight - cookwarePenalty - identityPenalty));
    const bucket = chooseBucket(missingIdentity, missingWeight, feasibleSubstitutions, unavailableCookware);

    const result: MatchResult = {
      recipe,
      matched,
      missing: missingDetails.map((item) => item.ingredient),
      missingOptional,
      substitutable: feasibleSubstitutions,
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

  const sorted = results.sort((a, b) =>
    BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket]
    || b.score - a.score
    || a.missingDetails.filter((item) => item.essential).length - b.missingDetails.filter((item) => item.essential).length
    || a.recipe.totalTimeMinutes - b.recipe.totalTimeMinutes
    || a.recipe.title.localeCompare(b.recipe.title),
  );
  return diversifyMatches(sorted);
}

export function diversifyMatches(results: MatchResult[], windowSize = 36): MatchResult[] {
  const pool = results.slice(0, Math.min(results.length, windowSize * 3));
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
      const penalty = (familyCount.get(key) ?? 0) * 8
        + (cuisineCount.get(candidate.recipe.cuisine) ?? 0) * 1.5
        + index * 0.01;
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

export function suggestUnlockIngredients(recipes: RecipeIndexEntry[], options: MatchOptions, limit = 3): UnlockSuggestion[] {
  const have = new Set(options.have);
  const excluded = new Set(options.excludeIngredients ?? []);
  const candidates = new Map<string, { score: number; recipes: Set<string>; examples: string[] }>();

  for (const recipe of recipes) {
    if (options.excludeAllergens?.some((allergen) => recipe.allergens.includes(allergen as never))) continue;
    if (options.dietTypes?.length && !options.dietTypes.some((diet) => recipe.dietType.includes(diet as never))) continue;
    const overlap = recipe.req.reduce((sum, slug) => have.has(slug) ? sum + metaFor(recipe, slug).weight : sum, 0);
    if (overlap <= 0) continue;

    for (const slug of recipe.req) {
      if (have.has(slug) || options.pantrySlugs.has(slug) || excluded.has(slug)) continue;
      const meta = metaFor(recipe, slug);
      if (meta.importance === "flavour" || meta.importance === "pantry") continue;
      const entry = candidates.get(slug) ?? { score: 0, recipes: new Set<string>(), examples: [] };
      entry.score += meta.weight * (0.5 + Math.min(1, overlap / Math.max(meta.weight, 1)));
      entry.recipes.add(recipe.slug);
      if (entry.examples.length < 3) entry.examples.push(recipe.title);
      candidates.set(slug, entry);
    }
  }

  return [...candidates.entries()]
    .map(([ingredient, value]) => ({
      ingredient,
      score: value.score,
      recipesUnlocked: value.recipes.size,
      examples: value.examples,
    }))
    .sort((a, b) => b.score - a.score || b.recipesUnlocked - a.recipesUnlocked || a.ingredient.localeCompare(b.ingredient))
    .slice(0, limit);
}

function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

function fuzzyCandidates(term: string, aliasMap: IngredientAliasMap): string[] {
  const query = normalise(term);
  if (query.length < 3) return [];
  let bestDistance = Number.POSITIVE_INFINITY;
  const matches = new Set<string>();

  for (const alias of aliasMap.allTerms ?? [...aliasMap.keys()]) {
    if (Math.abs(alias.length - query.length) > 2) continue;
    const distance = levenshtein(alias, query);
    const threshold = query.length <= 5 ? 1 : 2;
    if (distance > threshold) continue;
    if (distance < bestDistance) {
      bestDistance = distance;
      matches.clear();
    }
    if (distance === bestDistance) {
      for (const slug of aliasMap.candidateSlugs?.get(alias) ?? [aliasMap.get(alias)!]) if (slug) matches.add(slug);
    }
  }
  return [...matches].slice(0, 3);
}

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
    .filter((word) => !STOP_WORDS.has(word) && !UNIT_WORDS.has(word));
  const unresolved = [...new Set(leftovers)];
  const suggestions = unresolved
    .map((term) => ({ input: term, slugs: fuzzyCandidates(term, aliasMap) }))
    .filter((suggestion) => suggestion.slugs.length > 0);
  const suggested = new Set(suggestions.map((suggestion) => suggestion.input));

  return {
    slugs,
    unknown: unresolved.filter((term) => !suggested.has(term)),
    ambiguous,
    suggestions,
  };
}

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

export function rankIngredientSuggestions<
  T extends { slug: string; name: string; ta: string | null; hi: string | null; aliases: string[] },
>(query: string, ingredients: T[], excluded: Set<string>, limit = 6): T[] {
  const normalizedQuery = normalise(query);
  if (normalizedQuery.length < 2) return [];

  return ingredients
    .filter((ingredient) => !excluded.has(ingredient.slug))
    .map((ingredient) => {
      const terms = [
        ingredient.slug.replace(/-/g, " "), ingredient.name, ingredient.ta, ingredient.hi, ...ingredient.aliases,
      ].filter(Boolean).map((term) => normalise(String(term)));
      const prefix = terms.some((term) => term.startsWith(normalizedQuery));
      const contains = terms.some((term) => term.includes(normalizedQuery));
      const distance = Math.min(...terms.map((term) => levenshtein(normalizedQuery, term)));
      return { ingredient, score: prefix ? 0 : contains ? 1 : distance <= 2 ? 2 + distance : 99 };
    })
    .filter((entry) => entry.score < 99)
    .sort((a, b) => a.score - b.score || a.ingredient.name.localeCompare(b.ingredient.name))
    .slice(0, limit)
    .map((entry) => entry.ingredient);
}

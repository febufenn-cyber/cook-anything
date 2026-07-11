/**
 * The "What can I cook?" matching engine.
 * Pure functions — used by client components against the search index,
 * and reusable server-side. This is the deterministic core that an LLM
 * assistant can later be layered on top of (see docs/AI-ASSISTANT.md).
 */
import type { MatchResult, RecipeIndexEntry } from "./types";

export interface PantryIngredient {
  slug: string;
  pantryStaple: boolean;
}

export interface MatchOptions {
  /** Ingredient slugs the user has */
  have: string[];
  /** Set of slugs that are pantry staples (never counted as missing) */
  pantrySlugs: Set<string>;
  /** Exclude recipes containing these allergens */
  excludeAllergens?: string[];
  /** Only recipes cookable with this cookware (empty = any) */
  cookware?: string[];
  maxTimeMinutes?: number;
  dietTypes?: string[];
  cuisines?: string[];
  maxMissing?: number;
}

export function matchRecipes(recipes: RecipeIndexEntry[], opts: MatchOptions): MatchResult[] {
  const have = new Set(opts.have);
  const results: MatchResult[] = [];

  for (const r of recipes) {
    if (opts.excludeAllergens?.length && r.allergens.some((a) => opts.excludeAllergens!.includes(a))) continue;
    if (opts.maxTimeMinutes && r.totalTimeMinutes > opts.maxTimeMinutes) continue;
    if (opts.dietTypes?.length && !opts.dietTypes.some((d) => r.dietType.includes(d as never))) continue;
    if (opts.cuisines?.length && !opts.cuisines.includes(r.cuisine)) continue;
    if (opts.cookware?.length && !r.cookware.every((c) => opts.cookware!.includes(c))) continue;

    const required = r.req.filter((s) => !opts.pantrySlugs.has(s));
    if (required.length === 0) continue;

    const matched = required.filter((s) => have.has(s));
    const missingAll = required.filter((s) => !have.has(s));
    const subMap = new Map(r.subs);
    const substitutable = missingAll
      .filter((s) => subMap.has(s))
      .map((s) => ({ ingredient: s, substitute: subMap.get(s)! }));
    const missing = missingAll.filter((s) => !subMap.has(s));
    const missingOptional = r.opt.filter((s) => !have.has(s) && !opts.pantrySlugs.has(s));

    if (matched.length === 0) continue;
    if (opts.maxMissing !== undefined && missingAll.length > opts.maxMissing) continue;

    const score = (matched.length + 0.5 * substitutable.length) / required.length;
    results.push({
      recipe: r,
      matched,
      missing,
      missingOptional,
      substitutable,
      score,
      reason: buildReason(matched.length, required.length, missing, substitutable),
    });
  }

  return results.sort(
    (a, b) =>
      b.score - a.score ||
      a.missing.length - b.missing.length ||
      a.recipe.totalTimeMinutes - b.recipe.totalTimeMinutes,
  );
}

function buildReason(
  matchedCount: number,
  requiredCount: number,
  missing: string[],
  substitutable: { ingredient: string; substitute: string }[],
): string {
  const parts: string[] = [`Uses ${matchedCount} of ${requiredCount} main ingredients you have`];
  if (missing.length === 0 && substitutable.length === 0) {
    return "You have everything this recipe needs";
  }
  if (substitutable.length > 0) {
    parts.push(`${substitutable.length} missing item${substitutable.length > 1 ? "s" : ""} can be substituted`);
  }
  if (missing.length > 0) {
    parts.push(`missing ${missing.length}`);
  }
  return parts.join(" — ");
}

/** Free-text ingredient parsing: "chicken, thayir, pyaz" -> canonical slugs. */
export function parseIngredientInput(
  input: string,
  aliasToSlug: Map<string, string>,
): { slugs: string[]; unknown: string[] } {
  const tokens = input
    .split(/[,\n;+]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const slugs: string[] = [];
  const unknown: string[] = [];
  for (const t of tokens) {
    const singular = t.endsWith("es") ? t.slice(0, -2) : t.endsWith("s") ? t.slice(0, -1) : t;
    const hit = aliasToSlug.get(t) ?? aliasToSlug.get(singular) ?? aliasToSlug.get(t.replace(/\s+/g, " "));
    if (hit) {
      if (!slugs.includes(hit)) slugs.push(hit);
    } else {
      unknown.push(t);
    }
  }
  return { slugs, unknown };
}

/** Build alias -> slug map from ingredient defs (name, ta, hi, aliases, slug). */
export function buildAliasMap(
  ingredients: { slug: string; name: string; ta: string | null; hi: string | null; aliases: string[] }[],
): Map<string, string> {
  const m = new Map<string, string>();
  for (const ing of ingredients) {
    const keys = [
      ing.slug,
      ing.name.toLowerCase().replace(/\s*\(.*\)\s*/g, "").trim(),
      ing.ta?.toLowerCase(),
      ing.hi?.toLowerCase(),
      ...ing.aliases.map((a) => a.toLowerCase()),
    ].filter(Boolean) as string[];
    for (const k of keys) if (!m.has(k)) m.set(k, ing.slug);
  }
  return m;
}

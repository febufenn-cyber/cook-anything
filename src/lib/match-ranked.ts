import type { MatchBucket, MatchResult, RecipeIndexEntry } from "./types";
import {
  diversifyMatches as diversifyGroup,
  matchRecipes as baseMatchRecipes,
  type MatchOptions,
} from "./match-v3";

const BUCKETS: MatchBucket[] = ["ready", "very_close", "substitutable", "needs_shopping"];

/**
 * Diversity is applied independently inside each feasibility bucket. A varied
 * but less cookable result must never leapfrog a genuinely ready result.
 */
export function diversifyMatches(results: MatchResult[], windowSize = 36): MatchResult[] {
  return BUCKETS.flatMap((bucket) => {
    const group = results
      .filter((result) => result.bucket === bucket)
      .sort((a, b) =>
        b.score - a.score
        || a.missingDetails.filter((item) => item.essential).length - b.missingDetails.filter((item) => item.essential).length
        || a.recipe.totalTimeMinutes - b.recipe.totalTimeMinutes
        || a.recipe.title.localeCompare(b.recipe.title),
      );
    return diversifyGroup(group, Math.min(windowSize, group.length));
  });
}

export function matchRecipes(recipes: RecipeIndexEntry[], options: MatchOptions): MatchResult[] {
  return diversifyMatches(baseMatchRecipes(recipes, options));
}

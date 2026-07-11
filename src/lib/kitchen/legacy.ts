"use client";

import { kitchenRepository } from "./repository";
import { isoNow } from "./schema";

const LEGACY_KEY = "ca:saved-recipes";
const MARKER_KEY = "cook-anything.kitchen.legacy-saved-migrated.v1";
let migrationPromise: Promise<void> | null = null;

interface LegacySavedRecipe {
  slug?: unknown;
  title?: unknown;
  cuisine?: unknown;
  savedAt?: unknown;
}

interface CompactSearchIndex {
  corpusVersion: string;
  recipes: Array<{ id: string; slug: string }>;
}

export function migrateLegacyCookbook(): Promise<void> {
  if (migrationPromise) return migrationPromise;
  migrationPromise = runMigration().catch(() => {
    migrationPromise = null;
  });
  return migrationPromise;
}

async function runMigration(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(MARKER_KEY) === "done") return;
  const raw = window.localStorage.getItem(LEGACY_KEY);
  if (!raw) {
    window.localStorage.setItem(MARKER_KEY, "done");
    return;
  }

  let legacy: LegacySavedRecipe[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error("invalid_legacy_cookbook");
    legacy = parsed.slice(0, 5_000) as LegacySavedRecipe[];
  } catch {
    return;
  }

  let index: CompactSearchIndex | null = null;
  try {
    const response = await fetch("/search-index.json", { cache: "no-cache" });
    if (response.ok) index = await response.json() as CompactSearchIndex;
  } catch {
    // Slug-based fallback still preserves the user's save.
  }
  const bySlug = new Map(index?.recipes.map((recipe) => [recipe.slug, recipe]) ?? []);

  for (const item of legacy) {
    if (typeof item.slug !== "string" || typeof item.title !== "string") continue;
    const slug = item.slug.slice(0, 200);
    const mapped = bySlug.get(slug);
    const existing = await kitchenRepository.getSavedRecipe(mapped?.id ?? slug);
    if (existing) continue;
    await kitchenRepository.saveRecipe({
      recipeId: mapped?.id ?? slug,
      recipeSlug: slug,
      recipeTitle: item.title.slice(0, 300),
      recipeVersion: index ? `${index.corpusVersion}:${slug}` : `legacy:${slug}`,
      savedAt: typeof item.savedAt === "string" && Number.isFinite(Date.parse(item.savedAt)) ? item.savedAt : isoNow(),
      timesCooked: 0,
      pinnedSubstitutions: [],
    });
  }

  window.localStorage.removeItem(LEGACY_KEY);
  window.localStorage.setItem(MARKER_KEY, "done");
}

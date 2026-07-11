"use client";

import { useEffect, useState } from "react";
import type { Allergen, IngredientDef, RecipeIndexEntry } from "@/lib/types";

export const SEARCH_INDEX_SCHEMA_VERSION = 3;

export interface SearchIngredient {
  slug: string;
  name: string;
  ta: string | null;
  hi: string | null;
  aliases: string[];
  pantryStaple: boolean;
  category: IngredientDef["category"];
  allergens: Allergen[];
}

export interface SearchIndex {
  schemaVersion: number;
  corpusVersion: string;
  generatedAt: string;
  ingredients: SearchIngredient[];
  cuisineNames: Record<string, string>;
  recipes: RecipeIndexEntry[];
}

let cached: SearchIndex | null = null;
let inflight: Promise<SearchIndex> | null = null;

function validateIndex(value: unknown): SearchIndex {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("search index is malformed");
  const index = value as Partial<SearchIndex>;
  if (index.schemaVersion !== SEARCH_INDEX_SCHEMA_VERSION) {
    throw new Error("search data changed — refresh to load the latest pantry index");
  }
  if (!index.corpusVersion || !Array.isArray(index.ingredients) || !Array.isArray(index.recipes)) {
    throw new Error("search index is incomplete");
  }
  return index as SearchIndex;
}

export function useSearchIndex(): { index: SearchIndex | null; error: string | null } {
  const [index, setIndex] = useState<SearchIndex | null>(cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cached) return;
    inflight ??= fetch("/search-index.json", { cache: "no-cache" }).then(async (response) => {
      if (!response.ok) throw new Error(`search index failed to load (${response.status})`);
      return validateIndex(await response.json());
    });
    inflight.then(
      (data) => {
        cached = data;
        setIndex(data);
      },
      (cause) => {
        inflight = null;
        setError(cause instanceof Error ? cause.message : "search index failed to load");
      },
    );
  }, []);

  return { index, error };
}

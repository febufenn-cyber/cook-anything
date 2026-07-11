"use client";

import { useEffect, useState } from "react";
import type { RecipeIndexEntry } from "@/lib/types";

export interface SearchIndex {
  generatedAt: string;
  ingredients: {
    slug: string;
    name: string;
    ta: string | null;
    hi: string | null;
    aliases: string[];
    pantryStaple: boolean;
  }[];
  cuisineNames: Record<string, string>;
  recipes: RecipeIndexEntry[];
}

let cached: SearchIndex | null = null;
let inflight: Promise<SearchIndex> | null = null;

export function useSearchIndex(): { index: SearchIndex | null; error: string | null } {
  const [index, setIndex] = useState<SearchIndex | null>(cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cached) return;
    inflight ??= fetch("/search-index.json").then((r) => {
      if (!r.ok) throw new Error(`search index failed to load (${r.status})`);
      return r.json();
    });
    inflight.then(
      (data) => {
        cached = data;
        setIndex(data);
      },
      (e) => setError(e.message),
    );
  }, []);

  return { index, error };
}

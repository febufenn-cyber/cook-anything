"use client";

/**
 * Family-cookbook foundation: saves live in localStorage today;
 * the same shape maps 1:1 to the saved_recipes table in db/schema.sql
 * when accounts land.
 */
import { useEffect, useState } from "react";

export interface SavedRecipe {
  slug: string;
  title: string;
  cuisine: string;
  collection: string;
  savedAt: string;
}

const KEY = "ca:saved-recipes";

export function readSaved(): SavedRecipe[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function writeSaved(list: SavedRecipe[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("ca:saved-changed"));
}

export default function SaveRecipeButton({
  slug,
  title,
  cuisine,
}: {
  slug: string;
  title: string;
  cuisine: string;
}) {
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSaved(readSaved().some((s) => s.slug === slug));
  }, [slug]);

  function toggle() {
    const list = readSaved();
    if (list.some((s) => s.slug === slug)) {
      writeSaved(list.filter((s) => s.slug !== slug));
      setSaved(false);
    } else {
      writeSaved([
        ...list,
        { slug, title, cuisine, collection: "Saved", savedAt: new Date().toISOString() },
      ]);
      setSaved(true);
    }
  }

  return (
    <button
      onClick={toggle}
      className={`no-print rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        saved
          ? "border-curry bg-curry-tint text-curry"
          : "border-cardamom bg-card text-tamarind-soft hover:border-curry"
      }`}
      aria-pressed={saved}
    >
      {mounted && saved ? "✓ In your cookbook" : "+ Save to cookbook"}
    </button>
  );
}

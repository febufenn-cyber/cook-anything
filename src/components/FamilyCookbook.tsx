"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { kitchenRepository, subscribeKitchenChanges } from "@/lib/kitchen/repository";
import type { SavedRecipe } from "@/lib/kitchen/types";

export default function FamilyCookbook() {
  const [saved, setSaved] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refresh = () => kitchenRepository.listSavedRecipes().then(setSaved).finally(() => setLoading(false));
    void refresh();
    return subscribeKitchenChanges(() => void refresh());
  }, []);

  if (loading) return <p className="text-sm text-tamarind-faint">Opening your cookbook…</p>;

  if (saved.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-cardamom bg-card p-10 text-center">
        <p className="font-display text-xl">Your cookbook is empty</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-tamarind-soft">
          Save recipes as you browse. Their exact recipe versions, cook count and personal notes stay in this browser and also appear in My Kitchen.
        </p>
        <Link href="/what-can-i-cook" className="mt-5 inline-block rounded-full bg-turmeric px-5 py-2.5 text-sm font-semibold text-tamarind">
          Find something to cook
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-tamarind-faint">Stored privately on this device · {saved.length} recipe{saved.length === 1 ? "" : "s"}</p>
        <Link href="/kitchen" className="rounded-full border border-cardamom bg-card px-4 py-2 text-sm font-medium">Manage all kitchen data</Link>
      </div>
      <ul className="mt-5 divide-y divide-cardamom rounded-card border border-cardamom bg-card shadow-lift">
        {saved.map((recipe) => (
          <li key={recipe.recipeId} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <Link href={`/recipes/${recipe.recipeSlug}`} className="font-medium hover:text-turmeric-deep">{recipe.recipeTitle}</Link>
              <p className="mt-1 text-xs text-tamarind-faint">
                Saved {new Date(recipe.savedAt).toLocaleDateString()} · cooked {recipe.timesCooked} time{recipe.timesCooked === 1 ? "" : "s"} · version {recipe.recipeVersion.slice(0, 12)}
              </p>
              {recipe.personalNotes && <p className="mt-1 text-xs text-tamarind-soft">{recipe.personalNotes}</p>}
            </div>
            <button onClick={() => void kitchenRepository.deleteSavedRecipe(recipe.recipeId)} className="text-xs font-medium text-chilli hover:underline">Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

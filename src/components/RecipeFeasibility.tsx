"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { matchRecipes } from "@/lib/match";
import { publicLabel } from "@/lib/format";
import type { MatchBucket } from "@/lib/types";
import { useSearchIndex } from "./useSearchIndex";

const MINIMAL_PANTRY = new Set(["salt", "water", "oil", "cooking-oil", "vegetable-oil"]);
const BUCKET_LABEL: Record<MatchBucket, string> = {
  ready: "Ready with your kitchen",
  very_close: "Very close",
  substitutable: "Possible with swaps you have",
  needs_shopping: "Needs a few additions",
};

export default function RecipeFeasibility({ recipeSlug }: { recipeSlug: string }) {
  const params = useSearchParams();
  const { index } = useSearchIndex();
  const have = useMemo(() => [...new Set(params.get("have")?.split(",").filter(Boolean) ?? [])], [params]);
  const pantryProfile = params.get("pantry") ?? "minimal";

  const pantrySlugs = useMemo(() => {
    if (!index || pantryProfile === "none") return new Set<string>();
    if (pantryProfile === "indian-basics") return new Set(index.ingredients.filter((ingredient) => ingredient.pantryStaple).map((ingredient) => ingredient.slug));
    return new Set(index.ingredients.filter((ingredient) => ingredient.pantryStaple && MINIMAL_PANTRY.has(ingredient.slug)).map((ingredient) => ingredient.slug));
  }, [index, pantryProfile]);

  const result = useMemo(() => {
    if (!index || have.length === 0) return null;
    const recipe = index.recipes.find((entry) => entry.slug === recipeSlug);
    return recipe ? matchRecipes([recipe], { have, pantrySlugs })[0] ?? null : null;
  }, [index, have, pantrySlugs, recipeSlug]);

  if (!index || have.length === 0 || !result) return null;
  const names = new Map(index.ingredients.map((ingredient) => [ingredient.slug, ingredient.name.replace(/\s*\(.*\)\s*/g, "")]));
  const essential = result.missingDetails.filter((item) => item.essential);
  const other = result.missingDetails.filter((item) => !item.essential);
  const availableSubs = result.substitutable.filter((substitution) => substitution.available);

  return (
    <aside className="mt-6 rounded-card border border-turmeric/40 bg-turmeric-tint/35 p-5" aria-label="Match to your pantry">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-turmeric-deep">Matched to your pantry</p>
          <h2 className="font-display mt-1 text-xl">{BUCKET_LABEL[result.bucket]}</h2>
          <p className="mt-1 text-sm text-tamarind-soft">{result.reason}</p>
        </div>
        <Link href={`/what-can-i-cook?${params.toString()}`} className="rounded-full border border-cardamom bg-card px-3 py-2 text-xs font-medium">Adjust kitchen</Link>
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">You have</p>
          <p className="mt-1 text-tamarind-soft">{result.matched.map((slug) => names.get(slug) ?? publicLabel(slug)).join(", ")}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Still needed</p>
          <p className="mt-1 text-tamarind-soft">
            {[...essential, ...other].length
              ? [...essential, ...other].map((item) => `${names.get(item.ingredient) ?? publicLabel(item.ingredient)}${item.essential ? " (essential)" : ""}`).join(", ")
              : "No unaccounted essential ingredients"}
          </p>
        </div>
      </div>
      {availableSubs.length > 0 && <p className="mt-3 text-xs text-tamarind-soft"><strong>Available swaps:</strong> {availableSubs.map((substitution) => `${names.get(substitution.ingredient) ?? publicLabel(substitution.ingredient)} → ${substitution.substitute}`).join("; ")}</p>}
      {result.assumedPantry.length > 0 && <p className="mt-2 text-[11px] text-tamarind-faint"><strong>Assumed:</strong> {result.assumedPantry.map((slug) => names.get(slug) ?? publicLabel(slug)).join(", ")}. Change this from the matcher.</p>}
    </aside>
  );
}

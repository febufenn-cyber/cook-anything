"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchIndex } from "./useSearchIndex";
import { kitchenRepository, subscribeKitchenChanges } from "@/lib/kitchen/repository";
import { isoNow } from "@/lib/kitchen/schema";
import type { PantryItem, SavedRecipe, ShoppingListItem } from "@/lib/kitchen/types";

function freshId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function SaveRecipeButton({ slug, title, cuisine }: { slug: string; title: string; cuisine: string }) {
  const { index } = useSearchIndex();
  const [saved, setSaved] = useState<SavedRecipe | null>(null);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [meal, setMeal] = useState<"breakfast" | "lunch" | "dinner" | "snack">("dinner");
  const indexedRecipe = index?.recipes.find((recipe) => recipe.slug === slug);
  const recipeId = indexedRecipe?.id ?? slug;
  const recipeVersion = index ? `${index.corpusVersion}:${slug}` : `pending:${slug}`;

  useEffect(() => {
    const refresh = () => Promise.all([
      kitchenRepository.getSavedRecipe(recipeId),
      kitchenRepository.listPantryItems(),
    ]).then(([nextSaved, nextPantry]) => {
      setSaved(nextSaved);
      setPantry(nextPantry);
    }).catch(() => undefined);
    void refresh();
    return subscribeKitchenChanges(() => void refresh());
  }, [recipeId]);

  const missing = useMemo(() => {
    if (!indexedRecipe) return [];
    const available = new Set(pantry.filter((item) => item.status === "available" || item.status === "running_low").map((item) => item.ingredientSlug));
    return indexedRecipe.req.filter((ingredient) => !available.has(ingredient));
  }, [indexedRecipe, pantry]);

  async function toggleSaved() {
    if (saved) {
      await kitchenRepository.deleteSavedRecipe(recipeId);
      setMessage("Removed from your local cookbook.");
      return;
    }
    await kitchenRepository.saveRecipe({
      recipeId,
      recipeSlug: slug,
      recipeTitle: title,
      recipeVersion,
      savedAt: isoNow(),
      timesCooked: 0,
      pinnedSubstitutions: [],
    });
    setMessage("Saved in this browser with its current corpus version.");
  }

  async function addMissing() {
    const now = isoNow();
    await Promise.all(missing.map((ingredientSlug) => kitchenRepository.saveShoppingItem({
      id: freshId(`shopping_${ingredientSlug}`),
      ingredientSlug,
      status: "needed",
      sources: [{ recipeId, recipeSlug: slug, reason: `Missing for ${title}` }],
      createdAt: now,
      updatedAt: now,
    } satisfies ShoppingListItem)));
    setMessage(missing.length ? `${missing.length} missing ingredient${missing.length === 1 ? "" : "s"} added to shopping.` : "Your local pantry already covers the required ingredients.");
  }

  async function planMeal() {
    await kitchenRepository.saveMealPlanEntry({
      id: freshId("meal"),
      date,
      meal,
      recipeId,
      recipeSlug: slug,
      recipeTitle: title,
      recipeVersion,
      servings: indexedRecipe?.servings,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
    setExpanded(false);
    setMessage(`${title} planned for ${date} ${meal}.`);
  }

  return (
    <div className="no-print rounded-card border border-cardamom bg-card p-2">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void toggleSaved()} className={`min-h-10 rounded-full border px-4 text-sm font-medium transition-colors ${saved ? "border-curry bg-curry-tint text-curry" : "border-cardamom bg-card text-tamarind-soft hover:border-curry"}`} aria-pressed={Boolean(saved)}>
          {saved ? "✓ Saved locally" : "+ Save recipe"}
        </button>
        <button onClick={() => void addMissing()} disabled={!indexedRecipe} className="min-h-10 rounded-full border border-cardamom px-4 text-sm font-medium disabled:opacity-40">
          Add missing{missing.length ? ` (${missing.length})` : ""}
        </button>
        <button onClick={() => setExpanded((value) => !value)} className="min-h-10 rounded-full border border-cardamom px-4 text-sm font-medium">Plan meal</button>
      </div>
      {expanded && (
        <div className="mt-2 flex flex-wrap gap-2 rounded-card bg-rice-deep p-2">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-10 rounded-full border border-cardamom bg-card px-3 text-xs" />
          <select value={meal} onChange={(event) => setMeal(event.target.value as typeof meal)} className="min-h-10 rounded-full border border-cardamom bg-card px-3 text-xs"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select>
          <button onClick={() => void planMeal()} className="min-h-10 rounded-full bg-turmeric px-4 text-xs font-semibold">Add</button>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-tamarind-faint">
        <span>{cuisine.replace(/-/g, " ")} · local only</span>
        <Link href="/kitchen" className="underline">Open My Kitchen</Link>
      </div>
      {message && <p className="mt-2 text-xs font-medium text-curry" aria-live="polite">{message}</p>}
    </div>
  );
}

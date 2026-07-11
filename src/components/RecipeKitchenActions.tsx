"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Recipe } from "@/lib/types";
import { recipeCookVersion } from "@/lib/cook-session";
import { kitchenRepository, subscribeKitchenChanges } from "@/lib/kitchen/repository";
import { isoNow } from "@/lib/kitchen/schema";
import type { PantryItem, SavedRecipe, ShoppingListItem } from "@/lib/kitchen/types";

function freshId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function RecipeKitchenActions({ recipe }: { recipe: Recipe }) {
  const [saved, setSaved] = useState<SavedRecipe | null>(null);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [message, setMessage] = useState("");
  const [showPlan, setShowPlan] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [meal, setMeal] = useState<"breakfast" | "lunch" | "dinner" | "snack">("dinner");
  const version = recipeCookVersion(recipe);

  useEffect(() => {
    const refresh = () => Promise.all([
      kitchenRepository.getSavedRecipe(recipe.id),
      kitchenRepository.listPantryItems(),
    ]).then(([nextSaved, nextPantry]) => {
      setSaved(nextSaved);
      setPantry(nextPantry);
    }).catch(() => undefined);
    void refresh();
    return subscribeKitchenChanges(() => void refresh());
  }, [recipe.id]);

  const missingRequired = useMemo(() => {
    const available = new Set(pantry.filter((item) => item.status === "available" || item.status === "running_low").map((item) => item.ingredientSlug));
    return [...new Set(recipe.ingredients.filter((item) => !item.optional && !available.has(item.normalizedName)).map((item) => item.normalizedName))];
  }, [pantry, recipe.ingredients]);

  async function toggleSaved() {
    if (saved) {
      await kitchenRepository.deleteSavedRecipe(recipe.id);
      setMessage("Removed from your local saved recipes.");
      return;
    }
    const record: SavedRecipe = {
      recipeId: recipe.id,
      recipeSlug: recipe.slug,
      recipeTitle: recipe.title,
      recipeVersion: version,
      savedAt: isoNow(),
      timesCooked: 0,
      pinnedSubstitutions: [],
    };
    await kitchenRepository.saveRecipe(record);
    setMessage("Saved in this browser with the current recipe version.");
  }

  async function addMissingToShopping() {
    const now = isoNow();
    await Promise.all(missingRequired.map((ingredientSlug) => kitchenRepository.saveShoppingItem({
      id: freshId(`shopping_${ingredientSlug}`),
      ingredientSlug,
      status: "needed",
      sources: [{ recipeId: recipe.id, recipeSlug: recipe.slug, reason: `Missing for ${recipe.title}` }],
      createdAt: now,
      updatedAt: now,
    } satisfies ShoppingListItem)));
    setMessage(missingRequired.length ? `${missingRequired.length} missing ingredient${missingRequired.length === 1 ? "" : "s"} added to your shopping list.` : "Your saved pantry already covers every required ingredient.");
  }

  async function planMeal() {
    await kitchenRepository.saveMealPlanEntry({
      id: freshId("meal"),
      date,
      meal,
      recipeId: recipe.id,
      recipeSlug: recipe.slug,
      recipeTitle: recipe.title,
      recipeVersion: version,
      servings: recipe.servings,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
    setShowPlan(false);
    setMessage(`${recipe.title} planned for ${date} ${meal}.`);
  }

  return (
    <div className="w-full rounded-card border border-cardamom bg-card p-4 sm:w-auto">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void toggleSaved()} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${saved ? "border border-curry bg-curry-tint text-curry" : "border border-cardamom bg-rice"}`}>
          {saved ? "Saved locally" : "Save recipe"}
        </button>
        <button onClick={() => void addMissingToShopping()} className="min-h-11 rounded-full border border-cardamom bg-rice px-4 text-sm font-semibold">
          Add missing to shopping{missingRequired.length ? ` (${missingRequired.length})` : ""}
        </button>
        <button onClick={() => setShowPlan((value) => !value)} className="min-h-11 rounded-full border border-cardamom bg-rice px-4 text-sm font-semibold">Plan this meal</button>
        <Link href="/kitchen" className="min-h-11 rounded-full border border-cardamom bg-rice px-4 py-2.5 text-sm font-semibold">Open My Kitchen</Link>
      </div>
      {showPlan && (
        <div className="mt-3 flex flex-wrap gap-2 rounded-card bg-rice-deep p-3">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-10 rounded-full border border-cardamom bg-card px-3 text-sm" />
          <select value={meal} onChange={(event) => setMeal(event.target.value as typeof meal)} className="min-h-10 rounded-full border border-cardamom bg-card px-3 text-sm"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select>
          <button onClick={() => void planMeal()} className="min-h-10 rounded-full bg-turmeric px-4 text-sm font-semibold">Add to plan</button>
        </div>
      )}
      <p className="mt-2 text-xs text-tamarind-faint">Local only · recipe version {version.slice(0, 24)}</p>
      {message && <p className="mt-2 text-xs font-medium text-curry" aria-live="polite">{message}</p>}
    </div>
  );
}

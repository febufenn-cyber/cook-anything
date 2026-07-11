"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteAllLocalCookAnythingData,
  kitchenRepository,
  subscribeKitchenChanges,
} from "@/lib/kitchen/repository";
import { isoNow, normalizeIngredientSlug } from "@/lib/kitchen/schema";
import type {
  CookHistoryEntry,
  KitchenSummary,
  LocalKitchenProfile,
  MealPlanEntry,
  PantryItem,
  PantryItemStatus,
  SavedRecipe,
  ShoppingListItem,
} from "@/lib/kitchen/types";
import { publicLabel } from "@/lib/format";

const COOKWARE = ["pressure-cooker", "oven", "air-fryer", "grill", "idli-steamer", "steamer"];
const ALLERGENS = ["dairy", "gluten", "nuts", "peanuts", "egg", "fish", "shellfish", "soy", "sesame", "mustard"];
const DIETS = ["vegetarian", "vegan", "eggetarian", "non_vegetarian", "pescatarian"];
const EMPTY_SUMMARY: KitchenSummary = { pantry: 0, savedRecipes: 0, history: 0, shoppingNeeded: 0, mealPlan: 0 };

function freshId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function KitchenDashboard() {
  const [profile, setProfile] = useState<LocalKitchenProfile | null>(null);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [saved, setSaved] = useState<SavedRecipe[]>([]);
  const [history, setHistory] = useState<CookHistoryEntry[]>([]);
  const [shopping, setShopping] = useState<ShoppingListItem[]>([]);
  const [plan, setPlan] = useState<MealPlanEntry[]>([]);
  const [summary, setSummary] = useState<KitchenSummary>(EMPTY_SUMMARY);
  const [pantryInput, setPantryInput] = useState("");
  const [shoppingInput, setShoppingInput] = useState("");
  const [planTitle, setPlanTitle] = useState("");
  const [planDate, setPlanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [planMeal, setPlanMeal] = useState<MealPlanEntry["meal"]>("dinner");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextProfile, nextPantry, nextSaved, nextHistory, nextShopping, nextPlan, nextSummary] = await Promise.all([
        kitchenRepository.getProfile(),
        kitchenRepository.listPantryItems(),
        kitchenRepository.listSavedRecipes(),
        kitchenRepository.listCookHistory(),
        kitchenRepository.listShoppingItems(),
        kitchenRepository.listMealPlan(),
        kitchenRepository.summary(),
      ]);
      setProfile(nextProfile);
      setPantry(nextPantry);
      setSaved(nextSaved);
      setHistory(nextHistory);
      setShopping(nextShopping);
      setPlan(nextPlan);
      setSummary(nextSummary);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Local kitchen storage is unavailable in this browser.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    void refresh();
    const unsubscribe = subscribeKitchenChanges(() => void refresh());
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      unsubscribe();
    };
  }, [refresh]);

  const useSoon = useMemo(() => {
    const today = Date.now();
    return pantry.filter((item) => item.expiryDate && Date.parse(item.expiryDate) - today <= 3 * 86_400_000 && item.status !== "out");
  }, [pantry]);

  async function addPantry() {
    const slugs = [...new Set(pantryInput.split(/[,\n]/).map(normalizeIngredientSlug).filter(Boolean))];
    if (!slugs.length) return;
    await Promise.all(slugs.map((ingredientSlug) => kitchenRepository.upsertPantryItem({
      ingredientSlug,
      status: "available",
      source: "user_added",
      updatedAt: isoNow(),
    })));
    setPantryInput("");
    setStatus(`${slugs.length} pantry item${slugs.length === 1 ? "" : "s"} saved.`);
  }

  async function updatePantry(item: PantryItem, patch: Partial<PantryItem>) {
    await kitchenRepository.upsertPantryItem({ ...item, ...patch, updatedAt: isoNow() });
  }

  async function saveProfile(next: LocalKitchenProfile) {
    setProfile(next);
    await kitchenRepository.saveProfile(next);
    setStatus("Kitchen preferences saved on this device.");
  }

  async function addShopping() {
    const label = shoppingInput.trim();
    if (!label) return;
    await kitchenRepository.saveShoppingItem({
      id: freshId("shopping"),
      customLabel: label.slice(0, 120),
      status: "needed",
      sources: [{ reason: "Added from My Kitchen" }],
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
    setShoppingInput("");
  }

  async function addPlan() {
    const title = planTitle.trim();
    if (!title || !planDate) return;
    await kitchenRepository.saveMealPlanEntry({
      id: freshId("meal"),
      date: planDate,
      meal: planMeal,
      recipeTitle: title.slice(0, 160),
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
    setPlanTitle("");
  }

  async function exportData() {
    const exported = await kitchenRepository.exportData();
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cook-anything-kitchen-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Local kitchen export created. API keys and companion messages were not included.");
  }

  async function importData(file: File | undefined) {
    if (!file) return;
    if (file.size > 5_000_000) return setStatus("Import rejected: file is larger than 5 MB.");
    const raw = await file.text();
    const replace = window.confirm("Replace existing local kitchen data? Choose Cancel to merge instead.");
    try {
      await kitchenRepository.importData(raw, replace ? "replace" : "merge");
      setStatus(replace ? "Local kitchen replaced from the validated export." : "Validated export merged with this local kitchen.");
    } catch (cause) {
      setStatus(`Import rejected: ${cause instanceof Error ? cause.message : "invalid file"}.`);
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  async function deleteEverything() {
    if (!window.confirm("Delete pantry, saved recipes, history, plans, shopping, Cook Mode sessions, remembered keys and local caches from this browser?")) return;
    await deleteAllLocalCookAnythingData();
    setProfile(null);
    setPantry([]);
    setSaved([]);
    setHistory([]);
    setShopping([]);
    setPlan([]);
    setSummary(EMPTY_SUMMARY);
    setStatus("All Cook Anything data stored by this browser was deleted.");
    await refresh();
  }

  if (loading) return <p className="text-sm text-tamarind-faint">Opening your local kitchen…</p>;

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Local kitchen summary">
        {([
          ["Pantry", summary.pantry],
          ["Saved", summary.savedRecipes],
          ["Cooked", summary.history],
          ["To buy", summary.shoppingNeeded],
          ["Planned", summary.mealPlan],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-card border border-cardamom bg-card p-4 shadow-lift">
            <p className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">{label}</p>
            <p className="font-display mt-1 text-3xl">{value}</p>
          </div>
        ))}
      </section>

      <div className={`rounded-card border px-4 py-3 text-sm ${online ? "border-curry/30 bg-curry-tint text-curry" : "border-turmeric bg-turmeric-tint text-tamarind"}`}>
        {online ? "Online. Your kitchen itself remains stored locally." : "Offline. Pantry, saved recipes, shopping and previously cached pages remain available."}
      </div>
      {status && <p className="rounded-card border border-cardamom bg-card px-4 py-3 text-sm" aria-live="polite">{status}</p>}

      <section className="rounded-card border border-cardamom bg-card p-5" aria-labelledby="pantry-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="pantry-title" className="font-display text-2xl">Pantry</h2>
            <p className="mt-1 text-xs text-tamarind-faint">Simple availability is enough. Quantities and expiry dates are optional.</p>
          </div>
          <Link href="/what-can-i-cook" className="rounded-full bg-turmeric px-4 py-2 text-xs font-semibold text-tamarind">Find dishes from this pantry</Link>
        </div>
        <div className="mt-4 flex gap-2">
          <input value={pantryInput} onChange={(event) => setPantryInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addPantry(); }} placeholder="egg, leftover-rice, onion" className="min-h-11 flex-1 rounded-card border border-cardamom bg-rice px-3" />
          <button onClick={() => void addPantry()} className="min-h-11 rounded-card bg-turmeric px-4 font-semibold">Add</button>
        </div>
        {useSoon.length > 0 && <p className="mt-3 text-xs font-medium text-chilli">Use soon: {useSoon.map((item) => publicLabel(item.ingredientSlug)).join(", ")}</p>}
        <div className="mt-4 divide-y divide-cardamom">
          {pantry.length === 0 && <p className="py-4 text-sm text-tamarind-faint">No pantry items saved yet.</p>}
          {pantry.map((item) => (
            <div key={item.ingredientSlug} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
              <div>
                <p className="font-medium">{publicLabel(item.ingredientSlug)}</p>
                <p className="text-xs text-tamarind-faint">{item.quantity !== undefined ? `${item.quantity} ${item.unit ?? ""}`.trim() : "Quantity not tracked"}</p>
              </div>
              <select value={item.status} onChange={(event) => void updatePantry(item, { status: event.target.value as PantryItemStatus })} className="min-h-10 rounded-full border border-cardamom bg-rice px-3 text-xs">
                <option value="available">Available</option><option value="running_low">Running low</option><option value="out">Out</option><option value="unknown">Unknown</option>
              </select>
              <input type="date" value={item.expiryDate ?? ""} onChange={(event) => void updatePantry(item, { expiryDate: event.target.value || undefined })} className="min-h-10 rounded-full border border-cardamom bg-rice px-3 text-xs" aria-label={`Expiry date for ${item.ingredientSlug}`} />
              <button onClick={() => void kitchenRepository.deletePantryItem(item.ingredientSlug)} className="min-h-10 rounded-full border border-cardamom px-3 text-xs text-chilli">Remove</button>
            </div>
          ))}
        </div>
      </section>

      {profile && (
        <section className="rounded-card border border-cardamom bg-card p-5" aria-labelledby="preferences-title">
          <h2 id="preferences-title" className="font-display text-2xl">Kitchen preferences</h2>
          <p className="mt-1 text-xs text-tamarind-faint">These are explicit defaults. A single search can still override them without rewriting this profile.</p>
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <PreferenceGroup title="Diet" values={DIETS} selected={profile.dietaryPreferences} single onChange={(values) => void saveProfile({ ...profile, dietaryPreferences: values, updatedAt: isoNow() })} />
            <PreferenceGroup title="Allergens to avoid" values={ALLERGENS} selected={profile.allergensToAvoid} onChange={(values) => void saveProfile({ ...profile, allergensToAvoid: values, updatedAt: isoNow() })} />
            <PreferenceGroup title="Special equipment" values={COOKWARE} selected={profile.cookware} onChange={(values) => void saveProfile({ ...profile, cookware: values, updatedAt: isoNow() })} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Defaults</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs">Servings<input type="number" min={1} max={100} value={profile.defaultServings ?? ""} onChange={(event) => void saveProfile({ ...profile, defaultServings: event.target.value ? Number(event.target.value) : undefined, updatedAt: isoNow() })} className="mt-1 w-full rounded-card border border-cardamom bg-rice px-3 py-2" /></label>
                <label className="text-xs">Weeknight minutes<input type="number" min={5} max={240} value={profile.maxWeeknightMinutes ?? ""} onChange={(event) => void saveProfile({ ...profile, maxWeeknightMinutes: event.target.value ? Number(event.target.value) : undefined, updatedAt: isoNow() })} className="mt-1 w-full rounded-card border border-cardamom bg-rice px-3 py-2" /></label>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="Saved recipes" empty="Save a recipe to keep it here with its version and personal history.">
          {saved.map((item) => <div key={item.recipeId} className="flex items-center justify-between gap-3 border-b border-cardamom py-3"><div><Link href={`/recipes/${item.recipeSlug}`} className="font-medium hover:text-turmeric-deep">{item.recipeTitle}</Link><p className="text-xs text-tamarind-faint">Cooked {item.timesCooked} time{item.timesCooked === 1 ? "" : "s"} · version {item.recipeVersion.slice(0, 8)}</p></div><button onClick={() => void kitchenRepository.deleteSavedRecipe(item.recipeId)} className="text-xs text-chilli">Remove</button></div>)}
        </Panel>
        <Panel title="Cooking history" empty="Explicitly completed Cook Mode sessions will appear here.">
          {history.slice(0, 20).map((item) => <div key={item.id} className="border-b border-cardamom py-3"><Link href={`/recipes/${item.recipeSlug}`} className="font-medium hover:text-turmeric-deep">{item.recipeTitle}</Link><p className="text-xs text-tamarind-faint">{item.outcome} · {new Date(item.completedAt ?? item.startedAt).toLocaleDateString()} · serves {item.servings}</p></div>)}
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="Shopping list" empty="Add missing ingredients from recipes or type a custom item.">
          <div className="flex gap-2 py-3"><input value={shoppingInput} onChange={(event) => setShoppingInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addShopping(); }} placeholder="Add an item" className="min-h-10 flex-1 rounded-card border border-cardamom bg-rice px-3" /><button onClick={() => void addShopping()} className="rounded-card bg-turmeric px-3 font-semibold">Add</button></div>
          {shopping.map((item) => <div key={item.id} className="flex items-start gap-3 border-b border-cardamom py-3"><input type="checkbox" checked={item.status === "purchased"} onChange={(event) => void kitchenRepository.saveShoppingItem({ ...item, status: event.target.checked ? "purchased" : "needed", updatedAt: isoNow() })} className="mt-1" /><div className="flex-1"><p className={item.status === "purchased" ? "line-through text-tamarind-faint" : "font-medium"}>{item.ingredientSlug ? publicLabel(item.ingredientSlug) : item.customLabel}</p><p className="text-xs text-tamarind-faint">{item.sources.map((source) => source.reason).join(" · ")}</p></div><button onClick={() => void kitchenRepository.deleteShoppingItem(item.id)} className="text-xs text-chilli">Remove</button></div>)}
        </Panel>
        <Panel title="Meal plan" empty="Plan a few meals locally; no nutrition claims or cloud calendar required.">
          <div className="grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto_auto]"><input value={planTitle} onChange={(event) => setPlanTitle(event.target.value)} placeholder="Recipe or meal" className="min-h-10 rounded-card border border-cardamom bg-rice px-3" /><input type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} className="min-h-10 rounded-card border border-cardamom bg-rice px-3" /><select value={planMeal} onChange={(event) => setPlanMeal(event.target.value as MealPlanEntry["meal"])} className="min-h-10 rounded-card border border-cardamom bg-rice px-3"><option>breakfast</option><option>lunch</option><option>dinner</option><option>snack</option></select><button onClick={() => void addPlan()} className="rounded-card bg-turmeric px-3 font-semibold">Plan</button></div>
          {plan.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-b border-cardamom py-3"><div><p className="font-medium">{item.recipeTitle}</p><p className="text-xs text-tamarind-faint">{item.date} · {item.meal}</p></div><button onClick={() => void kitchenRepository.deleteMealPlanEntry(item.id)} className="text-xs text-chilli">Remove</button></div>)}
        </Panel>
      </section>

      <section className="rounded-card border border-cardamom bg-card p-5" aria-labelledby="data-title">
        <h2 id="data-title" className="font-display text-2xl">Data on this device</h2>
        <p className="mt-1 text-sm text-tamarind-soft">Exports include pantry, preferences, saved recipes, history, shopping and plans. They never include API keys, hosted cookies, companion messages or photos.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => void exportData()} className="min-h-11 rounded-full border border-cardamom bg-rice px-4 text-sm font-semibold">Export local kitchen</button>
          <button onClick={() => importRef.current?.click()} className="min-h-11 rounded-full border border-cardamom bg-rice px-4 text-sm font-semibold">Import validated export</button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importData(event.target.files?.[0])} />
          <button onClick={() => void deleteEverything()} className="min-h-11 rounded-full border border-chilli px-4 text-sm font-semibold text-chilli">Delete all local data</button>
        </div>
      </section>
    </div>
  );
}

function PreferenceGroup({ title, values, selected, onChange, single = false }: { title: string; values: string[]; selected: string[]; onChange: (values: string[]) => void; single?: boolean }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">{title}</p><div className="mt-2 flex flex-wrap gap-2">{values.map((value) => <button key={value} onClick={() => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : single ? [value] : [...selected, value])} className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium ${selected.includes(value) ? "border-curry bg-curry-tint text-curry" : "border-cardamom bg-rice text-tamarind-soft"}`} aria-pressed={selected.includes(value)}>{publicLabel(value)}</button>)}</div></div>;
}

function Panel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const count = Array.isArray(children) ? children.filter(Boolean).length : 1;
  return <section className="rounded-card border border-cardamom bg-card p-5"><h2 className="font-display text-2xl">{title}</h2><div className="mt-2">{count ? children : <p className="py-4 text-sm text-tamarind-faint">{empty}</p>}</div></section>;
}

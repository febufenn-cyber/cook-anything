"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchIndex } from "./useSearchIndex";
import { formatMinutes, titleFromSlug, SPICE_CHILLIES } from "@/lib/format";
import type { RecipeIndexEntry } from "@/lib/types";

const DIFFICULTY = ["easy", "medium", "hard"];
const SPICE = ["none", "mild", "medium", "hot", "very_hot"];
const BUDGET = ["budget", "moderate", "premium"];

export default function SearchClient() {
  const { index, error } = useSearchIndex();
  const [q, setQ] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [diet, setDiet] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [spice, setSpice] = useState("");
  const [budget, setBudget] = useState("");
  const [maxTime, setMaxTime] = useState(0);
  const [method, setMethod] = useState("");
  const [cookwareF, setCookwareF] = useState("");
  const [excludeAllergen, setExcludeAllergen] = useState("");
  const [showCount, setShowCount] = useState(30);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("q");
    if (p) setQ(p);
  }, []);

  const methods = useMemo(
    () => [...new Set(index?.recipes.flatMap((r) => r.methods) ?? [])].sort(),
    [index],
  );
  const cookwareOptions = useMemo(
    () => [...new Set(index?.recipes.flatMap((r) => r.cookware) ?? [])].sort(),
    [index],
  );
  const allergens = useMemo(
    () => [...new Set(index?.recipes.flatMap((r) => r.allergens) ?? [])].sort(),
    [index],
  );

  const results = useMemo(() => {
    if (!index) return [];
    const needle = q.trim().toLowerCase();
    return index.recipes.filter((r) => {
      if (cuisine && r.cuisine !== cuisine) return false;
      if (diet && !r.dietType.includes(diet as never)) return false;
      if (difficulty && r.difficulty !== difficulty) return false;
      if (spice && r.spiceLevel !== spice) return false;
      if (budget && r.budgetLevel !== budget) return false;
      if (maxTime && r.totalTimeMinutes > maxTime) return false;
      if (method && !r.methods.includes(method)) return false;
      if (cookwareF && !r.cookware.includes(cookwareF)) return false;
      if (excludeAllergen && r.allergens.includes(excludeAllergen as never)) return false;
      if (!needle) return true;
      return (
        r.title.toLowerCase().includes(needle) ||
        r.nativeTitle?.toLowerCase().includes(needle) ||
        r.cuisine.includes(needle) ||
        r.country.includes(needle) ||
        r.tags.some((t) => t.includes(needle)) ||
        r.req.some((i) => i.includes(needle.replace(/\s+/g, "-")))
      );
    });
  }, [index, q, cuisine, diet, difficulty, spice, budget, maxTime, method, cookwareF, excludeAllergen]);

  const sel = "rounded-lg border border-cardamom bg-card px-2.5 py-1.5 text-xs text-tamarind-soft";

  return (
    <div>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setShowCount(30); }}
        placeholder="Search dishes, cuisines, ingredients… e.g. biryani, kimchi, brinjal"
        className="w-full rounded-card border border-cardamom bg-card px-5 py-4 text-base shadow-lift outline-none placeholder:text-tamarind-faint focus:border-turmeric"
        autoComplete="off"
      />

      <div className="rail mt-3 flex items-center gap-2 overflow-x-auto pb-1">
        <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} className={sel} aria-label="Cuisine">
          <option value="">All cuisines</option>
          {Object.entries(index?.cuisineNames ?? {}).sort((a, b) => a[1].localeCompare(b[1])).map(([slug, name]) => (
            <option key={slug} value={slug}>{name}</option>
          ))}
        </select>
        <select value={diet} onChange={(e) => setDiet(e.target.value)} className={sel} aria-label="Diet">
          <option value="">Any diet</option>
          {["vegetarian", "vegan", "eggetarian", "non_vegetarian", "pescatarian", "high_protein", "low_carb"].map((d) => (
            <option key={d} value={d}>{titleFromSlug(d)}</option>
          ))}
        </select>
        <select value={String(maxTime)} onChange={(e) => setMaxTime(Number(e.target.value))} className={sel} aria-label="Time">
          <option value="0">Any time</option>
          <option value="15">Under 15 min</option>
          <option value="30">Under 30 min</option>
          <option value="60">Under 1 hr</option>
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={sel} aria-label="Difficulty">
          <option value="">Any difficulty</option>
          {DIFFICULTY.map((d) => <option key={d} value={d}>{titleFromSlug(d)}</option>)}
        </select>
        <select value={spice} onChange={(e) => setSpice(e.target.value)} className={sel} aria-label="Spice level">
          <option value="">Any spice level</option>
          {SPICE.map((s) => <option key={s} value={s}>{titleFromSlug(s)}</option>)}
        </select>
        <select value={budget} onChange={(e) => setBudget(e.target.value)} className={sel} aria-label="Budget">
          <option value="">Any budget</option>
          {BUDGET.map((b) => <option key={b} value={b}>{titleFromSlug(b)}</option>)}
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className={sel} aria-label="Method">
          <option value="">Any method</option>
          {methods.map((m) => <option key={m} value={m}>{titleFromSlug(m)}</option>)}
        </select>
        <select value={cookwareF} onChange={(e) => setCookwareF(e.target.value)} className={sel} aria-label="Cookware">
          <option value="">Any cookware</option>
          {cookwareOptions.map((c) => <option key={c} value={c}>{titleFromSlug(c)}</option>)}
        </select>
        <select value={excludeAllergen} onChange={(e) => setExcludeAllergen(e.target.value)} className={sel} aria-label="Exclude allergen">
          <option value="">No allergen filter</option>
          {allergens.map((a) => <option key={a} value={a}>No {titleFromSlug(a)}</option>)}
        </select>
      </div>

      <div className="mt-5">
        {error && <p className="text-sm text-chilli">Search index failed to load — refresh to try again.</p>}
        {!index && !error && <p className="text-sm text-tamarind-faint">Loading recipes…</p>}
        {index && (
          <>
            <p className="text-sm text-tamarind-soft">
              <strong className="font-semibold text-tamarind">{results.length}</strong> recipes
            </p>
            <ul className="mt-3 divide-y divide-cardamom rounded-card border border-cardamom bg-card shadow-lift">
              {results.slice(0, showCount).map((r) => (
                <SearchRow key={r.slug} r={r} cuisineNames={index.cuisineNames} />
              ))}
              {results.length === 0 && (
                <li className="p-8 text-center text-sm text-tamarind-faint">
                  Nothing matches those filters yet. Loosen one filter, or try the{" "}
                  <Link href="/what-can-i-cook" className="font-medium text-turmeric-deep underline">
                    ingredient matcher
                  </Link>{" "}
                  instead.
                </li>
              )}
            </ul>
            {results.length > showCount && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowCount((c) => c + 30)}
                  className="rounded-full border border-cardamom bg-card px-5 py-2 text-sm font-medium hover:border-turmeric"
                >
                  Show more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SearchRow({ r, cuisineNames }: { r: RecipeIndexEntry; cuisineNames: Record<string, string> }) {
  return (
    <li>
      <Link href={`/recipes/${r.slug}`} className="flex items-baseline gap-3 px-5 py-3.5 hover:bg-rice-deep/50">
        <div className="min-w-0 flex-1">
          <span className="font-medium">{r.title}</span>
          {r.nativeTitle && <span className="ml-2 text-sm text-tamarind-faint">{r.nativeTitle}</span>}
        </div>
        <span className="hidden shrink-0 text-xs text-curry sm:inline">{cuisineNames[r.cuisine] ?? r.cuisine}</span>
        <span className="shrink-0 text-xs text-chilli">{"◆".repeat(SPICE_CHILLIES[r.spiceLevel])}</span>
        <span className="shrink-0 text-xs text-tamarind-faint">{formatMinutes(r.totalTimeMinutes)}</span>
      </Link>
    </li>
  );
}

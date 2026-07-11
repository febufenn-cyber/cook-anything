"use client";

/**
 * The core product loop: understand a natural pantry description, apply explicit
 * safety/feasibility constraints, and explain why every deterministic match is
 * or is not cookable.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  buildAliasMap,
  matchRecipes,
  parseIngredientInput,
  rankIngredientSuggestions,
  suggestUnlockIngredients,
  type IngredientParseSuggestion,
} from "@/lib/match";
import type { MatchBucket, MatchResult } from "@/lib/types";
import { formatMinutes, publicLabel, SPICE_CHILLIES, titleFromSlug } from "@/lib/format";
import { useSearchIndex, type SearchIngredient } from "./useSearchIndex";

const QUICK_ADD = ["egg", "onion", "tomato", "rice", "chicken", "potato", "paneer", "curd"];
const DIET_FILTERS = [
  { slug: "vegetarian", label: "Vegetarian" },
  { slug: "vegan", label: "Vegan" },
  { slug: "eggetarian", label: "Eggetarian" },
  { slug: "non_vegetarian", label: "Non-vegetarian" },
  { slug: "pescatarian", label: "Pescatarian" },
];
const TIME_FILTERS = [
  { max: 0, label: "Any time" },
  { max: 20, label: "Under 20 min" },
  { max: 30, label: "Under 30 min" },
  { max: 60, label: "Under 1 hr" },
];
const ALLERGEN_FILTERS = ["dairy", "gluten", "nuts", "peanuts", "egg", "fish", "shellfish", "soy", "sesame", "mustard"];
const EQUIPMENT = ["pressure-cooker", "oven", "air-fryer", "grill", "idli-steamer", "steamer"];
const MINIMAL_PANTRY = new Set(["salt", "water", "oil", "cooking-oil", "vegetable-oil"]);

type PantryProfile = "none" | "minimal" | "indian-basics";

const BUCKET_COPY: Record<MatchBucket, { label: string; className: string }> = {
  ready: { label: "Ready to cook", className: "bg-curry-tint text-curry" },
  very_close: { label: "Very close", className: "bg-turmeric-tint text-turmeric-deep" },
  substitutable: { label: "Possible with swaps", className: "bg-rice-deep text-tamarind" },
  needs_shopping: { label: "Needs shopping", className: "bg-chilli-tint text-chilli" },
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export default function IngredientMatcher({ initialHave }: { initialHave?: string[] }) {
  const { index, error } = useSearchIndex();
  const [have, setHave] = useState<string[]>(initialHave ?? []);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [excludeText, setExcludeText] = useState("");
  const [diet, setDiet] = useState<string | null>(null);
  const [maxTime, setMaxTime] = useState(0);
  const [excludeAllergens, setExcludeAllergens] = useState<string[]>([]);
  const [pantryProfile, setPantryProfile] = useState<PantryProfile>("minimal");
  const [availableCookware, setAvailableCookware] = useState<string[]>([]);
  const [strictCookware, setStrictCookware] = useState(true);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [ambiguous, setAmbiguous] = useState<IngredientParseSuggestion[]>([]);
  const [parseSuggestions, setParseSuggestions] = useState<IngredientParseSuggestion[]>([]);
  const [showCount, setShowCount] = useState(24);
  const inputRef = useRef<HTMLInputElement>(null);

  const aliasMap = useMemo(
    () => (index ? buildAliasMap(index.ingredients) : buildAliasMap([])),
    [index],
  );
  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    index?.ingredients.forEach((ingredient) => map.set(ingredient.slug, ingredient.name.replace(/\s*\(.*\)\s*/g, "")));
    return map;
  }, [index]);

  const pantrySlugs = useMemo(() => {
    if (!index || pantryProfile === "none") return new Set<string>();
    if (pantryProfile === "minimal") {
      return new Set(index.ingredients.filter((ingredient) => ingredient.pantryStaple && MINIMAL_PANTRY.has(ingredient.slug)).map((ingredient) => ingredient.slug));
    }
    return new Set(index.ingredients.filter((ingredient) => ingredient.pantryStaple).map((ingredient) => ingredient.slug));
  }, [index, pantryProfile]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!initialHave?.length) setHave(unique(params.get("have")?.split(",").filter(Boolean) ?? []));
    setExcludedIngredients(unique(params.get("avoid")?.split(",").filter(Boolean) ?? []));
    const pantry = params.get("pantry");
    if (pantry === "none" || pantry === "minimal" || pantry === "indian-basics") setPantryProfile(pantry);
    const queryDiet = params.get("diet");
    if (queryDiet) setDiet(queryDiet);
  }, [initialHave]);

  useEffect(() => {
    if (!index) return;
    const query = new URLSearchParams(window.location.search).get("q");
    if (!query) return;
    applyParsed(parseIngredientInput(query, aliasMap), "have");
    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    window.history.replaceState(null, "", url.toString());
    // Parse only the initial URL query after the index is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (have.length) url.searchParams.set("have", have.join(",")); else url.searchParams.delete("have");
    if (excludedIngredients.length) url.searchParams.set("avoid", excludedIngredients.join(",")); else url.searchParams.delete("avoid");
    if (diet) url.searchParams.set("diet", diet); else url.searchParams.delete("diet");
    url.searchParams.set("pantry", pantryProfile);
    window.history.replaceState(null, "", url.toString());
  }, [have, excludedIngredients, diet, pantryProfile]);

  useEffect(() => setShowCount(24), [have, excludedIngredients, diet, maxTime, excludeAllergens, pantryProfile, availableCookware, strictCookware]);

  const suggestions = useMemo(
    () => index ? rankIngredientSuggestions(text, index.ingredients, new Set([...have, ...excludedIngredients])) : [],
    [index, text, have, excludedIngredients],
  );
  const excludeSuggestions = useMemo(
    () => index ? rankIngredientSuggestions(excludeText, index.ingredients, new Set([...have, ...excludedIngredients])) : [],
    [index, excludeText, have, excludedIngredients],
  );

  function applyParsed(parsed: ReturnType<typeof parseIngredientInput>, target: "have" | "exclude") {
    if (target === "have") {
      setHave((current) => unique([...current, ...parsed.slugs]).filter((slug) => !excludedIngredients.includes(slug)));
      setUnknown(parsed.unknown);
      setAmbiguous(parsed.ambiguous);
      setParseSuggestions(parsed.suggestions);
    } else {
      setExcludedIngredients((current) => unique([...current, ...parsed.slugs]).filter((slug) => !have.includes(slug)));
    }
  }

  function commitText(target: "have" | "exclude") {
    const value = target === "have" ? text : excludeText;
    if (!value.trim() || !index) return;
    applyParsed(parseIngredientInput(value, aliasMap), target);
    if (target === "have") setText(""); else setExcludeText("");
  }

  function add(slug: string, target: "have" | "exclude" = "have") {
    if (target === "have") {
      setExcludedIngredients((current) => current.filter((value) => value !== slug));
      setHave((current) => current.includes(slug) ? current : [...current, slug]);
      setText("");
      inputRef.current?.focus();
    } else {
      setHave((current) => current.filter((value) => value !== slug));
      setExcludedIngredients((current) => current.includes(slug) ? current : [...current, slug]);
      setExcludeText("");
    }
  }

  const matchOptions = useMemo(() => ({
    have,
    pantrySlugs,
    dietTypes: diet ? [diet] : undefined,
    maxTimeMinutes: maxTime || undefined,
    excludeAllergens: excludeAllergens.length ? excludeAllergens : undefined,
    excludeIngredients: excludedIngredients.length ? excludedIngredients : undefined,
    availableCookware,
    strictCookware,
  }), [have, pantrySlugs, diet, maxTime, excludeAllergens, excludedIngredients, availableCookware, strictCookware]);

  const results = useMemo<MatchResult[]>(() => {
    if (!index || have.length === 0) return [];
    return matchRecipes(index.recipes, matchOptions);
  }, [index, have.length, matchOptions]);

  const unlocks = useMemo(() => {
    if (!index || have.length === 0) return [];
    return suggestUnlockIngredients(index.recipes, matchOptions, 3);
  }, [index, have.length, matchOptions]);

  const cuisinesInResults = useMemo(() => new Set(results.map((result) => result.recipe.cuisine)).size, [results]);

  return (
    <div>
      <section className="relative rounded-card border border-cardamom bg-card p-4 shadow-lift sm:p-5" aria-labelledby="pantry-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="pantry-heading" className="font-display text-xl">What is in your kitchen?</h2>
            <p className="mt-1 text-xs text-tamarind-faint">Try: “2 mutta, leftover rice and one small vengayam”.</p>
          </div>
          <label className="text-xs font-medium text-tamarind-soft">
            Pantry assumptions
            <select
              value={pantryProfile}
              onChange={(event) => setPantryProfile(event.target.value as PantryProfile)}
              className="ml-2 rounded-full border border-cardamom bg-rice px-3 py-1.5"
            >
              <option value="none">Assume nothing</option>
              <option value="minimal">Minimal: salt, water, oil</option>
              <option value="indian-basics">Indian basics</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-cardamom bg-rice px-3 py-2 focus-within:border-turmeric">
          {have.map((slug) => (
            <button
              key={slug}
              onClick={() => setHave((current) => current.filter((value) => value !== slug))}
              className="flex min-h-9 items-center gap-1.5 rounded-full bg-turmeric-tint px-3 py-1 text-sm font-medium text-turmeric-deep hover:bg-turmeric/20"
              title="Remove ingredient"
            >
              {nameOf.get(slug) ?? titleFromSlug(slug)} <span aria-hidden>×</span>
            </button>
          ))}
          <input
            ref={inputRef}
            id="ingredient-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                if (suggestions.length > 0 && !text.includes(",")) add(suggestions[0].slug); else commitText("have");
              }
              if (event.key === "Backspace" && !text && have.length) setHave((current) => current.slice(0, -1));
            }}
            placeholder={have.length ? "Add more…" : "egg, onion, thakkali, leftover rice"}
            className="min-w-44 flex-1 bg-transparent py-1.5 text-base outline-none placeholder:text-tamarind-faint"
            aria-label="Ingredients you have"
            autoComplete="off"
            enterKeyHint="done"
          />
        </div>

        {suggestions.length > 0 && (
          <SuggestionList suggestions={suggestions} onPick={(ingredient) => add(ingredient.slug)} />
        )}

        {(ambiguous.length > 0 || parseSuggestions.length > 0 || unknown.length > 0) && (
          <div className="mt-3 space-y-2 rounded-xl border border-cardamom bg-rice-deep/50 p-3 text-xs" aria-live="polite">
            {ambiguous.map((item) => (
              <div key={`ambiguous-${item.input}`} className="flex flex-wrap items-center gap-2">
                <span className="text-tamarind-soft">Which “{item.input}” did you mean?</span>
                {item.slugs.map((slug) => (
                  <button key={slug} onClick={() => add(slug)} className="rounded-full border border-turmeric px-2.5 py-1 font-medium text-turmeric-deep">
                    {nameOf.get(slug) ?? titleFromSlug(slug)}
                  </button>
                ))}
              </div>
            ))}
            {parseSuggestions.map((item) => (
              <div key={`suggest-${item.input}`} className="flex flex-wrap items-center gap-2">
                <span className="text-tamarind-soft">Did you mean for “{item.input}”:</span>
                {item.slugs.map((slug) => (
                  <button key={slug} onClick={() => add(slug)} className="rounded-full border border-turmeric px-2.5 py-1 font-medium text-turmeric-deep">
                    {nameOf.get(slug) ?? titleFromSlug(slug)}
                  </button>
                ))}
              </div>
            ))}
            {unknown.length > 0 && <p className="text-tamarind-faint">Not recognised yet: {unknown.join(", ")}. Nothing was silently guessed.</p>}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-tamarind-faint">Quick add:</span>
          {QUICK_ADD.filter((slug) => !have.includes(slug)).map((slug) => (
            <button key={slug} onClick={() => add(slug)} className="min-h-8 rounded-full border border-cardamom px-2.5 py-1 text-xs text-tamarind-soft hover:border-turmeric">
              + {nameOf.get(slug) ?? titleFromSlug(slug)}
            </button>
          ))}
          {have.length > 0 && (
            <button onClick={() => { setHave([]); setUnknown([]); setAmbiguous([]); setParseSuggestions([]); }} className="ml-auto text-xs font-medium text-chilli hover:underline">
              Clear kitchen
            </button>
          )}
        </div>
      </section>

      {have.length > 0 && (
        <details className="mt-4 rounded-card border border-cardamom bg-card p-4" open={excludedIngredients.length > 0 || excludeAllergens.length > 0}>
          <summary className="cursor-pointer font-semibold text-tamarind">Constraints and equipment</summary>
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div>
              <label htmlFor="avoid-input" className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Ingredients to exclude</label>
              <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-cardamom bg-rice px-3 py-2">
                {excludedIngredients.map((slug) => (
                  <button key={slug} onClick={() => setExcludedIngredients((current) => current.filter((value) => value !== slug))} className="rounded-full bg-chilli-tint px-3 py-1 text-xs font-medium text-chilli">
                    {nameOf.get(slug) ?? titleFromSlug(slug)} ×
                  </button>
                ))}
                <input
                  id="avoid-input"
                  value={excludeText}
                  onChange={(event) => setExcludeText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") {
                      event.preventDefault();
                      if (excludeSuggestions.length > 0 && !excludeText.includes(",")) add(excludeSuggestions[0].slug, "exclude"); else commitText("exclude");
                    }
                  }}
                  placeholder="no onion, peanuts…"
                  className="min-w-36 flex-1 bg-transparent py-1 text-sm outline-none"
                />
              </div>
              {excludeSuggestions.length > 0 && <SuggestionList suggestions={excludeSuggestions} onPick={(ingredient) => add(ingredient.slug, "exclude")} compact />}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Available special equipment</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {EQUIPMENT.map((item) => (
                  <button
                    key={item}
                    onClick={() => setAvailableCookware((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])}
                    className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium ${availableCookware.includes(item) ? "border-curry bg-curry-tint text-curry" : "border-cardamom bg-rice text-tamarind-soft"}`}
                    aria-pressed={availableCookware.includes(item)}
                  >
                    {publicLabel(item)}
                  </button>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-tamarind-soft">
                <input type="checkbox" checked={strictCookware} onChange={(event) => setStrictCookware(event.target.checked)} className="h-4 w-4 accent-turmeric" />
                Hide recipes requiring special equipment I did not select
              </label>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Avoid allergens</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALLERGEN_FILTERS.map((allergen) => (
                <button
                  key={allergen}
                  onClick={() => setExcludeAllergens((current) => current.includes(allergen) ? current.filter((value) => value !== allergen) : [...current, allergen])}
                  className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium ${excludeAllergens.includes(allergen) ? "border-chilli bg-chilli-tint text-chilli" : "border-cardamom bg-rice text-tamarind-soft"}`}
                  aria-pressed={excludeAllergens.includes(allergen)}
                >
                  {publicLabel(allergen)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-tamarind-faint">These are hard filters based on recipe trust metadata. Always check exact packaged-product labels.</p>
          </div>
        </details>
      )}

      {have.length > 0 && (
        <div className="rail mt-4 flex items-center gap-2 overflow-x-auto pb-1">
          {DIET_FILTERS.map((filter) => (
            <button
              key={filter.slug}
              onClick={() => setDiet(diet === filter.slug ? null : filter.slug)}
              className={`min-h-9 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${diet === filter.slug ? "border-curry bg-curry text-white" : "border-cardamom bg-card text-tamarind-soft"}`}
              aria-pressed={diet === filter.slug}
            >
              {filter.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px shrink-0 bg-cardamom" aria-hidden />
          {TIME_FILTERS.map((filter) => (
            <button
              key={filter.max}
              onClick={() => setMaxTime(filter.max)}
              className={`min-h-9 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${maxTime === filter.max ? "border-tamarind bg-tamarind text-rice" : "border-cardamom bg-card text-tamarind-soft"}`}
              aria-pressed={maxTime === filter.max}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      <section className="mt-6" aria-labelledby="results-heading">
        {error && <p className="rounded-card border border-chilli/30 bg-chilli-tint p-4 text-sm text-chilli">{error}. Refresh the page to try again.</p>}
        {!index && !error && <p className="text-sm text-tamarind-faint">Loading the world&apos;s pantry…</p>}
        {index && have.length === 0 && <p className="text-sm text-tamarind-faint">Add two or three ingredients to see genuinely viable dishes—not just recipes sharing salt or spices.</p>}

        {index && have.length > 0 && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="results-heading" className="font-display text-2xl">Best uses of what you have</h2>
                <p className="mt-1 text-sm text-tamarind-soft" aria-live="polite">
                  <strong className="font-semibold text-tamarind">{results.length}</strong> dishes across <strong className="font-semibold text-tamarind">{cuisinesInResults}</strong> cuisines pass your current constraints.
                </p>
              </div>
              <p className="text-xs text-tamarind-faint">Corpus {index.corpusVersion.slice(0, 8)}</p>
            </div>

            {unlocks.length > 0 && (
              <div className="mt-4 rounded-card border border-turmeric/40 bg-turmeric-tint/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-turmeric-deep">One ingredient that unlocks more</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {unlocks.map((unlock) => (
                    <button key={unlock.ingredient} onClick={() => add(unlock.ingredient)} className="rounded-full border border-turmeric bg-card px-3 py-2 text-left text-xs">
                      <strong>+ {nameOf.get(unlock.ingredient) ?? titleFromSlug(unlock.ingredient)}</strong>
                      <span className="ml-1 text-tamarind-faint">helps {unlock.recipesUnlocked} dishes</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {results.length === 0 ? (
              <div className="mt-5 rounded-card border border-cardamom bg-card p-6">
                <h3 className="font-display text-xl">No safe match passes every restriction</h3>
                <p className="mt-2 text-sm text-tamarind-soft">Try allowing one more cooking method, removing the time limit, or checking whether an excluded ingredient is essential.</p>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {results.slice(0, showCount).map((result) => (
                  <MatchCard
                    key={result.recipe.slug}
                    result={result}
                    nameOf={nameOf}
                    cuisineNames={index.cuisineNames}
                    have={have}
                    pantryProfile={pantryProfile}
                  />
                ))}
              </div>
            )}

            {results.length > showCount && (
              <div className="mt-6 text-center">
                <button onClick={() => setShowCount((count) => count + 24)} className="min-h-11 rounded-full border border-cardamom bg-card px-5 py-2 text-sm font-medium hover:border-turmeric">
                  Show more ({results.length - showCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function SuggestionList({ suggestions, onPick, compact = false }: { suggestions: SearchIngredient[]; onPick: (ingredient: SearchIngredient) => void; compact?: boolean }) {
  return (
    <ul className={`${compact ? "mt-1" : "absolute left-4 right-4 z-20 mt-1"} overflow-hidden rounded-xl border border-cardamom bg-card shadow-lift`}>
      {suggestions.map((ingredient) => (
        <li key={ingredient.slug}>
          <button onClick={() => onPick(ingredient)} className="flex min-h-11 w-full items-baseline gap-2 px-4 py-2.5 text-left text-sm hover:bg-rice-deep">
            <span className="font-medium">{ingredient.name}</span>
            {(ingredient.ta || ingredient.hi) && <span className="text-xs text-tamarind-faint">{[ingredient.ta, ingredient.hi].filter(Boolean).join(" · ")}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

function MatchCard({
  result,
  nameOf,
  cuisineNames,
  have,
  pantryProfile,
}: {
  result: MatchResult;
  nameOf: Map<string, string>;
  cuisineNames: Record<string, string>;
  have: string[];
  pantryProfile: PantryProfile;
}) {
  const recipe = result.recipe;
  const bucket = BUCKET_COPY[result.bucket];
  const coverage = Math.round(result.score * 100);
  const essentialMissing = result.missingDetails.filter((item) => item.essential);
  const nonEssentialMissing = result.missingDetails.filter((item) => !item.essential);
  const availableSubs = result.substitutable.filter((substitution) => substitution.available);
  const unavailableSubs = result.substitutable.filter((substitution) => !substitution.available);
  const query = new URLSearchParams({ have: have.join(","), pantry: pantryProfile }).toString();

  return (
    <Link href={`/recipes/${recipe.slug}?${query}`} className="group flex flex-col rounded-card border border-cardamom bg-card p-5 shadow-lift transition-transform duration-150 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-turmeric">
      <div className="flex items-start justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${bucket.className}`}>{bucket.label}</span>
        <span className="text-xs text-tamarind-faint">{formatMinutes(recipe.totalTimeMinutes)}</span>
      </div>
      <h3 className="font-display mt-2.5 text-lg leading-snug group-hover:text-turmeric-deep">{recipe.title}</h3>
      {recipe.nativeTitle && <p className="text-sm text-tamarind-faint">{recipe.nativeTitle}</p>}
      <p className="mt-1 text-xs text-tamarind-faint">{cuisineNames[recipe.cuisine] ?? titleFromSlug(recipe.cuisine)} · {coverage}% weighted coverage</p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-rice-deep" role="progressbar" aria-label={result.reason} aria-valuemin={0} aria-valuemax={100} aria-valuenow={coverage}>
        <div className="h-full rounded-full bg-turmeric" style={{ width: `${coverage}%` }} />
      </div>
      <p className="mt-2 text-xs font-medium text-tamarind-soft">{result.reason}</p>

      {essentialMissing.length > 0 && (
        <p className="mt-3 text-xs text-tamarind-soft"><span className="font-semibold text-chilli">Essential:</span> {essentialMissing.map((item) => nameOf.get(item.ingredient) ?? publicLabel(item.ingredient)).join(", ")}</p>
      )}
      {nonEssentialMissing.length > 0 && (
        <p className="mt-1 text-xs text-tamarind-soft"><span className="font-semibold">Still needed:</span> {nonEssentialMissing.map((item) => nameOf.get(item.ingredient) ?? publicLabel(item.ingredient)).join(", ")}</p>
      )}
      {availableSubs.length > 0 && (
        <p className="mt-2 text-xs text-tamarind-soft"><span className="font-semibold text-turmeric-deep">You have a swap:</span> {availableSubs.map((substitution) => `${nameOf.get(substitution.ingredient) ?? publicLabel(substitution.ingredient)} → ${substitution.substitute} (${publicLabel(substitution.quality)})`).join("; ")}</p>
      )}
      {unavailableSubs.length > 0 && result.bucket === "needs_shopping" && (
        <p className="mt-1 text-xs text-tamarind-faint">Possible alternatives exist, but none were recognised in your kitchen.</p>
      )}
      {result.assumedPantry.length > 0 && (
        <p className="mt-2 text-[11px] text-tamarind-faint"><span className="font-semibold">Assumed pantry:</span> {result.assumedPantry.map((slug) => nameOf.get(slug) ?? publicLabel(slug)).join(", ")}</p>
      )}
      {result.unavailableCookware.length > 0 && (
        <p className="mt-2 text-xs font-medium text-chilli">Unavailable equipment: {result.unavailableCookware.map(publicLabel).join(", ")}</p>
      )}

      <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
        {recipe.dietType.slice(0, 2).map((diet) => <span key={diet} className="rounded bg-rice-deep px-1.5 py-0.5 text-[11px] text-tamarind-soft">{publicLabel(diet)}</span>)}
        <span className="rounded bg-rice-deep px-1.5 py-0.5 text-[11px] text-tamarind-soft">{"◆".repeat(SPICE_CHILLIES[recipe.spiceLevel]) || "No heat"}</span>
        {recipe.cookware.slice(0, 2).map((item) => <span key={item} className="rounded bg-rice-deep px-1.5 py-0.5 text-[11px] text-tamarind-soft">{publicLabel(item)}</span>)}
      </div>
    </Link>
  );
}

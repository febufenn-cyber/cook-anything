"use client";

/**
 * The core product experience: enter ingredients you have,
 * see what the world cooks with them.
 */
import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { matchRecipes, buildAliasMap, parseIngredientInput } from "@/lib/match";
import type { MatchResult } from "@/lib/types";
import { formatMinutes, titleFromSlug, SPICE_CHILLIES } from "@/lib/format";
import { useSearchIndex } from "./useSearchIndex";

const QUICK_ADD = ["chicken", "curd", "onion", "tomato", "rice", "egg", "potato", "paneer"];
const DIET_FILTERS = [
  { slug: "vegetarian", label: "Vegetarian" },
  { slug: "vegan", label: "Vegan" },
  { slug: "eggetarian", label: "Eggetarian" },
  { slug: "non_vegetarian", label: "Non-veg" },
  { slug: "high_protein", label: "High protein" },
];
const TIME_FILTERS = [
  { max: 0, label: "Any time" },
  { max: 30, label: "Under 30 min" },
  { max: 60, label: "Under 1 hr" },
];
const ALLERGEN_FILTERS = ["dairy", "gluten", "nuts", "peanuts", "egg", "fish", "shellfish", "soy"];

export default function IngredientMatcher({ initialHave }: { initialHave?: string[] }) {
  const { index, error } = useSearchIndex();
  const [have, setHave] = useState<string[]>(initialHave ?? []);
  const [text, setText] = useState("");
  const [diet, setDiet] = useState<string | null>(null);
  const [maxTime, setMaxTime] = useState(0);
  const [excludeAllergens, setExcludeAllergens] = useState<string[]>([]);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [showCount, setShowCount] = useState(24);
  const inputRef = useRef<HTMLInputElement>(null);

  // Read ?have= from URL on mount (shareable searches)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("have");
    if (p && !initialHave?.length) setHave(p.split(",").filter(Boolean));
  }, [initialHave]);

  const aliasMap = useMemo(
    () => (index ? buildAliasMap(index.ingredients) : new Map<string, string>()),
    [index],
  );

  // Parse free-text ?q= (from the home hero) once the index is ready
  useEffect(() => {
    if (!index) return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (!q) return;
    const { slugs, unknown: unk } = parseIngredientInput(q, aliasMap);
    if (slugs.length) setHave((h) => [...h, ...slugs.filter((s) => !h.includes(s))]);
    if (unk.length) setUnknown(unk);
    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    window.history.replaceState(null, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  const pantrySlugs = useMemo(
    () => new Set(index?.ingredients.filter((i) => i.pantryStaple).map((i) => i.slug) ?? []),
    [index],
  );
  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    index?.ingredients.forEach((i) => m.set(i.slug, i.name.replace(/\s*\(.*\)\s*/g, "")));
    return m;
  }, [index]);

  const suggestions = useMemo(() => {
    if (!index || text.trim().length < 2) return [];
    const q = text.trim().toLowerCase();
    return index.ingredients
      .filter(
        (i) =>
          !have.includes(i.slug) &&
          (i.slug.includes(q) ||
            i.name.toLowerCase().includes(q) ||
            i.ta?.toLowerCase().includes(q) ||
            i.hi?.toLowerCase().includes(q) ||
            i.aliases.some((a) => a.includes(q))),
      )
      .slice(0, 6);
  }, [index, text, have]);

  function commitText() {
    if (!text.trim() || !index) return;
    const { slugs, unknown: unk } = parseIngredientInput(text, aliasMap);
    setHave((h) => [...h, ...slugs.filter((s) => !h.includes(s))]);
    setUnknown(unk);
    setText("");
  }

  function add(slug: string) {
    setHave((h) => (h.includes(slug) ? h : [...h, slug]));
    setText("");
    inputRef.current?.focus();
  }

  const results = useMemo<MatchResult[]>(() => {
    if (!index || have.length === 0) return [];
    return matchRecipes(index.recipes, {
      have,
      pantrySlugs,
      dietTypes: diet ? [diet] : undefined,
      maxTimeMinutes: maxTime || undefined,
      excludeAllergens: excludeAllergens.length ? excludeAllergens : undefined,
    });
  }, [index, have, diet, maxTime, excludeAllergens, pantrySlugs]);

  // Update URL for shareability
  useEffect(() => {
    const url = new URL(window.location.href);
    if (have.length) url.searchParams.set("have", have.join(","));
    else url.searchParams.delete("have");
    window.history.replaceState(null, "", url.toString());
  }, [have]);

  const cuisinesInResults = useMemo(
    () => new Set(results.slice(0, 60).map((r) => r.recipe.cuisine)).size,
    [results],
  );

  return (
    <div>
      {/* Input */}
      <div className="relative rounded-card border border-cardamom bg-card p-4 shadow-lift sm:p-5">
        <label htmlFor="ingredient-input" className="text-sm font-medium text-tamarind-soft">
          What ingredients do you have?
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-cardamom bg-rice px-3 py-2 focus-within:border-turmeric">
          {have.map((slug) => (
            <button
              key={slug}
              onClick={() => setHave((h) => h.filter((s) => s !== slug))}
              className="flex items-center gap-1.5 rounded-full bg-turmeric-tint px-3 py-1 text-sm font-medium text-turmeric-deep hover:bg-turmeric/20"
              title="Remove"
            >
              {nameOf.get(slug) ?? titleFromSlug(slug)}
              <span aria-hidden>×</span>
            </button>
          ))}
          <input
            ref={inputRef}
            id="ingredient-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                if (suggestions.length > 0 && text.trim().length >= 2 && !text.includes(",")) add(suggestions[0].slug);
                else commitText();
              }
              if (e.key === "Backspace" && !text && have.length) setHave((h) => h.slice(0, -1));
            }}
            placeholder={have.length ? "Add more…" : "chicken, curd, onion, tomato, rice"}
            className="min-w-40 flex-1 bg-transparent py-1 text-base outline-none placeholder:text-tamarind-faint"
            autoComplete="off"
            enterKeyHint="done"
          />
        </div>

        {suggestions.length > 0 && (
          <ul className="absolute left-4 right-4 z-20 mt-1 overflow-hidden rounded-xl border border-cardamom bg-card shadow-lift">
            {suggestions.map((s) => (
              <li key={s.slug}>
                <button
                  onClick={() => add(s.slug)}
                  className="flex w-full items-baseline gap-2 px-4 py-2.5 text-left text-sm hover:bg-rice-deep"
                >
                  <span className="font-medium">{s.name}</span>
                  {(s.ta || s.hi) && (
                    <span className="text-xs text-tamarind-faint">
                      {[s.ta, s.hi].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {unknown.length > 0 && (
          <p className="mt-2 text-xs text-tamarind-faint">
            Not in our pantry yet: {unknown.join(", ")} — matching continues with the rest.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-tamarind-faint">Quick add:</span>
          {QUICK_ADD.filter((s) => !have.includes(s)).map((slug) => (
            <button
              key={slug}
              onClick={() => add(slug)}
              className="rounded-full border border-cardamom px-2.5 py-1 text-xs text-tamarind-soft hover:border-turmeric hover:text-tamarind"
            >
              + {nameOf.get(slug) ?? titleFromSlug(slug)}
            </button>
          ))}
          {have.length > 0 && (
            <button
              onClick={() => { setHave([]); setUnknown([]); }}
              className="ml-auto text-xs font-medium text-chilli hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {have.length > 0 && (
        <div className="rail mt-4 flex items-center gap-2 overflow-x-auto pb-1">
          {DIET_FILTERS.map((d) => (
            <button
              key={d.slug}
              onClick={() => setDiet(diet === d.slug ? null : d.slug)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                diet === d.slug
                  ? "border-curry bg-curry text-white"
                  : "border-cardamom bg-card text-tamarind-soft hover:border-curry"
              }`}
            >
              {d.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px shrink-0 bg-cardamom" aria-hidden />
          {TIME_FILTERS.map((t) => (
            <button
              key={t.max}
              onClick={() => setMaxTime(t.max)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                maxTime === t.max
                  ? "border-tamarind bg-tamarind text-rice"
                  : "border-cardamom bg-card text-tamarind-soft"
              }`}
            >
              {t.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px shrink-0 bg-cardamom" aria-hidden />
          <span className="shrink-0 text-xs text-tamarind-faint">Avoid:</span>
          {ALLERGEN_FILTERS.map((a) => (
            <button
              key={a}
              onClick={() =>
                setExcludeAllergens((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]))
              }
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                excludeAllergens.includes(a)
                  ? "border-chilli bg-chilli-tint text-chilli"
                  : "border-cardamom bg-card text-tamarind-soft"
              }`}
            >
              {titleFromSlug(a)}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="mt-6">
        {error && (
          <p className="rounded-card border border-chilli/30 bg-chilli-tint p-4 text-sm text-chilli">
            The recipe index could not load. Refresh the page to try again.
          </p>
        )}
        {!index && !error && <p className="text-sm text-tamarind-faint">Loading the world&apos;s pantry…</p>}

        {index && have.length === 0 && (
          <p className="text-sm text-tamarind-faint">
            Add a few ingredients above — dishes from Tamil Nadu to Tokyo will line up by how much of them you already have.
          </p>
        )}

        {index && have.length > 0 && (
          <>
            <p className="text-sm text-tamarind-soft">
              <strong className="font-semibold text-tamarind">{results.length}</strong> dishes across{" "}
              <strong className="font-semibold text-tamarind">{cuisinesInResults}</strong> cuisines match your kitchen
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {results.slice(0, showCount).map((res) => (
                <MatchCard key={res.recipe.slug} res={res} nameOf={nameOf} cuisineNames={index.cuisineNames} />
              ))}
            </div>
            {results.length > showCount && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowCount((c) => c + 24)}
                  className="rounded-full border border-cardamom bg-card px-5 py-2 text-sm font-medium hover:border-turmeric"
                >
                  Show more ({results.length - showCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MatchCard({
  res,
  nameOf,
  cuisineNames,
}: {
  res: MatchResult;
  nameOf: Map<string, string>;
  cuisineNames: Record<string, string>;
}) {
  const r = res.recipe;
  const total = res.matched.length + res.substitutable.length + res.missing.length;
  return (
    <Link
      href={`/recipes/${r.slug}`}
      className="group flex flex-col rounded-card border border-cardamom bg-card p-5 shadow-lift transition-transform duration-150 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full bg-curry-tint px-2.5 py-0.5 text-xs font-semibold text-curry">
          {cuisineNames[r.cuisine] ?? titleFromSlug(r.cuisine)}
        </span>
        <span className="text-xs text-tamarind-faint">{formatMinutes(r.totalTimeMinutes)}</span>
      </div>
      <h3 className="font-display mt-2.5 text-lg leading-snug group-hover:text-turmeric-deep">{r.title}</h3>
      {r.nativeTitle && <p className="text-sm text-tamarind-faint">{r.nativeTitle}</p>}

      {/* Signature: pantry dots */}
      <div className="mt-3 flex items-center gap-1" aria-label={res.reason}>
        {res.matched.map((s) => (
          <span key={s} className="pantry-dot pantry-dot--have" title={`Have: ${nameOf.get(s) ?? s}`} />
        ))}
        {res.substitutable.map((s) => (
          <span key={s.ingredient} className="pantry-dot pantry-dot--sub" title={`Substitutable: ${nameOf.get(s.ingredient) ?? s.ingredient}`} />
        ))}
        {res.missing.map((s) => (
          <span key={s} className="pantry-dot pantry-dot--missing" title={`Missing: ${nameOf.get(s) ?? s}`} />
        ))}
        <span className="ml-2 text-xs font-medium text-tamarind-soft">
          {res.matched.length}/{total} in your kitchen
        </span>
      </div>

      <p className="mt-2 text-xs text-tamarind-faint">{res.reason}</p>

      {res.missing.length > 0 && (
        <p className="mt-2 text-xs text-tamarind-soft">
          <span className="font-medium text-chilli">Missing:</span>{" "}
          {res.missing.map((s) => nameOf.get(s) ?? s).join(", ")}
        </p>
      )}
      {res.substitutable.length > 0 && (
        <p className="mt-1 text-xs text-tamarind-soft">
          <span className="font-medium text-turmeric-deep">Swap:</span>{" "}
          {res.substitutable.map((s) => `${nameOf.get(s.ingredient) ?? s.ingredient} → ${s.substitute}`).join("; ")}
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
        {r.dietType.slice(0, 2).map((d) => (
          <span key={d} className="rounded bg-rice-deep px-1.5 py-0.5 text-[11px] text-tamarind-soft">
            {titleFromSlug(d.replace(/_placeholder$/, ""))}
          </span>
        ))}
        <span className="rounded bg-rice-deep px-1.5 py-0.5 text-[11px] text-tamarind-soft">
          {"◆".repeat(SPICE_CHILLIES[r.spiceLevel]) || "no heat"}
        </span>
        {r.cookware.slice(0, 2).map((c) => (
          <span key={c} className="rounded bg-rice-deep px-1.5 py-0.5 text-[11px] text-tamarind-soft">
            {titleFromSlug(c)}
          </span>
        ))}
      </div>
    </Link>
  );
}

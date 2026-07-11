import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { getAllRecipes, getCuisines, getIngredients, getCollections } from "@/lib/data";
import { VERIFICATION_LABEL } from "@/lib/format";
import type { VerificationStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Data studio",
  description: "Build-time snapshot of the recipe database and the import/validation pipeline.",
  alternates: { canonical: "/admin/" },
  robots: { index: false },
};

const SCRIPTS: [string, string][] = [
  ["npm run validate", "Structural + referential validation of every recipe (slugs, enums, times, diets, allergen consistency, provenance)"],
  ["npm run dupes", "Duplicate detection: slug/title similarity + ingredient & cuisine overlap"],
  ["npm run normalize", "Map free-text ingredient names to canonical slugs via the alias table"],
  ["npm run slugs", "Generate/repair slugs and ids for imported recipes"],
  ["npm run search-index", "Build the client search index (public/search-index.json)"],
  ["npm run licenses", "License checker: flags unknown licenses, missing sources, republishing risk"],
  ["npm run import-recipes -- --file <path>", "Import external recipe JSON through normalization + validation"],
  ["npm run export-recipes", "Export the full database as one JSON file"],
  ["npm run seed", "Report seed coverage per cuisine/category"],
];

export default function AdminPage() {
  const recipes = getAllRecipes();
  const cuisines = getCuisines();
  const ingredients = getIngredients();
  const collections = getCollections();

  const byStatus = new Map<VerificationStatus, number>();
  const byCuisine = new Map<string, number>();
  for (const r of recipes) {
    byStatus.set(r.verificationStatus, (byStatus.get(r.verificationStatus) ?? 0) + 1);
    byCuisine.set(r.cuisine, (byCuisine.get(r.cuisine) ?? 0) + 1);
  }
  const withAdaptation = recipes.filter((r) => r.indianKitchenAdaptation).length;
  const withNutrition = recipes.filter((r) => r.nutrition).length;
  const avgSteps = Math.round(recipes.reduce((s, r) => s + r.steps.length, 0) / Math.max(recipes.length, 1));

  return (
    <>
      <PageHero
        eyebrow="Studio"
        title="Data studio"
        intro="A build-time snapshot of the knowledge engine. The write side lives in the scripts pipeline; this page makes the state of the data visible."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Recipes", recipes.length],
              ["Cuisines with recipes", byCuisine.size],
              ["Cuisines defined", cuisines.length],
              ["Ingredients", ingredients.length],
              ["Collections", collections.length],
              ["Indian-kitchen adaptations", withAdaptation],
              ["With nutrition estimates", withNutrition],
              ["Avg steps per recipe", avgSteps],
            ] as [string, number][]
          ).map(([k, v]) => (
            <div key={k} className="rounded-card border border-cardamom bg-card p-4 text-center shadow-lift">
              <p className="font-display text-3xl">{v}</p>
              <p className="mt-1 text-xs text-tamarind-faint">{k}</p>
            </div>
          ))}
        </div>

        <h2 className="font-display mt-12 text-2xl">Verification pipeline</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(VERIFICATION_LABEL).map(([status, v]) => (
            <div key={status} className="rounded-card border border-cardamom bg-card p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">{v.label}</p>
                <p className="font-display text-xl">{byStatus.get(status as VerificationStatus) ?? 0}</p>
              </div>
              <p className="mt-1 text-xs text-tamarind-faint">{v.note}</p>
            </div>
          ))}
        </div>

        <h2 className="font-display mt-12 text-2xl">Coverage by cuisine</h2>
        <div className="mt-4 overflow-hidden rounded-card border border-cardamom bg-card">
          {[...byCuisine.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([slug, count]) => (
              <div key={slug} className="flex items-center gap-3 border-b border-cardamom px-4 py-2 last:border-0">
                <span className="w-40 shrink-0 truncate text-sm font-medium">
                  {cuisines.find((c) => c.slug === slug)?.name ?? slug}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-rice-deep">
                  <div
                    className="h-full rounded-full bg-turmeric"
                    style={{ width: `${Math.min(100, (count / Math.max(...byCuisine.values())) * 100)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs text-tamarind-faint">{count}</span>
              </div>
            ))}
        </div>

        <h2 className="font-display mt-12 text-2xl">Pipeline scripts</h2>
        <p className="mt-2 text-sm text-tamarind-soft">
          Run from the repo root. Docs: <code className="rounded bg-rice-deep px-1">docs/SCALING.md</code>.
        </p>
        <div className="mt-4 overflow-hidden rounded-card border border-cardamom bg-card">
          {SCRIPTS.map(([cmd, desc]) => (
            <div key={cmd} className="border-b border-cardamom px-4 py-3 last:border-0">
              <code className="text-sm font-semibold text-curry">{cmd}</code>
              <p className="mt-0.5 text-xs text-tamarind-faint">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

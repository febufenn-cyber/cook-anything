import type { Metadata } from "next";
import Link from "next/link";
import { getAllRecipes, getCuisines } from "@/lib/data";
import PageHero from "@/components/PageHero";
import RecipeGrid from "@/components/RecipeGrid";

export const metadata: Metadata = {
  title: "All recipes",
  description:
    "Browse every recipe on Cook Anything, organised by cuisine — from Tamil kulambu to Korean rice bowls, each with source and verification status.",
  alternates: { canonical: "/recipes/" },
};

export default function RecipesPage() {
  const recipes = getAllRecipes();
  const cuisines = getCuisines();
  const byCuisine = new Map<string, typeof recipes>();
  for (const r of recipes) {
    if (!byCuisine.has(r.cuisine)) byCuisine.set(r.cuisine, []);
    byCuisine.get(r.cuisine)!.push(r);
  }
  const orderedCuisines = cuisines.filter((c) => byCuisine.has(c.slug));

  return (
    <>
      <PageHero
        eyebrow="The atlas"
        title={`All ${recipes.length} recipes`}
        intro="Every dish in the engine, grouped by cuisine. Use search or the ingredient matcher to slice it any other way."
      >
        <div className="rail mt-6 flex gap-2 overflow-x-auto pb-1">
          {orderedCuisines.map((c) => (
            <a
              key={c.slug}
              href={`#${c.slug}`}
              className="whitespace-nowrap rounded-full border border-cardamom bg-card px-3 py-1.5 text-xs font-medium text-tamarind-soft hover:border-turmeric"
            >
              {c.name} · {byCuisine.get(c.slug)!.length}
            </a>
          ))}
        </div>
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {orderedCuisines.map((c) => (
          <section key={c.slug} id={c.slug} className="mb-12 scroll-mt-20">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl">{c.name}</h2>
              <Link href={`/cuisines/${c.slug}`} className="shrink-0 text-sm font-medium text-turmeric-deep hover:underline">
                About {c.name} cooking →
              </Link>
            </div>
            <div className="mt-4">
              <RecipeGrid recipes={byCuisine.get(c.slug)!} />
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

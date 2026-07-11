import type { Metadata } from "next";
import Link from "next/link";
import { getCountries, getAllRecipes } from "@/lib/data";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Recipes by country",
  description: "Travel the world's kitchens country by country — from India and Sri Lanka to Korea, Italy, Mexico and Nigeria.",
  alternates: { canonical: "/countries/" },
};

export default function CountriesPage() {
  const countries = getCountries();
  const counts = new Map<string, number>();
  for (const r of getAllRecipes()) counts.set(r.country, (counts.get(r.country) ?? 0) + 1);
  const byContinent = new Map<string, typeof countries>();
  for (const c of countries) {
    if (!byContinent.has(c.continent)) byContinent.set(c.continent, []);
    byContinent.get(c.continent)!.push(c);
  }

  return (
    <>
      <PageHero
        eyebrow="Food atlas"
        title="Recipes by country"
        intro="Every country groups its cuisines, regions and dishes. Pick a place and see what its home kitchens actually cook."
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {[...byContinent.entries()].map(([continent, list]) => (
          <section key={continent} className="mb-10">
            <h2 className="font-display text-2xl">{continent}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((c) => (
                <Link
                  key={c.slug}
                  href={`/countries/${c.slug}`}
                  className="group rounded-card border border-cardamom bg-card p-4 shadow-lift hover:-translate-y-0.5 transition-transform"
                >
                  <p className="font-display group-hover:text-turmeric-deep">{c.name}</p>
                  <p className="mt-1 text-xs text-tamarind-faint">{counts.get(c.slug) ?? 0} recipes</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

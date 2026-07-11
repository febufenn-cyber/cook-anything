import type { Metadata } from "next";
import Link from "next/link";
import { getCuisines, getAllRecipes, getCountry } from "@/lib/data";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Cuisines of the world",
  description:
    "Browse recipes by cuisine — Tamil, Kerala, Andhra, Punjabi, Pakistani, Korean, Japanese, Italian, Mexican, Middle Eastern and more.",
  alternates: { canonical: "/cuisines/" },
};

export default function CuisinesPage() {
  const cuisines = getCuisines();
  const counts = new Map<string, number>();
  for (const r of getAllRecipes()) counts.set(r.cuisine, (counts.get(r.cuisine) ?? 0) + 1);

  return (
    <>
      <PageHero
        eyebrow="Food atlas"
        title="Every cuisine is a different answer to the same question"
        intro="What do we do with what we have? Browse how each food culture answers it — start close to home or as far away as you like."
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cuisines.map((c) => (
            <Link
              key={c.slug}
              href={`/cuisines/${c.slug}`}
              className="group rounded-card border border-cardamom bg-card p-5 shadow-lift transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-xl group-hover:text-turmeric-deep">{c.name}</h2>
                <span className="shrink-0 rounded-full bg-turmeric-tint px-2 py-0.5 text-xs font-semibold text-turmeric-deep">
                  {counts.get(c.slug) ?? 0}
                </span>
              </div>
              {c.country && (
                <p className="mt-0.5 text-xs text-tamarind-faint">
                  {getCountry(c.country)?.name ?? c.country}
                </p>
              )}
              <p className="mt-2 line-clamp-2 text-sm text-tamarind-soft">{c.blurb}</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

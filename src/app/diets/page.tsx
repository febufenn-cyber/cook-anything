import type { Metadata } from "next";
import Link from "next/link";
import { getDiets, getAllRecipes } from "@/lib/data";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Diet & health filters",
  description:
    "Vegetarian, vegan, eggetarian, high-protein, low-carb and allergen-aware recipe browsing — with honest placeholder labels where values aren't verified yet.",
  alternates: { canonical: "/diets/" },
};

export default function DietsPage() {
  const diets = getDiets();
  const counts = new Map<string, number>();
  for (const r of getAllRecipes())
    for (const d of r.dietType) counts.set(d, (counts.get(d) ?? 0) + 1);

  return (
    <>
      <PageHero
        eyebrow="Diet & health"
        title="Cook for how you eat"
        intro="Every recipe is tagged with a primary diet plus extras like high-protein. Labels marked 'estimated' haven't been dietitian-verified — we say so instead of pretending."
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {diets.map((d) => (
            <Link
              key={d.slug}
              href={`/diets/${d.slug}`}
              className="group rounded-card border border-cardamom bg-card p-5 shadow-lift transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-lg group-hover:text-turmeric-deep">{d.name}</h2>
                <span className="shrink-0 text-xs text-tamarind-faint">{counts.get(d.slug) ?? 0}</span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-tamarind-soft">{d.blurb}</p>
              {d.isPlaceholderLabel && (
                <p className="mt-2 text-xs font-medium text-chilli">Estimated label — not yet verified</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

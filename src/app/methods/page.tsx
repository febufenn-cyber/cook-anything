import type { Metadata } from "next";
import Link from "next/link";
import { getMethods, getAllRecipes } from "@/lib/data";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Cooking methods",
  description:
    "Browse recipes by technique — tempering, pressure cooking, kadai, tawa, dum, stir-frying, steaming, fermenting and more, with Indian-kitchen equivalents for Western methods.",
  alternates: { canonical: "/methods/" },
};

export default function MethodsPage() {
  const methods = getMethods();
  const counts = new Map<string, number>();
  for (const r of getAllRecipes())
    for (const m of r.methods) counts.set(m, (counts.get(m) ?? 0) + 1);

  return (
    <>
      <PageHero
        eyebrow="Technique"
        title="Cooking methods"
        intro="Same ingredients, different fire. Every Western method here carries its Indian-kitchen equivalent — no oven required."
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {methods
            .sort((a, b) => (counts.get(b.slug) ?? 0) - (counts.get(a.slug) ?? 0))
            .map((m) => (
              <Link
                key={m.slug}
                href={`/methods/${m.slug}`}
                className="group rounded-card border border-cardamom bg-card p-5 shadow-lift transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg group-hover:text-turmeric-deep">{m.name}</h2>
                  <span className="shrink-0 text-xs text-tamarind-faint">{counts.get(m.slug) ?? 0} recipes</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-tamarind-soft">{m.blurb}</p>
                {m.indianEquivalent && (
                  <p className="mt-2 text-xs font-medium text-turmeric-deep">🇮🇳 {m.indianEquivalent}</p>
                )}
              </Link>
            ))}
        </div>
      </div>
    </>
  );
}

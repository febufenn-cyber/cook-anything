import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRegions, getRegion, getRecipesByRegion, getCountry } from "@/lib/data";
import PageHero from "@/components/PageHero";
import RecipeGrid from "@/components/RecipeGrid";

export function generateStaticParams() {
  return getRegions().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = getRegion(slug);
  if (!r) return {};
  return {
    title: `${r.name} recipes`,
    description: r.blurb.slice(0, 158),
    alternates: { canonical: `/regions/${slug}/` },
  };
}

export default async function RegionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const region = getRegion(slug);
  if (!region) notFound();
  const recipes = getRecipesByRegion(slug);
  const country = getCountry(region.country);

  return (
    <>
      <PageHero eyebrow={country?.name ?? region.country} title={`${region.name} kitchens`} intro={region.blurb} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="mb-5 text-sm text-tamarind-soft">{recipes.length} recipes from this region</p>
        <RecipeGrid
          recipes={recipes}
          emptyNote="No recipes are pinned to this exact region yet — check the parent country page for nearby dishes."
        />
        {country && (
          <p className="mt-10 text-sm text-tamarind-soft">
            <Link href={`/countries/${country.slug}`} className="font-medium text-turmeric-deep hover:underline">
              ← All of {country.name}
            </Link>
          </p>
        )}
      </div>
    </>
  );
}

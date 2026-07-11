import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCountries, getCountry, getRecipesByCountry, getCuisine, getRegions } from "@/lib/data";
import PageHero from "@/components/PageHero";
import RecipeGrid from "@/components/RecipeGrid";
import ChipLink from "@/components/ChipLink";

export function generateStaticParams() {
  return getCountries().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = getCountry(slug);
  if (!c) return {};
  return {
    title: `${c.name} recipes`,
    description: c.blurb.slice(0, 158),
    alternates: { canonical: `/countries/${slug}/` },
  };
}

export default async function CountryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const country = getCountry(slug);
  if (!country) notFound();
  const recipes = getRecipesByCountry(slug);
  const regions = getRegions().filter((r) => r.country === slug);

  return (
    <>
      <PageHero eyebrow={country.continent} title={`Cooking in ${country.name}`} intro={country.blurb}>
        <div className="mt-6 flex flex-wrap gap-2">
          {country.cuisines.map((cu) => {
            const c = getCuisine(cu);
            return c ? <ChipLink key={cu} href={`/cuisines/${cu}`} label={c.name} /> : null;
          })}
          {regions.map((r) => (
            <ChipLink key={r.slug} href={`/regions/${r.slug}`} label={r.name} sub="region" />
          ))}
        </div>
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="mb-5 text-sm text-tamarind-soft">{recipes.length} recipes</p>
        <RecipeGrid recipes={recipes} />
        <p className="mt-10 text-sm text-tamarind-soft">
          <Link href="/countries" className="font-medium text-turmeric-deep hover:underline">← All countries</Link>
        </p>
      </div>
    </>
  );
}

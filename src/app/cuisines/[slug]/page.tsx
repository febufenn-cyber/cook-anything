import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCuisines, getCuisine, getRecipesByCuisine, getCountry, getRegion, getIngredient } from "@/lib/data";
import PageHero from "@/components/PageHero";
import RecipeGrid from "@/components/RecipeGrid";
import ChipLink from "@/components/ChipLink";

export function generateStaticParams() {
  return getCuisines().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = getCuisine(slug);
  if (!c) return {};
  const count = getRecipesByCuisine(slug).length;
  return {
    title: `${c.name} recipes (${count})`,
    description: c.blurb.slice(0, 158),
    alternates: { canonical: `/cuisines/${slug}/` },
  };
}

export default async function CuisinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cuisine = getCuisine(slug);
  if (!cuisine) notFound();
  const recipes = getRecipesByCuisine(slug);
  const country = cuisine.country ? getCountry(cuisine.country) : undefined;
  const region = cuisine.region ? getRegion(cuisine.region) : undefined;

  return (
    <>
      <PageHero eyebrow={country ? `${country.name}${region ? ` · ${region.name}` : ""}` : "World cuisine"} title={`${cuisine.name} recipes`} intro={cuisine.blurb}>
        {cuisine.signatureIngredients.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">
              Signature ingredients:
            </span>
            {cuisine.signatureIngredients.map((slug2) => {
              const ing = getIngredient(slug2);
              return (
                <ChipLink
                  key={slug2}
                  href={`/ingredients/${slug2}`}
                  label={ing?.name.replace(/\s*\(.*\)\s*/g, "") ?? slug2}
                  sub={ing?.ta ?? ing?.hi}
                />
              );
            })}
          </div>
        )}
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="mb-5 text-sm text-tamarind-soft">
          {recipes.length} recipe{recipes.length === 1 ? "" : "s"} ·{" "}
          <Link href={`/what-can-i-cook`} className="font-medium text-turmeric-deep hover:underline">
            or match by your ingredients →
          </Link>
        </p>
        <RecipeGrid recipes={recipes} />
        {country && (
          <p className="mt-10 text-sm text-tamarind-soft">
            Explore more from{" "}
            <Link href={`/countries/${country.slug}`} className="font-medium text-turmeric-deep hover:underline">
              {country.name}
            </Link>
            {region && (
              <>
                {" "}or the{" "}
                <Link href={`/regions/${region.slug}`} className="font-medium text-turmeric-deep hover:underline">
                  {region.name}
                </Link>{" "}
                region
              </>
            )}
            .
          </p>
        )}
      </div>
    </>
  );
}

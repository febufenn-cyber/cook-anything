import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDiets, getDiet, getRecipesByDiet } from "@/lib/data";
import PageHero from "@/components/PageHero";
import RecipeGrid from "@/components/RecipeGrid";

export function generateStaticParams() {
  return getDiets().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = getDiet(slug);
  if (!d) return {};
  return {
    title: `${d.name} recipes`,
    description: d.blurb.slice(0, 158),
    alternates: { canonical: `/diets/${slug}/` },
  };
}

export default async function DietPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const diet = getDiet(slug);
  if (!diet) notFound();
  const recipes = getRecipesByDiet(slug);

  return (
    <>
      <PageHero eyebrow="Diet" title={`${diet.name} recipes`} intro={diet.blurb}>
        {diet.isPlaceholderLabel && (
          <p className="mt-4 inline-block rounded-full bg-chilli-tint px-4 py-2 text-sm font-medium text-chilli">
            These labels are estimates, not verified dietary advice. Check with your doctor for medical diets.
          </p>
        )}
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="mb-5 text-sm text-tamarind-soft">{recipes.length} recipes</p>
        <RecipeGrid recipes={recipes} />
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMethods, getMethod, getRecipesByMethod } from "@/lib/data";
import PageHero from "@/components/PageHero";
import RecipeGrid from "@/components/RecipeGrid";

export function generateStaticParams() {
  return getMethods().map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const m = getMethod(slug);
  if (!m) return {};
  return {
    title: `${m.name} recipes`,
    description: m.blurb.slice(0, 158),
    alternates: { canonical: `/methods/${slug}/` },
  };
}

export default async function MethodPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const method = getMethod(slug);
  if (!method) notFound();
  const recipes = getRecipesByMethod(slug);

  return (
    <>
      <PageHero eyebrow="Cooking method" title={method.name} intro={method.blurb}>
        {method.indianEquivalent && (
          <p className="mt-4 inline-block rounded-full bg-turmeric-tint px-4 py-2 text-sm font-medium text-turmeric-deep">
            Indian kitchen: {method.indianEquivalent}
          </p>
        )}
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="mb-5 text-sm text-tamarind-soft">{recipes.length} recipes use this method</p>
        <RecipeGrid recipes={recipes} />
      </div>
    </>
  );
}

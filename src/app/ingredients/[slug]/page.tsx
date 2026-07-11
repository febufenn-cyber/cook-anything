import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getIngredients, getIngredient, getRecipesByIngredient, getCuisine } from "@/lib/data";
import PageHero from "@/components/PageHero";
import RecipeGrid from "@/components/RecipeGrid";
import { titleFromSlug } from "@/lib/format";

export function generateStaticParams() {
  return getIngredients().map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ing = getIngredient(slug);
  if (!ing) return {};
  const count = getRecipesByIngredient(slug).length;
  const names = [ing.name, ing.ta, ing.hi].filter(Boolean).join(" / ");
  return {
    title: `${ing.name} recipes (${count})`,
    description: `What the world cooks with ${names}: ${count} recipes across cuisines, with substitutions and allergen notes.`,
    alternates: { canonical: `/ingredients/${slug}/` },
  };
}

export default async function IngredientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ing = getIngredient(slug);
  if (!ing) notFound();
  const recipes = getRecipesByIngredient(slug);
  const cuisineSet = [...new Set(recipes.map((r) => r.cuisine))];

  return (
    <>
      <PageHero
        eyebrow={titleFromSlug(ing.category)}
        title={`What the world cooks with ${ing.name.replace(/\s*\(.*\)\s*/g, "").toLowerCase()}`}
        intro={
          [ing.ta && `Tamil: ${ing.ta}`, ing.hi && `Hindi: ${ing.hi}`].filter(Boolean).join(" · ") ||
          undefined
        }
      >
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
          {ing.allergens.length > 0 && (
            <span className="rounded-full bg-chilli-tint px-3 py-1 font-medium text-chilli">
              Allergen: {ing.allergens.map(titleFromSlug).join(", ")}
            </span>
          )}
          {ing.pantryStaple && (
            <span className="rounded-full bg-curry-tint px-3 py-1 font-medium text-curry">
              Pantry staple — assumed available in matching
            </span>
          )}
          {ing.aliases.length > 0 && (
            <span className="text-tamarind-faint">Also known as: {ing.aliases.slice(0, 6).join(", ")}</span>
          )}
        </div>
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="mb-5 text-sm text-tamarind-soft">
          {recipes.length} recipes across {cuisineSet.length} cuisines
          {cuisineSet.length > 0 && (
            <>
              {": "}
              {cuisineSet.slice(0, 8).map((c, i) => (
                <span key={c}>
                  {i > 0 && ", "}
                  <Link href={`/cuisines/${c}`} className="text-curry hover:underline">
                    {getCuisine(c)?.name ?? titleFromSlug(c)}
                  </Link>
                </span>
              ))}
              {cuisineSet.length > 8 && "…"}
            </>
          )}
        </p>
        <RecipeGrid recipes={recipes} />
      </div>
    </>
  );
}

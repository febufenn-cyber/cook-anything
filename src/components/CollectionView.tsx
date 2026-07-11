import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollection, getCollectionRecipes, getCollections, getCuisine } from "@/lib/data";
import PageHero from "@/components/PageHero";
import RecipeGrid from "@/components/RecipeGrid";
import { titleFromSlug } from "@/lib/format";

export function collectionMetadata(slug: string) {
  const col = getCollection(slug);
  if (!col) return {};
  const count = getCollectionRecipes(col).length;
  return {
    title: `${col.name} (${count} recipes)`,
    description: col.intro.slice(0, 158),
    alternates: { canonical: `/${slug}/` },
    openGraph: { title: `${col.name} · Cook Anything`, description: col.intro.slice(0, 158) },
  };
}

export default function CollectionView({ slug }: { slug: string }) {
  const col = getCollection(slug);
  if (!col) notFound();
  const recipes = getCollectionRecipes(col);
  const related = col.relatedCollections
    .map((s) => getCollections().find((c) => c.slug === s))
    .filter(Boolean);
  const topCuisines = [...new Set(recipes.map((r) => r.cuisine))].slice(0, 8);
  const topIngredients = [
    ...new Set(
      recipes.flatMap((r) => r.ingredients.filter((i) => !i.optional).map((i) => i.normalizedName)),
    ),
  ]
    .filter((s) => !["salt", "oil", "water", "sugar"].includes(s))
    .slice(0, 8);

  return (
    <>
      <PageHero eyebrow="Collection" title={col.name} intro={col.intro} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="mb-5 text-sm text-tamarind-soft">
          {recipes.length} recipes ·{" "}
          <Link href="/what-can-i-cook" className="font-medium text-turmeric-deep hover:underline">
            match against your own kitchen →
          </Link>
        </p>
        <RecipeGrid recipes={recipes} />

        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {related.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">
                Related collections
              </h2>
              <ul className="mt-3 space-y-2">
                {related.map((c) => (
                  <li key={c!.slug}>
                    <Link href={`/${c!.slug}`} className="text-sm font-medium text-turmeric-deep hover:underline">
                      {c!.name} →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {topCuisines.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">
                Cuisines in this collection
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {topCuisines.map((c) => (
                  <Link key={c} href={`/cuisines/${c}`} className="rounded-full border border-cardamom bg-card px-3 py-1 text-xs hover:border-turmeric">
                    {getCuisine(c)?.name ?? titleFromSlug(c)}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {topIngredients.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">
                Common ingredients
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {topIngredients.map((i) => (
                  <Link key={i} href={`/ingredients/${i}`} className="rounded-full border border-cardamom bg-card px-3 py-1 text-xs hover:border-turmeric">
                    {titleFromSlug(i)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

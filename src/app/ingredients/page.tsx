import type { Metadata } from "next";
import Link from "next/link";
import { getIngredients, getAllRecipes } from "@/lib/data";
import PageHero from "@/components/PageHero";
import { titleFromSlug } from "@/lib/format";

export const metadata: Metadata = {
  title: "Ingredients A–Z",
  description:
    "Every ingredient the engine understands, with Tamil and Hindi names — tap one to see what the world cooks with it.",
  alternates: { canonical: "/ingredients/" },
};

export default function IngredientsPage() {
  const ingredients = getIngredients();
  const counts = new Map<string, number>();
  for (const r of getAllRecipes())
    for (const i of new Set(r.ingredients.map((x) => x.normalizedName)))
      counts.set(i, (counts.get(i) ?? 0) + 1);

  const byCategory = new Map<string, typeof ingredients>();
  for (const i of ingredients) {
    if (!byCategory.has(i.category)) byCategory.set(i.category, []);
    byCategory.get(i.category)!.push(i);
  }
  const order = [
    "vegetable", "fruit", "meat", "seafood", "egg", "dairy", "grain", "pulse",
    "spice", "herb", "oil", "nut", "condiment", "sweetener", "other",
  ];

  return (
    <>
      <PageHero
        eyebrow="The pantry"
        title="Ingredients, in your language"
        intro="Onion, vengayam or pyaz — the engine understands all three. Pick an ingredient to see every dish the world makes with it."
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {order
          .filter((cat) => byCategory.has(cat))
          .map((cat) => (
            <section key={cat} className="mb-10">
              <h2 className="font-display text-xl capitalize">{titleFromSlug(cat)}s</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {byCategory
                  .get(cat)!
                  .sort((a, b) => (counts.get(b.slug) ?? 0) - (counts.get(a.slug) ?? 0))
                  .map((i) => (
                    <Link
                      key={i.slug}
                      href={`/ingredients/${i.slug}`}
                      className="group rounded-full border border-cardamom bg-card px-4 py-2 text-sm shadow-lift hover:border-turmeric"
                    >
                      <span className="font-medium">{i.name.replace(/\s*\(.*\)\s*/g, "")}</span>
                      {(i.ta || i.hi) && (
                        <span className="ml-2 text-xs text-tamarind-faint">
                          {[i.ta, i.hi].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      {(counts.get(i.slug) ?? 0) > 0 && (
                        <span className="ml-2 rounded-full bg-turmeric-tint px-1.5 text-xs font-semibold text-turmeric-deep">
                          {counts.get(i.slug)}
                        </span>
                      )}
                    </Link>
                  ))}
              </div>
            </section>
          ))}
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllRecipes, getRecipeBySlug, getRelatedRecipes, getCrossCultureRecipes,
  getCuisine, getCountry, getRegion, getIngredients, getMethods, getCookware,
} from "@/lib/data";
import { recipeJsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import {
  formatMinutes, formatQuantity, DIFFICULTY_LABEL, SPICE_LABEL,
  BUDGET_LABEL, titleFromSlug,
} from "@/lib/format";
import CookMode from "@/components/CookMode";
import CookCompanion from "@/components/CookCompanion";
import { toCompanionRecipe } from "@/lib/companion/adapt";
import SaveRecipeButton from "@/components/SaveRecipeButton";
import ShareButton from "@/components/ShareButton";
import RecipeGrid from "@/components/RecipeGrid";
import RecipeTrustPanel from "@/components/RecipeTrustPanel";
import { buildRecipeTrustRecord } from "@/lib/trust/server";

export function generateStaticParams() {
  return getAllRecipes().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = getRecipeBySlug(slug);
  if (!r) return {};
  const title = `${r.title} Recipe`;
  const description = `${r.description} Ready in ${formatMinutes(r.totalTimeMinutes)} · ${titleFromSlug(r.cuisine)} · ${DIFFICULTY_LABEL[r.difficulty]}.`.slice(0, 158);
  return {
    title,
    description,
    alternates: { canonical: `/recipes/${r.slug}/` },
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary", title, description },
  };
}

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recipe = getRecipeBySlug(slug);
  if (!recipe) notFound();

  const cuisine = getCuisine(recipe.cuisine);
  const country = getCountry(recipe.country);
  const region = recipe.region ? getRegion(recipe.region) : undefined;
  const ingredientDefs = new Map(getIngredients().map((i) => [i.slug, i]));
  const methodDefs = new Map(getMethods().map((m) => [m.slug, m]));
  const cookwareDefs = new Map(getCookware().map((c) => [c.slug, c]));
  const related = getRelatedRecipes(recipe);
  const crossCulture = getCrossCultureRecipes(recipe);
  const trust = buildRecipeTrustRecord(recipe, ingredientDefs);
  const companionRecipe = toCompanionRecipe(recipe, ingredientDefs, trust);

  const facts: [string, string][] = [
    ["Prep", formatMinutes(recipe.prepTimeMinutes)],
    ["Cook", formatMinutes(recipe.cookTimeMinutes)],
    ["Total", formatMinutes(recipe.totalTimeMinutes)],
    ["Serves", String(recipe.servings)],
    ["Difficulty", DIFFICULTY_LABEL[recipe.difficulty]],
    ["Spice", SPICE_LABEL[recipe.spiceLevel]],
    ["Cost", BUDGET_LABEL[recipe.budgetLevel]],
  ];

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(recipeJsonLd(recipe)) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Recipes", url: "/recipes/" },
              { name: cuisine?.name ?? titleFromSlug(recipe.cuisine), url: `/cuisines/${recipe.cuisine}/` },
              { name: recipe.title, url: `/recipes/${recipe.slug}/` },
            ]),
          ),
        }}
      />

      <nav aria-label="Breadcrumb" className="no-print text-sm text-tamarind-faint">
        <Link href="/recipes" className="hover:text-tamarind">Recipes</Link>
        <span aria-hidden> / </span>
        <Link href={`/cuisines/${recipe.cuisine}`} className="hover:text-tamarind">
          {cuisine?.name ?? titleFromSlug(recipe.cuisine)}
        </Link>
        <span aria-hidden> / </span>
        <span className="text-tamarind-soft">{recipe.title}</span>
      </nav>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href={`/cuisines/${recipe.cuisine}`} className="rounded-full bg-curry-tint px-3 py-1 font-semibold text-curry hover:bg-curry hover:text-white">
            {cuisine?.name ?? titleFromSlug(recipe.cuisine)}
          </Link>
          <Link href={`/countries/${recipe.country}`} className="rounded-full bg-rice-deep px-3 py-1 text-tamarind-soft hover:text-tamarind">
            {country?.name ?? titleFromSlug(recipe.country)}
          </Link>
          {region && (
            <Link href={`/regions/${region.slug}`} className="rounded-full bg-rice-deep px-3 py-1 text-tamarind-soft hover:text-tamarind">
              {region.name}
            </Link>
          )}
          {recipe.mealType.map((m) => (
            <span key={m} className="rounded-full bg-rice-deep px-3 py-1 text-tamarind-soft">{titleFromSlug(m)}</span>
          ))}
        </div>
        <h1 className="font-display mt-4 text-3xl leading-tight sm:text-5xl">{recipe.title}</h1>
        {recipe.nativeTitle && <p className="mt-2 text-xl text-tamarind-faint">{recipe.nativeTitle}</p>}
        <p className="mt-4 max-w-3xl text-lg text-tamarind-soft">{recipe.description}</p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-turmeric-tint px-3 py-1 text-xs font-semibold text-turmeric-deep">
            {trust.verification.cookTestStatus === "cook_tested" ? "Cook-tested" : "Not cook-tested"}
          </span>
          <span className="text-xs text-tamarind-faint">
            {trust.provenance.sourceLabel} · Licence declaration: {trust.provenance.licenseId}
          </span>
        </div>

        <div className="no-print mt-6 flex flex-wrap items-center gap-3">
          <CookMode recipe={recipe} />
          <CookCompanion recipe={recipe} companionRecipe={companionRecipe} />
          <SaveRecipeButton slug={recipe.slug} title={recipe.title} cuisine={recipe.cuisine} />
          <ShareButton title={recipe.title} />
        </div>
      </header>

      <div className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-card border border-cardamom bg-cardamom sm:grid-cols-7">
        {facts.map(([k, v]) => (
          <div key={k} className="bg-card px-3 py-3 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-tamarind-faint">{k}</p>
            <p className="mt-0.5 text-sm font-semibold">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <h2 className="font-display text-2xl">Ingredients</h2>
          <p className="mt-1 text-sm text-tamarind-faint">For {recipe.servings} servings</p>
          <ul className="mt-4 space-y-2.5">
            {recipe.ingredients.map((ing, i) => {
              const def = ingredientDefs.get(ing.normalizedName);
              return (
                <li key={i} className="flex items-baseline justify-between gap-3 border-b border-cardamom pb-2.5 text-sm">
                  <span>
                    <Link href={`/ingredients/${ing.normalizedName}`} className="font-medium hover:text-turmeric-deep">
                      {ing.name}
                    </Link>
                    {ing.optional && <span className="ml-1.5 text-xs text-tamarind-faint">(optional)</span>}
                    {(def?.ta || def?.hi) && (
                      <span className="block text-xs text-tamarind-faint">
                        {[def?.ta, def?.hi].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {ing.notes && <span className="block text-xs text-tamarind-faint">{ing.notes}</span>}
                  </span>
                  <span className="shrink-0 font-semibold">{formatQuantity(ing)}</span>
                </li>
              );
            })}
          </ul>

          {recipe.substitutions.length > 0 && (
            <div className="mt-6 rounded-card border border-cardamom bg-turmeric-tint/50 p-5">
              <h3 className="font-display text-lg">Don&apos;t have it? Swap it</h3>
              <p className="mt-1 text-xs text-tamarind-faint">
                Substitutions can introduce allergens or change dietary suitability. Check every replacement label before using it.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {recipe.substitutions.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium">{ingredientDefs.get(s.ingredient)?.name ?? titleFromSlug(s.ingredient)}</span>
                    <span className="text-tamarind-soft"> → {s.substitute}</span>
                    {s.notes && <span className="block text-xs text-tamarind-faint">{s.notes}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 space-y-4 text-sm">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Cookware</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {recipe.cookware.map((c) => (
                  <span key={c} className="rounded-full border border-cardamom bg-card px-3 py-1 text-xs">
                    {cookwareDefs.get(c)?.name ?? titleFromSlug(c)}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Methods</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {recipe.methods.map((m) => (
                  <Link key={m} href={`/methods/${m}`} className="rounded-full border border-cardamom bg-card px-3 py-1 text-xs hover:border-turmeric">
                    {methodDefs.get(m)?.name ?? titleFromSlug(m)}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Allergen assessment</h3>
              {trust.allergen.contains.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {trust.allergen.contains.map((a) => (
                    <span key={a} className="rounded-full bg-chilli-tint px-3 py-1 text-xs font-medium text-chilli">
                      Contains {titleFromSlug(a)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-tamarind-soft">
                  No listed allergens detected from canonical ingredients. This does not mean allergen-free; check product labels and cross-contact.
                </p>
              )}
              <p className="mt-2 text-xs text-tamarind-faint">Status: {trust.allergen.status}. {trust.allergen.basis}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Diet</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {recipe.dietType.map((d) => (
                  <Link key={d} href={`/diets/${d}`} className="rounded-full border border-cardamom bg-card px-3 py-1 text-xs hover:border-turmeric">
                    {titleFromSlug(d.replace(/_placeholder$/, " (est.)"))}
                  </Link>
                ))}
              </div>
              <p className="mt-2 text-xs text-tamarind-faint">Ingredient-derived primary diet: {titleFromSlug(trust.dietary.derivedPrimary)}.</p>
            </div>
          </div>

          {recipe.nutrition && (
            <div className="mt-6 rounded-card border border-cardamom bg-card p-5">
              <h3 className="font-display text-lg">Nutrition per serving</h3>
              {recipe.nutrition.isEstimate && (
                <p className="mt-1 text-xs text-tamarind-faint">
                  Estimated values — not lab-verified. Treat as a rough guide.
                </p>
              )}
              <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                {(
                  [
                    ["Calories", recipe.nutrition.calories, ""],
                    ["Protein", recipe.nutrition.protein, "g"],
                    ["Carbs", recipe.nutrition.carbs, "g"],
                    ["Fat", recipe.nutrition.fat, "g"],
                    ["Fiber", recipe.nutrition.fiber, "g"],
                    ["Sugar", recipe.nutrition.sugar, "g"],
                  ] as [string, number | null, string][]
                )
                  .filter(([, v]) => v !== null)
                  .map(([k, v, u]) => (
                    <div key={k}>
                      <dt className="text-xs text-tamarind-faint">{k}</dt>
                      <dd className="font-semibold">{v}{u}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}
        </div>

        <div>
          <h2 className="font-display text-2xl">Method</h2>
          <ol className="mt-4 space-y-6">
            {recipe.steps.map((s) => (
              <li key={s.order} className="flex gap-4">
                <span
                  aria-hidden
                  className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-turmeric-tint text-base text-turmeric-deep"
                >
                  {s.order}
                </span>
                <div className="pt-1">
                  <p className="leading-relaxed">{s.text}</p>
                  {s.timerMinutes && (
                    <p className="mt-1 text-xs font-medium text-turmeric-deep">⏱ about {s.timerMinutes} min</p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 space-y-4">
            {recipe.indianKitchenAdaptation && (
              <div className="rounded-card border-l-4 border-turmeric bg-turmeric-tint/60 p-5">
                <h3 className="font-display text-lg">Indian kitchen adaptation</h3>
                <p className="mt-2 text-sm leading-relaxed text-tamarind-soft">{recipe.indianKitchenAdaptation}</p>
              </div>
            )}
            {recipe.culturalNote && (
              <div className="rounded-card border border-cardamom bg-card p-5">
                <h3 className="font-display text-lg">Where this comes from</h3>
                <p className="mt-2 text-sm leading-relaxed text-tamarind-soft">{recipe.culturalNote}</p>
              </div>
            )}
            {recipe.regionalVariation && (
              <div className="rounded-card border border-cardamom bg-card p-5">
                <h3 className="font-display text-lg">Regional variations</h3>
                <p className="mt-2 text-sm leading-relaxed text-tamarind-soft">{recipe.regionalVariation}</p>
              </div>
            )}
          </div>

          <div className="mt-8">
            <RecipeTrustPanel trust={trust} source={recipe.source} author={recipe.author} />
            <p className="mt-3 text-xs text-tamarind-faint">
              {recipe.sourceUrl && (
                <><a href={recipe.sourceUrl} rel="nofollow noopener" className="underline">View declared source</a>{" · "}</>
              )}
              <Link href="/sources" className="underline hover:text-tamarind">Report an issue or suggest a correction</Link>.
            </p>
          </div>
        </div>
      </div>

      {crossCulture.length > 0 && (
        <section className="no-print mt-14">
          <h2 className="font-display text-2xl">The same pantry, other worlds</h2>
          <p className="mt-1 text-sm text-tamarind-soft">
            Dishes from other cuisines built on the same core ingredients.
          </p>
          <div className="mt-5">
            <RecipeGrid recipes={crossCulture} />
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="no-print mt-12">
          <h2 className="font-display text-2xl">More like this</h2>
          <div className="mt-5">
            <RecipeGrid recipes={related} />
          </div>
        </section>
      )}
    </article>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  getAllRecipes, getRecipeBySlug, getRelatedRecipes, getCrossCultureRecipes,
  getCuisine, getCountry, getRegion, getIngredients, getMethods, getCookware,
} from "@/lib/data";
import { recipeJsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import {
  formatMinutes, formatQuantity, DIFFICULTY_LABEL, SPICE_LABEL,
  BUDGET_LABEL, publicLabel,
} from "@/lib/format";
import CookMode from "@/components/CookMode";
import CookCompanion from "@/components/CookCompanion";
import { toCompanionRecipe } from "@/lib/companion/adapt";
import SaveRecipeButton from "@/components/SaveRecipeButton";
import ShareButton from "@/components/ShareButton";
import RecipeGrid from "@/components/RecipeGrid";
import RecipeTrustPanel from "@/components/RecipeTrustPanel";
import RecipeFeasibility from "@/components/RecipeFeasibility";
import { buildRecipeTrustRecord } from "@/lib/trust/server";

export function generateStaticParams() {
  return getAllRecipes().map((recipe) => ({ slug: recipe.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const recipe = getRecipeBySlug(slug);
  if (!recipe) return {};
  const title = `${recipe.title} Recipe`;
  const description = `${recipe.description} Ready in ${formatMinutes(recipe.totalTimeMinutes)} · ${publicLabel(recipe.cuisine)} · ${DIFFICULTY_LABEL[recipe.difficulty]}.`.slice(0, 158);
  return {
    title,
    description,
    alternates: { canonical: `/recipes/${recipe.slug}/` },
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
  const ingredientDefs = new Map(getIngredients().map((ingredient) => [ingredient.slug, ingredient]));
  const methodDefs = new Map(getMethods().map((method) => [method.slug, method]));
  const cookwareDefs = new Map(getCookware().map((item) => [item.slug, item]));
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
              { name: cuisine?.name ?? publicLabel(recipe.cuisine), url: `/cuisines/${recipe.cuisine}/` },
              { name: recipe.title, url: `/recipes/${recipe.slug}/` },
            ]),
          ),
        }}
      />

      <nav aria-label="Breadcrumb" className="no-print text-sm text-tamarind-faint">
        <Link href="/recipes" className="hover:text-tamarind">Recipes</Link>
        <span aria-hidden> / </span>
        <Link href={`/cuisines/${recipe.cuisine}`} className="hover:text-tamarind">{cuisine?.name ?? publicLabel(recipe.cuisine)}</Link>
        <span aria-hidden> / </span>
        <span className="text-tamarind-soft">{recipe.title}</span>
      </nav>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href={`/cuisines/${recipe.cuisine}`} className="rounded-full bg-curry-tint px-3 py-1 font-semibold text-curry hover:bg-curry hover:text-white">
            {cuisine?.name ?? publicLabel(recipe.cuisine)}
          </Link>
          <Link href={`/countries/${recipe.country}`} className="rounded-full bg-rice-deep px-3 py-1 text-tamarind-soft hover:text-tamarind">
            {country?.name ?? publicLabel(recipe.country)}
          </Link>
          {region && <Link href={`/regions/${region.slug}`} className="rounded-full bg-rice-deep px-3 py-1 text-tamarind-soft hover:text-tamarind">{region.name}</Link>}
          {recipe.mealType.map((meal) => <span key={meal} className="rounded-full bg-rice-deep px-3 py-1 text-tamarind-soft">{publicLabel(meal)}</span>)}
        </div>
        <h1 className="font-display mt-4 text-3xl leading-tight sm:text-5xl">{recipe.title}</h1>
        {recipe.nativeTitle && <p className="mt-2 text-xl text-tamarind-faint">{recipe.nativeTitle}</p>}
        <p className="mt-4 max-w-3xl text-lg text-tamarind-soft">{recipe.description}</p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-turmeric-tint px-3 py-1 text-xs font-semibold text-turmeric-deep">
            {publicLabel(trust.verification.cookTestStatus)}
          </span>
          <span className="text-xs text-tamarind-faint">{trust.provenance.sourceLabel} · Licence declaration: {trust.provenance.licenseId}</span>
        </div>

        <Suspense fallback={null}>
          <RecipeFeasibility recipeSlug={recipe.slug} />
        </Suspense>

        <div className="no-print mt-6 flex flex-wrap items-center gap-3">
          <CookMode recipe={recipe} />
          <CookCompanion recipe={recipe} companionRecipe={companionRecipe} />
          <SaveRecipeButton slug={recipe.slug} title={recipe.title} cuisine={recipe.cuisine} />
          <ShareButton title={recipe.title} />
        </div>
      </header>

      <div className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-card border border-cardamom bg-cardamom sm:grid-cols-7">
        {facts.map(([label, value]) => (
          <div key={label} className="bg-card px-3 py-3 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-tamarind-faint">{label}</p>
            <p className="mt-0.5 text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <h2 className="font-display text-2xl">Ingredients</h2>
          <p className="mt-1 text-sm text-tamarind-faint">Base quantities for {recipe.servings} servings. Cook Mode can scale them.</p>
          <ul className="mt-4 space-y-2.5">
            {recipe.ingredients.map((ingredient, index) => {
              const definition = ingredientDefs.get(ingredient.normalizedName);
              return (
                <li key={`${ingredient.normalizedName}-${index}`} className="flex items-baseline justify-between gap-3 border-b border-cardamom pb-2.5 text-sm">
                  <span>
                    <Link href={`/ingredients/${ingredient.normalizedName}`} className="font-medium hover:text-turmeric-deep">{ingredient.name}</Link>
                    {ingredient.optional && <span className="ml-1.5 text-xs text-tamarind-faint">(optional)</span>}
                    {(definition?.ta || definition?.hi) && <span className="block text-xs text-tamarind-faint">{[definition.ta, definition.hi].filter(Boolean).join(" · ")}</span>}
                    {ingredient.notes && <span className="block text-xs text-tamarind-faint">{ingredient.notes}</span>}
                  </span>
                  <span className="shrink-0 font-semibold">{formatQuantity(ingredient)}</span>
                </li>
              );
            })}
          </ul>

          {recipe.substitutions.length > 0 && (
            <div className="mt-6 rounded-card border border-cardamom bg-turmeric-tint/50 p-5">
              <h3 className="font-display text-lg">Substitutions</h3>
              <p className="mt-1 text-xs text-tamarind-faint">A swap can introduce allergens or change the dish. The pantry matcher counts it only when a recognised replacement is actually present.</p>
              <ul className="mt-3 space-y-3 text-sm">
                {recipe.substitutions.map((substitution, index) => (
                  <li key={`${substitution.ingredient}-${index}`} className="border-b border-turmeric/20 pb-2 last:border-0">
                    <span className="font-medium">{ingredientDefs.get(substitution.ingredient)?.name ?? publicLabel(substitution.ingredient)}</span>
                    <span className="text-tamarind-soft"> → {substitution.substitute}</span>
                    {substitution.notes && <span className="block text-xs text-tamarind-faint">{substitution.notes}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 space-y-5 text-sm">
            <InfoChips title="Cookware" values={recipe.cookware.map((item) => cookwareDefs.get(item)?.name ?? publicLabel(item))} />
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Methods</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {recipe.methods.map((method) => <Link key={method} href={`/methods/${method}`} className="rounded-full border border-cardamom bg-card px-3 py-1 text-xs hover:border-turmeric">{methodDefs.get(method)?.name ?? publicLabel(method)}</Link>)}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Allergen assessment</h3>
              {trust.allergen.contains.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">{trust.allergen.contains.map((allergen) => <span key={allergen} className="rounded-full bg-chilli-tint px-3 py-1 text-xs font-medium text-chilli">Contains {publicLabel(allergen)}</span>)}</div>
              ) : (
                <p className="mt-2 text-xs text-tamarind-soft">No listed allergens detected from canonical ingredients. This does not mean allergen-free; check product labels and cross-contact.</p>
              )}
              <p className="mt-2 text-xs text-tamarind-faint">{trust.allergen.basis}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Diet</h3>
              <div className="mt-2 flex flex-wrap gap-2">{recipe.dietType.map((diet) => <Link key={diet} href={`/diets/${diet}`} className="rounded-full border border-cardamom bg-card px-3 py-1 text-xs hover:border-turmeric">{publicLabel(diet)}</Link>)}</div>
              <p className="mt-2 text-xs text-tamarind-faint">Ingredient-derived primary diet: {publicLabel(trust.dietary.derivedPrimary)}.</p>
            </div>
          </div>

          {recipe.nutrition && (
            <div className="mt-6 rounded-card border border-cardamom bg-card p-5">
              <h3 className="font-display text-lg">Nutrition per serving</h3>
              {recipe.nutrition.isEstimate && <p className="mt-1 text-xs text-tamarind-faint">Estimated values—not lab-verified. Treat as a rough guide.</p>}
              <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                {([
                  ["Calories", recipe.nutrition.calories, ""], ["Protein", recipe.nutrition.protein, "g"],
                  ["Carbs", recipe.nutrition.carbs, "g"], ["Fat", recipe.nutrition.fat, "g"],
                  ["Fiber", recipe.nutrition.fiber, "g"], ["Sugar", recipe.nutrition.sugar, "g"],
                ] as [string, number | null, string][]).filter(([, value]) => value !== null).map(([label, value, unit]) => (
                  <div key={label}><dt className="text-xs text-tamarind-faint">{label}</dt><dd className="font-semibold">{value}{unit}</dd></div>
                ))}
              </dl>
            </div>
          )}
        </div>

        <div>
          <h2 className="font-display text-2xl">Method</h2>
          <ol className="mt-4 space-y-6">
            {recipe.steps.map((recipeStep) => (
              <li key={recipeStep.order} className="flex gap-4">
                <span aria-hidden className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-turmeric-tint text-base text-turmeric-deep">{recipeStep.order}</span>
                <div className="pt-1">
                  <p className="leading-relaxed">{recipeStep.text}</p>
                  {recipeStep.timerMinutes && <p className="mt-1 text-xs font-medium text-turmeric-deep">⏱ about {recipeStep.timerMinutes} min</p>}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 space-y-4">
            {recipe.indianKitchenAdaptation && <Note title="Indian kitchen adaptation" accent>{recipe.indianKitchenAdaptation}</Note>}
            {recipe.culturalNote && <Note title="Where this comes from">{recipe.culturalNote}</Note>}
            {recipe.regionalVariation && <Note title="Regional variations">{recipe.regionalVariation}</Note>}
          </div>

          <div className="mt-8">
            <RecipeTrustPanel trust={trust} source={recipe.source} author={recipe.author} />
            <p className="mt-3 text-xs text-tamarind-faint">
              {recipe.sourceUrl && <><a href={recipe.sourceUrl} rel="nofollow noopener" className="underline">View declared source</a>{" · "}</>}
              <Link href="/sources" className="underline hover:text-tamarind">Report an issue or suggest a correction</Link>.
            </p>
          </div>
        </div>
      </div>

      {crossCulture.length > 0 && <RecipeSection title="The same pantry, other worlds" intro="Dishes from other cuisines built on the same core ingredients." recipes={crossCulture} />}
      {related.length > 0 && <RecipeSection title="More like this" recipes={related} />}
    </article>
  );
}

function InfoChips({ title, values }: { title: string; values: string[] }) {
  return <div><h3 className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">{title}</h3><div className="mt-2 flex flex-wrap gap-2">{values.map((value) => <span key={value} className="rounded-full border border-cardamom bg-card px-3 py-1 text-xs">{value}</span>)}</div></div>;
}

function Note({ title, accent = false, children }: { title: string; accent?: boolean; children: string }) {
  return <div className={`rounded-card p-5 ${accent ? "border-l-4 border-turmeric bg-turmeric-tint/60" : "border border-cardamom bg-card"}`}><h3 className="font-display text-lg">{title}</h3><p className="mt-2 text-sm leading-relaxed text-tamarind-soft">{children}</p></div>;
}

function RecipeSection({ title, intro, recipes }: { title: string; intro?: string; recipes: ReturnType<typeof getRelatedRecipes> }) {
  return <section className="no-print mt-14"><h2 className="font-display text-2xl">{title}</h2>{intro && <p className="mt-1 text-sm text-tamarind-soft">{intro}</p>}<div className="mt-5"><RecipeGrid recipes={recipes} /></div></section>;
}

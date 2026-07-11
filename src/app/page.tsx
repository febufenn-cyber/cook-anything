import Link from "next/link";
import HeroSearch from "@/components/HeroSearch";
import RecipeCard from "@/components/RecipeCard";
import { getAllRecipes, getCuisines, getIngredients, getCollections } from "@/lib/data";
import { SITE_TAGLINE } from "@/lib/site";
import { titleFromSlug } from "@/lib/format";

const FEATURED_CUISINES = [
  "tamil", "kerala", "andhra", "north-indian", "pakistani", "sri-lankan",
  "korean", "chinese", "japanese", "thai", "italian", "mexican",
  "middle-eastern", "turkish", "french", "american", "west-african", "mediterranean",
];

const FEATURED_INGREDIENTS = [
  "chicken", "rice", "egg", "onion", "tomato", "curd", "potato", "paneer",
  "fish", "toor-dal", "brinjal", "mushroom", "wheat-flour", "coconut", "garlic",
];

export default function HomePage() {
  const recipes = getAllRecipes();
  const cuisines = getCuisines();
  const ingredients = getIngredients();
  const cuisineName = new Map(cuisines.map((c) => [c.slug, c.name]));
  const ingredientMap = new Map(ingredients.map((i) => [i.slug, i]));
  const countByCuisine = new Map<string, number>();
  for (const r of recipes) countByCuisine.set(r.cuisine, (countByCuisine.get(r.cuisine) ?? 0) + 1);

  const quick = recipes.filter((r) => r.totalTimeMinutes <= 30).slice(0, 3);
  const budget = recipes.filter((r) => r.budgetLevel === "budget" && r.totalTimeMinutes > 30).slice(0, 3);
  const festival = recipes.filter((r) => r.tags.includes("festival")).slice(0, 3);
  const adapted = recipes.filter((r) => r.indianKitchenAdaptation && r.country !== "india").slice(0, 3);
  const cuisineCount = new Set(recipes.map((r) => r.cuisine)).size;
  const countryCount = new Set(recipes.map((r) => r.country)).size;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-cardamom">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-turmeric-tint blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-turmeric-deep">
            The world&apos;s cooking knowledge engine
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-4xl leading-[1.1] sm:text-6xl">
            Tell us what you have.
            <br />
            <span className="text-turmeric-deep">Discover what the world cooks with it.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-tamarind-soft">
            Type the ingredients sitting in your kitchen. We&apos;ll show you what Tamil Nadu,
            Seoul, Istanbul and Oaxaca would make with them — with what&apos;s missing, what to
            substitute, and how to cook it on a kadai, tawa or pressure cooker.
          </p>
          <HeroSearch />
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-tamarind-faint">
            <span><strong className="font-semibold text-tamarind">{recipes.length}</strong> recipes</span>
            <span><strong className="font-semibold text-tamarind">{cuisineCount}</strong> cuisines</span>
            <span><strong className="font-semibold text-tamarind">{countryCount}</strong> countries</span>
            <span><strong className="font-semibold text-tamarind">{ingredients.length}</strong> ingredients understood</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-2xl sm:text-3xl">Cook from ingredients you already have</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              t: "Empty the shelf, not your wallet",
              d: "Add what's actually in your kitchen — vengayam or pyaz, thayir or dahi, we understand Tamil, Hindi and English names.",
            },
            {
              t: "See the whole world's answers",
              d: "The same five ingredients become kulambu in Madurai, karahi in Lahore, and a rice bowl in Seoul. Every match explains why it fits.",
            },
            {
              t: "Cook it your way",
              d: "Missing something? We show substitutions. No oven? Every global recipe carries an Indian-kitchen adaptation for kadai, tawa or cooker.",
            },
          ].map((s, i) => (
            <div key={i} className="rounded-card border border-cardamom bg-card p-6 shadow-lift">
              <div className="flex gap-1" aria-hidden>
                <span className="pantry-dot pantry-dot--have" />
                <span className={`pantry-dot ${i >= 1 ? "pantry-dot--have" : "pantry-dot--missing"}`} />
                <span className={`pantry-dot ${i >= 2 ? "pantry-dot--have" : "pantry-dot--missing"}`} />
              </div>
              <h3 className="font-display mt-3 text-lg">{s.t}</h3>
              <p className="mt-2 text-sm text-tamarind-soft">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cuisines */}
      <section className="border-y border-cardamom bg-rice-deep/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl sm:text-3xl">Explore recipes by culture</h2>
            <Link href="/cuisines" className="shrink-0 text-sm font-medium text-turmeric-deep hover:underline">
              All cuisines →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {FEATURED_CUISINES.map((slug) => (
              <Link
                key={slug}
                href={`/cuisines/${slug}`}
                className="group rounded-card border border-cardamom bg-card p-4 shadow-lift transition-transform hover:-translate-y-0.5"
              >
                <p className="font-display text-base leading-tight group-hover:text-turmeric-deep">
                  {cuisineName.get(slug) ?? titleFromSlug(slug)}
                </p>
                <p className="mt-1 text-xs text-tamarind-faint">
                  {countByCuisine.get(slug) ?? 0} recipes
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Indian kitchen adaptation */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl">Global recipes, adapted for Indian kitchens</h2>
            <p className="mt-4 text-tamarind-soft">
              Most world recipes assume an oven, a supermarket and a stick of butter. Ours don&apos;t.
              Every international dish carries a practical adaptation — grams and ml instead of
              ounces, kadai instead of dutch oven, cooker whistles instead of braising hours, and
              the names your grocery shop actually uses.
            </p>
            <Link
              href="/methods"
              className="mt-5 inline-block rounded-full border border-cardamom bg-card px-5 py-2.5 text-sm font-medium hover:border-turmeric"
            >
              Browse cooking methods →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {adapted.map((r) => <RecipeCard key={r.slug} recipe={r} />)}
          </div>
        </div>
      </section>

      {/* Quick + budget */}
      <section className="border-y border-cardamom bg-rice-deep/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl sm:text-3xl">Quick meals under 30 minutes</h2>
            <Link href="/quick-recipes" className="shrink-0 text-sm font-medium text-turmeric-deep hover:underline">
              All quick recipes →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {quick.map((r) => <RecipeCard key={r.slug} recipe={r} />)}
          </div>
          <div className="mt-10 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl sm:text-3xl">Budget meals that don&apos;t taste like it</h2>
            <Link href="/budget-recipes" className="shrink-0 text-sm font-medium text-turmeric-deep hover:underline">
              All budget recipes →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {budget.map((r) => <RecipeCard key={r.slug} recipe={r} />)}
          </div>
        </div>
      </section>

      {/* Ingredients */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl sm:text-3xl">Start from one ingredient</h2>
          <Link href="/ingredients" className="shrink-0 text-sm font-medium text-turmeric-deep hover:underline">
            All ingredients →
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-2.5">
          {FEATURED_INGREDIENTS.map((slug) => {
            const ing = ingredientMap.get(slug);
            return (
              <Link
                key={slug}
                href={`/ingredients/${slug}`}
                className="group rounded-full border border-cardamom bg-card px-4 py-2 text-sm shadow-lift hover:border-turmeric"
              >
                <span className="font-medium">{ing?.name.replace(/\s*\(.*\)\s*/g, "") ?? titleFromSlug(slug)}</span>
                {ing?.ta && <span className="ml-2 text-xs text-tamarind-faint">{ing.ta}</span>}
                {ing?.hi && ing.hi !== ing.ta && <span className="ml-1 text-xs text-tamarind-faint">· {ing.hi}</span>}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Festival + family cookbook */}
      <section className="border-y border-cardamom bg-rice-deep/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl sm:text-3xl">Festival and family food</h2>
            <Link href="/festival-recipes" className="shrink-0 text-sm font-medium text-turmeric-deep hover:underline">
              All festival recipes →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {festival.map((r) => <RecipeCard key={r.slug} recipe={r} />)}
          </div>
          <div className="mt-10 grid gap-6 rounded-card border border-cardamom bg-card p-8 shadow-lift sm:grid-cols-[1.5fr_1fr] sm:items-center">
            <div>
              <h3 className="font-display text-xl">Build your family cookbook</h3>
              <p className="mt-2 text-sm text-tamarind-soft">
                Save the recipes you cook, collect your grandmother&apos;s dishes, and submit your own —
                every community recipe keeps its contributor&apos;s name and story. Because the world&apos;s
                best recipes aren&apos;t on the internet yet; they&apos;re in kitchens like yours.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 sm:justify-end">
              <Link href="/family-cookbook" className="rounded-full border border-cardamom bg-rice px-5 py-2.5 text-sm font-medium hover:border-turmeric">
                My cookbook
              </Link>
              <Link href="/submit-recipe" className="rounded-full bg-turmeric px-5 py-2.5 text-sm font-semibold text-tamarind hover:bg-turmeric-deep hover:text-rice">
                Submit a recipe
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Knowledge engine */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display max-w-2xl text-2xl sm:text-3xl">
          Not a recipe blog. A cooking knowledge engine.
        </h2>
        <p className="mt-4 max-w-2xl text-tamarind-soft">
          Under every page here is structured data: normalized ingredients with Tamil, Hindi and
          English names, substitutions, allergens, cookware, methods, diets, regions and source
          licensing. That&apos;s what lets one search span the whole world&apos;s kitchens — and what
          nutrition tracking, meal planning and a cooking assistant will build on next.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5 text-sm">
          {[
            ["/diets", "Diet & health filters"],
            ["/methods", "Cooking methods"],
            ["/countries", "Countries"],
            ["/high-protein-recipes", "High protein"],
            ["/pressure-cooker-recipes", "Pressure cooker"],
            ["/kadai-recipes", "Kadai"],
            ["/sources", "Sources & licensing"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-full border border-cardamom bg-card px-4 py-2 font-medium hover:border-turmeric">
              {label}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

export const dynamic = "force-static";

export const metadata = {
  title: `Cook Anything — ${SITE_TAGLINE}`,
};

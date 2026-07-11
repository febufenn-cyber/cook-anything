import type { Recipe } from "./types";
import { SITE_URL, SITE_NAME } from "./site";
import { formatQuantity } from "./format";

/** Schema.org Recipe JSON-LD for SEO rich results. */
export function recipeJsonLd(recipe: Recipe): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    ...(recipe.nativeTitle ? { alternateName: recipe.nativeTitle } : {}),
    description: recipe.description,
    url: `${SITE_URL}/recipes/${recipe.slug}/`,
    author: { "@type": "Organization", name: recipe.author || SITE_NAME },
    datePublished: recipe.createdAt.slice(0, 10),
    dateModified: recipe.updatedAt.slice(0, 10),
    recipeCuisine: recipe.cuisine,
    recipeCategory: recipe.mealType.join(", "),
    keywords: [recipe.cuisine, recipe.country, ...recipe.tags].join(", "),
    prepTime: `PT${recipe.prepTimeMinutes}M`,
    cookTime: `PT${recipe.cookTimeMinutes}M`,
    totalTime: `PT${recipe.totalTimeMinutes}M`,
    recipeYield: `${recipe.servings} servings`,
    recipeIngredient: recipe.ingredients.map((i) =>
      `${formatQuantity(i)} ${i.name}${i.optional ? " (optional)" : ""}`.trim(),
    ),
    recipeInstructions: recipe.steps.map((s) => ({
      "@type": "HowToStep",
      position: s.order,
      text: s.text,
    })),
    suitableForDiet: dietSchemaOrg(recipe),
  };
  if (recipe.nutrition?.calories) {
    ld.nutrition = {
      "@type": "NutritionInformation",
      calories: `${recipe.nutrition.calories} calories`,
      ...(recipe.nutrition.protein ? { proteinContent: `${recipe.nutrition.protein} g` } : {}),
      ...(recipe.nutrition.carbs ? { carbohydrateContent: `${recipe.nutrition.carbs} g` } : {}),
      ...(recipe.nutrition.fat ? { fatContent: `${recipe.nutrition.fat} g` } : {}),
    };
  }
  return ld;
}

function dietSchemaOrg(recipe: Recipe): string[] {
  const out: string[] = [];
  if (recipe.dietType.includes("vegetarian")) out.push("https://schema.org/VegetarianDiet");
  if (recipe.dietType.includes("vegan")) out.push("https://schema.org/VeganDiet");
  if (recipe.dietType.includes("low_carb")) out.push("https://schema.org/LowCalorieDiet");
  return out;
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.url}`,
    })),
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search/?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

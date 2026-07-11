import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import {
  getAllRecipes, getCuisines, getCountries, getRegions, getIngredients,
  getMethods, getDiets, getCollections,
} from "@/lib/data";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages = [
    "", "/what-can-i-cook", "/search", "/recipes", "/cuisines", "/countries",
    "/ingredients", "/methods", "/diets", "/submit-recipe", "/family-cookbook",
    "/about", "/legal", "/privacy", "/sources",
  ].map((p) => ({ url: `${SITE_URL}${p}/`.replace(/\/\/$/, "/"), lastModified: now }));

  const recipes = getAllRecipes().map((r) => ({
    url: `${SITE_URL}/recipes/${r.slug}/`,
    lastModified: new Date(r.updatedAt),
    priority: 0.8,
  }));

  const taxo = [
    ...getCuisines().map((c) => `/cuisines/${c.slug}`),
    ...getCountries().map((c) => `/countries/${c.slug}`),
    ...getRegions().map((r) => `/regions/${r.slug}`),
    ...getIngredients().map((i) => `/ingredients/${i.slug}`),
    ...getMethods().map((m) => `/methods/${m.slug}`),
    ...getDiets().map((d) => `/diets/${d.slug}`),
    ...getCollections().map((c) => `/${c.slug}`),
  ].map((p) => ({ url: `${SITE_URL}${p}/`, lastModified: now, priority: 0.6 }));

  return [...staticPages, ...recipes, ...taxo];
}

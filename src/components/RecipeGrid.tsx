import type { Recipe } from "@/lib/types";
import RecipeCard from "./RecipeCard";

export default function RecipeGrid({ recipes, emptyNote }: { recipes: Recipe[]; emptyNote?: string }) {
  if (recipes.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-cardamom bg-card p-8 text-center text-sm text-tamarind-faint">
        {emptyNote ?? "No recipes here yet — the atlas is still growing. Try a related cuisine or ingredient."}
      </p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((r) => (
        <RecipeCard key={r.slug} recipe={r} />
      ))}
    </div>
  );
}

import Link from "next/link";
import type { Recipe } from "@/lib/types";
import { formatMinutes, DIFFICULTY_LABEL, SPICE_CHILLIES, VERIFICATION_LABEL } from "@/lib/format";
import { titleFromSlug } from "@/lib/format";

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="group flex flex-col rounded-card border border-cardamom bg-card p-5 shadow-lift transition-transform duration-150 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full bg-curry-tint px-2.5 py-0.5 text-xs font-semibold text-curry">
          {titleFromSlug(recipe.cuisine)}
        </span>
        <span aria-label={`Spice level: ${recipe.spiceLevel.replace("_", " ")}`} className="text-xs tracking-tight text-chilli">
          {"◆".repeat(SPICE_CHILLIES[recipe.spiceLevel])}
          <span className="text-cardamom">{"◆".repeat(4 - SPICE_CHILLIES[recipe.spiceLevel])}</span>
        </span>
      </div>
      <h3 className="font-display mt-3 text-lg leading-snug group-hover:text-turmeric-deep">
        {recipe.title}
      </h3>
      {recipe.nativeTitle && (
        <p className="mt-0.5 text-sm text-tamarind-faint">{recipe.nativeTitle}</p>
      )}
      <p className="mt-2 line-clamp-2 text-sm text-tamarind-soft">{recipe.description}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-xs text-tamarind-faint">
        <span>{formatMinutes(recipe.totalTimeMinutes)}</span>
        <span aria-hidden>·</span>
        <span>{DIFFICULTY_LABEL[recipe.difficulty]}</span>
        <span aria-hidden>·</span>
        <span>{recipe.servings} servings</span>
        <span className="ml-auto rounded bg-rice-deep px-1.5 py-0.5">
          {VERIFICATION_LABEL[recipe.verificationStatus].label}
        </span>
      </div>
    </Link>
  );
}

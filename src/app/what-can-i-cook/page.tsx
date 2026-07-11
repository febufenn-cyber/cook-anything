import type { Metadata } from "next";
import { Suspense } from "react";
import IngredientMatcher from "@/components/IngredientMatcher";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "What can I cook with these ingredients?",
  description:
    "Enter the ingredients in your kitchen — in English, Tamil or Hindi — and discover matching dishes from every cuisine, with missing items, substitutions and cook times.",
  alternates: { canonical: "/what-can-i-cook/" },
};

export default function WhatCanICookPage() {
  return (
    <>
      <PageHero
        eyebrow="Ingredient matcher"
        title="What can I cook?"
        intro="Add what's in your kitchen. Recipes from every culture line up by how much of them you already have — turmeric dots you have, hollow dots you're missing."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Suspense>
          <IngredientMatcher />
        </Suspense>
      </div>
    </>
  );
}

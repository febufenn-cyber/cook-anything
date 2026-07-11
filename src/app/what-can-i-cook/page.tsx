import type { Metadata } from "next";
import { Suspense } from "react";
import IngredientMatcher from "@/components/IngredientMatcher";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "What can I cook with these ingredients?",
  description:
    "Enter ingredients naturally in English, Tamil, Tanglish, Hindi or Hinglish. See explainable recipe matches, essential missing items, feasible substitutions and equipment constraints.",
  alternates: { canonical: "/what-can-i-cook/" },
};

export default function WhatCanICookPage() {
  return (
    <>
      <PageHero
        eyebrow="Your kitchen → a real dish"
        title="Tell us what you have"
        intro="Type it naturally. We weight the ingredients that define a dish, disclose every pantry assumption, and explain what is truly ready, close, substitutable or still needs shopping."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-tamarind-faint">Loading the pantry matcher…</p>}>
          <IngredientMatcher />
        </Suspense>
      </div>
    </>
  );
}

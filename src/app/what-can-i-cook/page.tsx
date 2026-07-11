import type { Metadata } from "next";
import { Suspense } from "react";
import KitchenMatcherBridge from "@/components/KitchenMatcherBridge";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "What can I cook with these ingredients?",
  description:
    "Reuse a local pantry or enter ingredients naturally in English, Tamil, Tanglish, Hindi or Hinglish. See explainable matches, missing items, substitutions and equipment constraints.",
  alternates: { canonical: "/what-can-i-cook/" },
};

export default function WhatCanICookPage() {
  return (
    <>
      <PageHero
        eyebrow="Your kitchen → a real dish"
        title="Tell us what you have"
        intro="Your saved pantry can be reused without an account. We still disclose every assumption and explain what is truly ready, close, substitutable or needs shopping."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-tamarind-faint">Loading your local kitchen…</p>}>
          <KitchenMatcherBridge />
        </Suspense>
      </div>
    </>
  );
}

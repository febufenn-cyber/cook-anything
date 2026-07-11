import type { Metadata } from "next";
import SubmitRecipeForm from "@/components/SubmitRecipeForm";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Submit a recipe",
  description:
    "Share your family's recipe with the world — in your own words, with your name and its story attached. Community recipes are published with clear provenance.",
  alternates: { canonical: "/submit-recipe/" },
};

export default function SubmitRecipePage() {
  return (
    <>
      <PageHero
        eyebrow="Community"
        title="The best recipes aren't online yet"
        intro="They're in your kitchen. Share one — written in your own words — and it joins the atlas with your name, your region and its story. Never paste text from books or websites."
      />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <SubmitRecipeForm />
      </div>
    </>
  );
}

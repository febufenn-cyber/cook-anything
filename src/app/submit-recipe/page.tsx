import type { Metadata } from "next";
import SubmitRecipeForm from "@/components/SubmitRecipeForm";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Create a local recipe draft",
  description:
    "Structure a family recipe in your own words and save or download the draft on this device. Uploading and publishing are not active yet.",
  alternates: { canonical: "/submit-recipe/" },
};

export default function SubmitRecipePage() {
  return (
    <>
      <PageHero
        eyebrow="Local draft"
        title="Write down the recipe before it disappears"
        intro="Create a structured draft in your own words. It stays on this device unless you download it. Nothing is uploaded, reviewed or published yet."
      />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <SubmitRecipeForm />
      </div>
    </>
  );
}

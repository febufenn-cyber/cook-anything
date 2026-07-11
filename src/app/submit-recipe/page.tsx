import type { Metadata } from "next";
import SubmitRecipeForm from "@/components/SubmitRecipeForm";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Write a family recipe",
  description:
    "Create a private, versioned family recipe draft. Optionally back it up, collaborate in a household or submit one immutable version for review.",
  alternates: { canonical: "/submit-recipe/" },
  robots: { index: false, follow: false },
};

export default function SubmitRecipePage() {
  return (
    <>
      <PageHero
        eyebrow="The Living Cookbook"
        title="Write down the recipe before it disappears"
        intro="Save privately first. Every edit creates a new version, and only an explicitly submitted version enters automated checks and human review. Saving or syncing never publishes it."
      />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <SubmitRecipeForm />
      </div>
    </>
  );
}

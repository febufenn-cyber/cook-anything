import type { Metadata } from "next";
import FamilyCookbook from "@/components/FamilyCookbook";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "My family cookbook",
  description: "Your saved recipes, organised into collections — weeknight dinners, festival dishes, grandmother's recipes.",
  alternates: { canonical: "/family-cookbook/" },
  robots: { index: false },
};

export default function FamilyCookbookPage() {
  return (
    <>
      <PageHero
        eyebrow="Yours"
        title="Family cookbook"
        intro="Recipes you've saved, grouped into your own collections. Stored privately on this device — accounts and family sharing are on the roadmap."
      />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <FamilyCookbook />
      </div>
    </>
  );
}

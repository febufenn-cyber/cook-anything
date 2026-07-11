import type { Metadata } from "next";
import LivingCookbookDashboard from "@/components/LivingCookbookDashboard";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "My family recipes",
  description: "Manage private family recipe drafts, immutable versions and editorial submissions without confusing them with published recipes.",
  alternates: { canonical: "/my-recipes/" },
  robots: { index: false, follow: false },
};

export default function MyRecipesPage() {
  return (
    <>
      <PageHero
        eyebrow="The Living Cookbook"
        title="Your family recipes, with their history intact"
        intro="Capture recipes privately, restore earlier versions, collaborate in a household and submit one exact version for review. Nothing becomes public merely because it was saved or uploaded."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <LivingCookbookDashboard />
      </div>
    </>
  );
}

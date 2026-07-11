import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import ReviewQueue from "@/components/ReviewQueue";

export const metadata: Metadata = {
  title: "Recipe review queue",
  description: "Role-protected editorial, safety, cook-test and publication-candidate review for immutable family recipe submissions.",
  alternates: { canonical: "/review/" },
  robots: { index: false, follow: false },
};

export default function ReviewPage() {
  return (
    <>
      <PageHero
        eyebrow="Trusted editorial workflow"
        title="Review immutable recipe versions"
        intro="Automated checks inform human decisions; they never replace them. Reviewer actions, cook tests and publication approval remain bound to the exact submitted content hash."
      />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <ReviewQueue />
      </div>
    </>
  );
}

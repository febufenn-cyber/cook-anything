import type { Metadata } from "next";
import KitchenDashboard from "@/components/KitchenDashboard";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "My Kitchen",
  description: "Manage a private local pantry, saved recipes, cooking history, shopping list, meal plan and browser-only data controls without creating an account.",
  alternates: { canonical: "/kitchen/" },
};

export default function KitchenPage() {
  return (
    <>
      <PageHero
        eyebrow="Local-first kitchen memory"
        title="Your kitchen, remembered"
        intro="Pantry, preferences, saved recipes, history, shopping and plans stay in this browser. Export them whenever you want; no account is required."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <KitchenDashboard />
      </div>
    </>
  );
}

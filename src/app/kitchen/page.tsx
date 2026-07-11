import type { Metadata } from "next";
import Link from "next/link";
import KitchenDashboard from "@/components/KitchenDashboard";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "My Kitchen",
  description: "Manage a private local pantry, saved recipes, cooking history, shopping list and meal plan; optionally sync them across devices.",
  alternates: { canonical: "/kitchen/" },
};

export default function KitchenPage() {
  return (
    <>
      <PageHero
        eyebrow="Local-first kitchen memory"
        title="Your kitchen, remembered"
        intro="Pantry, preferences, saved recipes, history, shopping and plans save to this browser first. An optional account can later back them up and synchronize other devices."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-cardamom bg-card p-4">
          <div><p className="font-semibold">Using more than one device?</p><p className="text-xs text-tamarind-faint">Preview local and cloud counts before anything is merged. Anonymous use remains fully supported.</p></div>
          <Link href="/account" className="rounded-full border border-turmeric bg-turmeric-tint px-4 py-2 text-sm font-semibold text-turmeric-deep">Account and sync</Link>
        </div>
        <KitchenDashboard />
      </div>
    </>
  );
}

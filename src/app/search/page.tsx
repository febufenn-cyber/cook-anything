import type { Metadata } from "next";
import { Suspense } from "react";
import SearchClient from "@/components/SearchClient";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Search recipes",
  description:
    "Search every recipe by name, ingredient, cuisine, country, method, diet, cookware, time, difficulty, spice level and budget.",
  alternates: { canonical: "/search/" },
};

export default function SearchPage() {
  return (
    <>
      <PageHero
        eyebrow="Search"
        title="Find any recipe"
        intro="Search by dish name, cuisine or ingredient — then narrow by diet, time, method, cookware, spice level, budget or allergens."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Suspense>
          <SearchClient />
        </Suspense>
      </div>
    </>
  );
}

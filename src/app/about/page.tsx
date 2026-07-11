import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "About",
  description:
    "Cook Anything is a global cooking knowledge engine: enter your ingredients, discover what the world cooks with them — adapted for real Indian kitchens.",
  alternates: { canonical: "/about/" },
};

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About" title="A cooking knowledge engine, not a recipe blog" />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 leading-relaxed text-tamarind-soft sm:px-6">
        <p>
          Cook Anything starts from a simple observation: almost everyone decides what to cook by
          looking at what they already have. Yet almost every recipe site starts from the dish, not
          the kitchen. We flipped it. You tell us your ingredients — chicken, curd, onion, tomato,
          rice — and we show you what Tamil Nadu, Lahore, Istanbul, Seoul and Oaxaca would do with
          exactly those things.
        </p>
        <p>
          Underneath is structured data, not blog posts: every ingredient is normalized across
          English, Tamil and Hindi names; every recipe carries substitutions, allergens, cookware,
          methods, diet tags, times, spice levels, budget levels, cultural notes and — for every
          international dish — a practical adaptation for Indian home kitchens: kadai instead of
          dutch oven, cooker whistles instead of braising hours, grams and millilitres instead of
          ounces.
        </p>
        <p>
          We are equally serious about provenance. Every recipe records its source, license and a
          verification status — from <em>AI-drafted</em> originals awaiting editorial review to
          <em> community-submitted</em> family recipes with their contributor&apos;s name and story.
          We never scrape or republish other people&apos;s recipe content, and we say plainly when
          nutrition values are estimates. Read more on our{" "}
          <Link href="/sources" className="font-medium text-turmeric-deep underline">sources page</Link>.
        </p>
        <p>
          Today the engine holds hundreds of structured recipes across dozens of cuisines. It is
          built to hold a million — from every culture, region, method, diet and kitchen style —
          growing through editorial work, open-license imports, licensed partners, and most
          importantly, home cooks{" "}
          <Link href="/submit-recipe" className="font-medium text-turmeric-deep underline">
            sharing the recipes only their families know
          </Link>
          .
        </p>
      </div>
    </>
  );
}

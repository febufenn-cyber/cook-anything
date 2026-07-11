import type { Metadata } from "next";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Cook Anything stores (very little) and where (mostly on your own device).",
  alternates: { canonical: "/privacy/" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Trust" title="Privacy" />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 leading-relaxed text-tamarind-soft sm:px-6">
        <p>
          Cook Anything currently runs without accounts and without trackers. The ingredient
          searches you type are processed in your browser against a downloaded recipe index — they
          are not sent to a server. Your saved recipes, cookbook collections and submitted recipe
          drafts are stored in your browser&apos;s local storage, on your device; clearing your
          browser data removes them.
        </p>
        <p>
          Our hosting provider (Cloudflare) records standard, short-lived server logs — IP address,
          user agent, requested URL — to serve the site and prevent abuse, as any website host does.
        </p>
        <p>
          When accounts, community publishing and sync arrive, this policy will be updated before
          any personal data is collected, and features that store data off-device will say so at
          the point of use.
        </p>
      </div>
    </>
  );
}

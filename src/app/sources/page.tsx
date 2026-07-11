import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { getAllRecipes } from "@/lib/data";
import { VERIFICATION_LABEL } from "@/lib/format";
import type { VerificationStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Sources & licensing",
  description:
    "How every Cook Anything recipe tracks its source, license and verification status — and our commitment against unauthorized republishing.",
  alternates: { canonical: "/sources/" },
};

export default function SourcesPage() {
  const recipes = getAllRecipes();
  const byStatus = new Map<VerificationStatus, number>();
  for (const r of recipes) byStatus.set(r.verificationStatus, (byStatus.get(r.verificationStatus) ?? 0) + 1);
  const byLicense = new Map<string, number>();
  for (const r of recipes) byLicense.set(r.license, (byLicense.get(r.license) ?? 0) + 1);

  return (
    <>
      <PageHero
        eyebrow="Trust"
        title="Sources & licensing"
        intro="Every recipe in the engine carries three provenance fields: source, license and verification status. This page is the live tally."
      />
      <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 leading-relaxed text-tamarind-soft sm:px-6">
        <section>
          <h2 className="font-display text-xl text-tamarind">Current database</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[...byStatus.entries()].map(([status, count]) => (
              <div key={status} className="rounded-card border border-cardamom bg-card p-4">
                <p className="text-sm font-semibold text-tamarind">
                  {VERIFICATION_LABEL[status].label} — {count} recipes
                </p>
                <p className="mt-1 text-xs">{VERIFICATION_LABEL[status].note}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm">
            Licenses in use:{" "}
            {[...byLicense.entries()].map(([l, c]) => `${l} (${c})`).join(", ")}. Total:{" "}
            {recipes.length} recipes.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl text-tamarind">How source tracking works</h2>
          <p className="mt-3">
            The recipe schema requires <code className="rounded bg-rice-deep px-1">source</code>,{" "}
            <code className="rounded bg-rice-deep px-1">sourceUrl</code>,{" "}
            <code className="rounded bg-rice-deep px-1">license</code>,{" "}
            <code className="rounded bg-rice-deep px-1">author</code> and{" "}
            <code className="rounded bg-rice-deep px-1">verificationStatus</code> on every record —
            our validation pipeline rejects recipes without them, and a license checker flags
            unknown licenses, missing sources and republishing risks before anything is published.
            Attribution is displayed on each recipe page.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl text-tamarind">What we will and won&apos;t import</h2>
          <p className="mt-3">
            As the database grows toward hundreds of thousands of recipes, imports will come from
            public-domain cookbooks, openly licensed collections (with license and attribution
            preserved per recipe), licensed partners, and community contributions. We do not
            republish copyrighted recipe sites. For recipes we can&apos;t republish, the platform
            supports saving an external link with metadata only — never the protected text.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl text-tamarind">Report an issue</h2>
          <p className="mt-3">
            Every recipe page links here. If a recipe misstates its source, misuses a license, or
            reproduces your content, contact us and we will review promptly. See also{" "}
            <Link href="/legal" className="font-medium text-turmeric-deep underline">legal &amp; content policy</Link>.
          </p>
        </section>
      </div>
    </>
  );
}

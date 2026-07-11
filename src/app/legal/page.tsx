import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { VERIFICATION_LABEL } from "@/lib/format";

export const metadata: Metadata = {
  title: "Legal & content policy",
  description:
    "How Cook Anything handles recipe content: sources, licenses, verification statuses, user submissions and rights issues.",
  alternates: { canonical: "/legal/" },
};

export default function LegalPage() {
  return (
    <>
      <PageHero eyebrow="Trust" title="Legal & content policy" />
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 leading-relaxed text-tamarind-soft sm:px-6">
        <section>
          <h2 className="font-display text-xl text-tamarind">Where our recipes come from</h2>
          <p className="mt-3">
            Recipes on Cook Anything are one of the following: original editorial work, AI-drafted
            original structured drafts, community submissions written by their contributors,
            public-domain material, openly licensed material with attribution, or content provided
            by licensed partners. We do not scrape or republish copyrighted recipe websites, blog
            text, photographs, videos or personal stories. Ingredient lists and general cooking
            techniques are facts and not owned by anyone, but written expression is — so every
            description and instruction here is written in our own or our contributors&apos; words.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl text-tamarind">Verification statuses</h2>
          <p className="mt-3">
            Every recipe carries a status so you always know how much to trust it. In plain terms:
          </p>
          <dl className="mt-4 space-y-3">
            {Object.entries(VERIFICATION_LABEL).map(([k, v]) => (
              <div key={k} className="rounded-card border border-cardamom bg-card p-4">
                <dt className="text-sm font-semibold text-tamarind">{v.label}</dt>
                <dd className="mt-1 text-sm">{v.note}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h2 className="font-display text-xl text-tamarind">Submitting recipes</h2>
          <p className="mt-3">
            When you submit a recipe you confirm it is your own or a traditional recipe you have
            the right to share, written in your own words. Do not submit text copied from books,
            websites, apps or paid content — submissions that appear copied will be removed.
            Community recipes are published under the <em>community submitted</em> status with your
            chosen contributor name.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl text-tamarind">Nutrition and health</h2>
          <p className="mt-3">
            Nutrition values are estimates unless a recipe is explicitly marked verified. Diet
            labels ending in &ldquo;(est.)&rdquo; — like diabetic-friendly — are heuristic
            placeholders, not medical advice. Always consult a professional for medical diets and
            allergies; allergen tags are best-effort and cross-contamination in your kitchen is
            beyond our knowledge.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl text-tamarind">Rights issues</h2>
          <p className="mt-3">
            If you believe content on Cook Anything infringes your rights, tell us and we will
            review and remove it promptly if warranted. See{" "}
            <Link href="/sources" className="font-medium text-turmeric-deep underline">
              sources &amp; licensing
            </Link>{" "}
            for how provenance is tracked per recipe.
          </p>
        </section>
      </div>
    </>
  );
}

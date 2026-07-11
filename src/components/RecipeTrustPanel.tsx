import type { RecipeTrustRecord } from "@/lib/trust/types";
import { titleFromSlug } from "@/lib/format";

function statusLabel(record: RecipeTrustRecord): string {
  if (record.verification.cookTestStatus === "cook_tested") return "Cook-tested";
  if (record.verification.editorialStatus === "reviewed") return "Editorially reviewed";
  if (record.provenance.sourceType === "ai_assisted_original") return "AI-assisted draft";
  if (record.verification.editorialStatus === "needs_review") return "Needs editorial review";
  return "Structurally validated draft";
}

export default function RecipeTrustPanel({
  trust,
  source,
  author,
}: {
  trust: RecipeTrustRecord;
  source: string;
  author: string;
}) {
  const allergenText = trust.allergen.contains.length
    ? trust.allergen.contains.map(titleFromSlug).join(", ")
    : "No listed allergens detected from canonical ingredients";

  return (
    <section className="rounded-card border border-cardamom bg-card p-5" aria-labelledby="recipe-trust-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Recipe trust record</p>
          <h2 id="recipe-trust-heading" className="font-display mt-1 text-xl">{statusLabel(trust)}</h2>
        </div>
        <span className="rounded-full bg-turmeric-tint px-3 py-1 text-xs font-semibold text-turmeric-deep">
          Not a safety guarantee
        </span>
      </div>

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-tamarind">Cook testing</dt>
          <dd className="mt-1 text-tamarind-soft">
            {trust.verification.cookTestStatus === "cook_tested"
              ? "Cook-tested for this exact recipe version."
              : "Not yet cook-tested. Quantities, timing and technique may still need correction."}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-tamarind">Editorial status</dt>
          <dd className="mt-1 text-tamarind-soft">{trust.verification.claim}</dd>
        </div>
        <div>
          <dt className="font-semibold text-tamarind">Allergen assessment</dt>
          <dd className="mt-1 text-tamarind-soft">
            <span className="font-medium">{allergenText}.</span>{" "}
            {trust.allergen.basis}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-tamarind">Source and licence</dt>
          <dd className="mt-1 text-tamarind-soft">
            {trust.provenance.sourceLabel}. Declared licence: {trust.provenance.licenseId}.
            {trust.provenance.licenseStatus === "declared" && " The declaration has not been independently re-verified at build time."}
          </dd>
        </div>
      </dl>

      {trust.safety.warnings.length > 0 && (
        <div className="mt-5 rounded-card bg-chilli-tint/60 p-4 text-sm">
          <h3 className="font-semibold text-chilli">Safety checks for this recipe</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-tamarind-soft">
            {[...trust.safety.warnings, ...trust.safety.criticalChecks].map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 border-t border-cardamom pt-3 text-xs text-tamarind-faint">
        <p>Source label: {source} · Contributor: {author}</p>
        <p className="mt-1">Recipe version: {trust.recipeVersion.slice(0, 12)}… · Trust policy schema {trust.schemaVersion}</p>
        <p className="mt-1">Always check product labels and adapt food-safety guidance for allergies, pregnancy, age and medical risk.</p>
      </div>
    </section>
  );
}

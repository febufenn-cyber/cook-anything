# Phase 2 — recipe trust, privacy and publication boundaries

> **Code boundary only.** Phase 2 does not enable the hosted companion, deploy the
> VPS bridge, create accounts, upload recipe drafts or publish community content.
> `HOSTED_COMPANION_ENABLED` remains `false`.

## Goal

Every public trust claim must be backed by structured evidence, derived
conservatively, visible where the user makes a decision and enforced by the build.
A polished page must never silently imply that an untested recipe, incomplete
allergen assessment or unverified licence is safer or more authoritative than the
available evidence.

## Core invariants

1. Empty allergen metadata never renders as “allergen-free.”
2. Canonical ingredient allergens are unioned with recipe-declared allergens.
3. Missing canonical ingredient metadata blocks publication.
4. Dietary claims conflicting with canonical ingredients block publication.
5. A valid JSON schema is not cook-test or editorial evidence.
6. Legacy `verified` cannot publish without separate version-bound evidence.
7. Imported/open-licence/partner content requires a declared source URL.
8. Licences outside the allowlist block full-text publication.
9. Duplicate slugs and exact recipe duplicates fail the build.
10. Rejected imports live outside `data/recipes` and cannot be production-loaded.
11. Companion prompts cannot claim more trust than the recipe trust record.
12. BYOK keys are session-only unless persistence is explicitly selected.
13. A custom provider hostname is shown and confirmed before receiving a key.
14. Hosted data flow is disclosed before first hosted use.
15. Browser-only drafts are labelled saved locally, never submitted or received.

## Trust record

`src/lib/trust/types.ts` defines one `RecipeTrustRecord` per recipe:

- `recipeVersion`: SHA-256 of the complete recipe record
- `allergen`: status, contains, possible cross-contact notes and basis
- `dietary`: claimed labels, ingredient-derived primary classification and conflicts
- `provenance`: source type, declared licence, attribution and evidence limitations
- `verification`: structural, editorial and cook-test status bound to the version
- `safety`: detected hazards, warnings and critical checks
- `publication`: hard blockers and non-blocking review warnings

`public/trust-manifest.json` is generated at build time for public-safe inspection.
Trust UI uses the same policy directly during static generation.

## Conservative migration

The existing corpus is not bulk-labelled reviewed or cook-tested. Automated trust
records use these conservative defaults:

- current AI drafts: structurally validated, unreviewed, not cook-tested
- declared recipe licences: `declared`, not independently re-verified
- allergens: derived from canonical metadata plus recipe declarations
- cross-contact: always requires checking exact packaged-product labels
- safety: rule-derived warnings for animal products, frying, pressure cooking and
  fermentation

Unknown information remains unknown or blocks publication. Missing evidence is
never invented to make CI green.

## Mandatory build order

`npm run build` runs:

```text
trust:gate
  ├─ recipe schema and referential validation
  ├─ declared licence checks
  ├─ production/quarantine boundary check
  ├─ exact duplicate detection
  └─ provenance, allergen, dietary and verification policy

then
  ├─ search index
  ├─ public trust manifest
  ├─ trusted companion recipe snapshots
  └─ Next.js static export
```

Fuzzy duplicate detection remains a review tool rather than a hard gate because
regional or cultural variants can legitimately overlap.

## Import quarantine

The production loader reads only direct JSON files under `data/recipes/`.
Failed imports are moved to:

```text
quarantine/rejected-imports/
```

Each rejected batch receives a machine-readable report containing its source,
time, reason, count and former production path. Quarantine is never nested under
the production recipe directory.

## Allergen and dietary boundary

The automated policy can detect declared and canonical ingredient allergens. It
cannot prove:

- manufacturing cross-contact
- restaurant or home-kitchen contamination
- exact formulation of a branded sauce or spice blend
- a user’s individual reaction threshold
- medical suitability

The UI therefore says “no listed allergens detected” rather than “allergen-free.”
Substitutions always carry a warning because a replacement can introduce an
allergen or alter vegan, vegetarian, gluten or dairy suitability.

## Safety boundary

The policy detects broad recipe hazards and produces conservative reminders:

- raw poultry, meat and seafood
- eggs
- cross-contamination
- deep or shallow frying
- pressure cooking
- fermentation

These checks are not a complete food-safety certification. Recipe authors still
need editorial and cook-test review, and users must follow current local guidance,
appliance instructions and medical advice where applicable.

## Verification boundary

The old single `verificationStatus` remains source metadata during migration, but
it is no longer sufficient for a public verified claim.

Public trust separates:

- structural validation
- editorial review
- cook testing
- provenance review

Evidence is bound to a recipe content hash. A material recipe change therefore
produces a new version and cannot silently inherit old evidence.

No current legacy `verified` recipe is allowed through the Phase 2 publication
gate until a separate version-bound evidence record is introduced.

## Companion boundary

Trusted companion snapshots contain a bounded trust context:

- allergen assessment status and known allergens
- cross-contact notes
- safety warnings and critical checks
- cook-test status
- provenance summary
- substitution warning

Worker runtime validation rejects unknown trust fields, unsupported allergens,
oversized strings and invalid statuses. The system prompt treats the trust object
as an upper bound and prohibits stronger safety, authenticity, medical or
verification claims.

Hosted mode remains text-only and disabled. BYOK photo analysis cannot prove
internal doneness, oil temperature, weight or allergen safety.

## BYOK privacy boundary

- The key is held in module memory by default.
- The former always-persistent storage key is deleted during migration.
- Persistent storage occurs only after the user selects “Remember key on this
  device.”
- The UI explains that the raw remembered key is accessible to code running on
  the site.
- OpenAI-compatible endpoints require HTTPS except loopback development URLs.
- Embedded credentials, query strings, fragments and unsafe schemes are rejected.
- Custom hosts require explicit confirmation and display the exact hostname that
  will receive the key and companion content.

The Content Security Policy permits HTTPS provider connections and local loopback
BYOK development while blocking framing, plugins and non-declared resource types.

## Hosted disclosure and retention

Before first hosted use, the UI explains:

- messages, selected recipe, recent context and temporary state may pass through
  Cloudflare and the configured provider/private bridge
- hosted mode accepts no photos
- inactive sessions are configured to expire after approximately two hours
- closing the companion requests earlier deletion

The disclosure is versioned. Material processing changes require a new version.

## Local recipe drafts

`/submit-recipe/` is currently a browser-only drafting tool. It now states:

- nothing is uploaded
- nothing is submitted
- nobody has reviewed it
- it is not published
- clearing browser data can remove it

The saved object includes `submissionStatus: "local_only_not_submitted"`.

## Tests

`npm run test:trust` covers:

- undeclared taxonomy allergens still appearing publicly
- vegan/vegetarian conflicts blocking publication
- missing ingredient taxonomy blocking publication
- blocked licences
- imported content without source evidence
- fake legacy verification
- safety hazards for animal products and hot oil
- malicious, credential-bearing or insecure BYOK endpoints
- explicit custom-host confirmation
- session-only BYOK default

Phase 1 security tests additionally validate trust-context shape and prompt-boundary
escaping.

## Staging and release checklist

Before merging:

- [ ] `npm run test:companion` passes
- [ ] `npm run test:trust` passes
- [ ] `npm run trust:gate` passes on the full corpus
- [ ] `npm run build` passes and generates both manifests
- [ ] Wrangler dry-run bundles successfully
- [ ] recipe pages clearly show non-cook-tested and allergen uncertainty
- [ ] remembered BYOK key requires explicit opt-in
- [ ] custom endpoint disclosure names the correct host
- [ ] local draft wording never implies upload or review
- [ ] CSP does not break Next.js static assets or approved BYOK providers
- [ ] hosted companion remains disabled

Before any future hosted production enablement, the complete Phase 1 VPS, tunnel,
process-termination, logging and canary exit gate still applies.

## Deferred work

Phase 2 does not include:

- human cook-test evidence storage and moderation UI
- accounts or Supabase sync
- real recipe upload/submission
- contributor identities or reputation
- cloud moderation queues
- legally verified automated retrieval of external licence pages
- branded-product allergen databases
- medical or nutrition certification

Those features must build on—not bypass—the trust record and publication gate.

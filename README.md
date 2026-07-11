# Cook Anything

**Tell us what you have. Discover what the world cooks with it.**

A global cooking knowledge engine: enter the ingredients in your kitchen (in
English, Tamil or Hindi) and see what every food culture would cook with them —
with missing-ingredient analysis, substitutions, and Indian-kitchen adaptations
for every international dish.

## Stack

- Next.js (App Router, static export) + TypeScript + Tailwind v4
- Local JSON data layer (`data/`) with a Postgres-compatible mirror (`db/schema.sql`)
- Client-side matching/search over a compiled index (`public/search-index.json`)
- Build-generated public recipe trust manifest (`public/trust-manifest.json`)
- Cloudflare Worker serving static assets and the hosted companion session API
- Durable Objects owning hosted cooking sessions and global execution capacity
- Browser BYOK companion: calls go directly from the browser to the selected
  Claude or OpenAI-compatible provider

## Trust status

Hosted execution remains **disabled by default**. `wrangler.jsonc` sets
`HOSTED_COMPANION_ENABLED` to `"false"`, and the Worker fails closed unless the
value is exactly `"true"`.

Phase 1 rebuilt the hosted execution boundary. Phase 2 adds a mandatory content
and privacy trust layer:

- every recipe receives a version-bound trust record
- allergen output is the safer union of recipe declarations and canonical
  ingredient metadata
- an empty allergen list never means “allergen-free”
- dietary claims are checked against canonical ingredient categories
- unpublishable licences, missing imported-source evidence, exact duplicates,
  duplicate slugs and quarantine leakage fail the build
- legacy `verified` cannot publish without separate version-bound evidence
- cooking hazards generate conservative safety warnings and critical checks
- companion snapshots carry the same trust ceiling as recipe pages
- BYOK keys are session-only unless the user explicitly selects “Remember key”
- custom model endpoints disclose the exact hostname receiving the key
- hosted processing disclosure appears before the first hosted session
- rejected imports live under `quarantine/`, outside the production data tree
- the local recipe-draft tool no longer claims a recipe was submitted or received

The current corpus is not silently relabelled as human-reviewed. Most recipes are
shown honestly as structurally validated, not cook-tested drafts.

Browser BYOK, recipe search, ingredient matching and normal Cook Mode remain
available while hosted execution is off. Do not enable hosted mode until every
exit condition in `docs/PHASE-1-COMPANION.md` passes in staging. Phase 2’s trust
model and limitations are in `docs/PHASE-2-TRUST.md`.

## Commands

```bash
npm install
npm run dev              # local dev at localhost:3000
npm run build            # mandatory trust gate + indexes/manifests + static export
npm run preview          # build + wrangler dev
npm run deploy           # build + wrangler deploy
npm run test:companion   # session, prompt, capacity and runtime-schema tests
npm run test:trust       # adversarial provenance/allergen/BYOK trust tests
npm run trust:gate       # production publication gate

# Data pipeline
npm run validate         # schema + referential validation
npm run licenses         # declared licence gate
npm run dupes:exact      # hard exact-duplicate gate
npm run dupes            # fuzzy duplicate candidates for human review
npm run normalize        # free-text -> canonical ingredient slugs
npm run slugs            # slug/id generation & repair
npm run search-index     # rebuild client index
npm run trust-manifest   # rebuild public trust records
npm run companion-recipes # rebuild trusted hosted-companion snapshots
npm run import-recipes -- --file <path>   # safe intake; failures go to quarantine/
npm run export-recipes   # full DB export (Supabase migration input)
npm run seed             # coverage report / what to generate next
```

## Layout

```text
data/taxonomy/    canonical multilingual ingredient and platform metadata
data/recipes/     production-authorized recipe JSON only
quarantine/       rejected imports and review candidates; never production-loaded
src/lib/trust/    provenance, allergen, dietary, safety and evidence policy
src/lib/          platform types, matching, data loading, companion prompt/client
src/app/          routes, recipe pages, trust pages and companion UI
worker/           public API, validation, execution, headers and Durable Objects
bridge/           hardened optional Claude Code bridge and shutdown controls
scripts/          validation, trust gates, manifests, imports and adversarial tests
docs/             recipe spec, scaling, AI assistant and Phase 0/1/2 runbooks
db/schema.sql     Postgres/Supabase upgrade path
```

## Content rules

A valid JSON shape is not proof that a recipe works. Each recipe’s public trust
record separately reports structural validation, editorial status, cook testing,
allergen assessment, provenance declaration and safety context. Automated licence
and allergen checks reduce silent errors but do not independently verify external
web pages, packaged-product labels, cultural authenticity or medical suitability.

No scraped or republished copyrighted recipe text should enter production. See
`/legal`, `/sources`, `/privacy`, `docs/RECIPE-SPEC.md` and
`docs/PHASE-2-TRUST.md`.

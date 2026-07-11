# Cook Anything

**Tell us what you have. Discover what the world cooks with it.**

A global cooking knowledge engine: describe the ingredients in your kitchen in
English, Tamil/Tanglish or Hindi/Hinglish and receive explainable, safety-filtered
recipe matches with honest missing items, feasible substitutions and interruption-safe
Cook Mode.

## Stack

- Next.js (App Router, static export) + TypeScript + Tailwind v4
- Local JSON data layer (`data/`) with a Postgres-compatible mirror (`db/schema.sql`)
- Versioned client-side matching index (`public/search-index.json`)
- Build-generated public recipe trust manifest (`public/trust-manifest.json`)
- Cloudflare Worker serving static assets and the disabled-by-default hosted companion API
- Durable Objects owning optional hosted cooking sessions and execution capacity
- Browser BYOK companion calling the selected provider directly

## Current boundaries

Hosted execution remains **disabled by default**. `wrangler.jsonc` sets
`HOSTED_COMPANION_ENABLED` to `"false"`, and the Worker fails closed unless the value
is exactly `"true"`.

Phase 1 rebuilt the hosted execution boundary. Phase 2 added the mandatory recipe,
privacy and publication trust layer. Phase 3 strengthens the anonymous local-first
product loop:

- identity and structural ingredients carry more ranking weight than seasonings
- textual substitutions count only when the replacement is actually in the kitchen
- pantry assumptions are explicit, user-controlled and disclosed per result
- allergen, ingredient, diet and special-equipment constraints are hard filters
- natural English/Tamil/Hindi input is parsed without silent guessing
- typo candidates and ambiguous ingredients require user confirmation
- results explain essential missing items, available swaps and equipment blockers
- repetitive dish families are diversified on the first screen
- one-extra-ingredient suggestions show what would unlock more viable dishes
- Cook Mode locally persists progress, servings and drift-free timestamp timers
- active sessions are bound to a recipe version so instructions cannot silently change

The current corpus is not silently relabelled as human-reviewed. Most recipes remain
honestly described as structurally validated, not cook-tested drafts.

Browser BYOK, recipe search, ingredient matching and normal Cook Mode remain available
while hosted execution is off. Do not enable hosted mode until every Phase 1 staging
exit condition passes. See:

- `docs/PHASE-1-COMPANION.md`
- `docs/PHASE-2-TRUST.md`
- `docs/PHASE-3-PRODUCT.md`

## Commands

```bash
npm install
npm run dev              # local dev at localhost:3000
npm run build            # trust gate + indexes/manifests + static export
npm run preview          # build + wrangler dev
npm run deploy           # build + wrangler deploy
npm run test:companion   # hosted-session and execution-boundary regressions
npm run test:trust       # provenance, allergen, BYOK and header regressions
npm run test:product     # matcher, parser, pantry, Cook Mode and timer regressions
npm run trust:gate       # production publication gate

# Data pipeline
npm run validate         # schema + referential validation
npm run licenses         # declared licence gate
npm run dupes:exact      # hard exact-duplicate gate
npm run dupes            # fuzzy duplicate candidates for human review
npm run normalize        # free text -> canonical ingredient slugs
npm run slugs            # slug/id generation and repair
npm run search-index     # weighted versioned client index
npm run trust-manifest   # public trust records
npm run companion-recipes # trusted hosted-companion snapshots
npm run import-recipes -- --file <path>   # safe intake; failures go to quarantine/
npm run export-recipes   # full DB export (Supabase migration input)
npm run seed             # corpus coverage report
```

## Layout

```text
data/taxonomy/          canonical multilingual ingredient/platform metadata
data/recipes/           production-authorized recipe JSON only
quarantine/             rejected imports and review candidates
src/lib/match.ts        weighted deterministic matcher and natural input parser
src/lib/cook-session.ts persistent version-bound Cook Mode state and scaling
src/lib/trust/          provenance, allergen, dietary, safety and evidence policy
src/components/         matcher, Cook Mode, companion and trust UI
worker/                 public API, validation, headers and Durable Objects
bridge/                 optional hardened Claude Code bridge and shutdown controls
scripts/                publication gates, generated indexes and regression suites
docs/                   recipe spec and Phase 0/1/2/3 runbooks
db/schema.sql           Postgres/Supabase upgrade path
```

## Content rules

A valid JSON shape is not proof that a recipe works. Each public trust record separately
reports structural validation, editorial status, cook testing, allergen assessment,
provenance declaration and safety context. Automated checks reduce silent errors but do
not independently verify external pages, packaged labels, cultural authenticity or
medical suitability.

No scraped or republished copyrighted recipe text should enter production. See
`/legal`, `/sources`, `/privacy`, `docs/RECIPE-SPEC.md` and the phase runbooks.

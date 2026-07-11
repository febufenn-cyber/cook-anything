# Cook Anything

**Tell us what you have. Discover what the world cooks with it.**

A global cooking knowledge engine: describe the ingredients in your kitchen in
English, Tamil/Tanglish or Hindi/Hinglish and receive explainable, safety-filtered
recipe matches with honest missing items, feasible substitutions, interruption-safe
Cook Mode, a private portable kitchen and a versioned family-recipe cookbook.

## Stack

- Next.js (App Router, static export) + TypeScript + Tailwind v4
- Local JSON data layer (`data/`) with a Postgres-compatible mirror (`db/schema.sql`)
- Versioned client-side matching index (`public/search-index.json`)
- Build-generated public recipe trust manifest (`public/trust-manifest.json`)
- Native IndexedDB local-kitchen, sync and family-recipe repositories
- Optional Supabase Auth + Postgres RPC synchronization with no mandatory account
- Role-protected contribution, review and cook-test workflow
- Quarantine-first trusted GitHub publication-candidate operator
- Installable offline web app with an explicit private-cache boundary
- Cloudflare Worker serving static assets and the disabled-by-default hosted companion API
- Durable Objects owning optional hosted cooking sessions and execution capacity
- Browser BYOK companion calling the selected provider directly

## Current boundaries

Hosted execution remains **disabled by default**. `wrangler.jsonc` sets
`HOSTED_COMPANION_ENABLED` to `"false"`, and the Worker fails closed unless the value
is exactly `"true"`.

Phase 1 rebuilt the hosted execution boundary. Phase 2 added the mandatory recipe,
privacy and publication trust layer. Phase 3 strengthened matching and Cook Mode.
Phase 4 added persistent browser-local kitchen memory. Phase 5 added optional portable
kitchen sync. Phase 6 adds the Living Cookbook:

- anonymous local family-recipe drafting still works without an account
- each material edit creates an immutable content version and SHA-256 hash
- local draft IDs and cloud UUIDs remain separate and explicitly linked
- personal and household cloud drafts stay private
- saving or syncing never implies submission or publication
- submission freezes one exact version and rights/AI-assistance declaration
- automated findings cannot approve a recipe
- editorial, safety, cook-test and publisher roles are server-authorized
- contributors cannot review, test or approve their own submission
- cook tests are bound to the submitted version and content hash
- publication candidates require two independent passed tests and no unresolved error
- browsers cannot directly access contribution tables or claim GitHub candidates
- the trusted operator writes only to `quarantine/publication-candidates/`
- publication candidate PRs are draft and have no merge or deploy operation
- final public recipes still require `data/recipes/`, human GitHub review and the complete trust gate

Cloud portability and contribution features are disabled unless both a Supabase URL and
public browser key are configured. No Supabase project, reviewer role, auth provider,
publication credential, Worker or VPS deployment is created by the repository itself.

The current corpus is not silently relabelled as human-reviewed. Most recipes remain
honestly described as structurally validated, not cook-tested drafts.

See:

- `docs/PHASE-1-COMPANION.md`
- `docs/PHASE-2-TRUST.md`
- `docs/PHASE-3-PRODUCT.md`
- `docs/PHASE-4-LOCAL-KITCHEN.md`
- `docs/PHASE-5-PORTABLE-KITCHEN.md`
- `docs/PHASE-6-LIVING-COOKBOOK.md`

## Optional cloud configuration

Copy `.env.example` only after applying and testing the Supabase migrations:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=PUBLIC_BROWSER_KEY
```

Apply migrations in order:

```text
supabase/migrations/20260712_phase5_portable_kitchen.sql
supabase/migrations/20260712_phase5_sync_push_hardening.sql
supabase/migrations/20260712_phase5_migration_device_registration.sql
supabase/migrations/20260712_phase6_living_cookbook.sql
supabase/migrations/20260712_phase6_account_deletion_hardening.sql
```

Never place a Supabase service-role credential in a `NEXT_PUBLIC_*` variable.

## Trusted publication-candidate operator

Only after a candidate passes the Phase 6 database threshold:

```bash
SUPABASE_URL=https://PROJECT.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
GITHUB_TOKEN=... \
GITHUB_REPOSITORY=febufenn-cyber/cook-anything \
PUBLICATION_CANDIDATE_ID=... \
npm run publication:open-pr
```

The operator opens a draft quarantine PR only. It cannot merge, deploy or write directly
to the production recipe directory.

## Commands

```bash
npm install
npm run dev                 # local dev at localhost:3000
npm run build               # trust gate + indexes/manifests + static export
npm run preview             # build + wrangler dev
npm run deploy              # build + wrangler deploy
npm run test:companion      # hosted-session and execution-boundary regressions
npm run test:trust          # provenance, allergen, BYOK and header regressions
npm run test:product        # matcher, parser, pantry, Cook Mode and timer regressions
npm run test:kitchen        # IndexedDB/import/offline/privacy-boundary regressions
npm run test:sync           # mutation, conflict, RLS/RPC and auth-cache regressions
npm run test:contributions  # versioning, rights, review, cook-test and publisher regressions
npm run trust:gate          # production publication gate

# Data pipeline
npm run validate            # schema + referential validation
npm run licenses            # declared licence gate
npm run dupes:exact         # hard exact-duplicate gate
npm run dupes               # fuzzy duplicate candidates for human review
npm run normalize           # free text -> canonical ingredient slugs
npm run slugs               # slug/id generation and repair
npm run search-index        # weighted versioned client index
npm run trust-manifest      # public trust records
npm run companion-recipes   # trusted hosted-companion snapshots
npm run import-recipes -- --file <path>   # safe intake; failures go to quarantine/
npm run export-recipes      # full DB export (Supabase migration input)
npm run seed                # corpus coverage report
```

## Layout

```text
data/taxonomy/             canonical multilingual ingredient/platform metadata
data/recipes/              production-authorized recipe JSON only
quarantine/                rejected imports and publication candidates
src/lib/match.ts           weighted deterministic matcher and natural input parser
src/lib/cook-session.ts    persistent version-bound Cook Mode state and scaling
src/lib/kitchen/           local data contracts, validation and IndexedDB repository
src/lib/sync/              optional auth, durable mutation queue and sync protocol
src/lib/contributions/     family recipe versions, rights and contribution RPC clients
src/lib/trust/             provenance, allergen, dietary, safety and evidence policy
src/components/            matcher, Cook Mode, kitchen/account/review dashboards and trust UI
public/sw.js               offline cache boundary; excludes auth, sync and companion traffic
supabase/migrations/       optional kitchen sync and contribution RPC boundaries
worker/                    public API, validation, headers and Durable Objects
bridge/                    optional hardened Claude Code bridge and shutdown controls
scripts/                   publication operators, gates, indexes and regression suites
docs/                      recipe spec and Phase 0–6 runbooks
db/schema.sql              earlier Postgres/Supabase upgrade path
```

## Content rules

A valid JSON shape is not proof that a recipe works. Each public trust record separately
reports structural validation, editorial status, cook testing, allergen assessment,
provenance declaration and safety context. Automated checks reduce silent errors but do
not independently verify external pages, packaged labels, cultural authenticity or
medical suitability.

No scraped or republished copyrighted recipe text should enter production. See
`/legal`, `/sources`, `/privacy`, `docs/RECIPE-SPEC.md` and the phase runbooks.

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
- Cloudflare Worker serving static assets and the hosted companion session API
- Durable Objects owning hosted cooking sessions and global execution capacity
- Browser BYOK companion: calls go directly from the browser to the selected
  Claude or OpenAI-compatible provider

## Hosted companion safety status

Hosted execution remains **disabled by default**. `wrangler.jsonc` sets
`HOSTED_COMPANION_ENABLED` to `"false"`, and the Worker fails closed unless the
value is exactly `"true"`.

Phase 1 replaces the legacy browser-controlled prompt proxy with:

- build-generated trusted recipe snapshots
- opaque HttpOnly session cookies
- server-owned state and bounded history
- ordered, crash-safe, at-most-once turns
- runtime validation of model state
- strict global concurrency and daily execution limits
- HMAC-signed, replay-protected private bridge calls
- a stateless text-only bridge with all Claude tools disabled
- automatic deletion of inactive session data

Browser BYOK, recipe search, ingredient matching and normal Cook Mode remain
available while hosted execution is off.

Do not enable hosted mode until every exit condition in
`docs/PHASE-1-COMPANION.md` passes in staging. Phase 0 emergency containment
remains documented in `docs/PHASE-0-CONTAINMENT.md`; VPS details are in
`docs/VPS-BRIDGE.md`.

## Commands

```bash
npm install
npm run dev              # local dev at localhost:3000
npm run build            # validate data, build indexes/snapshots, export to out/
npm run preview          # build + wrangler dev
npm run deploy           # build + wrangler deploy
npm run test:companion   # companion validators, limits, idempotency and expiry

# Data pipeline
npm run validate         # schema + referential validation (fails build on errors)
npm run dupes            # duplicate-candidate detection
npm run normalize        # free-text -> canonical ingredient slugs
npm run slugs            # slug/id generation & repair
npm run licenses         # legal-safety gate
npm run search-index     # rebuild client index
npm run companion-recipes # rebuild trusted hosted-companion snapshots
npm run import-recipes -- --file <path>   # safe external import
npm run export-recipes   # full DB export (Supabase migration input)
npm run seed             # coverage report / what to generate next
```

## Layout

```text
data/taxonomy/    ingredients (multilingual), cuisines, countries, regions,
                  methods, diets, cookware, tags, allergens, units, collections
data/recipes/     recipe batch files (validated JSON)
src/lib/          platform types, matching, data loading, companion prompt/client
src/app/          routes, recipe pages, trust pages and companion UI
worker/           public API, validation, execution and Durable Object boundaries
bridge/           hardened optional Claude Code bridge and shutdown controls
scripts/          data pipeline, companion snapshot generator and security tests
docs/             recipe spec, scaling, AI assistant, Phase 0/1 runbooks
db/schema.sql     Postgres/Supabase upgrade path
```

## Content rules

Every recipe carries `source`, `license`, `author` and a `verificationStatus`
(`ai_drafted` → `verified` pipeline). No scraped/republished copyrighted
content — see `/legal` and `/sources` on the site, and `docs/RECIPE-SPEC.md`.

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
- Cloudflare Worker (`worker/index.ts`) serving the static export and retaining
  the hosted Cooking Companion API boundary (`POST /api/companion`).
- Browser BYOK companion: users connect their own Claude or OpenAI-compatible
  API key in the UI; calls go browser → provider.

## Hosted companion safety status

Hosted execution through a site-wide API key or the Claude Code VPS bridge is
**disabled by default under Phase 0 containment**. `wrangler.jsonc` sets
`HOSTED_COMPANION_ENABLED` to `"false"`, and the Worker fails closed unless the
value is exactly `"true"`. Browser BYOK, recipe search, ingredient matching and
normal Cook Mode remain available.

Do not re-enable hosted execution until every exit condition in
`docs/PHASE-0-CONTAINMENT.md` is complete. VPS bridge architecture and the
sanitized future setup notes live in `docs/VPS-BRIDGE.md`.

## Commands

```bash
npm install
npm run dev              # local dev at localhost:3000
npm run build            # validates data, builds search index, exports to out/
npm run preview          # build + wrangler dev
npm run deploy           # build + wrangler deploy

# Data pipeline
npm run validate         # schema + referential validation (fails build on errors)
npm run dupes            # duplicate-candidate detection
npm run normalize        # free-text -> canonical ingredient slugs
npm run slugs            # slug/id generation & repair
npm run licenses         # legal-safety gate
npm run search-index     # rebuild client index
npm run import-recipes -- --file <path>   # safe external import
npm run export-recipes   # full DB export (Supabase migration input)
npm run seed             # coverage report / what to generate next
```

## Layout

```
data/taxonomy/    ingredients (multilingual), cuisines, countries, regions,
                  methods, diets, cookware, tags, allergens, units, collections
data/recipes/     recipe batch files (validated JSON)
src/lib/          types.ts (schema), canon.ts (enums), match.ts (engine),
                  data.ts (loaders), jsonld.ts (SEO)
src/app/          all routes (recipes, cuisines, countries, regions,
                  ingredients, methods, diets, 14 SEO collections, trust pages)
scripts/          the import/validation/dedup/license pipeline
docs/             RECIPE-SPEC, SCALING, AI-ASSISTANT, MONETIZATION,
                  PHASE-0-CONTAINMENT, VPS-BRIDGE
db/schema.sql     Postgres/Supabase upgrade path
```

## Content rules

Every recipe carries `source`, `license`, `author` and a `verificationStatus`
(`ai_drafted` → `verified` pipeline). No scraped/republished copyrighted
content — see `/legal` and `/sources` on the site, and `docs/RECIPE-SPEC.md`.

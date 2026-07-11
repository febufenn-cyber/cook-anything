# Scaling Cook Anything: from seed to 1,000,000 recipes

The platform is built so the content pipeline — not the code — is the thing
that scales. Every stage below reuses the same contract: `src/lib/types.ts`
(shapes), `src/lib/canon.ts` (enums), `docs/RECIPE-SPEC.md` (authoring rules),
and the scripts pipeline (gates).

## The pipeline (already built)

```
source material ──> import-recipes ──> normalize-ingredients ──> validate-recipes
                                                    │                   │
                                            check-licenses      detect-duplicates
                                                    │                   │
                                                    └────── publish ────┘
                                                    (batch file in data/recipes/)
```

Every batch that enters `data/recipes/*.json` has passed: schema validation,
canonical-slug checks, license checks, and duplicate screening. `npm run seed`
reports coverage and names the thinnest cuisines to fill next.

## Stage 1 — seed → 10,000 (current architecture, no infra change)

1. **AI-drafted batches (the current engine).** The seed set was produced by
   parallel generation agents, each given a theme + curated dish list, writing
   a batch file and self-validating with `validate-recipes --file`. Repeat with
   new themes: more regional Indian cuisines (Bihari, Odia, Northeast, Konkani,
   Sindhi), more dish depth per cuisine (10 sambar styles, 20 biryanis), more
   categories (soups, salads, pickles, chutneys, drinks). ~30 batches of 20 per
   run ≈ 600 recipes/run; 15 runs ≈ 10,000. Always `ai_drafted`, never `verified`.
2. **Editorial upgrade path.** Human editors review `ai_drafted` → flip to
   `verified` (this status is currently *rejected* by the validator by design;
   lift that rule only when a real editorial process exists).
3. **Community submissions.** The /submit-recipe form already produces
   platform-schema drafts (`community_submitted`). Wire it to a backend (see
   Stage 2) and moderate.
4. Static export handles 10k pages fine (build time grows to ~ minutes). The
   client search index at 10k recipes is ~5–8 MB raw — split per-cuisine index
   shards, or move matching server-side (Stage 2).

## Stage 2 — 10,000 → 100,000 (move data out of the repo)

1. **Postgres/Supabase.** Apply `db/schema.sql`; import with
   `export-recipes` → a loader script. The data layer (`src/lib/data.ts`) is
   the only file that touches the filesystem — swap its internals for SQL.
2. **Rendering.** Static-generate the top N recipes per cuisine + all taxonomy
   pages; serve the long tail with SSR/ISR (move the Worker from assets-only to
   OpenNext on Cloudflare, or keep static + a search API Worker).
3. **Search.** Move matching to a Worker endpoint backed by Postgres
   (`idx_recipe_ingredients_norm` makes have/missing queries cheap) or add
   Meilisearch/Typesense for text search. The matching logic in
   `src/lib/match.ts` is pure and runs server-side unchanged.
4. **Sources.** Public-domain cookbook digitization (pre-1929 US publications
   and equivalent), government/extension-service recipe collections (usually
   public domain), open-license corpora — each imported through
   `import-recipes --status public_domain_imported|open_license_imported`,
   which enforces sourceUrl/license attribution.
5. **Images.** Add licensed/user photos only with `imageLicense` set; the
   validator already refuses images without licenses.

## Stage 3 — 100,000 → 1,000,000 (platform)

1. **Licensed partners** (`licensed_partner`): publishers and creators feed
   recipes via the import API in exchange for attribution/traffic/revenue share.
2. **Community at scale**: contributor profiles, regional editor programs
   (schema tables already exist: profiles, submissions, ratings, reports).
3. **Translation layer**: the `translations` JSONB field per recipe + the
   ta/hi fields on ingredients grow into full localized pages (start with
   Tamil + Hindi; the URL structure /ta/... can mirror the English tree).
4. **Dedup at scale**: replace the O(n²) detect-duplicates pass with MinHash /
   embedding-based clustering over (title + required ingredients); keep the
   current script as the verifier for flagged clusters.
5. **Data quality flywheel**: cooked-count + ratings feed a quality score that
   ranks search results (field already in MatchResult scoring path).

## Non-negotiables at every stage

- No scraping/republishing copyrighted recipe sites.
- Every recipe: source, sourceUrl (where applicable), license, author,
  verificationStatus. `check-licenses` runs in CI before publish.
- `verified` is earned by human review, never assigned by tooling.
- Nutrition stays `isEstimate: true` until a real nutrition pipeline exists.

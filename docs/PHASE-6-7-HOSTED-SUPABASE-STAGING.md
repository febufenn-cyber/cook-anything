# Phase 6.7 — Hosted Supabase staging (operations)

Staging project: `cook-anything-staging`, ap-south-1, created 2026-07-12 under
explicit owner authorization (unrelated project paused to free the slot).
Secrets: local mode-600 store only (`<LOCAL_SECRET_STORE>`); publishable key +
URL are build-time browser vars for the STAGING worker only; the service-role
key never enters builds, wrangler vars, evidence or CI.

Connection facts (learned the hard way): the direct `db.<ref>.supabase.co`
host is IPv6-only; use the session pooler — host comes from the Management API
(`/config/database/pooler`, currently `aws-1-ap-south-1...:5432` session mode).
SQL fixtures for hosted tests run through `scripts/staging-sql.sh` (Management
API query endpoint; operator token; curl UA required — python-urllib is WAF-blocked).

Migrations: `supabase link` + `supabase db push` applies 000100–001000 in
order. Three hosted-only fixes were authored in this phase (000800 grant
hardening, 000900 pgcrypto search_path, 001000 sync_push ambiguity) — see
`docs/PHASE-6-7-RESULTS.md`. Rerunning everything:
`STAGING_* env + STAGING_SQL_CMD='bash scripts/staging-sql.sh' node scripts/test-hosted-staging.mjs`.

Recovery procedure (validated with the drill limitation): apply migrations to
a fresh target FIRST, then restore the `--data-only` dump. A schema-level
logical dump alone restores RLS-enabled tables but zero policies (default-deny).

Auth: magic-link fully validated via the admin link API. Google/Apple OAuth
blocked pending staging console credentials — configure redirect URLs for
`https://cook-anything-staging.robofox.online` only, never production.

# Backup and restore

Scope: Supabase Postgres (cloud kitchens, households, contributions, deletion
queue). Local IndexedDB kitchens are user-owned and covered by the in-app
export/import — not by server backups. The recipe corpus and all evidence live
in git (this repository is its own backup via GitHub).

## Backups

1. **Supabase automated backups** — available on paid projects (daily, PITR on
   higher tiers). Verify tier when the staging/production projects are created;
   record retention in this file.
2. **Manual logical export** (works on every tier, run before ANY risky
   operation and on a weekly schedule):
   `supabase db dump --db-url "$STAGING_DB_URL" -f backups/dump-$(date -u +%Y%m%dT%H%M%SZ).sql`
   plus `--data-only` variant. Store outside the repo (backups may contain
   private user rows — never commit them; `backups/` is for local staging use).
3. **What backups do NOT cover**: Supabase Auth users are included in the db
   dump (`auth` schema) but OAuth provider config, email templates and URL
   allowlists are project settings — record them in `docs/` whenever changed.

## Restore drill (staging — must be performed before production launch)

1. Create representative data (users A/B, kitchen rows, a contribution draft).
2. `supabase db dump` as above (schema + data).
3. Mutate/delete some of the test data; note exactly what.
4. Restore into an ISOLATED stack (fresh `supabase start` on another port or a
   scratch hosted project): `psql "$RECOVERY_DB_URL" -f dump.sql`.
5. Verify: row counts match pre-mutation state; RLS still ENABLED on every
   table (`select relname from pg_class join pg_namespace n on n.oid=relnamespace
   where n.nspname='public' and relkind='r' and not relrowsecurity;` must
   return zero rows); grants match (`\dp`); RPCs still SECURITY DEFINER.
6. Record duration + outcome in `evidence/phase-6-5/ledger.json`.

Status: **not yet performed** — blocked on nothing locally (local stack can
drill as soon as migrations are applied); hosted drill blocked on the staging
project. Do not claim backups work until a restore has been performed.

## Migration rollback limitations

Migrations here create tables/policies/RPCs; there are no `down` scripts.
Rollback = restore from backup or fix-forward with a new migration. Never edit
an applied migration file; never `db reset` anything but local/staging.

## Credential rotation after suspected breach

Rotate in this order: service-role key → publishable key (only if RLS gap) →
GitHub publication token → Cloudflare token → bridge HMAC. Each rotation step
is detailed in `docs/INCIDENT-RESPONSE.md`.

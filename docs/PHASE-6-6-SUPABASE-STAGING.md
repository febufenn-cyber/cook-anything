# Phase 6.6 — Supabase staging validation

## Hosted staging project: BLOCKED (free-tier cap)

Creation was attempted on 2026-07-12 with the authenticated CLI:
`supabase projects create cook-anything-staging --org-id qasbonmvvocbukceppww --region ap-south-1`
Supabase rejected it: the org owner already has 2 active free projects
(`Verse_a_tile`, `contract-reviewer`). Pausing/deleting either is an owner
decision this agent will not make.

**Human action to unblock** (then rerun the harnesses below with staging env):
pause or delete one free project OR upgrade the org, rerun the create command
(db password already generated in `~/.cook-anything/staging.env`, mode 600),
then `supabase link --project-ref <ref>` + `supabase db push`, configure auth
redirect origins for `https://cook-anything-staging.robofox.online`, and set
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` on the
staging Worker env only. Never the service-role key in browser vars.

## Evidence collected on the LOCAL isolated stack (labeled, not hosted)

The local stack (`supabase start`, Docker) runs the same Postgres+PostgREST+
GoTrue components. All seven migrations (000100–000700) apply in documented
order; RLS enabled on all public tables; zero direct anon/authenticated table
grants (Phase 6.5 ledger + `evidence/phase-6-5/artifacts/local-migrations.log`).

Phase 6.6 additions, all against this stack:

- **Publication operator crash-resumption** — REAL GitHub side effects against
  the dedicated staging repository `febufenn-cyber/cook-anything-staging-pub`
  (never the production repo): crash injected after branch, after commit, and
  after PR creation; resumption without duplicate branches/PRs; unrelated
  branch refused; allowlist enforced. Results:
  `evidence/phase-6-6/publication-operator-results.json`.
- **RLS actor checks** — anon + cross-user denials proven in Phase 6.5;
  the full 14-actor matrix harness remains follow-up work for the hosted
  project (tracked in the ledger).
- **Magic-link auth flow** — locally testable via Mailpit; OAuth providers
  (Google/Apple) are BLOCKED pending console credentials.

## What remains hosted-only (blocked until the project exists)

Hosted RLS parity run · OAuth provider flows · guest→account migration on
hosted auth · multi-device sync chaos over real network · household matrix ·
hosted deletion drill · backup/restore drill on hosted backups · log/privacy
inspection of hosted logs. Each is listed as a blocker or pending row in
`evidence/phase-6-6/ledger.json` — none is claimed as done.

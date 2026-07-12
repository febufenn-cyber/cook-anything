# Incident response

Severities: **SEV1** user data exposure / unsafe recipe published / secrets
leaked · **SEV2** feature-wide outage or data-loss risk · **SEV3** degraded
behavior, no data risk. All SEV1 require a written postmortem in `evidence/`.

Correlation: use the Cloudflare `cf-ray` id + ISO timestamp in every note.

## Emergency switches (fastest first)

| Target | Action |
| --- | --- |
| Hosted companion | `npx wrangler versions deploy` previous version, or redeploy with `HOSTED_COMPANION_ENABLED="false"` (it already is) |
| Bridge (VPS) | `ssh ubuntu@68.233.116.11 'sudo touch /opt/cook-anything/BRIDGE_DISABLED && sudo systemctl stop companion-bridge'` (see `bridge/phase0-disable.sh`) |
| Publication | Revoke the fine-grained GitHub token in GitHub settings; close open `quarantine/publication-candidates/` PRs |
| Cloud sync | Remove Supabase URL/key vars + redeploy; clients continue local-only (IndexedDB remains source of truth — no data loss) |
| Whole site | `npx wrangler versions deploy <last-good>@100%` |

## Runbooks

**Leaked service-role key** (SEV1): rotate in Supabase dashboard immediately →
update operator env stores → audit `auth.audit_log_entries` + PostgREST logs
for the exposure window → verify RLS held (service-role bypasses RLS: assume
full read; notify users if any private rows could have been read) → postmortem.

**Leaked publishable (anon) key misuse** (SEV3): it is public by design; abuse
shows as RLS-denied spikes/rate anomalies → tighten Supabase rate limits; the
key rotates only if paired with an RLS gap (then treat as SEV1).

**Leaked GitHub publication token** (SEV1): revoke token → audit repo events
for pushes/PRs by the token → close/delete unexpected branches (only
`quarantine/publication-candidates/*` should ever exist) → confirm branch
protection on `main` blocked any merge attempt → mint a new fine-grained token
scoped to contents+PRs on the allowlisted repo only.

**Leaked Cloudflare API token / wrangler OAuth** (SEV1): revoke in Cloudflare
dashboard → `wrangler login` fresh → review deployment list for unexpected
versions of `cook-anything`/`cook-anything-staging` → roll back to last-good.

**Leaked bridge HMAC secret** (SEV2): generate ≥32-char replacement → update
`/etc/companion-bridge.env` + `wrangler secret put COMPANION_UPSTREAM_SIGNING_SECRET`
→ restart `companion-bridge`. Replay window is 30s; rotate promptly and the
exposure closes.

**Compromised reviewer/publisher account** (SEV1): remove role rows via
service-role operator → audit their review/cook-test/publication actions since
compromise → re-review any recipe they touched → invalidate their sessions
(Supabase admin signOut) → postmortem with role-provisioning fix.

**Incorrect RLS deployment / cross-user exposure** (SEV1): immediately remove
Supabase vars + redeploy (kills cloud reads from the app) → reproduce the leak
in staging with the RLS suite → fix policy via a NEW migration (never edit an
applied migration) → staging-verify → restore service → notify affected users
with specifics.

**Accidental/malicious publication** (SEV1): the publication operator can only
open DRAFT PRs into `quarantine/publication-candidates/` — close the PR; if
something reached `data/recipes/`, revert the merge commit, redeploy, takedown
per `docs/TAKEDOWN-POLICY.md`, preserve evidence (do not force-push history).

**Account-deletion failure** (SEV2): the worker is idempotent — rerun it; if
`prepare_contribution_account_deletion` succeeded but auth deletion failed,
rerun completes the remainder. Escalate to manual SQL only with a fresh backup
and record every statement in `evidence/`.

**Supabase outage** (SEV3 for us): app continues local-first (verified by
design: sync errors surface, kitchen remains usable). Do nothing destructive;
post status note; queue mutations replay on recovery.

**Cloudflare outage** (SEV2): status.cloudflare.com; nothing to do but
communicate; do not migrate DNS in panic.

**Service-worker cache corruption** (SEV2): bump the SW cache version constant
in `public/sw.js` (forces re-install + old-cache cleanup), deploy; users
recover on next visit; document the trigger.

**Migration failure in staging** (SEV3): `supabase db reset` the staging
stack, fix forward with a new migration. In hosted staging: restore from
backup (see `docs/BACKUP-RESTORE.md`) — never `DROP` by hand without one.

## Exercised drills (evidence required)

- Emergency hosted-companion disable: hosted mode has never been enabled; the
  fail-closed path is exercised on every smoke run (`companion-*-disabled`).
- Bridge kill-switch: `BRIDGE_DISABLED` marker honored by service unit
  (`ConditionPathExists`), watchdog and tunnel script — verify on the VPS
  whenever bridge staging begins.
- Rollback: `wrangler versions deploy <previous>` on staging after any failed
  smoke run (first real execution recorded in the ledger when it occurs).

# Phase 6.7 — Hosted Supabase staging validation: results

Base: `main` @ `b2be565`. Staging project: `cook-anything-staging` (ap-south-1,
created 2026-07-12 after explicit owner authorization to pause an unrelated
free project). Production untouched throughout. Evidence: `evidence/phase-6-7/`.

## Definition-of-done status

- Project created: **yes** (identity verified twice; fresh password in the
  local mode-600 secret store)
- Migrations applied: **yes — ten** (000100–000700 as planned, plus three fixes
  authored this phase; see defects below); remote history verified
- Hosted RLS matrix: **pass (core)** — anon denial, A/B isolation, viewer
  write-denial, removed-member lockout, contributor self-review block
  (`self_review_forbidden`), browser-role denial of all trusted RPCs.
  Double-tester rule: **not fully proven hosted** (harness call-shape warn) —
  follow-up recorded
- Magic-link Auth: **pass** (generate, first use, replay rejected, malformed
  rejected, refresh, sign-out, revoked-session rejection)
- Google OAuth: **blocked** (no staging console credentials)
- Apple OAuth: **blocked** (no staging console credentials)
- Guest migration: **partial** — "use this device" reset semantics proven at
  RPC level; the three-choice UI flow pends browser-session validation
- Hosted sync chaos: **pass (core)** — push + conflict machinery (real
  `concurrent_edit` surfaced), duplicate-mutation receipt idempotency, revoked
  device denial, personal-scope reset; long-tail chaos rows pend UI/browser runs
- Households: **pass** — create, invite (create/accept/replay-reject), viewer
  write-denial, removed-member lockout
- Deletion drill: **pass** — full worker pipeline hosted, auth user 404,
  idempotent rerun
- Restore drill: see `evidence/phase-6-7/restore-run.log` (hosted logical dump
  via session pooler → isolated local restore; free tier has no PITR — logical
  dump/restore is the documented limitation)
- Publication lifecycle: **pass — fully hosted**: claiming 5/5 (atomic claim,
  1-of-8 concurrency winner, token gate, expiry recovery, duplicate-PR
  prevention, janitor) + operator crash resumption 5/5 (crash after
  commit/branch/PR with base advancement, unrelated-branch refusal, allowlist)
  against the real `cook-anything-staging-pub` repo
- Privacy scan: **pass** (no tokens, keys, passwords or privileged JWTs in any
  evidence; disposable synthetic accounts only)
- Production modified: **no** · Production deployed: **no**

## Hosted-only defects found and fixed forward (the reason this phase exists)

1. **000800** — hosted default privileges auto-granted browser-role EXECUTE on
   the four trusted operator functions (in-function guard held; grant-level
   hardening applied).
2. **000900** — five functions (sync_push, personal reset, household
   invite create/accept, cloud draft save) called unqualified pgcrypto under a
   pinned `search_path`; all were inoperable over the hosted API (42883).
3. **001000** — `sync_push` plpgsql variable/column ambiguity (42702) made
   every push fail after device validation. None of these were reachable by
   local engine-level suites.

## Readiness verdicts (no blanket verdict)

- **Supabase Auth**: magic-link ready for staging canary use; OAuth providers
  blocked on console credentials → not ready
- **Personal synchronization**: core hosted semantics proven; UI-flow chaos
  long tail pending → staging-canary ready, production NO
- **Household collaboration**: hosted authorization proven at RPC level;
  UI + concurrent-edit long tail pending → staging-canary ready, production NO
- **Public contributions**: NO — moderation staffing unchanged; double-tester
  hosted proof pending
- **Publication operator**: mechanism fully proven hosted; remains DISABLED
  (no continuous service, no production repo access)

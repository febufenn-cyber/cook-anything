# Private canary plan (staged A → D)

Cohort: 10–25 invited users (family + trusted friends), staged so high-risk
features never launch together. Every stage has entry gates (evidence in
`evidence/phase-6-5/ledger.json`), collected metrics, and blockers that stop
promotion. **Any data-loss incident, cross-user exposure, silent allergen
weakening, or unauthorized publication is a release blocker for every stage.**

## Canary A — anonymous local product (no accounts)

Scope: search, matcher (Tamil/Tanglish/Hindi aliases), recipe pages, Cook
Mode, local kitchen (IndexedDB), saved recipes, offline/PWA, BYOK companion.
Entry gates: staging smoke 25/25 · browser QA matrix (desktop) · PWA offline
test · performance budgets measured. Hosted companion disabled · submissions
disabled · no cloud account UI.
Collect: no-result searches, unrecognized ingredients, Cook Mode
completion, offline issues, confusion reports (all via feedback form/chat —
no automatic analytics in A).

## Canary B — optional accounts + personal sync

Adds: Supabase auth (Google/Apple/magic-link), guest→account migration
choices (merge / use this device / use cloud), device management, deletion
request + worker. Entry gates: Supabase staging project migrated + RLS suite
green · sync chaos suite green · deletion drill green · restore drill done.
Collect: sync failures, conflict outcomes, migration-choice confusion,
deletion completion time.

## Canary C — private households + reviewer operations

Adds: household creation/roles, private family drafts, reviewer queue with
trained reviewers, staging-only publication operator. Entry gates: household
RLS matrix green · immutable submission + two-tester rule proven in staging ·
reviewer guides signed off. Public submissions REMAIN disabled.

## Canary D — operator-only hosted companion

Adds: hosted companion for OPERATOR accounts only, daily budget ≤ the staging
values (`COMPANION_DAILY_EXECUTION_LIMIT="50"`), bridge via stable private
tunnel only. Entry gates: full Step-12 checklist (process-group termination
OBSERVED, replay protection, HMAC, concurrency caps) + emergency-disable drill
re-run same week. Never general users in this phase.

## Rollback per stage

A: static rollback via wrangler versions. B: remove Supabase vars (local-first
continues). C: revoke roles via service-role. D: `HOSTED_COMPANION_ENABLED`
false + bridge `BRIDGE_DISABLED` marker.

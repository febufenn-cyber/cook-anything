# Account deletion — trusted worker operations

Code: `scripts/account-deletion-worker.mjs` (service-role; NEVER runs in a
browser or public CI). Schema hooks: `supabase/migrations/20260712_phase6_account_deletion_hardening.sql`
(deletion request queue + `prepare_contribution_account_deletion`).

## What deletion does

1. Fetch pending deletion requests (service-role authority) and revalidate
   state (request still pending, user still exists).
2. Revoke all registered devices and active sessions.
3. Households owned by the user: transfer to the eldest other owner/editor if
   present, else delete the household with its private drafts.
4. `prepare_contribution_account_deletion(user_id)` — deletes unpublished
   private contribution data and REDACTS internal identities on retained
   licensed evidence (published/licensed content keeps its license + public
   attribution string; internal user ids are severed).
5. Delete personal sync records, mutation receipts, private metadata.
6. Delete the Supabase Auth user.
7. Record completion (timestamps + counts only — never private payloads).

Idempotent: every step tolerates "already gone"; safe to rerun after any
partial failure. Dry-run mode (`--dry-run`) prints the plan without writing.

## What is NOT deleted

- Published, licensed recipes (license grant survives; attribution redacted to
  the public pseudonym; story fields already excluded from publication).
- The user's LOCAL IndexedDB kitchen on their devices — the app's "Delete all
  local data" control handles that separately, on-device.
- Aggregated, non-identifying operational counters.

## Expected completion & escalation

Target: within 24h of request. On repeated failure (3 runs): SEV2 per
`docs/INCIDENT-RESPONSE.md`; manual completion requires a fresh backup and a
recorded SQL transcript in `evidence/`.

## Test matrix (staging gate — all must pass before public enablement)

ordinary account · household owner · unpublished drafts · submitted-but-
unpublished recipe · account referenced by a publication PR · pending sync
mutations · duplicate execution · crash after contribution-prep (rerun
completes) · crash before auth deletion (rerun completes) · already-deleted
auth user · malformed request · unauthorized invocation (no service key).

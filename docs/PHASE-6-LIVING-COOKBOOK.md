# Phase 6 — The Living Cookbook

Phase 6 turns the former browser-only recipe form into a private, versioned family-recipe system with optional household collaboration, immutable submissions, role-protected review, version-bound cook-test evidence and a quarantine-first GitHub publication path.

## Status

- Anonymous local drafting remains available without an account.
- Cloud drafts, household collaboration and submission remain disabled when Supabase public configuration is absent.
- No Phase 6 migration is applied by this repository change.
- No reviewer role, service-role credential or GitHub publication credential is configured automatically.
- No publication candidate PR is opened by CI.
- Nothing is merged or deployed.
- Hosted companion execution remains disabled.

## Core invariants

1. Saving a draft is not submission.
2. Synchronizing a draft is not publication.
3. Every material edit creates a new immutable content version and SHA-256 hash.
4. Submission freezes one exact version; later edits cannot change it.
5. Rights, licence and AI-assistance declarations are version-bound.
6. Contributors cannot review, cook-test or approve their own submissions.
7. Cook-test evidence must match the submitted version ID and hash.
8. Publisher approval requires two independent passed cook tests and no unresolved error finding.
9. Browser roles cannot read or write contribution tables directly.
10. Browser code cannot claim candidates for GitHub publication.
11. The trusted operator opens only a draft quarantine PR and has no merge or deploy operation.
12. Public recipes still require canonical `data/recipes/` records and the existing trust gate.

## Product surfaces

- `/submit-recipe/` — resumable local-first editor.
- `/my-recipes/` — local, private-cloud and household draft dashboard with version history.
- `/review/` — role-protected editorial, safety, cook-test and publisher shell.

The UI always distinguishes saved, synced, submitted, approved, candidate, PR-open and published states.

## Local storage

The IndexedDB database `cook-anything-contributions` contains `drafts`, `versions`, `submissions` and `meta`.

The editor performs a one-time best-effort migration from the old `ca:recipe-drafts` and `ca:submitted-drafts` localStorage values. Successfully migrated values are removed only after the IndexedDB writes and migration marker succeed.

Local draft IDs and cloud UUIDs remain separate. A linked local draft stores its `cloudDraftId`; later cloud saves include the expected latest cloud version ID. Stale tabs receive `draft_revision_conflict` rather than overwriting newer work or silently creating another cloud draft.

The global delete-all control emits `local_data_deleted`. A globally mounted deletion bridge clears the contribution database in addition to the kitchen database, sync queue, remembered keys and application caches.

## Editor data

The editor captures multilingual titles and stories, cuisine and region, servings and timings, structured ingredients, ordered steps, cookware, safety notes, dietary/allergen declarations, source type, licence, public attribution, AI-assistance disclosure and rights attestations.

A browser save always commits locally before any cloud call. Cloud failure therefore cannot destroy the browser version.

## Required migration order

Apply all migrations in this exact order:

1. `supabase/migrations/20260712000100_phase5_portable_kitchen.sql`
2. `supabase/migrations/20260712000200_phase5_sync_push_hardening.sql`
3. `supabase/migrations/20260712000300_phase5_migration_device_registration.sql`
4. `supabase/migrations/20260712000400_phase6_living_cookbook.sql`
5. `supabase/migrations/20260712000500_phase6_account_deletion_hardening.sql`

The fifth migration makes contributor, reviewer, tester and publisher identities nullable for retained licensed evidence and adds a service-role deletion-preparation RPC. Do not apply it before the primary Phase 6 schema.

## Cloud schema and authorization

Phase 6 creates contribution roles, recipe drafts, collaborators, immutable versions, submissions, findings, editorial reviews, cook-test runs, publication candidates and status events.

All tables have RLS enabled. Direct privileges are revoked from `anon` and `authenticated`; browser access is limited to narrow security-definer RPCs deriving identity from `auth.uid()`.

Personal drafts are accessible to their owner and explicit collaborators. Household drafts are readable by members and writable only by household owners/editors. Household membership does not grant reviewer authority. Draft scope is immutable after cloud creation.

## Submission intake

`submit_recipe_version` requires authenticated draft access, an exact draft/version relationship, own-words and right-to-share confirmations, an allowed licence, bounded structured content and no secret-like or prototype-pollution fields.

It freezes the version ID and hash, generates conservative findings, and moves the submission to `automated_checks_failed` or `awaiting_editorial_review`. Database findings are triage aids, not publication approval. Full taxonomy, allergen, dietary, provenance, duplicate and production-schema validation remains the repository trust gate.

## Roles and review

Trusted operators provision `editorial`, `safety`, `cook_tester`, `publisher` and `administrator` roles through controlled administration. No browser RPC grants roles. The `/review/` route is only a client shell; unauthorized accounts cannot retrieve the queue.

Review records and workflow events are append-only. Reviewers request changes or transition submissions; they never modify a frozen contributor version invisibly.

## Cook-test evidence

Cook tests store the submission, version, hash, tester, servings, timings, equipment, substitutions, step findings, safety observations, outcome and summary.

The server rejects self-testing, evidence for another version/hash, duplicate tests by one tester and tests outside `awaiting_cook_test`. Two distinct testers with `passed` outcomes are required for a publication candidate. `passed_with_changes` does not satisfy that threshold.

## Publication candidate

Publisher approval requires `editorially_approved` status, a publisher distinct from the contributor, a valid canonical slug, two independent passed tests tied to the frozen hash and no unresolved error finding. Approval creates a database candidate only.

## Trusted GitHub operator

Run only in a trusted operator environment:

```bash
SUPABASE_URL=https://PROJECT.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
GITHUB_TOKEN=... \
GITHUB_REPOSITORY=febufenn-cyber/cook-anything \
PUBLICATION_CANDIDATE_ID=... \
npm run publication:open-pr
```

Optional controls:

```bash
PUBLICATION_BASE_BRANCH=main
PUBLICATION_REPOSITORY_ALLOWLIST=febufenn-cyber/cook-anything
```

The operator claims one ready candidate through a service-role RPC, verifies its identity/hash/slug and repository allowlist, creates a branch, writes only beneath `quarantine/publication-candidates/`, opens a draft PR and records the PR URL. It contains no merge API, deploy command or production recipe-path creation.

The quarantine PR must be completed by an editor: supply every canonical field required by `docs/RECIPE-SPEC.md`, verify taxonomy and rights evidence, create a valid production batch under `data/recipes/`, remove quarantine files, pass all trust/licence/duplicate/build gates and receive human GitHub review. Missing metadata must never be invented to make CI green.

## Account deletion

`prepare_contribution_account_deletion` is service-role-only and must run before deleting the Supabase Auth user.

It deletes unpublished drafts and private workflow records, removes collaboration and reviewer assignments, redacts internal contributor/reviewer/tester/publisher IDs, and retains only records associated with publication PRs, published content or takedown history. It returns counts without returning recipe bodies.

The deletion worker must then complete the existing Phase 5 process and delete the Auth user. Publicly licensed text may remain under the selected licence, subject to attribution, withdrawal and takedown rules. Internal emails and account UUIDs must never enter public recipe JSON.

## Privacy and media

Private drafts may contain names, family stories and cultural information. They use a separate export from the ordinary kitchen export. Operational logs should record identifiers, states and outcomes rather than full private stories or credentials.

Phase 6 is text-only. Images and video remain deferred until signed uploads, strict limits, server-side decode/re-encode, EXIF removal, malware scanning, rights declarations, private access controls, moderation and deletion propagation exist.

## Staging procedure

1. Complete the Phase 5 personal-sync staging canary.
2. Apply all five migrations in order to a staging project.
3. Verify direct table access fails for `anon` and `authenticated`.
4. Create contributor, household editor/viewer, editorial, safety, cook-tester and publisher accounts.
5. Verify household viewers cannot edit and removed members lose access.
6. Save concurrent versions and confirm stale writes fail.
7. Submit a version, edit the draft, and confirm the submission remains unchanged.
8. Test missing rights, unsupported licence and incomplete AI-drafting disclosure.
9. Verify contributors cannot review, test or publish their own submissions.
10. Verify cook tests for another version/hash fail and one tester cannot count twice.
11. Verify publication approval fails before two independent passed tests.
12. Verify browsers cannot call service-role publication RPCs.
13. Run the operator against a staging repository and inspect every changed path.
14. Confirm the PR is draft and no workflow auto-merges or deploys it.
15. Exercise withdrawal, rejection, takedown and account deletion.
16. Inspect logs for recipe bodies, stories, tokens and credentials.
17. Run full Phase 1–6 CI and corpus build.

## Production exit gate

Do not enable public submissions until Phase 5 staging/deletion gates pass; all five migrations are controlled; reviewer provisioning is documented; real authorization, immutable-version, stale-write, self-review/test/publication and deletion tests pass; duplicate/licence escalation exists; the two-tester threshold is exercised; the operator uses least-privilege credentials and reviewed allowlists; generated PRs cannot auto-merge; takedown procedures and abuse alerts are staffed; privacy names the actual processors; and full Phase 1–6 CI remains green.

## Deliberate limits

Phase 6 does not include public comments or feeds, direct messages, popularity-based trust, monetization, nutrition/medical certification, unrestricted media, real-time rich-text collaboration, scraping, AI auto-approval, automatic GitHub merge or deployment.

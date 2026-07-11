# Phase 6 — The Living Cookbook

Phase 6 turns the existing local recipe-draft form into a private, versioned family-recipe system with optional household collaboration, immutable submissions, role-protected editorial review, version-bound cook-test evidence and a quarantine-first GitHub publication path.

## Status

- Code is complete on the stacked Phase 6 branch.
- Anonymous local drafting remains available without an account.
- Cloud drafts, household collaboration and submission remain disabled when Supabase public configuration is absent.
- No Phase 6 migration is applied by this repository change.
- No reviewer role is granted automatically.
- No publication candidate is opened automatically.
- No recipe is written directly to `data/recipes/` by the browser or publication operator.
- Nothing is merged or deployed.
- Hosted companion execution remains disabled.

## Core invariants

1. Saving a draft is not submission.
2. Synchronizing a draft is not publication.
3. Every material edit creates a new immutable content version and SHA-256 hash.
4. A submission freezes one exact version; later edits cannot change it.
5. Rights, licence and AI-assistance declarations are version-bound.
6. Contributors cannot review, cook-test or approve publication of their own submission.
7. Cook-test evidence must match the submitted version ID and content hash.
8. Publisher approval requires two independent passed cook tests and no unresolved error finding.
9. Browser roles cannot read or write contribution tables directly.
10. The browser cannot claim publication candidates for GitHub.
11. The trusted operator can only open a draft quarantine PR; it has no merge or deploy operation.
12. Public recipes still enter through `data/recipes/` and the existing Phase 2 trust gate.

## Local data model

The browser database `cook-anything-contributions` contains:

- `drafts`
- `versions`
- `submissions`
- `meta`

The first visit to the new editor or `/my-recipes/` performs a one-time best-effort migration of the old `ca:recipe-drafts` and `ca:submitted-drafts` localStorage arrays. Successfully migrated legacy records are removed only after IndexedDB writes and the migration marker succeed.

Local draft IDs and cloud draft UUIDs are separate fields. A linked local draft stores `cloudDraftId`; repeated cloud saves use the last cloud version ID as an optimistic concurrency check. A stale editor receives `draft_revision_conflict` instead of overwriting or silently forking the cloud draft.

## Draft workflow

`/submit-recipe/` supports three explicit targets:

- this device only
- personal private cloud cookbook
- a selected private household cookbook

The editor captures:

- multilingual title and story
- cuisine and region context
- servings and timings
- structured ingredients and canonical slugs when known
- ordered steps
- cookware and safety notes
- claimed dietary labels and declared allergens
- source type
- licence
- public contributor name or pseudonym
- AI-assistance category and explanation
- rights-to-share and own-words attestations
- separate permission to publish the cultural story

A local save always happens before any cloud request. Cloud failure therefore does not destroy the browser version.

## Cloud database

Apply after all Phase 5 migrations:

```text
supabase/migrations/20260712_phase6_living_cookbook.sql
```

It creates:

- `contribution_roles`
- `recipe_drafts`
- `recipe_draft_collaborators`
- `recipe_draft_versions`
- `recipe_submissions`
- `submission_findings`
- `editorial_reviews`
- `cook_test_runs`
- `publication_candidates`
- `contribution_status_events`

All tables have RLS enabled and direct privileges are revoked from `anon` and `authenticated`. Browser access is limited to authenticated security-definer RPCs.

## Scope and collaboration

A personal draft is readable and writable by its owner, plus explicitly assigned draft collaborators. A household draft is readable by household members and writable only by household owners/editors. Household membership does not grant editorial, safety, cook-tester or publisher authority.

The draft scope is immutable after cloud creation. Moving a recipe between personal and household contexts must create a deliberate copy rather than silently changing who can see an existing version history.

## Submission intake

`submit_recipe_version` requires:

- authenticated contributor access to the draft
- exact draft/version relationship
- own-words confirmation
- right-to-share confirmation
- an allowed publication licence
- bounded structured content
- no secret-like or prototype-pollution keys

The database freezes the version reference and content hash, creates automated findings and moves the submission to either:

- `automated_checks_failed`, or
- `awaiting_editorial_review`

Current database checks are deliberately conservative and incomplete. Full ingredient taxonomy, dietary, allergen, licence, duplicate and production-schema validation remains the repository trust gate.

## Review roles

Roles are stored in `contribution_roles`:

- `editorial`
- `safety`
- `cook_tester`
- `publisher`
- `administrator`

No browser RPC can grant roles. Provision roles only through a trusted operator or controlled migration. The `/review/` route is a client shell; unauthorized users receive `review_role_required` from the database and cannot read the queue.

Review records are append-only. Reviewers propose changes or transition the submission; they never edit contributor content invisibly.

## Cook tests

Cook-test evidence stores:

- submission, version and content hash
- tester identity
- servings attempted
- actual timing when provided
- equipment used
- substitutions
- step findings
- critical safety observations
- outcome and summary

The database rejects:

- contributor self-testing
- evidence for a different version/hash
- duplicate tests by the same tester
- tests outside the `awaiting_cook_test` state

Two distinct testers with `passed` outcomes are required for a publication candidate. `passed_with_changes` is useful evidence but does not satisfy that threshold by itself.

## Publication boundary

Publisher approval creates a `publication_candidates` row only when:

- status is `editorially_approved`
- the publisher is not the contributor
- two independent passed tests match the frozen hash
- no unresolved error finding exists
- the canonical slug is valid

The browser cannot export the candidate to GitHub. A trusted operator runs:

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

The operator:

1. claims one ready candidate through a service-role-only RPC,
2. verifies candidate ID, slug and immutable hash,
3. verifies the repository allowlist,
4. creates a dedicated branch,
5. writes only under `quarantine/publication-candidates/`,
6. opens a draft PR,
7. records the PR URL through a service-role-only RPC.

It does not call a merge API, deploy command or `data/recipes/` path.

The quarantine PR must then be completed editorially:

1. supply every canonical field required by `docs/RECIPE-SPEC.md`,
2. verify ingredient/cuisine/region/method/cookware/tag slugs,
3. review rights and attribution evidence,
4. create a valid production batch under `data/recipes/`,
5. bind version-specific editorial and cook-test evidence,
6. remove the quarantine candidate files,
7. run all trust, duplicate and build gates,
8. receive human GitHub review before merge.

Missing publication metadata must never be invented automatically merely to make CI green.

## State model

Primary states:

```text
submitted
  → automated_checks_failed | awaiting_editorial_review | withdrawn
awaiting_editorial_review
  → changes_requested | awaiting_cook_test | editorially_approved | rejected | withdrawn
awaiting_cook_test
  → changes_requested | editorially_approved | rejected | withdrawn
editorially_approved
  → publication_candidate | changes_requested | withdrawn
publication_candidate
  → publication_pr_open | changes_requested | withdrawn
publication_pr_open
  → published | changes_requested | withdrawn | takedown_pending
published
  → takedown_pending
```

Terminal and recovery states include `rejected`, `withdrawn`, `superseded` and `takedown_completed`. Every transition is recorded in `contribution_status_events` with actor role and bounded reason.

## Privacy and deletion

Private drafts may contain family stories, names and cultural information. They are not included in ordinary kitchen exports. `/my-recipes/` provides a separate contribution export.

Account deletion must remove unpublished drafts, versions, submissions and review-visible private content according to the deletion runbook. Published recipe text may have a separate lawful retention basis under the contributor-selected licence; public attribution, withdrawal and takedown behavior must be explained before public submissions are enabled. Contact email and internal user IDs must never enter public recipe JSON.

Reviewer and moderation logs should record IDs, states and operational outcomes rather than full private recipe bodies.

## Media limit

Phase 6 is text-only. It does not accept recipe photos or video. A later media phase requires signed uploads, strict byte/dimension limits, server-side decode/re-encode, EXIF removal, malware scanning, rights declarations, private-by-default access, moderation and deletion propagation.

## Staging procedure

1. Complete the Phase 5 personal-sync staging canary first.
2. Apply the Phase 6 migration to a separate staging project.
3. Verify direct table reads/writes fail for `anon` and `authenticated`.
4. Create contributor, household editor, editorial, safety, cook-tester and publisher accounts.
5. Verify household viewers cannot edit drafts.
6. Verify removed collaborators lose access immediately.
7. Save two concurrent versions and confirm stale optimistic writes fail.
8. Submit a frozen version, then edit the draft and confirm the submission remains unchanged.
9. Test missing rights, unsupported licence and AI-drafting disclosure failures.
10. Verify a contributor cannot review, test or publish their own submission.
11. Verify tests for another hash/version fail.
12. Verify one tester cannot count twice.
13. Verify publication approval fails before two independent passed tests.
14. Verify the browser cannot call service-role publication RPCs.
15. Run the operator against a staging repository and confirm it writes only quarantine files.
16. Confirm the generated PR is draft and contains no auto-merge/deploy workflow.
17. Exercise withdrawal, rejected submission and takedown paths.
18. Exercise account deletion for unpublished and published contributions.
19. Inspect logs for recipe bodies, stories, tokens and service-role credentials.
20. Run full Phase 1–6 CI and corpus build.

## Production exit gate

Do not enable public submissions until:

- Phase 5 staging and deletion gates pass
- Phase 6 migration is applied through controlled change management
- reviewer role provisioning and revocation is documented
- direct table access tests pass
- collaborator and household authorization tests pass
- immutable-version and stale-write tests pass
- self-review/self-test/self-publication tests pass
- automated findings use the same policy vocabulary as repository gates
- duplicate and licence escalation procedures exist
- two-tester evidence threshold is exercised
- publication operator has least-privilege GitHub and Supabase credentials
- repository/path allowlists are reviewed
- publication PRs cannot merge automatically
- withdrawal and takedown procedures are staffed
- account-deletion rules for licensed published text are approved
- abuse limits and moderator alerts are configured
- privacy text names the actual processors and operator
- full Phase 1–6 CI remains green

## Deliberate limits

Phase 6 does not include:

- public comments, likes, follows or social feeds
- contributor direct messages
- popularity-based trust
- creator monetization
- nutrition or medical certification
- unrestricted image/video uploads
- real-time collaborative rich-text editing
- automated scraping or licence-page retrieval
- AI auto-approval
- automatic GitHub merge or deployment

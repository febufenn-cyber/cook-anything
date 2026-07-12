# Production-readiness report — Phase 6.5

Generated: 2026-07-12 · Base: `main` @ `1e378ec` · Branch: `agent/phase-6-5-staging-canary-operations` · Draft PR: #7
Legend: ✅ evidenced (ledger entry) · 🟡 partial · ⛔ blocked (named blocker) · ⬜ not started · 🔒 deliberately disabled

| Subsystem | Code | Configured | Staging deployed | Staging tested | Canary | Prod enabled |
| --- | --- | --- | --- | --- | --- | --- |
| Static application | ✅ | ✅ | ✅ | ✅ smoke 25/25 | ⬜ | ✅ deployed @ d3a4eea (v 8fb4fd02), smoke 25/25, cold+cached headers verified |
| PWA / offline | ✅ | ✅ | ✅ served | 🟡 sw serving + cache boundaries only | ⬜ | 🟡 deployed; device QA outstanding |
| Recipe trust gate | ✅ | ✅ | n/a (build-time) | ✅ 0 errors in chain rerun | n/a | ✅ enforced in every build |
| Matcher | ✅ | ✅ | ✅ | 🟡 unit suites only; no deployed QA | ⬜ | 🟡 |
| Cook Mode | ✅ | ✅ | ✅ | 🟡 unit suites; no device QA | ⬜ | 🟡 |
| Local kitchen (IndexedDB) | ✅ | ✅ | ✅ | 🟡 phase-4 suite; no browser matrix | ⬜ | 🟡 |
| Supabase Auth | ✅ | ⛔ no staging project | ⛔ | ⛔ | ⬜ | 🔒 vars absent |
| Personal sync | ✅ | ⛔ no staging project | ⛔ | 🟡 RPC surface proven on local stack | ⬜ | 🔒 |
| Device management | ✅ | ⛔ | ⛔ | 🟡 revocation exercised in deletion drill (local) | ⬜ | 🔒 |
| Household authorization | ✅ | ⛔ | ⛔ | 🟡 RLS spot checks only; full matrix pending | ⬜ | 🔒 |
| Account deletion | ✅ **worker built this phase** | ✅ | n/a | ✅ full drill on local stack + mock CI suite | ⬜ | 🔒 |
| Family drafts / contributions | ✅ | ⛔ | ⛔ | 🟡 phase-6 unit suite; guard bug fixed (000600) | ⬜ | 🔒 |
| Moderation (human ops) | n/a | 🟡 docs only | n/a | ⬜ | ⬜ | 🔒 no staffing |
| Cook testing program | n/a | 🟡 protocol written | n/a | ⬜ | ⬜ | 🔒 |
| Publication operator | ✅ | 🟡 allowlist in code | ⬜ | ⛔ was inoperable (guard bug) — retest needed | ⬜ | 🔒 |
| Hosted companion | ✅ fail-closed | ✅ disabled everywhere | ✅ disabled | ✅ disabled-path proven (503, no cookie, no DO) | ⬜ | 🔒 |
| Observability | 🟡 | 🟡 CF built-ins + smoke script | 🟡 | 🟡 | ⬜ | 🟡 |
| Backups / restore | ⬜ docs only | ⬜ | ⬜ | ⛔ restore drill NOT performed | ⬜ | ⬜ |
| Incident response | ✅ runbooks | n/a | n/a | 🟡 fail-closed + kill-switch paths exist; drills partially exercised | ⬜ | n/a |
| Analytics | ⬜ not implemented (deliberate) | — | — | — | — | 🔒 |

## Defects found and fixed this phase (evidence in ledger)

1. **Deployed security headers absent on ALL static routes** — assets edge
   path bypasses the Worker on env deploys; repo tests could not see it.
   Fixed via `public/_headers` + parity test; shipped to production 2026-07-12
   (verified on cold and cached responses).
2. **Migration version collision + wrong application order** — five files
   shared version `20260712`; CLI failed at #2 and lexicographic order
   contradicted the documented order. Renamed `000100–000500`.
3. **Trusted-operator guard uncallable over API** — legacy
   `request.jwt.claim.role` GUC; account deletion + publication operator were
   inoperable. Fixed in migration `000600` (`is_service_role()`).
4. GitHub repo had no branch protection, no secret scanning, no push
   protection, no dependency alerts — all enabled now; 1 moderate dependency
   vulnerability surfaced immediately (dependabot will PR).

## Go / no-go by capability

- **Anonymous local product** (static + matcher + Cook Mode + local kitchen +
  offline): **GO for Canary A** after: authorized production redeploy (ships
  `_headers`), plus at least one real-device pass of the QA matrix.
  NOT a blanket production GO — device/accessibility QA is outstanding.
- **Optional cloud sync**: **NO-GO** — blocked on a real Supabase staging
  project, OAuth configuration, the full RLS matrix, sync chaos testing, and
  a restore drill. Code-complete; local-stack evidence is promising.
- **Household features**: **NO-GO** — same blockers + full cross-role matrix.
- **Public contributions**: **NO-GO** — moderation staffing and takedown
  ownership are documents, not people. Publication claim concurrency is
  hardened (migration 000700, tested); end-to-end GitHub crash resumption
  remains pending staging validation against a dedicated staging repo (see
  blocker PUBLICATION_OPERATOR_GITHUB_CRASH_RESUMPTION).
- **Hosted companion**: **NO-GO (deliberately disabled)** — fail-closed state
  is the verified, correct state. Step-12 checklist untouched by design.

## Standing blockers (machine-readable copy in evidence/phase-6-5/ledger.json)

1. `SUPABASE_STAGING_PROJECT_MISSING` — human: create project, provide URL +
   publishable key (+ service-role via secret store); then: apply 000100–000600,
   run RLS matrix, OAuth flows, sync chaos, restore drill, deletion drill re-run.
2. `REAL_DEVICE_AND_HUMAN_QA_REQUIRED` — human: iPhone/Android/desktop QA
   matrix, screen-reader pass, canary cohort, cook testers.
3. `PRODUCTION_REDEPLOY_AUTHORIZATION` — **RESOLVED 2026-07-12**: authorized
   redeploy executed (version 8fb4fd02); smoke 25/25; cold+cached headers
   verified; no high-risk feature enabled.

No unsupported production-readiness claim is made: nothing in this phase
enabled hosted AI, cloud sync, public submissions, or publication anywhere.

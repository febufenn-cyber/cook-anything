# Phase 6.6 — results

Base: `main` @ `b94d1c9`. Branch: `agent/phase-6-6-device-qa-supabase-staging`.
Production untouched. Nothing high-risk enabled. Two Phase 6.5 blockers targeted;
one fully resolved (publication operator crash resumption), the rest advanced with
honest blockers where physical devices / hosted Supabase / OAuth credentials are
unavailable to this environment.

## Workstream A — device & accessibility QA

**Completed on real browser engine (Chromium, Playwright, automated), against
deployed staging:** 21 checks pass, 1 step-dependent warn, 0 failures —
homepage, ingredient search including Tamil/Hinglish aliases (`thayir`, `pyaz`
→ 26 matches) and typo handling, recipe page, Cook Mode open/advance, kitchen/
account/my-recipes routes, keyboard tab order (12/12) + visible focus,
no-horizontal-scroll at 640px, reduced motion, service worker active, offline
reload of home and cached recipe, reconnection, axe-core 0 violations on 4 pages.

**Defects found and FIXED this phase:**
1. *Critical* — unlabeled `type=date` input and meal `<select>` (KitchenDashboard
   meal-plan row + RecipeKitchenActions): added `aria-label` to both.
2. *Serious* — site-wide color contrast: `tamarind-faint` (#8a7361) and
   `turmeric-deep` (#a96d00) computed 3.66–4.39 on rice/rice-deep/card, below
   WCAG AA 4.5:1 for small text. Darkened tokens to `#6b5545` / `#8a5a00`
   (≥5.0 on every background). Redeployed staging; re-scan = 0 violations.

**Blocked (no physical device / AT in this environment):** real iPhone Safari,
iOS PWA install, lock-screen Cook Mode recovery, VoiceOver; real Android Chrome,
Android PWA, TalkBack; manual screen-reader pass; real-device performance numbers.
Each has a machine-readable blocker in the ledger with the exact human action.

**Canary A verdict: NO-GO** — the gate requires one real iPhone pass, one real
Android pass, one desktop keyboard pass, one screen-reader pass, and offline/PWA
recovery. Keyboard + offline are proven on a real engine; iPhone/Android/
screen-reader remain blocked on hardware. No unresolved critical/serious
accessibility or data-loss defect remains (both found were fixed).

## Workstream B — hosted Supabase staging

**Hosted project: BLOCKED** — creation rejected because the org is at the
2-active-free-project cap (`Verse_a_tile`, `contract-reviewer`). Exact unblock
steps in `docs/PHASE-6-6-SUPABASE-STAGING.md`. Consequently the hosted RLS
matrix, OAuth flows, guest-migration, multi-device sync chaos, household matrix,
hosted deletion drill, and backup/restore drill are all blocked; each has a
result file marked `blocked` with the local-stack evidence that does exist.

**Publication operator crash resumption: RESOLVED** — the one Workstream-B gate
achievable without the hosted project. The operator was made idempotent and
tested with REAL GitHub side effects against a dedicated staging repo
(`cook-anything-staging-pub`, never production): crash after branch, after
commit, and after PR creation each resume with exactly one draft PR and no
duplicate; a same-named unrelated branch is refused; the repo allowlist is
enforced before any side effect. 5/5.

## Per-capability verdicts (unchanged unless noted)

- **Anonymous local product Canary A**: NO-GO (blocked on physical-device +
  screen-reader passes; all found defects fixed).
- **Supabase Auth / Personal sync / Household collaboration**: NO-GO — blocked
  on the hosted staging project.
- **Public contributions**: NO-GO — moderation staffing/takedown ownership are
  people, not docs; hosted validation still pending.
- **Publication operator**: crash-resumption RESOLVED; still DISABLED pending
  hosted Supabase + moderation.
- **Hosted companion**: NO-GO (deliberately disabled; fail-closed verified).

No blanket production-ready verdict is made.

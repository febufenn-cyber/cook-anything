# Phase 6.5 — Staging, Canary and Operations (canonical operational document)

Status: IN PROGRESS — this document is the single source of truth for what is
deployed, what is proven, and what remains disabled. A claim without an entry
in the evidence ledger (`evidence/phase-6-5/ledger.json`) is not a claim.

Base commit audited: `1e378ec6961e68826c83b0b65a7d2e72af626746` (main, Phase 6 merge).

## 1. Current architecture (as merged, Phases 1–6)

- Static Next.js export served by a Cloudflare Worker (`worker/index.ts`) that
  applies security headers/CSP and hosts the hosted-companion API behind
  Durable Objects (`CompanionSession`, `CompanionGate`) — **fail-closed**:
  `HOSTED_COMPANION_ENABLED` defaults to `"false"` and every hosted route
  returns `not_configured` (503) when disabled.
- Trust pipeline: `npm run trust:gate` (validate → licenses → import
  boundaries → exact duplicates → trust checks) gates every build; trusted
  companion snapshots are pre-built to `public/companion-recipes/`.
- Local kitchen: IndexedDB (`src/lib/kitchen/`), offline PWA (`public/sw.js`),
  interruption-safe Cook Mode.
- Portable kitchen: optional Supabase sync (`src/lib/sync/`), device
  registration and revocation, guest→account migration choices.
- Living Cookbook: contributions, households, reviews, cook tests, quarantine
  publication PRs (`src/lib/contributions/`, `scripts/open-publication-candidate-pr.ts`).
- Private bridge (`bridge/`): loopback-bound subscription executor; quick
  tunnels are development-only and blocked unless explicitly allowed;
  `BRIDGE_DISABLED` marker halts everything.

## 2. Environment matrix

| Concern | Local | Staging | Production |
| --- | --- | --- | --- |
| App origin | `next dev` / `wrangler dev` | `cook-anything-staging.robofox.online` (planned) | `cook-anything.robofox.online` |
| Worker | `wrangler dev` | `cook-anything-staging` (wrangler env `staging`) | `cook-anything` |
| Durable Objects | local sim | staging-namespace (per worker name) | production namespaces |
| Rate limiters | local sim | distinct namespace IDs (verified) | distinct namespace IDs |
| Supabase | local stack (`supabase start`) or none | dedicated staging project (BLOCKED: needs project) | dedicated production project (not created) |
| Hosted companion | disabled | disabled (flag false) | disabled (flag false) |
| Public submissions | disabled | disabled | disabled |
| Analytics | none | none | none (not implemented) |

Staging must not share: Worker name, DO namespaces, rate-limit namespaces, KV,
Supabase project, OAuth redirect URLs, publication repository/branch, secrets.

## 3. Deployment sequence (staging first, always)

1. `npm ci`
2. Full verification chain (see §6 CI) — must pass at the exact commit.
3. `npx wrangler deploy --env staging --dry-run` — inspect bindings.
4. `npx wrangler deploy --env staging`
5. Run `scripts/staging-smoke-test.mjs` against the deployed staging origin.
6. Only after staging smoke passes may a production deploy be *proposed* —
   production deploys require explicit human authorization; they are never
   run automatically by CI or agents.

## 4. Migration sequence (staging before production, in exact order)

1. `supabase/migrations/20260712000100_phase5_portable_kitchen.sql`
2. `supabase/migrations/20260712000200_phase5_sync_push_hardening.sql`
3. `supabase/migrations/20260712000300_phase5_migration_device_registration.sql`
4. `supabase/migrations/20260712000400_phase6_living_cookbook.sql`
5. `supabase/migrations/20260712000500_phase6_account_deletion_hardening.sql`

After each: record identifier + outcome in the ledger; inspect objects,
grants, revokes; confirm RLS enabled; confirm no unintended public access.

## 5. Secret inventory (names only — values live in approved stores)

| Secret | Store | Owner | Used by |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` (optional hosted) | Cloudflare Worker secret | Febin | worker hosted mode (disabled) |
| `COMPANION_BRIDGE_SECRET` (HMAC) | Cloudflare secret + `/etc/companion-bridge.env` | Febin | worker ↔ bridge |
| Supabase publishable key | Cloudflare var / build env | Febin | browser auth+sync |
| Supabase service-role key | operator env only (never browser/CI) | Febin | deletion worker, publication ops |
| GitHub publication token (fine-grained) | operator env only | Febin | publication candidate PRs |
| Cloudflare API token (deploys) | local wrangler OAuth / CI environment secret | Febin | deploys |
| Claude Code OAuth (VPS) | VPS `~/.claude` | Febin | bridge executor |

## 6. Verification chain (must all pass; see ci.yml)

companion security → gate rollover → trust (phase 2 + dietary + headers) →
product (phase 3 + edge + corrections) → kitchen (phase 4) → sync (phase 5) →
contributions (phase 6) → trust:gate → bridge/sw/SQL syntax → static build →
wrangler dry-run.

## 7. Rollback, backup, incidents, canary — see companion docs

- `docs/DEPLOYMENT.md` — deploy/rollback runbook
- `docs/BACKUP-RESTORE.md` — backup + restore drill
- `docs/INCIDENT-RESPONSE.md` — incident severities + runbooks
- `docs/CANARY-PLAN.md` — staged canary A→D
- `docs/OBSERVABILITY.md` — telemetry + redaction rules
- `docs/ACCOUNT-DELETION.md` — deletion worker operations
- `docs/REVIEWER-OPERATIONS.md`, `docs/TAKEDOWN-POLICY.md`,
  `docs/COOK-TEST-PROTOCOL.md` — human operations

## 8. Disabled-feature matrix (current truth)

| Feature | Flag/control | State | Enablement gate |
| --- | --- | --- | --- |
| Hosted companion | `HOSTED_COMPANION_ENABLED` var | **disabled** | Step 12 exit gate + human sign-off |
| Cloud accounts/sync UI | Supabase env vars absent | **inactive** (no staging project yet) | Supabase staging gates |
| Household editing | Phase 6 RPC + roles | code-complete, **unproven** | staging RLS suite |
| Public submissions | no public route + policy | **disabled** | moderation staffing + takedown ownership |
| Publication operator | manual script, allowlisted repo | **staging-only** | Step 13 gate |
| Analytics | not implemented | **absent** | Step 19 design |

## 9. Evidence ledger

Machine-readable: `evidence/phase-6-5/ledger.json`. Every gate entry records
test, environment, date, actor, inputs, observed result, artifact reference,
status (`passed`/`failed`/`blocked`), and unresolved risk.

## 10. Emergency shutdown

- Hosted companion: set `HOSTED_COMPANION_ENABLED="false"` + deploy (or
  `wrangler versions rollback`); bridge: create `/opt/cook-anything/BRIDGE_DISABLED`
  and `systemctl stop companion-bridge` on the VPS.
- Publication: revoke the fine-grained GitHub token; close open candidate PRs.
- Sync: remove Supabase publishable key vars + deploy (clients fall back to
  local-only; no data loss — local IndexedDB remains source of truth).

# Deployment runbook

## Environments

| | Staging | Production |
| --- | --- | --- |
| Worker | `cook-anything-staging` | `cook-anything` |
| Domain | cook-anything-staging.robofox.online | cook-anything.robofox.online |
| Deploy | `npm run deploy:staging` | `CONFIRM_PRODUCTION=yes npm run deploy:production` |
| Rate-limit namespaces | 92017 / 92018 | 91017 / 91018 |
| Hosted companion | `HOSTED_COMPANION_ENABLED="false"` | `HOSTED_COMPANION_ENABLED="false"` |

Durable Object namespaces are automatically distinct because the worker names
differ. Staging has NO KV binding. Secrets are set per environment:
`npx wrangler secret put <NAME> [--env staging]` — a secret set without
`--env staging` affects production only.

## Standard sequence (never skip a step)

1. `npm ci`
2. Full verification chain — the same commands as `.github/workflows/ci.yml`
   (`npm run test:companion && npm run test:trust && npm run test:product &&
   npm run test:kitchen && npm run test:sync && npm run test:contributions &&
   npm run trust:gate`), plus file checks and `npm run build`.
3. `npx wrangler deploy --env staging --dry-run --outdir /tmp/wr-dry` — read
   the bindings table; any unexpected binding stops the deploy.
4. `npm run deploy:staging`
5. `npm run smoke:staging` (25 deployed checks) — must be 25/25. Save the log
   under `evidence/`.
6. Production requires: staging smoke green at the same commit + explicit
   human authorization. Then `CONFIRM_PRODUCTION=yes npm run deploy:production`
   and `node scripts/staging-smoke-test.mjs https://cook-anything.robofox.online`.

## Rollback

- `npx wrangler deployments list [--env staging]` — find the previous version.
- `npx wrangler rollback [--env staging]` — interactive; or
  `npx wrangler versions deploy <version-id>@100% [--env staging]`.
- Static assets and worker code roll back together (single deploy unit).
- After any rollback, rerun the smoke test against the environment.

## Header architecture (do not regress)

Static routes are served by the assets edge path WITHOUT the Worker; their
security headers come from `public/_headers`. `/api/*` headers come from
`worker/index.ts`. `scripts/test-worker-security-headers.ts` asserts parity.
If you edit CSP, edit BOTH and let the test prove it.

## What a deploy must never do

- Enable `HOSTED_COMPANION_ENABLED` (separate gated procedure, Step 12 of
  `docs/PHASE-6-5-STAGING-CANARY-OPERATIONS.md`).
- Apply Supabase migrations (separate procedure, staging first).
- Run from CI on PRs (CI only dry-runs).

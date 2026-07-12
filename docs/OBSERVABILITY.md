# Observability (privacy-preserving)

Principle: identifiers, counts, status codes, durations, bounded error
categories. NEVER: recipe stories, pantry text, companion messages, tokens,
household invites, deletion payloads.

## Current state (truthful)

- Cloudflare Workers built-in analytics + logs: request volumes, status codes,
  CPU, errors per worker (`cook-anything`, `cook-anything-staging`) — available
  in the dashboard today, no code required.
- `npx wrangler tail --env staging` for live structured logs during drills.
- Durable Objects: exceptions surface in the same dashboards.
- Supabase (when projects exist): dashboard auth/API logs; PostgREST error
  rates; `auth.audit_log_entries`.
- Synthetic checks: `npm run smoke:staging` (25 checks) — run post-deploy and
  scheduled (see below). This is the primary availability probe.
- No client-side analytics exist. Trust-manifest mismatch and IndexedDB
  failures surface only in-app today.

## Planned wiring (tracked, not yet claimed)

- Scheduled smoke runs via a protected GitHub Actions workflow (manual +
  cron) hitting staging only, uploading the JSON summary as an artifact.
- Worker structured logging: one log line per companion/API request —
  `{route, status, durationMs, errorCategory, rayId}` only. Log redaction test
  (`scripts/test-log-redaction.ts`) asserts the log helper rejects objects
  containing forbidden keys (message, story, pantry, token, secret, email).
- Alert thresholds (Cloudflare notifications): worker error rate > 5%/5min;
  DO exception spike; daily-budget circuit-breaker events (hosted mode only).
- Supabase alerts: auth failure spikes, RLS-denial spikes, deletion-queue age
  > 24h, pending-mutation age > 1h.

## Dashboards & retention

Cloudflare: 30d built-in. Supabase logs: tier-dependent (record when project
exists). Evidence logs in-repo under `evidence/` (no private payloads —
enforced by review + the redaction test).

## Release check

Before any canary stage: run one full user journey on staging with
`wrangler tail` capturing, then grep the capture for: `sk-ant-`, `Bearer `,
`eyJ`, email addresses, and any pantry/recipe words used in the journey.
Attach the clean capture to the ledger. A hit = SEV1 fix before proceeding.

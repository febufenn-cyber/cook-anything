# Phase 1 — hosted companion trust boundary

> **Code complete, deployment disabled.** This implementation deliberately keeps
> `HOSTED_COMPANION_ENABLED="false"`. Merging or deploying the code creates the
> new boundaries and Durable Object namespaces, but it does not authorize public
> hosted execution.

## Security invariants

The hosted browser client may send only:

```json
{ "recipe_id": "chicken-chettinad" }
```

when creating a session, then:

```json
{ "message": "The onions are browning too fast.", "client_turn_id": "<uuid>" }
```

for a turn. It cannot submit or control:

- recipe JSON
- system prompts
- cooking state
- conversation history
- provider or model selection
- Claude session identifiers
- filesystem paths or tool permissions
- bridge origin
- photos in hosted mode

The Worker resolves a build-generated recipe snapshot, owns the session cookie,
state and bounded history, validates model output, and executes each idempotency
key at most once.

## Architecture

```text
Browser
  ├─ BYOK ───────────────────────────────> selected provider
  └─ hosted session API
       ├─ POST /api/companion/session
       ├─ POST /api/companion/turn
       └─ DELETE /api/companion/session
                    │
                    v
Cloudflare Worker
  ├─ same-origin + strict request validation
  ├─ trusted /companion-recipes/<id>.json lookup
  ├─ coarse per-location rate limiting
  ├─ CompanionSession Durable Object
  │    ├─ opaque HttpOnly cookie ownership
  │    ├─ ordered turns
  │    ├─ crash-safe idempotency records
  │    ├─ bounded state/history
  │    └─ automatic expiry alarm
  └─ singleton CompanionGate Durable Object
       ├─ serialized active-execution leases
       └─ strict daily execution circuit breaker
                    │
                    v
Either Anthropic Messages API or signed private bridge
```

## Trusted recipe snapshots

`npm run companion-recipes` generates one minimal snapshot per recipe under
`public/companion-recipes/`. Each snapshot is derived from repository-owned
recipe data and includes a SHA-256 version. Hosted sessions are pinned to that
snapshot rather than accepting browser-provided content.

The build runs this generator automatically.

Recipe and session JSON is escaped before it is placed inside prompt delimiters.
Literal `<`, `>` and `&` characters inside data cannot close the application’s
`<recipe_data>` or `<session_state>` boundary.

## Session ownership and retention

- Browser receives a random `__Host-` HttpOnly, Secure, SameSite=Strict cookie.
- Session state and at most 16 recent messages live in one Durable Object.
- Default inactivity lifetime is two hours.
- A Durable Object alarm deletes abandoned sessions even when no later request
  arrives.
- The expiry alarm is renewed before a provider execution starts and again when
  the result is committed, so it cannot delete a live long-running turn.
- A session accepts at most 30 successful turns by default.
- Closing the API session deletes its stored state immediately.

## Idempotency and uncertain failures

The Worker stores `client_turn_id` as `processing` before invoking a provider.

- A completed duplicate returns the original response.
- A duplicate while processing returns `turn_in_progress`.
- A stale processing record returns `turn_unknown` and is never executed again.

This deliberately favors at-most-once execution over silently issuing duplicate
Claude turns after a crash or ambiguous network failure.

## Model-output boundary

Model state is untrusted. Before committing it, the session validates:

- exact allowed fields
- recipe identity
- allowed stage and step identifiers
- bounded servings, arrays and strings
- maximum five timers and valid timer ranges
- bounded substitution ledger and flags
- no duplicate completed-step identifiers
- completed steps, flags and substitution ledger are append-only
- at most one new completed step and one stage/step advance per turn
- no backward or multi-step stage/current-step jumps

Malformed or invalidly advancing state is discarded while the last valid state
is preserved. The text reply may still be returned with
`state_warning: "invalid_model_state"`.

## Global abuse controls

Defaults in `wrangler.jsonc`:

- session creation: 5 per minute per coarse client key
- turns: 10 per minute per session
- maximum two active hosted executions globally
- maximum 300 hosted execution attempts per UTC day
- maximum 30 successful turns per session

The Cloudflare Rate Limiting binding is a coarse edge defense. The serialized
singleton Durable Object gate is the strict capacity and budget boundary.

The `namespace_id` values under `ratelimits` must be unique within the Cloudflare
account. Confirm `91017` and `91018` are unused before deployment; replace them
when necessary.

## Private bridge protocol

Production bridge traffic must use a stable named/private tunnel. Automatic
quick-tunnel discovery has been removed.

Every Worker request carries:

- `X-Request-Id`
- `X-Timestamp`
- `X-Body-SHA256`
- `X-Signature`

The signature is HMAC-SHA256 over:

```text
request_id.timestamp.body_sha256
```

The bridge rejects stale timestamps, reused request IDs, body-hash mismatches,
invalid signatures, unknown fields and oversized inputs.

The bridge is text-only and stateless:

- no Claude `--resume`
- no image files
- `Read` disabled
- all other tools disabled
- one model turn
- bounded input and output
- newest server-owned history retained within strict message/character budgets
- maximum two child processes by default
- timeout and client disconnect terminate the whole process group
- minimal child environment excludes the bridge signing secret

## Required secrets

Generate one random value of at least 32 bytes and store the same value in the
Worker and bridge environments:

```bash
openssl rand -hex 32
npx wrangler secret put COMPANION_UPSTREAM_SIGNING_SECRET
```

VPS environment:

```text
BRIDGE_SIGNING_SECRET=<same random value>
CLAUDE_CODE_OAUTH_TOKEN=<stored outside source control>
COMPANION_MODEL=sonnet
MAX_CONCURRENCY=2
```

Never commit, paste into issues, or log live values.

For the direct Anthropic backend instead of the bridge:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Configure only one intended backend during canary testing.

## VPS boundary

Install `bridge/companion-bridge.service` only for a dedicated `companion` user.
The checked-in unit applies systemd filesystem, home, device, capability,
namespace, process and syscall restrictions.

The exact syscall policy must be tested on the target VPS because Node and Claude
Code releases can change runtime requirements. Do not weaken all hardening to fix
one denial; identify and allow only the required operation.

The bridge remains bound to `127.0.0.1`. Do not expose port 8788 publicly.

## Deployment sequence

1. Keep `/opt/cook-anything/BRIDGE_DISABLED` present.
2. Merge and deploy the Worker with `HOSTED_COMPANION_ENABLED="false"`.
3. Confirm the Durable Object migration and rate-limit bindings deploy cleanly.
4. Confirm `/api/companion/session` returns `503 not_configured` without reading
   recipe data or creating a session.
5. Install the hardened bridge and stable private tunnel in staging.
6. Configure and rotate the HMAC secret.
7. Run the adversarial checks below.
8. Test with an operator-only staging hostname.
9. Review privacy text and operational logs.
10. Only then remove the staging disable marker and set the staging flag true.
11. Canary with invited testers before considering production.

Do not set the production flag true merely because the build deploys.

## Required adversarial checks

Public API:

- full recipe object is rejected
- client state/history/session IDs are rejected as unknown fields
- images and oversized messages are rejected
- unknown recipe IDs return 404
- cross-origin requests are rejected
- expired and malformed cookies are rejected
- repeated `client_turn_id` never executes twice
- simultaneous turns remain ordered
- simultaneous global lease requests cannot exceed capacity
- session turn, global concurrency and daily limits trigger correctly
- abandoned session data disappears after the configured alarm
- prompt delimiter strings inside trusted recipe/state fields remain data
- model state cannot remove progress, rewrite ledger entries or jump steps/stages

Bridge:

- missing or invalid signature returns 401
- modified body with old signature returns 401
- repeated request ID is rejected
- timestamp outside the replay window is rejected
- unknown body fields are rejected
- newest history is retained while old history is discarded at size limits
- history and output limits are enforced
- timeout kills the Claude process group
- disconnect kills the Claude process group
- third concurrent request is rejected at default capacity
- Claude cannot use Read, Bash, web or editing tools
- service user cannot read unrelated homes, repositories, SSH keys or secrets

Failure drills:

- provider authentication expires
- bridge and tunnel are offline
- model returns malformed state
- Worker loses the upstream response after execution
- VPS reboots during a turn
- emergency Phase 0 shutdown is re-run

## Exit gate

Public hosted mode remains disabled until all of these are evidenced:

- build and CI are green
- stable private tunnel is configured
- dedicated service identity and systemd hardening pass on the VPS
- HMAC and replay tests pass
- process termination is observed, not merely assumed
- rate and budget limits are verified
- session alarms delete stored data
- privacy disclosure matches the deployed backend
- metadata-only logging is confirmed
- Phase 0 shutdown still works end-to-end
- private canary produces no unresolved critical findings

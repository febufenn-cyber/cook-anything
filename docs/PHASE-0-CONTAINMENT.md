# Phase 0 — hosted companion containment

Phase 0 keeps the recipe site, deterministic ingredient matcher, search, normal
Cook Mode, and browser BYOK companion available while preventing anonymous
internet traffic from invoking a hosted API key or Claude Code on the VPS.

## Enforced in this repository

- `HOSTED_COMPANION_ENABLED` is explicitly `"false"` in `wrangler.jsonc`.
- The Worker fails closed unless that value is exactly `"true"`.
- `POST /api/companion` returns `not_configured` before reading the request body,
  reading bridge KV, or contacting a hosted backend.
- `POST /api/bridge-origin` returns `503 disabled` before authentication, JSON
  parsing, or KV mutation.
- Browser BYOK remains available because BYOK calls go directly from the browser
  to the provider and do not use the Worker endpoint.
- The VPS watchdog, quick-tunnel script, and systemd bridge unit all honor
  `/opt/cook-anything/BRIDGE_DISABLED`.
- `bridge/phase0-disable.sh` creates that marker and stops/disables known bridge
  services without destructively editing unrelated crontabs.

## Deployment order

The Worker gate must be deployed first. This protects the VPS even if a service
restarts while containment is being applied.

```bash
# From the repository root
npm install
npm run build
npm run deploy
```

Then disable the VPS bridge:

```bash
scp bridge/phase0-disable.sh <VPS_HOST>:/tmp/phase0-disable.sh
ssh <VPS_HOST> 'chmod +x /tmp/phase0-disable.sh && sudo /tmp/phase0-disable.sh'
```

Install the marker-aware files before any future bridge restart:

```bash
scp bridge/companion-watchdog.sh bridge/companion-tunnel.sh \
  bridge/companion-bridge.service <VPS_HOST>:/tmp/

ssh <VPS_HOST> '
  sudo install -m 0755 /tmp/companion-watchdog.sh /opt/cook-anything/bridge/companion-watchdog.sh
  sudo install -m 0755 /tmp/companion-tunnel.sh /opt/cook-anything/bridge/companion-tunnel.sh
  sudo install -m 0644 /tmp/companion-bridge.service /etc/systemd/system/companion-bridge.service
  sudo systemctl daemon-reload
'
```

The old KV `origin` value may remain present. During Phase 0 the Worker ignores
it and rejects new origin announcements. Clearing it is still recommended when
operational access is available, but containment does not depend on that cleanup.

## External verification

Test the public boundary directly, not only through the React UI.

```bash
curl -i -X POST https://cook-anything.robofox.online/api/companion \
  -H 'content-type: application/json' \
  --data '{"recipe":{"recipe_id":"test"},"state":{},"messages":[{"role":"user","content":"hello"}]}'
```

Expected result:

- HTTP `503`
- JSON error `not_configured`
- no bridge process spawned

```bash
curl -i -X POST https://cook-anything.robofox.online/api/bridge-origin \
  -H 'content-type: application/json' \
  -H 'x-bridge-token: deliberately-wrong' \
  --data '{"origin":"https://example.trycloudflare.com"}'
```

Expected result:

- HTTP `503`
- JSON error `disabled`
- no authentication detail leaked
- no KV mutation

On the VPS:

```bash
test -f /opt/cook-anything/BRIDGE_DISABLED
systemctl is-active companion-bridge companion-tunnel || true
systemctl is-enabled companion-bridge companion-tunnel || true
curl -fsS localhost:8788/health && echo 'UNEXPECTED: bridge still reachable' || true
```

The static website, recipe pages, matcher, search, and normal Cook Mode should
continue to work. A user without BYOK receives the existing connect-your-key
message. A user with BYOK continues to call their selected provider directly.

## Operational rules during Phase 0

- Do not remove `/opt/cook-anything/BRIDGE_DISABLED`.
- Do not set `HOSTED_COMPANION_ENABLED` to `"true"` in Wrangler or the
  Cloudflare dashboard.
- Do not treat hiding the companion button as a security control.
- Do not rely on an old quick-tunnel URL becoming unreachable by accident.
- Rotate `BRIDGE_TOKEN` before any future re-enable.
- Keep VPS addresses, OAuth tokens, bridge tokens, and operational credentials
  out of repository documentation.

## Phase 1 exit conditions

Hosted execution must remain disabled until all of the following are complete:

1. The client sends a trusted recipe identifier rather than system-prompt data.
2. The server resolves and validates the canonical recipe itself.
3. Claude Code runs as a dedicated restricted user or isolated container.
4. File access is limited to a per-request photo directory.
5. Raw Claude session IDs are not accepted as proof of session ownership.
6. Per-IP/user rate limits and a small global concurrency limit exist.
7. Model-produced session state is runtime-schema validated and bounded.
8. Privacy copy covers messages, photos, providers, Cloudflare, and VPS routing.
9. A tested emergency kill switch remains available outside normal releases.
10. Logs avoid recipe conversations, photos, API keys, tokens, and prompt bodies.

# Subscription bridge — hosted execution architecture

> **Phase 0 status: disabled.** The public Worker rejects hosted companion turns
> and bridge-origin announcements unless `HOSTED_COMPANION_ENABLED` is exactly
> `"true"`. The VPS must retain `/opt/cook-anything/BRIDGE_DISABLED`. See
> `docs/PHASE-0-CONTAINMENT.md` before operating any bridge service.

The Anthropic Messages API does not use a consumer Claude subscription as an API
credential. The experimental bridge runs a turn through headless Claude Code on
a machine controlled by the operator and lets the Cloudflare Worker proxy to it.

```text
browser ──> Worker /api/companion ──> isolated bridge (:8788)
                                           └─ claude -p
```

This path is intentionally unavailable during Phase 0. Browser BYOK remains the
supported companion mode because requests go directly from the browser to the
user-selected provider.

## Why it is disabled

Before a public hosted bridge can be re-enabled, it needs a trusted server-side
recipe lookup, isolated file access, application-owned session identifiers,
rate limiting, bounded concurrency, runtime state validation, privacy disclosure,
and a tested emergency kill switch. The current bridge is retained as an
experimental implementation, not as a production boundary.

## Phase 0 shutdown

Deploy the fail-closed Worker first, then run the VPS shutdown command:

```bash
scp bridge/phase0-disable.sh <VPS_HOST>:/tmp/phase0-disable.sh
ssh <VPS_HOST> 'chmod +x /tmp/phase0-disable.sh && sudo /tmp/phase0-disable.sh'
```

The marker-aware watchdog, tunnel script, and systemd unit must be installed
before any future service restart:

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

Do not record real VPS addresses, OAuth tokens, bridge tokens, private tunnel
origins, or SSH commands containing deployment identifiers in this repository.

## Experimental from-scratch setup

These instructions are retained only for future Phase 1 work on an isolated host.
Do not use them to re-enable the public production path during Phase 0.

### 1. Create a dedicated machine identity

The bridge must not run as a general deployment or login account. Create a
restricted service user:

```bash
sudo useradd -r -m -d /opt/cook-anything companion 2>/dev/null || true
sudo install -d -o companion -g companion -m 0750 /opt/cook-anything/bridge
sudo install -d -o companion -g companion -m 0750 /opt/cook-anything/logs
```

Do not give this user access to SSH keys, unrelated repositories, cloud
credentials, shell history, or home directories belonging to other users.
A container or stronger filesystem sandbox is required before Phase 1 exits.

### 2. Install and authenticate Claude Code

Install Claude Code using current official instructions, authenticate the
restricted identity, and store credentials outside the repository. The bridge
requires Node 20 or newer.

Create a root-owned environment file:

```bash
sudo tee /etc/companion-bridge.env >/dev/null <<'EOF'
BRIDGE_TOKEN=REPLACE_WITH_A_LONG_RANDOM_VALUE
CLAUDE_CODE_OAUTH_TOKEN=REPLACE_OUTSIDE_SOURCE_CONTROL
COMPANION_MODEL=sonnet
CLAUDE_BIN=/opt/cook-anything/.local/bin/claude
EOF
sudo chmod 600 /etc/companion-bridge.env
```

Never paste live values into documentation, issues, commits, screenshots, or
chat transcripts.

### 3. Install the bridge service

```bash
sudo install -m 0755 bridge/server.mjs /opt/cook-anything/bridge/server.mjs
sudo install -m 0644 bridge/companion-bridge.service /etc/systemd/system/companion-bridge.service
sudo systemctl daemon-reload
```

The checked-in unit includes a `ConditionPathExists` safety interlock. It will
not start while `/opt/cook-anything/BRIDGE_DISABLED` exists.

### 4. Tunnel architecture

A named Cloudflare Tunnel on a stable hostname is preferable to a quick tunnel.
Quick tunnels rotate origins and should remain development-only. In either case,
keep the bridge bound to `127.0.0.1`; do not open the bridge port publicly.

The experimental quick-tunnel script can announce an origin to
`POST /api/bridge-origin`, but the Worker rejects that endpoint during Phase 0.

### 5. Worker configuration

Hosted execution has two independent requirements:

1. `HOSTED_COMPANION_ENABLED` must be exactly `"true"`.
2. A valid hosted backend must be configured.

Example for a future controlled environment only:

```jsonc
{
  "vars": {
    "HOSTED_COMPANION_ENABLED": "true",
    "COMPANION_UPSTREAM": "https://companion-bridge.example.com"
  }
}
```

The upstream token remains a Worker secret:

```bash
npx wrangler secret put COMPANION_UPSTREAM_TOKEN
```

A missing or malformed enable value must always fail closed.

## Operations after Phase 1 approval

Future operations must include:

- a dedicated restricted user or container
- a small process concurrency pool
- request and session ownership controls
- IP/user quotas
- temporary photo directories with no broader filesystem visibility
- secret rotation procedures
- log redaction
- monitoring that distinguishes safety shutdown from service failure

Do not remove `/opt/cook-anything/BRIDGE_DISABLED` merely to test availability.
Use a separate private staging environment until every exit condition in
`docs/PHASE-0-CONTAINMENT.md` has been satisfied.

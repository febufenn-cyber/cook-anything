# Subscription bridge — Phase 1 deployment notes

> **Hosted execution remains disabled.** Keep
> `HOSTED_COMPANION_ENABLED="false"` and retain
> `/opt/cook-anything/BRIDGE_DISABLED` until every check in
> `docs/PHASE-1-COMPANION.md` passes in a private staging environment.

The bridge runs a bounded text-only cooking turn through headless Claude Code on
an operator-controlled machine. It is not a public prompt proxy and must never be
reachable directly from the internet.

```text
browser
  └─ narrow session API
       └─ Cloudflare Worker + Durable Objects
            └─ HMAC-signed request through named/private tunnel
                 └─ 127.0.0.1:8788 hardened bridge
                      └─ one stateless claude -p process
```

## What changed from the legacy bridge

Removed:

- browser-provided recipe, state and conversation history
- browser-visible Claude session IDs
- Claude `--resume`
- kitchen-photo files and the Read tool
- bearer-token-only authentication
- automatic quick-tunnel origin publication
- unlimited process spawning
- execution under a general deployment account

Added:

- trusted Worker-generated prompt envelopes
- HMAC-SHA256 body authentication
- timestamp and request-ID replay protection
- strict request schema and size limits
- text-only stateless execution
- one-turn Claude invocation with all tools disabled
- bounded concurrency, output and timeout
- process-group termination on timeout or disconnect
- minimal child-process environment
- hardened systemd service identity and filesystem boundary

## Phase 0 shutdown remains authoritative

To force the bridge off:

```bash
scp bridge/phase0-disable.sh <VPS_HOST>:/tmp/phase0-disable.sh
ssh <VPS_HOST> 'chmod +x /tmp/phase0-disable.sh && sudo /tmp/phase0-disable.sh'
```

The Worker flag is an independent kill switch. A disabled Worker must reject
hosted session creation before recipe lookup or Durable Object creation.

## Dedicated service identity

Create a restricted account and directories. Do not reuse `ubuntu`, a developer
login, or an account that owns unrelated repositories and SSH credentials.

```bash
sudo useradd --system --home-dir /var/lib/companion-bridge \
  --create-home --shell /usr/sbin/nologin companion 2>/dev/null || true
sudo install -d -o companion -g companion -m 0700 /var/lib/companion-bridge
sudo install -d -o companion -g companion -m 0750 /opt/cook-anything/bridge
sudo install -d -o companion -g companion -m 0750 /opt/cook-anything/logs
```

Install Claude Code using current official instructions for this restricted
identity. Keep its authentication material outside the repository. The bridge
must not have access to:

- `/home/*`
- SSH keys
- unrelated source repositories
- cloud credentials
- shell history
- database backups
- deployment secrets other than its own required authentication

## Environment file

Generate a new random HMAC secret:

```bash
openssl rand -hex 32
```

Store it in the Worker:

```bash
npx wrangler secret put COMPANION_UPSTREAM_SIGNING_SECRET
```

Store the identical value in a root-owned VPS environment file:

```bash
sudo tee /etc/companion-bridge.env >/dev/null <<'EOF'
BRIDGE_SIGNING_SECRET=REPLACE_WITH_THE_RANDOM_VALUE
CLAUDE_CODE_OAUTH_TOKEN=REPLACE_OUTSIDE_SOURCE_CONTROL
COMPANION_MODEL=sonnet
CLAUDE_BIN=/usr/local/bin/claude
MAX_CONCURRENCY=2
TURN_TIMEOUT_MS=90000
MAX_BODY_BYTES=300000
MAX_OUTPUT_BYTES=1000000
EOF
sudo chown root:root /etc/companion-bridge.env
sudo chmod 600 /etc/companion-bridge.env
```

The bridge passes only a small allowlist of environment variables to Claude. The
HMAC signing secret is not inherited by child processes.

## Install the bridge service

```bash
sudo install -o companion -g companion -m 0755 \
  bridge/server.mjs /opt/cook-anything/bridge/server.mjs
sudo install -o root -g root -m 0644 \
  bridge/companion-bridge.service /etc/systemd/system/companion-bridge.service
sudo systemctl daemon-reload
```

The checked-in unit applies extensive systemd hardening and refuses to start
while `/opt/cook-anything/BRIDGE_DISABLED` exists.

Validate the unit before any canary:

```bash
systemd-analyze verify /etc/systemd/system/companion-bridge.service
sudo systemctl start companion-bridge
sudo systemctl status companion-bridge --no-pager
sudo journalctl -u companion-bridge -n 100 --no-pager
```

Run these only on isolated staging after deliberately removing the staging
marker. If Claude or Node needs an additional syscall or path, identify that
specific requirement. Do not broadly disable `ProtectHome`, `ProtectSystem`, the
capability boundary, or the syscall filter.

## Tunnel

Use a stable named Cloudflare Tunnel or another private authenticated network
path. The bridge listens only on `127.0.0.1:8788`; do not firewall-open that port.

`bridge/companion-tunnel.sh` is retained for explicit development use only. It:

- refuses to run during Phase 0
- requires `ALLOW_INSECURE_QUICK_TUNNEL=true`
- does not publish an origin to the Worker

The production Worker no longer consumes KV-discovered quick-tunnel origins, and
`POST /api/bridge-origin` is permanently gone.

Configure the stable origin only in the Worker environment:

```jsonc
{
  "vars": {
    "HOSTED_COMPANION_ENABLED": "false",
    "COMPANION_UPSTREAM": "https://private-companion.example.com"
  }
}
```

Cloudflare Access or the private network is the outer transport boundary. HMAC
verification inside the bridge remains mandatory even when the tunnel is
private.

## Health and protocol

Local health check:

```bash
curl --fail http://127.0.0.1:8788/health
```

A turn requires these headers:

```text
X-Request-Id
X-Timestamp
X-Body-SHA256
X-Signature
```

The body contains only the Worker-generated system text, validated state,
bounded server-owned history and newest user message. The bridge accepts no
model, tool, path, image, recipe authority or Claude session identifier from the
browser.

Do not create a manual curl command containing the live HMAC secret. Use an
automated staging test that computes a fresh signature and redacts credentials.

## Operations

- Keep default bridge and Worker concurrency equal at two during canary.
- Alert on authentication failures, replay attempts, timeouts and saturation.
- Log request IDs, duration, status and process exit outcomes only.
- Do not log full prompts, messages, state, OAuth material or HMAC secrets.
- Rotate both copies of the signing secret together.
- Re-run the Phase 0 shutdown drill after every deployment change.
- Never re-enable production directly; progress through operator-only staging and
  invited canary traffic.

The complete architecture, API contract and exit checklist are in
`docs/PHASE-1-COMPANION.md`.

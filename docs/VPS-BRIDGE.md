# Subscription bridge — run the companion on a Claude Max plan (no API key)

The Anthropic Messages API rejects Max-subscription OAuth tokens, so the
legitimate way to power the companion with a subscription is to run each turn
through **headless Claude Code** on a box you control. `bridge/server.mjs`
does exactly that; the Cloudflare Worker proxies `/api/companion` to it when
`COMPANION_UPSTREAM` is set.

```
browser ──> worker /api/companion ──> VPS bridge (:8788, localhost)
                                        └─ claude -p  (subscription auth)
```

Trade-offs vs an API key: turns share your plan's 5-hour session windows with
your other Claude Code usage (mid-cook rate-limiting is possible), and each
turn pays ~2-4s of CLI startup latency. Photos work (written to temp files,
viewed with Claude Code's Read tool).

## 1. VPS: install Claude Code + authenticate browserless

```bash
# native installer, no Node needed for the CLI itself
curl -fsSL https://claude.ai/install.sh | bash

# browserless OAuth: prints a URL — open it on your phone/laptop, sign in to
# the Max account, paste the code back into the terminal. Copy the printed
# long-lived token (sk-ant-oat01-…).
claude setup-token
```

The bridge itself needs Node 20+ (`sudo apt install -y nodejs` or fnm).

## 2. VPS: install the bridge

```bash
sudo useradd -r -m -d /opt/cook-anything companion 2>/dev/null || true
sudo -u companion git clone https://github.com/febufenn-cyber/cook-anything /opt/cook-anything

sudo tee /etc/companion-bridge.env >/dev/null <<EOF
BRIDGE_TOKEN=$(openssl rand -hex 24)
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-PASTE-THE-TOKEN-HERE
COMPANION_MODEL=sonnet
CLAUDE_BIN=/opt/cook-anything/.local/bin/claude   # wherever install.sh put it (`which claude`)
EOF
sudo chmod 600 /etc/companion-bridge.env

sudo cp /opt/cook-anything/bridge/companion-bridge.service /etc/systemd/system/
sudo systemctl enable --now companion-bridge
curl -s localhost:8788/health   # -> {"ok":true}
```

## 3. VPS: expose it via Cloudflare Tunnel (no open ports, free TLS)

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared

cloudflared tunnel login                       # pick the robofox.online zone
cloudflared tunnel create companion-bridge
cloudflared tunnel route dns companion-bridge companion-bridge.robofox.online

sudo tee /etc/cloudflared/config.yml >/dev/null <<EOF
tunnel: companion-bridge
credentials-file: /root/.cloudflared/$(cloudflared tunnel list | awk '/companion-bridge/{print $1}').json
ingress:
  - hostname: companion-bridge.robofox.online
    service: http://localhost:8788
  - service: http_status:404
EOF
sudo cloudflared service install && sudo systemctl enable --now cloudflared
```

## 4. Local repo: point the Worker at the bridge

```bash
# same value you generated into /etc/companion-bridge.env
npx wrangler secret put COMPANION_UPSTREAM_TOKEN
```

Then add to `wrangler.jsonc` and `npm run deploy`:

```jsonc
"vars": { "COMPANION_UPSTREAM": "https://companion-bridge.robofox.online" }
```

Backend priority in the shipped code: user's own key (⚙️ BYOK, straight from
their browser) → `COMPANION_UPSTREAM` bridge → hosted `ANTHROPIC_API_KEY` →
`not_configured`.

## Operations

- Logs: `journalctl -u companion-bridge -f`
- Rotate the OAuth token: rerun `claude setup-token`, update
  `/etc/companion-bridge.env`, `sudo systemctl restart companion-bridge`.
- Hitting session limits mid-cook returns `rate_limited`; the UI shows a
  friendly retry message. If that annoys you, this is the signal to switch to
  a hosted API key.

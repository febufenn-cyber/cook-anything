#!/bin/bash
# Quick tunnel for the companion bridge: exposes localhost:8788 via
# *.trycloudflare.com and announces the current origin to the cook-anything
# Worker (POST /api/bridge-origin, authed by the shared BRIDGE_TOKEN), which
# persists it to its COMPANION_CONFIG KV — so /api/companion always proxies
# to the live tunnel. No Cloudflare credentials needed on this box at all:
# no zone cert, no API token, no wrangler. Survives URL rotation on restart.
#
# Env (from /etc/companion-bridge.env via systemd): BRIDGE_TOKEN (required),
# PORT, WORKER_URL, TUNNEL_LOG.
set -u
BRIDGE_PORT="${PORT:-8788}"
WORKER_URL="${WORKER_URL:-https://cook-anything.robofox.online}"
LOG="${TUNNEL_LOG:-/opt/cook-anything/logs/tunnel.log}"
mkdir -p "$(dirname "$LOG")"

published=""
/usr/local/bin/cloudflared tunnel --url "http://localhost:${BRIDGE_PORT}" --no-autoupdate 2>&1 | \
while IFS= read -r line; do
  printf '%s\n' "$line" >> "$LOG"
  case "$line" in
    *trycloudflare.com*)
      url=$(printf '%s' "$line" | grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | head -1)
      if [ -n "$url" ] && [ "$url" != "$published" ]; then
        if curl -fsS -X POST "$WORKER_URL/api/bridge-origin" \
             -H "x-bridge-token: ${BRIDGE_TOKEN}" \
             -H "content-type: application/json" \
             -d "{\"origin\":\"$url\"}" >> "$LOG" 2>&1; then
          published="$url"
          printf '\n== published companion origin %s\n' "$url" >> "$LOG"
        else
          printf '\n== FAILED to publish %s (will retry on next log line)\n' "$url" >> "$LOG"
        fi
      fi
      ;;
  esac
done

#!/bin/bash
# Development-only quick tunnel. Phase 1 production traffic must use a stable,
# private/named tunnel and the Worker no longer accepts origin publication.
set -eu

BRIDGE_PORT="${PORT:-8788}"
LOG="${TUNNEL_LOG:-/opt/cook-anything/logs/tunnel.log}"
DISABLE_MARKER=/opt/cook-anything/BRIDGE_DISABLED
mkdir -p "$(dirname "$LOG")"

if [ -e "$DISABLE_MARKER" ]; then
  printf '%s quick tunnel blocked: %s exists\n' "$(date -u +%FT%TZ)" "$DISABLE_MARKER" >> "$LOG"
  exit 0
fi

if [ "${ALLOW_INSECURE_QUICK_TUNNEL:-false}" != "true" ]; then
  printf '%s quick tunnel blocked: use a named/private tunnel for Phase 1\n' "$(date -u +%FT%TZ)" >> "$LOG"
  exit 1
fi

printf '%s WARNING: starting development-only quick tunnel; origin is not published to the Worker\n' \
  "$(date -u +%FT%TZ)" >> "$LOG"
exec /usr/local/bin/cloudflared tunnel --url "http://localhost:${BRIDGE_PORT}" --no-autoupdate >> "$LOG" 2>&1

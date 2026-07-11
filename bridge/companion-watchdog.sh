#!/bin/bash
# Phase 1 watchdog. It never discovers, publishes, or revives a quick tunnel.
# A stable private tunnel may be checked only when an operator explicitly names
# its systemd service and private health URL in the watchdog environment file.
set -u

LOG=/opt/cook-anything/logs/watchdog.log
DISABLE_MARKER=/opt/cook-anything/BRIDGE_DISABLED
WATCHDOG_ENV=/etc/companion-bridge-watchdog.env
LOCAL_HEALTH_URL="${LOCAL_HEALTH_URL:-http://127.0.0.1:8788/health}"
PRIVATE_HEALTH_URL="${PRIVATE_HEALTH_URL:-}"
PRIVATE_TUNNEL_SERVICE="${PRIVATE_TUNNEL_SERVICE:-}"

if [ -r "$WATCHDOG_ENV" ]; then
  # shellcheck disable=SC1090
  . "$WATCHDOG_ENV"
fi

mkdir -p "$(dirname "$LOG")"
note() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$1" >> "$LOG"; }

# Safety shutdown always beats availability recovery.
if [ -e "$DISABLE_MARKER" ]; then
  exit 0
fi

if ! curl -fsS -m 5 "$LOCAL_HEALTH_URL" >/dev/null 2>&1; then
  note "local bridge health failed — restarting companion-bridge"
  systemctl restart companion-bridge
fi

# Private transport recovery is opt-in. Never infer an origin from logs and
# never start the development-only companion-tunnel service automatically.
if [ -n "$PRIVATE_HEALTH_URL" ] && [ -n "$PRIVATE_TUNNEL_SERVICE" ]; then
  if ! curl -fsS -m 10 "$PRIVATE_HEALTH_URL" >/dev/null 2>&1; then
    note "private transport health failed — restarting configured service"
    systemctl restart "$PRIVATE_TUNNEL_SERVICE"
  fi
fi

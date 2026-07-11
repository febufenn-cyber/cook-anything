#!/bin/bash
# Phase 0 emergency containment for the hosted Cooking Companion bridge.
# Run on the VPS as root (or normally; the script will sudo itself).
#
# This is deliberately idempotent. It creates a persistent safety marker first,
# then stops/disables every known bridge-related systemd unit. The watchdog and
# tunnel scripts also honor the marker, so cron or an accidental restart cannot
# bring hosted execution back online.
set -euo pipefail

ROOT=/opt/cook-anything
DISABLE_MARKER="$ROOT/BRIDGE_DISABLED"

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo "$0" "$@"
fi

install -d -m 0755 "$ROOT"
printf 'disabled_at=%s\nreason=phase0_containment\n' "$(date -u +%FT%TZ)" > "$DISABLE_MARKER"
chmod 0644 "$DISABLE_MARKER"

echo "Created safety marker: $DISABLE_MARKER"

for unit in companion-watchdog companion-tunnel companion-bridge; do
  if systemctl list-unit-files "${unit}.service" --no-legend 2>/dev/null | grep -q "^${unit}\.service"; then
    systemctl disable --now "${unit}.service" || true
    echo "Stopped and disabled ${unit}.service"
  fi
done

# A cron-installed companion-watchdog.sh may still run, but it exits immediately
# while BRIDGE_DISABLED exists. Show matching entries so the operator can remove
# them later without this script editing unrelated crontabs automatically.
for user in root ubuntu companion; do
  if id "$user" >/dev/null 2>&1; then
    matches=$(crontab -u "$user" -l 2>/dev/null | grep 'companion-watchdog\.sh' || true)
    if [ -n "$matches" ]; then
      echo "Watchdog cron remains inert for user $user:"
      echo "$matches"
    fi
  fi
done

echo
echo "Hosted bridge containment is active on this VPS."
echo "The Cloudflare Worker must also be deployed with HOSTED_COMPANION_ENABLED=false."
echo "Do not remove $DISABLE_MARKER until the Phase 1 security exit conditions are complete."

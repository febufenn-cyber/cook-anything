#!/bin/bash
# Emergency containment for every hosted Cooking Companion execution path.
# Run on the VPS as root (or normally; the script will sudo itself).
set -euo pipefail

ROOT=/opt/cook-anything
DISABLE_MARKER="$ROOT/BRIDGE_DISABLED"
WATCHDOG_ENV=/etc/companion-bridge-watchdog.env
PRIVATE_TUNNEL_SERVICE="${PRIVATE_TUNNEL_SERVICE:-}"

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo "$0" "$@"
fi

# Only source the root-controlled operational file. It may name the stable
# private tunnel service that must be stopped alongside the bridge.
if [ -r "$WATCHDOG_ENV" ]; then
  # shellcheck disable=SC1090
  . "$WATCHDOG_ENV"
fi
if [ -n "$PRIVATE_TUNNEL_SERVICE" ] && ! [[ "$PRIVATE_TUNNEL_SERVICE" =~ ^[A-Za-z0-9@_.-]+$ ]]; then
  echo "Refusing unsafe PRIVATE_TUNNEL_SERVICE value" >&2
  exit 1
fi

install -d -m 0755 "$ROOT"
printf 'disabled_at=%s\nreason=emergency_containment\n' "$(date -u +%FT%TZ)" > "$DISABLE_MARKER"
chmod 0644 "$DISABLE_MARKER"
echo "Created safety marker: $DISABLE_MARKER"

units=(companion-watchdog companion-tunnel companion-bridge)
if [ -n "$PRIVATE_TUNNEL_SERVICE" ]; then
  units+=("${PRIVATE_TUNNEL_SERVICE%.service}")
fi

for unit in "${units[@]}"; do
  if systemctl list-unit-files "${unit}.service" --no-legend 2>/dev/null | grep -q "^${unit}\.service"; then
    systemctl disable --now "${unit}.service" || true
    echo "Stopped and disabled ${unit}.service"
  fi
done

# A cron-installed watchdog may still run, but it exits immediately while the
# marker exists. Show matching entries without editing unrelated crontabs.
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
echo "Do not remove $DISABLE_MARKER until the Phase 1 exit conditions are complete."

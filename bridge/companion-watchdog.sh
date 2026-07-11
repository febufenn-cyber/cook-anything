#!/bin/bash
# Watchdog for the companion bridge + tunnel (cron every 5 min). systemd's
# Restart=always already revives crashed processes and reboots; this catches
# what systemd can't see — a hung bridge, a zombie tunnel, or a published
# origin that no longer routes. The one failure it cannot fix is an expired
# Claude subscription login (re-auth with the vps-claude-oauth flow).
set -u
LOG=/opt/cook-anything/logs/watchdog.log
note() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$1" >> "$LOG"; }

# 1. Bridge answering locally?
if ! curl -fsS -m 5 localhost:8788/health >/dev/null 2>&1; then
  note "bridge health failed — restarting companion-bridge"
  sudo systemctl restart companion-bridge
fi

# 2. Tunnel end-to-end: the last announced origin must still serve /health.
origin=$(grep -a "published companion origin" /opt/cook-anything/logs/tunnel.log 2>/dev/null \
  | tail -1 | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com')
if [ -z "$origin" ] || ! curl -fsS -m 10 "$origin/health" >/dev/null 2>&1; then
  note "tunnel check failed (origin: ${origin:-none}) — restarting companion-tunnel"
  sudo systemctl restart companion-tunnel
fi

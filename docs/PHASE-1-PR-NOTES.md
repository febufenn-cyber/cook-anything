# Phase 1 review notes

This branch rebuilds the hosted companion as a bounded cooking-session service.
It deliberately leaves `HOSTED_COMPANION_ENABLED="false"`.

## Review focus

- Browser hosted requests contain only a recipe ID at session creation and one
  text message plus idempotency key per turn.
- Recipe snapshots, conversation history and state are server-owned.
- Durable Objects serialize turns, preserve at-most-once semantics, expire
  inactive sessions and enforce global execution/daily limits.
- Model state is schema-validated and transition-validated before commit.
- Prompt JSON cannot close application delimiters.
- Worker-to-bridge traffic is HMAC-signed and replay-protected.
- The bridge is stateless, text-only, tool-free and process-bounded.
- Phase 0 shutdown remains authoritative.

## Do not enable hosted mode during review

A green build proves code integration only. Public enablement still requires the
private-tunnel, dedicated-user, HMAC, process-termination, rate-limit, retention,
privacy and canary evidence listed in `docs/PHASE-1-COMPANION.md`.

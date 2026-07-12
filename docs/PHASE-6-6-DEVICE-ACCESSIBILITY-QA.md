# Phase 6.6 — Device and accessibility QA

Canonical matrix for the anonymous local product. Environments are labeled
truthfully: `real-engine automated` (Playwright Chromium on macOS against the
deployed staging origin), `emulation` (viewport/device emulation — never
counted as a device pass), `blocked` (no physical device/AT available to this
agent). Machine-readable results: `evidence/phase-6-6/device-matrix.json` and
`evidence/phase-6-6/qa-browser-results.json`.

## Matrix

| Row | Environment | Status |
| --- | --- | --- |
| Recent iPhone Safari (full A2/A3 flows) | physical device | **blocked — physical device unavailable** |
| Oldest supported iPhone Safari | physical device | **blocked — physical device unavailable** |
| iPhone PWA install + lock-screen Cook Mode | physical device | **blocked — physical device unavailable** |
| Recent Android Chrome | physical device | **blocked — physical device unavailable** |
| Android PWA install | physical device | **blocked — physical device unavailable** |
| VoiceOver (iOS/macOS), TalkBack, NVDA | assistive tech, manual | **blocked — no screen-reader pass possible from agent environment** |
| macOS Safari | real browser, manual | **blocked this phase** (drivable via computer-use in a follow-up; not attempted to conserve scope) |
| Firefox desktop | real browser | **blocked this phase** (binary not installed; Playwright firefox available as follow-up) |
| Desktop Chromium — core flows (A2 subset) | real-engine automated | see `qa-browser-results.json` |
| Desktop Chromium — keyboard-only | real-engine automated | see `qa-browser-results.json` |
| Desktop Chromium — offline/PWA (A3 subset) | real-engine automated | see `qa-browser-results.json` |
| 200% zoom / no horizontal scroll | real-engine automated (viewport approximation) | see `qa-browser-results.json` |
| Reduced motion | real-engine automated (`prefers-reduced-motion: reduce`) | see `qa-browser-results.json` |
| axe-core scans (4 pages) | automated supplement — never replaces manual AT testing | see `qa-browser-results.json` |

## What the automated pass covers (A2/A3 subset)

homepage · ingredient entry · Tamil/Hinglish aliases (`thayir`, `pyaz`) ·
typo handling · recipe matching + links · recipe page · Cook Mode open/advance/
timer/Escape · kitchen, account (local-only), my-recipes routes · keyboard tab
order + visible focus · service-worker registration · offline reload of home +
cached recipe · reconnection · reduced-motion load · axe scans.

Not covered by automation (needs humans/devices): phone lock/unlock during
Cook Mode, backgrounding recovery, PWA install UX, private-mode/quota-exceeded
IndexedDB behavior, screen-reader semantics, real touch-target feel, real
device performance numbers.

## Canary A gate (from the mission definition)

Requires: one real iPhone pass, one real Android pass, one desktop keyboard
pass, one screen-reader pass, offline/PWA recovery verified, no unresolved
critical accessibility/data-loss defect. Only the desktop keyboard pass and
automated offline verification exist; iPhone/Android/screen-reader rows are
blocked. **Verdict: NO-GO for Canary A until the blocked rows are run by a
human with devices** (estimated: one person, ~2 hours with this document).

#!/usr/bin/env node
/**
 * Phase 6.5 deployed-endpoint smoke test.
 *
 * Runs against a DEPLOYED origin (staging by default) and verifies the
 * behaviors Phase 6.5 requires before any environment promotion:
 * security headers, cache boundaries, trust/search assets, service worker,
 * fail-closed hosted companion (no session cookie, no Durable Object
 * session), and absence of secret material in served JavaScript bundles.
 *
 * Usage:
 *   node scripts/staging-smoke-test.mjs https://cook-anything-staging.robofox.online
 *   node scripts/staging-smoke-test.mjs            # defaults to staging origin
 *
 * Exits non-zero on any failure. Prints a machine-readable JSON summary on
 * the last line for the evidence ledger.
 */

const ORIGIN = (process.argv[2] ?? "https://cook-anything-staging.robofox.online").replace(/\/$/, "");

const results = [];
let failures = 0;

function record(id, passed, detail) {
  results.push({ id, status: passed ? "passed" : "failed", detail });
  if (!passed) failures += 1;
  console.log(`${passed ? "PASS" : "FAIL"}  ${id}${detail ? ` — ${detail}` : ""}`);
}

async function get(path, init) {
  return fetch(`${ORIGIN}${path}`, { redirect: "manual", ...init });
}

function headerIncludes(response, name, needle) {
  const value = response.headers.get(name) ?? "";
  return needle instanceof RegExp ? needle.test(value) : value.includes(needle);
}

// --- 1. Homepage availability + full security-header suite -------------------
const home = await get("/");
record("home-200", home.status === 200, `status ${home.status}`);
const REQUIRED_HEADERS = [
  ["content-security-policy", "default-src 'self'"],
  ["content-security-policy", "frame-ancestors 'none'"],
  ["content-security-policy", "object-src 'none'"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
  ["permissions-policy", "geolocation=()"],
  ["cross-origin-opener-policy", "same-origin"],
  ["cross-origin-resource-policy", "same-origin"],
  ["strict-transport-security", "max-age=31536000"],
];
for (const [name, needle] of REQUIRED_HEADERS) {
  record(`header:${name}:${needle.slice(0, 24)}`, headerIncludes(home, name, needle),
    `got: ${(home.headers.get(name) ?? "<missing>").slice(0, 120)}`);
}

// --- 2. Core routes and trusted assets ---------------------------------------
const homeHtml = await home.text();
const recipeMatch = homeHtml.match(/href="\/recipes\/([a-z0-9-]+)/);
const recipeSlug = recipeMatch?.[1] ?? "tamil-adai";
for (const [id, path, type] of [
  ["recipe-page", `/recipes/${recipeSlug}/`, "text/html"],
  ["search-index", "/search-index.json", "application/json"],
  ["trust-manifest", "/trust-manifest.json", "application/json"],
  ["kitchen-dashboard", "/kitchen/", "text/html"],
  ["account-page", "/account/", "text/html"],
  ["review-route", "/review/", "text/html"],
  ["service-worker", "/sw.js", "javascript"],
]) {
  const response = await get(path);
  record(id, response.status === 200 && headerIncludes(response, "content-type", type),
    `status ${response.status}, type ${response.headers.get("content-type")}`);
}

// --- 3. Cache boundaries ------------------------------------------------------
const swResponse = await get("/sw.js");
record("sw-not-immutable", !headerIncludes(swResponse, "cache-control", "immutable"),
  `cache-control: ${swResponse.headers.get("cache-control")}`);
const assetMatch = homeHtml.match(/src="(\/_next\/static\/[^"]+\.js)"/);
if (assetMatch) {
  const asset = await get(assetMatch[1]);
  record("static-asset-long-cache", headerIncludes(asset, "cache-control", /max-age=\d{5,}/),
    `cache-control: ${asset.headers.get("cache-control")}`);
} else {
  record("static-asset-long-cache", false, "no _next/static asset found in homepage HTML");
}

// --- 4. Hosted companion is fail-closed (disabled, no session, no cookie) ----
const sessionCreate = await get("/api/companion/session", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ recipe_id: recipeSlug }),
});
const sessionBody = await sessionCreate.json().catch(() => null);
record("companion-session-disabled",
  sessionCreate.status === 503 && sessionBody?.error === "not_configured",
  `status ${sessionCreate.status}, error ${sessionBody?.error}`);
record("companion-session-no-cookie", !sessionCreate.headers.get("set-cookie"),
  `set-cookie: ${sessionCreate.headers.get("set-cookie") ?? "<none>"}`);
record("companion-api-no-store", headerIncludes(sessionCreate, "cache-control", "no-store"),
  `cache-control: ${sessionCreate.headers.get("cache-control")}`);
const turn = await get("/api/companion/turn", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ message: "hi" }),
});
const turnBody = await turn.json().catch(() => null);
record("companion-turn-disabled", turn.status === 503 && turnBody?.error === "not_configured",
  `status ${turn.status}, error ${turnBody?.error}`);

// --- 5. Served bundles contain no secret material -----------------------------
const bundlePaths = [...new Set([...homeHtml.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))].slice(0, 12);
const SECRET_PATTERNS = [
  /sk-ant-[a-zA-Z0-9_-]{8,}/,
  /sk-[a-zA-Z0-9]{20,}/,
  /service_role/i,
  /BRIDGE_SIGNING_SECRET\s*[:=]\s*["'][^"']+/,
  // JWTs are checked separately below: the publishable anon key is browser-safe
  // by design; only privileged-role JWTs (service_role) are secrets.
  /ghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
];
let bundleFinding = "";
for (const path of bundlePaths) {
  const source = await (await get(path)).text();
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(source)) bundleFinding = `${path} matches ${pattern}`;
  }
  for (const jwt of source.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g) ?? []) {
    try {
      const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
      if (payload.role && payload.role !== "anon") bundleFinding = `${path} contains a ${payload.role} JWT`;
    } catch { bundleFinding = `${path} contains an undecodable JWT`; }
  }
}
record("bundles-no-secrets", bundleFinding === "", bundleFinding || `${bundlePaths.length} bundles scanned`);

// --- Summary ------------------------------------------------------------------
const summary = {
  id: "staging-smoke-test",
  origin: ORIGIN,
  generatedAt: new Date().toISOString(),
  total: results.length,
  failed: failures,
  status: failures === 0 ? "passed" : "failed",
  results,
};
console.log(JSON.stringify(summary));
process.exit(failures === 0 ? 0 : 1);

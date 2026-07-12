#!/usr/bin/env node
/**
 * Phase 6.6 credential-free CI checks:
 *  - evidence result files exist and are valid JSON with required keys
 *  - migration list 000100–000700 present in order
 *  - no production Supabase URL / service-role pattern in committed fixtures
 *  - feature flags default safely in wrangler.jsonc (hosted companion false)
 *  - the operator-resumption test only ever targets a non-production repo
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";

let failures = 0;
const fail = (m) => { console.error("FAIL " + m); failures += 1; };
const ok = (m) => console.log("ok   " + m);

// 1. required evidence files parse as JSON
const required = [
  "evidence/phase-6-6/ledger.json",
  "evidence/phase-6-6/device-matrix.json",
  "evidence/phase-6-6/qa-browser-results.json",
  "evidence/phase-6-6/publication-operator-results.json",
  "evidence/phase-6-6/supabase-staging-results.json",
  "evidence/phase-6-6/rls-matrix-results.json",
  "evidence/phase-6-6/sync-chaos-results.json",
  "evidence/phase-6-6/deletion-drill-results.json",
  "evidence/phase-6-6/restore-drill-results.json",
];
for (const f of required) {
  if (!existsSync(f)) { fail(`missing evidence file ${f}`); continue; }
  try { JSON.parse(readFileSync(f, "utf8")); ok(`valid JSON ${f}`); }
  catch { fail(`invalid JSON ${f}`); }
}
const ledger = existsSync("evidence/phase-6-6/ledger.json") ? JSON.parse(readFileSync("evidence/phase-6-6/ledger.json", "utf8")) : {};
if (!Array.isArray(ledger.checks) || !Array.isArray(ledger.blockers)) fail("ledger must have checks[] and blockers[]");
else ok(`ledger: ${ledger.checks.length} checks, ${ledger.blockers.length} blockers`);

// 2. migration list 000100–000700 in order
const migs = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
const expected = ["000100", "000200", "000300", "000400", "000500", "000600", "000700"];
const seq = migs.map((m) => m.match(/20260712(\d{6})/)?.[1]).filter(Boolean);
if (JSON.stringify(seq) === JSON.stringify(expected)) ok("migrations 000100-000700 present in order");
else fail(`migration sequence mismatch: ${JSON.stringify(seq)}`);

// 3. no production-ish Supabase URL or service-role JWT in committed evidence/fixtures
const SECRETS = [
  /https:\/\/[a-z0-9]{20}\.supabase\.co/,          // a real hosted project URL
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWT
  /service_role[^A-Za-z]{0,3}(key|=)/i,
];
for (const f of required.filter(existsSync)) {
  const text = readFileSync(f, "utf8");
  for (const re of SECRETS) if (re.test(text)) fail(`possible secret/prod-URL pattern in ${f}: ${re}`);
}
ok("no secret/prod-Supabase-URL patterns in evidence files");

// 4. wrangler flags default safe
const wrangler = readFileSync("wrangler.jsonc", "utf8");
if (/"HOSTED_COMPANION_ENABLED":\s*"false"/.test(wrangler)) ok("HOSTED_COMPANION_ENABLED defaults false");
else fail("HOSTED_COMPANION_ENABLED is not defaulting to false");

// 5. operator resumption test refuses the production repo
const opTest = readFileSync("scripts/test-publication-operator-resumption.mjs", "utf8");
if (/notEqual\(STAGING_PUB_REPO, "febufenn-cyber\/cook-anything"/.test(opTest))
  ok("operator resumption test guards against the production repo");
else fail("operator resumption test missing production-repo guard");

console.log(failures === 0 ? "\nPhase 6.6 evidence checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

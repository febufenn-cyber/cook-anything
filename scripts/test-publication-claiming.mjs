#!/usr/bin/env node
/**
 * Publication-candidate claiming: concurrency + crash-recovery tests.
 *
 * Requires a LIVE Supabase stack (local `supabase start` or a staging
 * project) — exits 0 with a skip notice when credentials are absent, so
 * public CI never needs live infrastructure.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   PGEXEC="docker exec supabase_db_xxx psql -U postgres -d postgres -tAc" \
 *     node scripts/test-publication-claiming.mjs
 *
 * Proves: atomic ready->claimed (N parallel claims, exactly one winner);
 * claim token required + single-use; expired claims recoverable; a stale
 * (expired/crashed) worker's token can never record a PR; no duplicate PRs.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";

const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PGEXEC = process.env.PGEXEC ?? "";
if (!SUPABASE_URL || !SERVICE_KEY || !PGEXEC) {
  console.log("SKIP publication-claiming tests: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / PGEXEC not set (live stack required).");
  process.exit(0);
}

const sql = (query) =>
  execSync(`${PGEXEC} ${JSON.stringify(query.replace(/\s+/g, " ").trim())}`)
    .toString().trim().split("\n")[0].trim();

async function rpc(name, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

// ---- fixture: user -> draft -> version -> submission -> candidate ----------
const admin = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" },
  body: JSON.stringify({ email: `claim-test-${randomUUID().slice(0, 8)}@test.local`, password: `pw-${randomUUID()}`, email_confirm: true }),
});
const userId = (await admin.json()).id;
assert.ok(userId, "fixture user created");

const hash = createHash("sha256").update(randomUUID()).digest("hex");
const slug = `claim-test-${randomUUID().slice(0, 8)}`;
const candidateId = sql(`
  with d as (
    insert into recipe_drafts (owner_id, scope_type, scope_id, title, status)
    values ('${userId}', 'personal', '${userId}', 'Claim test', 'ready_for_submission') returning id
  ), v as (
    insert into recipe_draft_versions (draft_id, version_number, content_hash, content, created_by)
    select id, 1, '${hash}', '{"title":"Claim test"}'::jsonb, '${userId}' from d returning id, draft_id
  ), s as (
    insert into recipe_submissions (draft_id, version_id, content_hash, status, contributor_id)
    select draft_id, id, '${hash}', 'publication_candidate', '${userId}' from v returning id, version_id
  )
  insert into publication_candidates (submission_id, version_id, content_hash, canonical_slug, candidate_json, status, created_by)
  select id, version_id, '${hash}', '${slug}', jsonb_build_object('contentHash', '${hash}'), 'ready', '${userId}' from s
  returning id;`);
assert.match(candidateId, /^[0-9a-f-]{36}$/, `candidate fixture created: ${candidateId}`);

// ---- 1. concurrency: 8 parallel claims, exactly one winner -----------------
const attempts = await Promise.all(Array.from({ length: 8 }, () => rpc("claim_publication_candidate", { p_candidate_id: candidateId })));
const winners = attempts.filter((a) => a.ok);
const losers = attempts.filter((a) => !a.ok);
assert.equal(winners.length, 1, `exactly one concurrent claim must win (got ${winners.length})`);
assert.ok(losers.every((l) => JSON.stringify(l.data).includes("publication_candidate_already_claimed")
  || JSON.stringify(l.data).includes("publication_candidate_not_ready")), "losers rejected cleanly");
const token = winners[0].data.claimToken;
assert.equal(winners[0].data.status, "claimed");
assert.ok(typeof token === "string" && token.length >= 48, "claim token issued");
assert.ok(!sql(`select claim_token_hash from publication_candidates where id='${candidateId}'`).includes(token),
  "raw token is never stored in the database");
console.log("PASS concurrency: 1 winner / 7 clean rejections, token issued, only hash stored");

// ---- 2. token required + wrong token rejected -------------------------------
const prUrl = "https://github.com/febufenn-cyber/cook-anything-staging-pub/pull/1";
const noToken = await rpc("mark_publication_candidate_pr", { p_candidate_id: candidateId, p_github_pr_url: prUrl, p_claim_token: "short" });
assert.ok(!noToken.ok && JSON.stringify(noToken.data).includes("claim_token_required"), "short/missing token rejected");
const wrongToken = await rpc("mark_publication_candidate_pr", { p_candidate_id: candidateId, p_github_pr_url: prUrl, p_claim_token: "x".repeat(48) });
assert.ok(!wrongToken.ok && JSON.stringify(wrongToken.data).includes("claim_token_mismatch"), "wrong token rejected");
console.log("PASS token gate: missing + mismatched tokens rejected");

// ---- 3. crash recovery: expire the claim, reclaim, stale token dead --------
sql(`update publication_candidates set claim_expires_at = now() - interval '1 minute' where id='${candidateId}'`);
const staleMark = await rpc("mark_publication_candidate_pr", { p_candidate_id: candidateId, p_github_pr_url: prUrl, p_claim_token: token });
assert.ok(!staleMark.ok && JSON.stringify(staleMark.data).includes("claim_expired"), "expired claim cannot record a PR");
const reclaim = await rpc("claim_publication_candidate", { p_candidate_id: candidateId });
assert.ok(reclaim.ok && reclaim.data.claimToken && reclaim.data.claimToken !== token, "expired claim recovered by a new worker with a NEW token");
const oldTokenAfterReclaim = await rpc("mark_publication_candidate_pr", { p_candidate_id: candidateId, p_github_pr_url: prUrl, p_claim_token: token });
assert.ok(!oldTokenAfterReclaim.ok, "crashed worker's old token is dead after recovery");
console.log("PASS crash recovery: expiry blocks stale worker; reclaim issues fresh token");

// ---- 4. successful record + duplicate-PR prevention -------------------------
const mark = await rpc("mark_publication_candidate_pr", { p_candidate_id: candidateId, p_github_pr_url: prUrl, p_claim_token: reclaim.data.claimToken });
assert.ok(mark.ok && mark.data.ok, `valid token records the PR: ${JSON.stringify(mark.data)}`);
const duplicate = await rpc("mark_publication_candidate_pr", { p_candidate_id: candidateId, p_github_pr_url: prUrl.replace("/1", "/2"), p_claim_token: reclaim.data.claimToken });
assert.ok(!duplicate.ok && JSON.stringify(duplicate.data).includes("publication_candidate_not_claimed"), "second PR for the same candidate rejected");
const reclaimAfterPr = await rpc("claim_publication_candidate", { p_candidate_id: candidateId });
assert.ok(!reclaimAfterPr.ok, "pr_open candidate can never be reclaimed");
console.log("PASS duplicate prevention: one PR per candidate, pr_open is terminal for claiming");

// ---- 5. janitor -------------------------------------------------------------
const janitor = await rpc("recover_expired_publication_claims", {});
assert.ok(janitor.ok && typeof janitor.data.recovered === "number", "janitor callable");
console.log("PASS janitor: recover_expired_publication_claims operational");

// cleanup fixture user (cascades are restricted on candidates — leave rows; local stack only)
console.log("Publication-claiming tests passed.");

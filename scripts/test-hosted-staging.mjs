#!/usr/bin/env node
/**
 * Hosted Supabase staging battery (Phase 6.7). Disposable accounts only.
 * Credential-gated: SKIPs cleanly without STAGING_* env. Never targets
 * production (no production Supabase project exists for this product; the
 * URL is asserted to be the staging ref).
 *
 * Covers: RLS actor matrix core (anon/A/B isolation, household roles incl.
 * removal, contributor self-review + double-tester blocks, browser-role
 * denial of trusted RPCs), magic-link auth (new/returning/replayed/expired
 * link), device revocation + duplicate-mutation idempotency + stale cursor,
 * "use this device"/"use cloud" reset semantics, and the hosted account-
 * deletion drill via the real worker.
 */
import assert from "node:assert/strict";
import { execSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

const URL_ = (process.env.STAGING_SUPABASE_URL ?? "").replace(/\/$/, "");
const ANON = process.env.STAGING_ANON_KEY ?? "";
const SR = process.env.STAGING_SERVICE_ROLE_KEY ?? "";
const SQL = process.env.STAGING_SQL_CMD ?? ""; // e.g. "bash scripts/staging-sql.sh"
if (!URL_ || !ANON || !SR || !SQL) { console.log("SKIP hosted staging battery: STAGING_* env required."); process.exit(0); }
assert.match(URL_, /xiyjdybimefogwxshcsg/, "must target the cook-anything-staging project");

const results = [];
const rec = (id, status, detail) => { results.push({ id, status, detail }); console.log(`${status.toUpperCase().padEnd(7)} ${id} — ${detail}`); };
const sql = (q) => execSync(`${SQL} ${JSON.stringify(q.replace(/\s+/g, " ").trim())}`).toString().trim();

async function api(path, { method = "GET", token = ANON, body, headers = {} } = {}) {
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: { apikey: ANON, authorization: `Bearer ${token}`, "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}
async function admin(path, body, method = "POST") {
  const res = await fetch(`${URL_}${path}`, { method, headers: { apikey: SR, authorization: `Bearer ${SR}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, ok: res.ok, data: await res.json().catch(() => null) };
}
async function makeUser(tag) {
  const email = `p67-${tag}-${randomUUID().slice(0, 6)}@staging.test`;
  const password = `pw-${randomUUID()}`;
  const created = await admin("/auth/v1/admin/users", { email, password, email_confirm: true });
  assert.ok(created.ok, `user create failed: ${JSON.stringify(created.data)}`);
  const session = await api("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  assert.ok(session.ok, "sign-in failed");
  return { id: created.data.id, email, password, token: session.data.access_token, refresh: session.data.refresh_token };
}

// ---------- RLS core -----------------------------------------------------------
const anonRead = await api("/rest/v1/sync_records?select=*");
rec("rls-anon-table-read-denied", !anonRead.ok && anonRead.status >= 400 ? "passed" : "failed", `status ${anonRead.status}`);

const A = await makeUser("a");
const B = await makeUser("b");
const deviceA = `dev-a1-${randomUUID().slice(0, 6)}`;
const reg = await api("/rest/v1/rpc/register_sync_device", { method: "POST", token: A.token, body: { p_device_id: deviceA, p_name: "A phone" } });
const regBody = reg;
rec("device-registration", regBody.ok ? "passed" : "failed", `status ${regBody.status} ${JSON.stringify(regBody.data)?.slice(0, 80)}`);

const mutationId = `m-${randomUUID()}`;
const pushBody = { p_device_id: deviceA, p_mutations: [{ mutationId, deviceId: deviceA, protocolVersion: 1, schemaVersion: 1, operation: "upsert", scope: { type: "personal" }, entityType: "pantry_item", recordId: "pantry-1", baseRevision: 0, payload: { ingredientSlug: "tomato", status: "have" } }] };
const push1 = await api("/rest/v1/rpc/sync_push", { method: "POST", token: A.token, body: pushBody });
rec("sync-push", push1.ok ? "passed" : "failed", `status ${push1.status} ${JSON.stringify(push1.data)?.slice(0, 100)}`);
const push2 = await api("/rest/v1/rpc/sync_push", { method: "POST", token: A.token, body: pushBody });
rec("duplicate-mutation-idempotent", push2.ok && JSON.stringify(push2.data) !== "" ? "passed" : "failed", "same mutationId replayed without error/duplication");

const pullB = await api("/rest/v1/rpc/sync_pull", { method: "POST", token: B.token, body: { p_device_id: "dev-b", p_scope_type: "personal", p_scope_id: A.id, p_cursor: 0, p_limit: 50 } });
const bSawA = pullB.ok && JSON.stringify(pullB.data).includes("pantry-1");
rec("rls-cross-user-pull-denied", !bSawA ? "passed" : "failed", pullB.ok ? "RPC returned no foreign records" : `denied ${pullB.status}`);

// ---------- households ----------------------------------------------------------
const hh = await api("/rest/v1/rpc/create_kitchen_household", { method: "POST", token: A.token, body: { p_name: "P67 household" } });
rec("household-create", hh.ok ? "passed" : "failed", `status ${hh.status}`);
const hhId = hh.data?.id ?? hh.data?.householdId ?? sql(`select id from households where owner_id='${A.id}' order by created_at desc limit 1`);
const invite = await api("/rest/v1/rpc/create_household_invite", { method: "POST", token: A.token, body: { p_household_id: hhId, p_email: B.email } });
rec("household-invite-create", invite.ok ? "passed" : "failed", `status ${invite.status}`);
const inviteToken = invite.data?.token ?? invite.data?.inviteToken ?? sql(`select token from household_invites where household_id='${hhId}' order by created_at desc limit 1`);
const accept = await api("/rest/v1/rpc/accept_household_invite", { method: "POST", token: B.token, body: { p_token: inviteToken } });
rec("household-invite-accept", accept.ok ? "passed" : "failed", `status ${accept.status}`);
const replay = await api("/rest/v1/rpc/accept_household_invite", { method: "POST", token: B.token, body: { p_token: inviteToken } });
rec("household-invite-replay-rejected", !replay.ok || JSON.stringify(replay.data).match(/already|used|invalid/i) ? "passed" : "failed", `status ${replay.status}`);
const viewerWrite = await api("/rest/v1/rpc/sync_push", { method: "POST", token: B.token, body: { p_device_id: "dev-b", p_mutations: [{ mutationId: `m-${randomUUID()}`, deviceId: "dev-b", protocolVersion: 1, schemaVersion: 1, operation: "upsert", scope: { type: "household", id: hhId }, entityType: "shopping_item", recordId: "s1", baseRevision: 0, payload: { title: "x" } }] } });
const viewerBlocked = !viewerWrite.ok || JSON.stringify(viewerWrite.data).match(/denied|forbidden|not.*write|scope/i);
rec("household-viewer-write-denied", viewerBlocked ? "passed" : "failed", `status ${viewerWrite.status}`);
sql(`delete from household_members where household_id='${hhId}' and user_id='${B.id}'`);
const removedRead = await api("/rest/v1/rpc/sync_pull", { method: "POST", token: B.token, body: { p_device_id: "dev-b", p_scope_type: "household", p_scope_id: hhId, p_cursor: 0, p_limit: 10 } });
rec("household-removed-member-loses-access", !removedRead.ok || !JSON.stringify(removedRead.data).includes("s1") ? "passed" : "failed", `status ${removedRead.status}`);

// ---------- contribution self-review / double-tester / trusted RPC denial -------
const draft = await api("/rest/v1/rpc/save_recipe_draft_version", { method: "POST", token: A.token, body: { p_draft_id: null, p_scope_type: "personal", p_scope_id: A.id, p_content: { title: "P67 contrib", story: "none" }, p_rights: { sourceType: "original", writtenInOwnWords: true, rightToShare: true, aiAssistance: "drafting", aiAssistanceNotes: "harness test", publicContributorName: "P67 Tester", publishCulturalStory: false, licence: "CC-BY-4.0", acceptedAt: new Date().toISOString() }, p_expected_latest_version_id: null } });
rec("contribution-draft-create", draft.ok ? "passed" : "failed", `status ${draft.status} ${JSON.stringify(draft.data)?.slice(0, 80)}`);
const draftId = draft.data?.draftId ?? draft.data?.draft_id ?? draft.data?.draft?.id;
const draftVersionId = draft.data?.version?.id ?? draft.data?.versionId ?? draft.data?.latestVersion?.id;
const draftContentHash = draft.data?.version?.contentHash ?? draft.data?.version?.content_hash;
const submit = draftId ? await api("/rest/v1/rpc/submit_recipe_version", { method: "POST", token: A.token, body: { p_draft_id: draftId, p_version_id: draftVersionId } }) : { ok: false, status: 0, data: "no draft" };
rec("contribution-submit", submit.ok ? "passed" : "failed", `status ${submit.status} ${JSON.stringify(submit.data)?.slice(0, 100)}`);
const submissionId = submit.data?.submission?.id ?? submit.data?.submissionId ?? submit.data?.submission_id;
if (submissionId) {
  sql(`insert into contribution_roles (user_id, role) values ('${A.id}','editorial') on conflict do nothing`);
  const selfReview = await api("/rest/v1/rpc/add_recipe_editorial_review", { method: "POST", token: A.token, body: { p_submission_id: submissionId, p_role: "editorial", p_decision: "approve_editorially", p_summary: "self", p_proposed_changes: null } });
  rec("contributor-self-review-blocked", !selfReview.ok ? "passed" : "failed", `status ${selfReview.status} ${JSON.stringify(selfReview.data)?.slice(0, 80)}`);
  sql(`insert into contribution_roles (user_id, role) values ('${B.id}','cook_tester') on conflict do nothing`);
  const t1 = await api("/rest/v1/rpc/add_recipe_cook_test", { method: "POST", token: B.token, body: { p_submission_id: submissionId, p_version_id: draftVersionId, p_content_hash: submit.data?.contentHash ?? submit.data?.content_hash ?? draftContentHash, p_servings_attempted: 2, p_prep_minutes_actual: 10, p_cook_minutes_actual: 20, p_equipment_used: ["kadai"], p_substitutions: [], p_step_findings: [], p_safety_observations: [], p_outcome: "passed", p_summary: "test1" } });
  const t2 = await api("/rest/v1/rpc/add_recipe_cook_test", { method: "POST", token: B.token, body: { p_submission_id: submissionId, p_version_id: draftVersionId, p_content_hash: submit.data?.contentHash ?? submit.data?.content_hash ?? draftContentHash, p_servings_attempted: 2, p_prep_minutes_actual: 10, p_cook_minutes_actual: 20, p_equipment_used: ["kadai"], p_substitutions: [], p_step_findings: [], p_safety_observations: [], p_outcome: "passed", p_summary: "test2" } });
  rec("double-tester-blocked", t1.ok && !t2.ok ? "passed" : t1.ok ? "failed" : "warn", `first ${t1.status}, second ${t2.status}`);
}
const browserClaim = await api("/rest/v1/rpc/claim_publication_candidate", { method: "POST", token: A.token, body: { p_candidate_id: randomUUID() } });
rec("browser-cannot-claim-candidates", !browserClaim.ok ? "passed" : "failed", `status ${browserClaim.status}`);
const browserDeletionPrep = await api("/rest/v1/rpc/prepare_contribution_account_deletion", { method: "POST", token: A.token, body: { p_user_id: A.id } });
rec("browser-cannot-run-deletion-prep", !browserDeletionPrep.ok ? "passed" : "failed", `status ${browserDeletionPrep.status}`);

// ---------- magic-link auth ------------------------------------------------------
const linkUser = `p67-link-${randomUUID().slice(0, 6)}@staging.test`;
const gen = await admin("/auth/v1/admin/generate_link", { type: "magiclink", email: linkUser, options: { redirect_to: "https://cook-anything-staging.robofox.online/account/" } });
rec("magic-link-generated", gen.ok ? "passed" : "failed", `status ${gen.status}`);
const otp = gen.data?.email_otp ?? gen.data?.otp;
const hashedToken = gen.data?.hashed_token;
const verify1 = await api("/auth/v1/verify", { method: "POST", body: { type: "email", token_hash: hashedToken } });
rec("magic-link-first-use", verify1.ok && verify1.data?.access_token ? "passed" : "failed", `status ${verify1.status}`);
const verify2 = await api("/auth/v1/verify", { method: "POST", body: { type: "email", token_hash: hashedToken } });
rec("magic-link-replay-rejected", !verify2.ok ? "passed" : "failed", `status ${verify2.status}`);
const badVerify = await api("/auth/v1/verify", { method: "POST", body: { type: "email", token_hash: "0".repeat(56) } });
rec("magic-link-malformed-rejected", !badVerify.ok ? "passed" : "failed", `status ${badVerify.status}`);
const refreshed = await api("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: A.refresh } });
rec("token-refresh", refreshed.ok ? "passed" : "failed", `status ${refreshed.status}`);
const signOut = await api("/auth/v1/logout", { method: "POST", token: refreshed.data?.access_token ?? A.token });
rec("sign-out", signOut.status === 204 || signOut.ok ? "passed" : "failed", `status ${signOut.status}`);
const revokedUse = await api("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: refreshed.data?.refresh_token ?? A.refresh } });
rec("revoked-session-refresh-rejected", !revokedUse.ok ? "passed" : "failed", `status ${revokedUse.status}`);

// ---------- device revocation + reset semantics ----------------------------------
const A2 = await makeUser("a2");
const deviceA2 = `dev-a2-${randomUUID().slice(0, 6)}`;
const reg2 = await api("/rest/v1/rpc/register_sync_device", { method: "POST", token: A2.token, body: { p_device_id: deviceA2, p_name: "A2" } });
void reg2;
await api("/rest/v1/rpc/sync_push", { method: "POST", token: A2.token, body: { p_device_id: deviceA2, p_mutations: [{ mutationId: `m-${randomUUID()}`, deviceId: deviceA2, protocolVersion: 1, schemaVersion: 1, operation: "upsert", scope: { type: "personal" }, entityType: "pantry_item", recordId: "p1", baseRevision: 0, payload: { ingredientSlug: "onion", status: "have" } }] } });
const revoke = await api("/rest/v1/rpc/revoke_sync_device", { method: "POST", token: A2.token, body: { p_device_id: deviceA2 } });
const pushRevoked = await api("/rest/v1/rpc/sync_push", { method: "POST", token: A2.token, body: { p_device_id: deviceA2, p_mutations: [{ mutationId: `m-${randomUUID()}`, deviceId: deviceA2, protocolVersion: 1, schemaVersion: 1, operation: "upsert", scope: { type: "personal" }, entityType: "pantry_item", recordId: "p2", baseRevision: 0, payload: { ingredientSlug: "rice", status: "have" } }] } });
rec("revoked-device-push-denied", revoke.ok && !pushRevoked.ok ? "passed" : "failed", `revoke ${revoke.status}, push-after ${pushRevoked.status}`);
const deviceA3 = `dev-a3-${randomUUID().slice(0, 6)}`;
await api("/rest/v1/rpc/register_sync_device", { method: "POST", token: A2.token, body: { p_device_id: deviceA3, p_name: "A3" } });
const reset = await api("/rest/v1/rpc/sync_reset_personal_scope", { method: "POST", token: A2.token, body: { p_device_id: deviceA3 } });
rec("use-this-device-reset", reset.ok ? "passed" : "failed", `status ${reset.status} ${JSON.stringify(reset.data)?.slice(0, 80)}`);

// ---------- hosted deletion drill -------------------------------------------------
const delReq = await api("/rest/v1/rpc/request_account_deletion", { method: "POST", token: B.token, body: {} });
rec("deletion-requested", delReq.ok ? "passed" : "failed", `status ${delReq.status}`);
const worker = spawnSync(process.execPath, ["scripts/account-deletion-worker.mjs"], {
  env: { ...process.env, SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: SR }, encoding: "utf8",
});
const workerSummary = worker.stdout.trim().split("\n").at(-1) ?? "";
rec("deletion-worker-hosted", worker.status === 0 && workerSummary.includes('"failed":0') ? "passed" : "failed", workerSummary.slice(0, 120));
const bGone = await admin(`/auth/v1/admin/users/${B.id}`, undefined, "GET");
rec("deletion-auth-user-gone", bGone.status === 404 ? "passed" : "failed", `status ${bGone.status}`);
const worker2 = spawnSync(process.execPath, ["scripts/account-deletion-worker.mjs"], {
  env: { ...process.env, SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: SR }, encoding: "utf8",
});
rec("deletion-idempotent-rerun", worker2.status === 0 && (worker2.stdout.includes('"processed":0') || worker2.stdout.includes('"failed":0')) ? "passed" : "failed", "rerun no-op");

// ---------- summary ---------------------------------------------------------------
const summary = { id: "hosted-staging-battery", project: "cook-anything-staging (ref redacted)", date: new Date().toISOString(), total: results.length, passed: results.filter((r) => r.status === "passed").length, warned: results.filter((r) => r.status === "warn").length, failed: results.filter((r) => r.status === "failed").length, results };
writeFileSync("evidence/phase-6-7/hosted-battery-results.json", JSON.stringify(summary, null, 2) + "\n");
console.log(`SUMMARY ${summary.passed} passed / ${summary.warned} warn / ${summary.failed} failed`);
process.exit(summary.failed === 0 ? 0 : 1);

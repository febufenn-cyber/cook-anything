#!/usr/bin/env node
/**
 * Trusted account-deletion worker (Phase 6.5).
 *
 * Runs with SERVICE-ROLE authority against a Supabase project — operator
 * machines or a protected job only. Never browsers, never public CI.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/account-deletion-worker.mjs [--dry-run]
 *
 * Order of operations per pending request (each step idempotent, safe to
 * rerun after a crash at any point):
 *   1. revalidate the request and mark it `processing`
 *   2. revoke every sync device
 *   3. owned households: transfer to the eldest other owner/editor member,
 *      else delete the household and its household-scoped sync records
 *   4. prepare_contribution_account_deletion RPC (deletes unpublished private
 *      contribution data, redacts identities on retained licensed evidence)
 *   5. delete personal-scope sync records + mutation receipts + profile
 *   6. mark the request `completed`
 *   7. delete the Supabase Auth user (FK cascades remove the request row and
 *      any remaining rows referencing the user)
 *
 * Crash recovery: rows in `processing` are retried from the top; rows in
 * `completed` that still have a live auth user (crash between 6 and 7) get
 * the auth deletion retried. Output is metadata-only: ids, counts, statuses —
 * never kitchen payloads.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("account-deletion-worker: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (operator environment only).");
  process.exit(2);
}

const HEADERS = {
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
  "content-type": "application/json",
};

async function rest(method, path, body, extraHeaders = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: { ...HEADERS, ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: response.status, ok: response.ok, data };
}

const summary = { processed: 0, completed: 0, failed: 0, dryRun: DRY_RUN, users: [] };

function log(userId, step, detail) {
  console.log(JSON.stringify({ at: new Date().toISOString(), userId, step, ...detail }));
}

async function revokeDevices(userId) {
  if (DRY_RUN) return log(userId, "revoke-devices", { dryRun: true });
  const r = await rest("PATCH", `/rest/v1/sync_devices?user_id=eq.${userId}&revoked_at=is.null`,
    { revoked_at: new Date().toISOString() }, { prefer: "return=minimal" });
  if (!r.ok) throw new Error(`revoke_devices_failed:${r.status}`);
  log(userId, "revoke-devices", { ok: true });
}

async function handleOwnedHouseholds(userId) {
  const owned = await rest("GET", `/rest/v1/households?owner_id=eq.${userId}&select=id`);
  if (!owned.ok) throw new Error(`households_query_failed:${owned.status}`);
  for (const { id } of owned.data ?? []) {
    const members = await rest("GET",
      `/rest/v1/household_members?household_id=eq.${id}&user_id=neq.${userId}&role=in.(owner,editor)&select=user_id,role,created_at&order=created_at.asc&limit=1`);
    if (!members.ok) throw new Error(`household_members_query_failed:${members.status}`);
    const heir = members.data?.[0];
    if (DRY_RUN) { log(userId, "household", { household: id, plan: heir ? `transfer:${heir.user_id}` : "delete" }); continue; }
    if (heir) {
      const t1 = await rest("PATCH", `/rest/v1/households?id=eq.${id}`, { owner_id: heir.user_id }, { prefer: "return=minimal" });
      const t2 = await rest("PATCH", `/rest/v1/household_members?household_id=eq.${id}&user_id=eq.${heir.user_id}`,
        { role: "owner" }, { prefer: "return=minimal" });
      if (!t1.ok || !t2.ok) throw new Error(`household_transfer_failed:${id}`);
      log(userId, "household", { household: id, transferredTo: heir.user_id });
    } else {
      const r1 = await rest("DELETE", `/rest/v1/sync_records?scope_type=eq.household&scope_id=eq.${id}`, undefined, { prefer: "return=minimal" });
      const r2 = await rest("DELETE", `/rest/v1/households?id=eq.${id}`, undefined, { prefer: "return=minimal" });
      if (!r1.ok || !r2.ok) throw new Error(`household_delete_failed:${id}`);
      log(userId, "household", { household: id, deleted: true });
    }
  }
}

async function prepareContributions(userId) {
  if (DRY_RUN) return log(userId, "contribution-prep", { dryRun: true });
  const r = await rest("POST", "/rest/v1/rpc/prepare_contribution_account_deletion", { p_user_id: userId });
  if (!r.ok) throw new Error(`contribution_prep_failed:${r.status}:${JSON.stringify(r.data)?.slice(0, 120)}`);
  log(userId, "contribution-prep", r.data ?? { ok: true });
}

async function deletePersonalData(userId) {
  if (DRY_RUN) return log(userId, "personal-data", { dryRun: true });
  for (const path of [
    `/rest/v1/sync_records?scope_type=eq.personal&scope_id=eq.${userId}`,
    `/rest/v1/sync_mutation_receipts?actor_id=eq.${userId}`,
    `/rest/v1/profiles?user_id=eq.${userId}`,
    `/rest/v1/sync_devices?user_id=eq.${userId}`,
  ]) {
    const r = await rest("DELETE", path, undefined, { prefer: "return=minimal" });
    if (!r.ok) throw new Error(`personal_data_delete_failed:${r.status}:${path.split("?")[0]}`);
  }
  log(userId, "personal-data", { ok: true });
}

async function markRequest(userId, status) {
  if (DRY_RUN) return;
  const body = status === "completed" ? { status, completed_at: new Date().toISOString() } : { status };
  const r = await rest("PATCH", `/rest/v1/account_deletion_requests?user_id=eq.${userId}`, body, { prefer: "return=minimal" });
  if (!r.ok) throw new Error(`request_mark_failed:${status}:${r.status}`);
}

async function deleteAuthUser(userId) {
  if (DRY_RUN) return log(userId, "auth-delete", { dryRun: true });
  const r = await rest("DELETE", `/auth/v1/admin/users/${userId}`);
  if (!r.ok && r.status !== 404) throw new Error(`auth_delete_failed:${r.status}`);
  log(userId, "auth-delete", { ok: true, alreadyDeleted: r.status === 404 });
}

async function processUser(userId) {
  summary.processed += 1;
  try {
    await markRequest(userId, "processing");
    await revokeDevices(userId);
    await handleOwnedHouseholds(userId);
    await prepareContributions(userId);
    await deletePersonalData(userId);
    await markRequest(userId, "completed");
    await deleteAuthUser(userId);
    summary.completed += 1;
    summary.users.push({ userId, status: DRY_RUN ? "dry-run" : "completed" });
  } catch (error) {
    summary.failed += 1;
    summary.users.push({ userId, status: "failed", error: String(error.message ?? error) });
    log(userId, "failed", { error: String(error.message ?? error) });
  }
}

// Pending + interrupted requests.
const queue = await rest("GET", "/rest/v1/account_deletion_requests?status=in.(pending,processing)&select=user_id,status,requested_at");
if (!queue.ok) {
  console.error(`queue_query_failed:${queue.status} — is the service-role key correct and are migrations applied?`);
  process.exit(1);
}
for (const request of queue.data ?? []) {
  if (!/^[0-9a-f-]{36}$/i.test(request.user_id ?? "")) { log(request.user_id, "skipped", { reason: "malformed" }); continue; }
  await processUser(request.user_id);
}

// Crash window: request completed but auth user still present.
const completedRows = await rest("GET", "/rest/v1/account_deletion_requests?status=eq.completed&select=user_id");
for (const request of completedRows.data ?? []) {
  log(request.user_id, "finalize-retry", { reason: "completed request row still exists" });
  if (!DRY_RUN) await deleteAuthUser(request.user_id);
}

console.log(JSON.stringify({ id: "account-deletion-worker", ...summary }));
process.exit(summary.failed > 0 ? 1 : 0);

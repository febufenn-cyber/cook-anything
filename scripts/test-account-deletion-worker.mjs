#!/usr/bin/env node
/**
 * Account-deletion worker tests. Boots a mock Supabase (PostgREST + GoTrue
 * admin) on localhost, seeds scenario state, runs the real worker as a child
 * process, and asserts the operation order, household handling, idempotency
 * and failure isolation. No credentials, no network — CI-safe.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Run the worker asynchronously so the in-process mock server stays responsive. */
function runWorker(env, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [WORKER, ...args], { env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

const WORKER = fileURLToPath(new URL("./account-deletion-worker.mjs", import.meta.url));

const USER_PLAIN = "11111111-1111-4111-8111-111111111111";
const USER_OWNER = "22222222-2222-4222-8222-222222222222";
const HEIR = "33333333-3333-4333-8333-333333333333";
const USER_STUCK = "44444444-4444-4444-8444-444444444444";

function makeState() {
  return {
    requests: [
      { user_id: USER_PLAIN, status: "pending" },
      { user_id: USER_OWNER, status: "processing" }, // interrupted previous run
      { user_id: "not-a-uuid", status: "pending" },
      { user_id: USER_STUCK, status: "completed" },  // crash between mark-completed and auth delete
    ],
    households: [
      { id: "aaaa1111-0000-4000-8000-000000000001", owner_id: USER_OWNER },
      { id: "aaaa1111-0000-4000-8000-000000000002", owner_id: USER_OWNER },
    ],
    members: {
      "aaaa1111-0000-4000-8000-000000000001": [{ user_id: HEIR, role: "editor", created_at: "2026-01-01" }],
      "aaaa1111-0000-4000-8000-000000000002": [],
    },
    calls: [],
    authDeleted: [],
  };
}

function route(state, req, url, body) {
  const record = (step) => state.calls.push(`${step}`);
  const path = url.pathname;
  const q = url.searchParams;
  if (path === "/rest/v1/account_deletion_requests" && req.method === "GET") {
    const statuses = (q.get("status") ?? "").replace(/^in\.\(|\)$/g, "").replace(/^eq\./, "").split(",");
    return state.requests.filter((r) => statuses.includes(r.status));
  }
  if (path === "/rest/v1/account_deletion_requests" && req.method === "PATCH") {
    const userId = q.get("user_id").replace("eq.", "");
    record(`mark:${userId}:${body.status}`);
    const row = state.requests.find((r) => r.user_id === userId);
    if (row) row.status = body.status;
    return [];
  }
  if (path === "/rest/v1/sync_devices" && req.method === "PATCH") { record(`devices:${q.get("user_id").replace("eq.", "")}`); return []; }
  if (path === "/rest/v1/households" && req.method === "GET") {
    return state.households.filter((h) => h.owner_id === q.get("owner_id").replace("eq.", ""));
  }
  if (path === "/rest/v1/household_members" && req.method === "GET") {
    return state.members[q.get("household_id").replace("eq.", "")] ?? [];
  }
  if (path === "/rest/v1/households" && req.method === "PATCH") { record(`hh-transfer:${q.get("id").replace("eq.", "")}:${body.owner_id}`); return []; }
  if (path === "/rest/v1/household_members" && req.method === "PATCH") { record("hh-promote"); return []; }
  if (path === "/rest/v1/households" && req.method === "DELETE") { record(`hh-delete:${q.get("id").replace("eq.", "")}`); return []; }
  if (path === "/rest/v1/sync_records" && req.method === "DELETE") { record(`records:${q.get("scope_type")}`); return []; }
  if (path === "/rest/v1/rpc/prepare_contribution_account_deletion" && req.method === "POST") {
    record(`prep:${body.p_user_id}`);
    return { ok: true, deletedPrivateDrafts: 1, retainedPublishedDrafts: 0 };
  }
  if (path === "/rest/v1/sync_mutation_receipts" && req.method === "DELETE") { record("receipts"); return []; }
  if (path === "/rest/v1/profiles" && req.method === "DELETE") { record("profile"); return []; }
  if (path === "/rest/v1/sync_devices" && req.method === "DELETE") { record("devices-delete"); return []; }
  if (path.startsWith("/auth/v1/admin/users/") && req.method === "DELETE") {
    const userId = path.split("/").pop();
    record(`auth-delete:${userId}`);
    state.authDeleted.push(userId);
    state.requests = state.requests.filter((r) => r.user_id !== userId); // FK cascade
    return {};
  }
  return { error: `unmocked ${req.method} ${path}` };
}

const state = makeState();
const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    assert.equal(req.headers.authorization, "Bearer test-service-role", "service key must be sent");
    const url = new URL(req.url, "http://localhost");
    const result = route(state, req, url, raw ? JSON.parse(raw) : undefined);
    res.writeHead(result?.error ? 500 : 200, { "content-type": "application/json" });
    res.end(JSON.stringify(result));
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

// 1. Refuses to run without credentials.
const noCreds = spawnSync(process.execPath, [WORKER], { env: { ...process.env, SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" } });
assert.equal(noCreds.status, 2, "must refuse without service credentials");

// 2. Full run against the mock.
const run = await runWorker({ ...process.env, SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: "test-service-role" });
assert.equal(run.code, 0, `worker run failed: ${run.stderr}`);
const lines = run.stdout.trim().split("\n").map((line) => JSON.parse(line));
const finalSummary = lines.at(-1);

// Plain user: full ordered pipeline.
const plainSteps = state.calls.filter((c) => c.includes(USER_PLAIN) || state.calls.indexOf(c) >= 0);
const orderOf = (step) => state.calls.findIndex((c) => c.startsWith(step));
assert.ok(orderOf(`mark:${USER_PLAIN}:processing`) < orderOf(`devices:${USER_PLAIN}`), "processing before device revoke");
assert.ok(orderOf(`devices:${USER_PLAIN}`) < orderOf(`prep:${USER_PLAIN}`), "devices before contribution prep");
assert.ok(orderOf(`prep:${USER_PLAIN}`) < orderOf(`mark:${USER_PLAIN}:completed`), "prep before completed");
assert.ok(orderOf(`mark:${USER_PLAIN}:completed`) < orderOf(`auth-delete:${USER_PLAIN}`), "completed before auth delete");

// Interrupted (processing) user is retried; household with heir transferred, empty household deleted.
assert.ok(state.calls.includes(`hh-transfer:aaaa1111-0000-4000-8000-000000000001:${HEIR}`), "heir household transferred");
assert.ok(state.calls.includes("hh-delete:aaaa1111-0000-4000-8000-000000000002"), "memberless household deleted");
assert.ok(state.calls.includes(`records:eq.household`), "household sync records deleted with household");

// Crash-window user gets auth deletion finalized.
assert.ok(state.authDeleted.includes(USER_STUCK), "completed-but-live auth user finalized");

// Malformed id skipped, not failed.
assert.equal(finalSummary.failed, 0, `no failures expected, got ${JSON.stringify(finalSummary)}`);
assert.equal(finalSummary.completed, 2, "two real users completed");
assert.ok(!state.authDeleted.includes("not-a-uuid"));

// 3. Idempotency: rerun with cleaned queue → nothing to do, exit 0.
const rerun = await runWorker({ ...process.env, SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: "test-service-role" });
assert.equal(rerun.code, 0);
assert.equal(JSON.parse(rerun.stdout.trim().split("\n").at(-1)).processed, 0, "rerun is a no-op");

// 4. Dry-run mutates nothing.
const marksBefore = state.calls.filter((c) => c.startsWith("mark:")).length;
const dry = await runWorker({ ...process.env, SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: "test-service-role" }, ["--dry-run"]);
assert.equal(dry.code, 0);
assert.equal(state.calls.filter((c) => c.startsWith("mark:")).length, marksBefore, "dry-run writes no status changes");

server.close();
console.log("Account-deletion worker tests passed.");

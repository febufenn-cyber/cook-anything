import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  assertSyncPayloadSafe,
  compactMutations,
  conflictReason,
  mergeProfilePayload,
  stableJson,
  syncEntityKey,
  validatePendingMutation,
} from "../src/lib/sync/security";
import type {
  PendingMutation,
  RemoteSyncRecord,
  SyncPayload,
} from "../src/lib/sync/types";
import { createDefaultKitchenProfile } from "../src/lib/kitchen/schema";

const now = "2026-07-12T00:00:00.000Z";

assert.throws(() => assertSyncPayloadSafe({ nested: { apiKey: "should-never-sync" } }), /secret_field_forbidden/);
assert.throws(() => assertSyncPayloadSafe({ authorization: "Bearer token" }), /secret_field_forbidden/);
assert.throws(() => assertSyncPayloadSafe({ constructor: { prototype: { polluted: true } } }), /invalid_sync_payload/);
assert.equal(stableJson({ b: 2, a: { z: 1, y: 2 } }), '{"a":{"y":2,"z":1},"b":2}');

function mutation(overrides: Partial<PendingMutation> = {}): PendingMutation {
  return {
    protocolVersion: 1,
    mutationId: "mutation-a",
    deviceId: "device-a",
    entityType: "pantry_item",
    recordId: "rice",
    operation: "upsert",
    scope: { type: "personal" },
    baseRevision: null,
    schemaVersion: 1,
    payload: {
      ingredientSlug: "rice",
      status: "available",
      source: "user_added",
      updatedAt: now,
    },
    createdAt: now,
    attemptCount: 0,
    ...overrides,
  };
}

assert.equal(validatePendingMutation(mutation()).recordId, "rice");
assert.throws(() => validatePendingMutation(mutation({ operation: "delete" })), /invalid_sync_mutation/, "delete must not carry payload");
assert.throws(() => validatePendingMutation(mutation({ protocolVersion: 2 as 1 })), /unsupported_sync_protocol/);
assert.throws(() => validatePendingMutation(mutation({ scope: { type: "household" } })), /invalid_sync_scope/);
assert.throws(() => validatePendingMutation(mutation({ payload: { accessToken: "secret" } as never })), /secret_field_forbidden/);

const compacted = compactMutations([
  mutation({ mutationId: "first", createdAt: "2026-07-12T00:00:00.000Z" }),
  mutation({ mutationId: "second", createdAt: "2026-07-12T00:01:00.000Z", payload: { ingredientSlug: "rice", status: "out", source: "user_added", updatedAt: now } }),
  mutation({ mutationId: "other", recordId: "egg", createdAt: "2026-07-12T00:02:00.000Z", payload: { ingredientSlug: "egg", status: "available", source: "user_added", updatedAt: now } }),
]);
assert.equal(compacted.length, 2);
assert.ok(compacted.some((item) => item.mutationId === "second"));
assert.ok(!compacted.some((item) => item.mutationId === "first"));

assert.equal(
  syncEntityKey("pantry_item", "rice", "personal", "user-uuid"),
  syncEntityKey("pantry_item", "rice", "personal", "self"),
  "personal revisions must remain stable before and after authentication",
);
assert.notEqual(
  syncEntityKey("pantry_item", "rice", "household", "household-a"),
  syncEntityKey("pantry_item", "rice", "household", "household-b"),
);

const left = {
  ...createDefaultKitchenProfile(now),
  allergensToAvoid: ["peanuts"],
  excludedIngredients: ["onion"],
} satisfies SyncPayload;
const right = {
  ...createDefaultKitchenProfile(now),
  allergensToAvoid: ["dairy"],
  excludedIngredients: ["garlic"],
} satisfies SyncPayload;
const merged = mergeProfilePayload(left, right) as typeof left;
assert.deepEqual(new Set(merged.allergensToAvoid), new Set(["peanuts", "dairy"]));
assert.deepEqual(new Set(merged.excludedIngredients), new Set(["onion", "garlic"]));

const remote: RemoteSyncRecord = {
  entityType: "profile",
  recordId: "local",
  scope: { type: "personal", id: "user-a" },
  schemaVersion: 1,
  revision: 2,
  deviceId: "device-b",
  payload: right,
  payloadHash: "hash",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  changeSequence: 2,
};
assert.equal(conflictReason(mutation({ entityType: "profile", recordId: "local", payload: left }), remote), "safety_preference");
assert.equal(conflictReason(mutation({ operation: "delete", payload: undefined }), remote), "delete_edit");
assert.equal(conflictReason(mutation({ entityType: "meal_plan_entry", recordId: "2026-07-12:dinner" }), { ...remote, entityType: "meal_plan_entry" }), "meal_slot");

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260712_phase5_portable_kitchen.sql"), "utf8");
const hardening = fs.readFileSync(path.join(root, "supabase", "migrations", "20260712_phase5_sync_push_hardening.sql"), "utf8");
const sql = `${migration}\n${hardening}`;

assert.match(sql, /auth\.uid\(\)/);
assert.match(sql, /sync_mutation_receipts/);
assert.match(sql, /change_sequence/);
assert.match(sql, /deleted_at/);
assert.match(sql, /can_write_kitchen_scope/);
assert.match(sql, /household_members/);
assert.match(sql, /role in \('owner', 'editor'\)/);
assert.match(sql, /revoke all on public\.profiles[\s\S]*from anon, authenticated/);
assert.match(sql, /grant execute on function public\.sync_push/);
assert.doesNotMatch(sql, /grant\s+(?:select|insert|update|delete|all)\s+on\s+public\.sync_records\s+to\s+(?:anon|authenticated)/i);
assert.match(hardening, /current_record := null/);
assert.match(hardening, /receipt := null/);
assert.match(hardening, /server-compacted/);
assert.match(sql, /secret_field_forbidden/);
assert.match(sql, /request_account_deletion/);

const serviceWorker = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.match(serviceWorker, /request\.headers\.has\("apikey"\)/);
assert.match(serviceWorker, /url\.searchParams\.has\("code"\)/);
assert.match(serviceWorker, /url\.searchParams\.has\("invite"\)/);

const browserSources = [
  "src/lib/sync/supabase-rest.ts",
  "src/lib/sync/engine.ts",
  "src/components/PortableKitchenProvider.tsx",
].map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
assert.doesNotMatch(browserSources, /service[_-]?role/i, "browser code must never mention or accept a service-role credential");
assert.match(browserSources, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
assert.match(browserSources, /cache: "no-store"/);

console.log("Phase 5 portable-kitchen sync tests passed.");

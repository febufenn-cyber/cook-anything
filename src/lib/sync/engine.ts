"use client";

import { kitchenRepository } from "../kitchen/repository";
import { isoNow } from "../kitchen/schema";
import { mergeProfilePayload } from "./security";
import {
  acknowledgeAccepted,
  clearSyncState,
  compactPendingQueue,
  getBoundAccountId,
  getDeviceId,
  getDeviceName,
  getPullCursor,
  hasCompletedMigration,
  isSyncPaused,
  listConflicts,
  listPendingMutations,
  pendingMutationCount,
  queueLocalUpsert,
  removeConflict,
  saveConflicts,
  saveRecoverySnapshot,
  saveRemoteRevisions,
  setBoundAccountId,
  setCompletedMigration,
  setLastSyncAt,
  setLastSyncError,
  setPullCursor,
  setSyncPaused,
  markMutationAttempts,
} from "./local-store";
import { callCloudRpc, getValidSession, isCloudSyncConfigured } from "./supabase-rest";
import type {
  CloudKitchenSummary,
  DeviceInfo,
  HouseholdSummary,
  MigrationStrategy,
  RecoverySnapshot,
  RemoteSyncRecord,
  SyncConflict,
  SyncPullResult,
  SyncPushResult,
} from "./types";

const PUSH_BATCH = 100;
const PULL_BATCH = 500;
const RECOVERY_DAYS = 14;
let activeSync: Promise<SyncRunResult> | null = null;

export interface SyncRunResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  pending: number;
  lastSyncAt: string;
}

function parseRemoteRecord(value: unknown): RemoteSyncRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_sync_record");
  const record = value as RemoteSyncRecord;
  if (!record.entityType || !record.recordId || !record.scope || !Number.isInteger(record.revision)) throw new Error("invalid_sync_record");
  if (!Number.isInteger(record.changeSequence) || record.changeSequence < 0) throw new Error("invalid_sync_record");
  return record;
}

function parsePushResult(value: unknown): SyncPushResult {
  if (!value || typeof value !== "object") throw new Error("invalid_sync_response");
  const result = value as Partial<SyncPushResult>;
  if (!Array.isArray(result.accepted) || !Array.isArray(result.conflicts)) throw new Error("invalid_sync_response");
  return {
    accepted: result.accepted.map((item) => ({ mutationId: item.mutationId, record: parseRemoteRecord(item.record) })),
    conflicts: result.conflicts.map((item) => ({ ...item, remote: parseRemoteRecord(item.remote) })),
  };
}

function parsePullResult(value: unknown): SyncPullResult {
  if (!value || typeof value !== "object") throw new Error("invalid_sync_response");
  const result = value as Partial<SyncPullResult>;
  if (!Number.isInteger(result.nextCursor) || !Array.isArray(result.records) || typeof result.serverTime !== "string") {
    throw new Error("invalid_sync_response");
  }
  return {
    nextCursor: result.nextCursor!,
    records: result.records.map(parseRemoteRecord),
    serverTime: result.serverTime,
  };
}

export async function queueFullLocalKitchen(): Promise<number> {
  const records = await kitchenRepository.snapshotSyncRecords();
  for (const record of records) await queueLocalUpsert(record.entityType, record.recordId, record.payload);
  return records.length;
}

async function pushPending(deviceId: string): Promise<{ pushed: number; conflicts: number }> {
  const compacted = await compactPendingQueue();
  const batch = compacted.slice(0, PUSH_BATCH);
  if (!batch.length) return { pushed: 0, conflicts: 0 };
  await markMutationAttempts(batch.map((item) => item.mutationId));
  const raw = await callCloudRpc<unknown>("sync_push", {
    p_device_id: deviceId,
    p_mutations: batch,
  });
  const result = parsePushResult(raw);
  await acknowledgeAccepted(result.accepted);
  await saveConflicts(result.conflicts);
  return { pushed: result.accepted.length, conflicts: result.conflicts.length };
}

async function pullRemote(deviceId: string): Promise<number> {
  let cursor = await getPullCursor();
  let total = 0;
  for (let page = 0; page < 20; page += 1) {
    const raw = await callCloudRpc<unknown>("sync_pull", {
      p_device_id: deviceId,
      p_cursor: cursor,
      p_limit: PULL_BATCH,
    });
    const result = parsePullResult(raw);
    for (const record of result.records) {
      // Household changes are authorization-checked and revision-tracked, but do
      // not overwrite the selected personal kitchen until a household space is opened.
      if (record.scope.type === "personal") await kitchenRepository.applyRemoteRecord(record);
    }
    await saveRemoteRevisions(result.records);
    cursor = Math.max(cursor, result.nextCursor);
    await setPullCursor(cursor);
    total += result.records.length;
    if (result.records.length < PULL_BATCH) break;
  }
  return total;
}

async function performSync(): Promise<SyncRunResult> {
  if (!isCloudSyncConfigured()) throw new Error("cloud_sync_not_configured");
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("offline");
  const session = await getValidSession();
  if (!session) throw new Error("authentication_required");
  if (await isSyncPaused()) throw new Error("sync_paused");
  if (!(await hasCompletedMigration(session.user.id))) throw new Error("migration_required");
  const bound = await getBoundAccountId();
  if (bound && bound !== session.user.id) throw new Error("different_account_requires_migration");
  await setBoundAccountId(session.user.id);

  const deviceId = await getDeviceId();
  await callCloudRpc("register_sync_device", {
    p_device_id: deviceId,
    p_name: await getDeviceName(),
  });

  let pushed = 0;
  let conflicts = 0;
  for (let page = 0; page < 20; page += 1) {
    const result = await pushPending(deviceId);
    pushed += result.pushed;
    conflicts += result.conflicts;
    if (result.pushed + result.conflicts < PUSH_BATCH) break;
  }
  const pulled = await pullRemote(deviceId);
  const lastSyncAt = isoNow();
  await setLastSyncAt(lastSyncAt);
  await setLastSyncError(null);
  return {
    pushed,
    pulled,
    conflicts,
    pending: await pendingMutationCount(),
    lastSyncAt,
  };
}

export function syncNow(): Promise<SyncRunResult> {
  activeSync ??= performSync()
    .catch(async (cause) => {
      await setLastSyncError(cause instanceof Error ? cause.message : "sync_failed");
      throw cause;
    })
    .finally(() => { activeSync = null; });
  return activeSync;
}

export function getCloudKitchenSummary(): Promise<CloudKitchenSummary> {
  return callCloudRpc<CloudKitchenSummary>("sync_kitchen_summary", {});
}

async function recoverySnapshot(accountId: string, reason: RecoverySnapshot["reason"]): Promise<void> {
  const exported = await kitchenRepository.exportData();
  const createdAt = isoNow();
  await saveRecoverySnapshot({
    id: `recovery_${crypto.randomUUID()}`,
    reason,
    accountId,
    createdAt,
    expiresAt: new Date(Date.parse(createdAt) + RECOVERY_DAYS * 86_400_000).toISOString(),
    exportJson: JSON.stringify(exported),
  });
}

export async function migrateKitchen(strategy: MigrationStrategy): Promise<SyncRunResult> {
  const session = await getValidSession();
  if (!session) throw new Error("authentication_required");
  await recoverySnapshot(session.user.id, strategy === "merge" ? "account_migration" : strategy);
  const currentDeviceId = await getDeviceId();

  if (strategy === "use_local") {
    await callCloudRpc("sync_reset_personal_scope", { p_device_id: currentDeviceId });
    await clearSyncState({ keepRecovery: true });
    await setBoundAccountId(session.user.id);
    await setCompletedMigration(session.user.id, true);
    await queueFullLocalKitchen();
  } else if (strategy === "use_cloud") {
    await kitchenRepository.clearKitchenStores();
    await clearSyncState({ keepRecovery: true });
    await setBoundAccountId(session.user.id);
    await setCompletedMigration(session.user.id, true);
    await setPullCursor(0);
  } else {
    await setBoundAccountId(session.user.id);
    await setCompletedMigration(session.user.id, true);
    await queueFullLocalKitchen();
  }

  await setSyncPaused(false);
  return syncNow();
}

export function pauseSync(paused: boolean): Promise<void> {
  return setSyncPaused(paused);
}

export async function resolveConflict(conflict: SyncConflict, resolution: "keep_local" | "keep_cloud" | "safe_merge"): Promise<void> {
  await recoverySnapshot((await getValidSession())?.user.id ?? "unknown", "conflict_resolution");
  if (resolution === "keep_cloud") {
    await kitchenRepository.applyRemoteRecord(conflict.remote);
    await saveRemoteRevisions([conflict.remote]);
  } else {
    let payload = conflict.mutation.payload;
    if (resolution === "safe_merge" && conflict.mutation.entityType === "profile" && payload && conflict.remote.payload) {
      payload = mergeProfilePayload(payload, conflict.remote.payload);
    }
    await saveRemoteRevisions([conflict.remote]);
    if (payload) await queueLocalUpsert(conflict.mutation.entityType, conflict.mutation.recordId, payload, conflict.mutation.scope);
  }
  await removeConflict(conflict.id);
}

export async function syncDiagnostics() {
  const [pending, conflicts, paused, boundAccountId] = await Promise.all([
    listPendingMutations(),
    listConflicts(),
    isSyncPaused(),
    getBoundAccountId(),
  ]);
  return { pending: pending.length, conflicts, paused, boundAccountId };
}

export async function listDevices(): Promise<DeviceInfo[]> {
  return callCloudRpc<DeviceInfo[]>("list_sync_devices", { p_current_device_id: await getDeviceId() });
}

export function revokeDevice(deviceId: string): Promise<{ ok: boolean }> {
  return callCloudRpc("revoke_sync_device", { p_device_id: deviceId });
}

export function listHouseholds(): Promise<HouseholdSummary[]> {
  return callCloudRpc<HouseholdSummary[]>("list_kitchen_households", {});
}

export function createHousehold(name: string): Promise<HouseholdSummary> {
  const normalized = name.trim().slice(0, 80);
  if (!normalized) return Promise.reject(new Error("household_name_required"));
  return callCloudRpc("create_kitchen_household", { p_name: normalized });
}

export function createHouseholdInvite(householdId: string, email: string): Promise<{ token: string; expiresAt: string }> {
  return callCloudRpc("create_household_invite", {
    p_household_id: householdId,
    p_email: email.trim().toLowerCase(),
  });
}

export function acceptHouseholdInvite(token: string): Promise<HouseholdSummary> {
  return callCloudRpc("accept_household_invite", { p_token: token.trim() });
}

export function exportCloudKitchen(): Promise<unknown> {
  return callCloudRpc("export_cloud_kitchen", {});
}

export async function deleteCloudAccount(eraseLocal: boolean): Promise<void> {
  const session = await getValidSession();
  if (!session) throw new Error("authentication_required");
  await recoverySnapshot(session.user.id, "use_cloud");
  await callCloudRpc("request_account_deletion", {});
  if (eraseLocal) await kitchenRepository.clearKitchenStores();
  await clearSyncState({ keepRecovery: !eraseLocal });
}

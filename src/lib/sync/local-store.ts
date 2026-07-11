"use client";

import { isoNow } from "../kitchen/schema";
import { assertSyncPayloadSafe, compactMutations, conflictReason, syncEntityKey, validatePendingMutation } from "./security";
import {
  SYNC_PROTOCOL_VERSION,
  SYNC_RECORD_SCHEMA_VERSION,
  type PendingMutation,
  type RecoverySnapshot,
  type RemoteSyncRecord,
  type SyncConflict,
  type SyncEntityType,
  type SyncMeta,
  type SyncPayload,
  type SyncRevision,
  type SyncScope,
} from "./types";

const DB_NAME = "cook-anything-sync";
const DB_VERSION = 1;
const STORE_QUEUE = "mutationQueue";
const STORE_REVISIONS = "revisions";
const STORE_CONFLICTS = "conflicts";
const STORE_META = "meta";
const STORE_RECOVERY = "recovery";

const META_DEVICE_ID = "device_id";
const META_CURSOR = "pull_cursor";
const META_ACCOUNT_ID = "account_id";
const META_PAUSED = "sync_paused";
const META_LAST_SYNC = "last_sync_at";
const META_LAST_ERROR = "last_sync_error";
const META_MIGRATION = "migration_completed";

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("sync_indexeddb_request_failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("sync_indexeddb_transaction_aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("sync_indexeddb_transaction_failed"));
  });
}

function openSyncDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("indexeddb_unavailable"));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queue = db.createObjectStore(STORE_QUEUE, { keyPath: "mutationId" });
        queue.createIndex("createdAt", "createdAt", { unique: false });
        queue.createIndex("record", ["entityType", "recordId"], { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_REVISIONS)) db.createObjectStore(STORE_REVISIONS, { keyPath: "key" });
      if (!db.objectStoreNames.contains(STORE_CONFLICTS)) db.createObjectStore(STORE_CONFLICTS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: "key" });
      if (!db.objectStoreNames.contains(STORE_RECOVERY)) db.createObjectStore(STORE_RECOVERY, { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        databasePromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("sync_indexeddb_open_failed"));
    };
    request.onblocked = () => reject(new Error("sync_indexeddb_upgrade_blocked"));
  });
  return databasePromise;
}

function randomId(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
}

async function readMeta<T>(key: string, fallback: T): Promise<T> {
  const db = await openSyncDatabase();
  const tx = db.transaction(STORE_META, "readonly");
  const record = await requestResult(tx.objectStore(STORE_META).get(key) as IDBRequest<SyncMeta | undefined>);
  return (record?.value as T | undefined) ?? fallback;
}

async function writeMeta(key: string, value: unknown): Promise<void> {
  assertSyncPayloadSafe(value);
  const db = await openSyncDatabase();
  const tx = db.transaction(STORE_META, "readwrite");
  tx.objectStore(STORE_META).put({ key, value, updatedAt: isoNow() } satisfies SyncMeta);
  await transactionDone(tx);
}

export async function getDeviceId(): Promise<string> {
  const existing = await readMeta<string | null>(META_DEVICE_ID, null);
  if (existing) return existing;
  const deviceId = randomId("device");
  await writeMeta(META_DEVICE_ID, deviceId);
  return deviceId;
}

export async function getDeviceName(): Promise<string> {
  if (typeof navigator === "undefined") return "Cook Anything browser";
  const platform = navigator.userAgentData?.platform || navigator.platform || "Browser";
  const mobile = /iphone|ipad|android|mobile/i.test(navigator.userAgent) ? "mobile" : "computer";
  return `${platform} ${mobile}`.slice(0, 80);
}

async function baseRevision(entityType: SyncEntityType, recordId: string, scope: SyncScope): Promise<number | null> {
  const db = await openSyncDatabase();
  const tx = db.transaction(STORE_REVISIONS, "readonly");
  const key = syncEntityKey(entityType, recordId, scope.type, scope.id ?? "self");
  const record = await requestResult(tx.objectStore(STORE_REVISIONS).get(key) as IDBRequest<SyncRevision | undefined>);
  return record?.revision ?? null;
}

async function queueMutation(
  entityType: SyncEntityType,
  recordId: string,
  operation: "upsert" | "delete",
  payload: SyncPayload | undefined,
  scope: SyncScope,
): Promise<PendingMutation> {
  if (payload) assertSyncPayloadSafe(payload);
  const mutation: PendingMutation = {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    mutationId: randomId("mutation"),
    deviceId: await getDeviceId(),
    entityType,
    recordId,
    operation,
    scope,
    baseRevision: await baseRevision(entityType, recordId, scope),
    schemaVersion: SYNC_RECORD_SCHEMA_VERSION,
    ...(payload ? { payload } : {}),
    createdAt: isoNow(),
    attemptCount: 0,
  };
  validatePendingMutation(mutation);
  const db = await openSyncDatabase();
  const tx = db.transaction(STORE_QUEUE, "readwrite");
  tx.objectStore(STORE_QUEUE).put(mutation);
  await transactionDone(tx);
  return mutation;
}

export function queueLocalUpsert(
  entityType: SyncEntityType,
  recordId: string,
  payload: SyncPayload,
  scope: SyncScope = { type: "personal" },
): Promise<PendingMutation> {
  return queueMutation(entityType, recordId, "upsert", payload, scope);
}

export function queueLocalDelete(
  entityType: SyncEntityType,
  recordId: string,
  scope: SyncScope = { type: "personal" },
): Promise<PendingMutation> {
  return queueMutation(entityType, recordId, "delete", undefined, scope);
}

export async function listPendingMutations(): Promise<PendingMutation[]> {
  const db = await openSyncDatabase();
  const tx = db.transaction(STORE_QUEUE, "readonly");
  const all = await requestResult(tx.objectStore(STORE_QUEUE).getAll() as IDBRequest<PendingMutation[]>);
  return all.map(validatePendingMutation).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function compactPendingQueue(): Promise<PendingMutation[]> {
  const all = await listPendingMutations();
  const compacted = compactMutations(all);
  const keep = new Set(compacted.map((item) => item.mutationId));
  const db = await openSyncDatabase();
  const tx = db.transaction(STORE_QUEUE, "readwrite");
  for (const mutation of all) if (!keep.has(mutation.mutationId)) tx.objectStore(STORE_QUEUE).delete(mutation.mutationId);
  await transactionDone(tx);
  return compacted;
}

export async function markMutationAttempts(mutationIds: string[]): Promise<void> {
  if (!mutationIds.length) return;
  const db = await openSyncDatabase();
  const tx = db.transaction(STORE_QUEUE, "readwrite");
  const store = tx.objectStore(STORE_QUEUE);
  for (const id of mutationIds) {
    const mutation = await requestResult(store.get(id) as IDBRequest<PendingMutation | undefined>);
    if (mutation) store.put({ ...mutation, attemptCount: mutation.attemptCount + 1, lastAttemptAt: isoNow() });
  }
  await transactionDone(tx);
}

export async function acknowledgeAccepted(
  accepted: Array<{ mutationId: string; record: RemoteSyncRecord }>,
): Promise<void> {
  if (!accepted.length) return;
  const db = await openSyncDatabase();
  const tx = db.transaction([STORE_QUEUE, STORE_REVISIONS], "readwrite");
  for (const item of accepted) {
    tx.objectStore(STORE_QUEUE).delete(item.mutationId);
    const record = item.record;
    tx.objectStore(STORE_REVISIONS).put({
      key: syncEntityKey(record.entityType, record.recordId, record.scope.type, record.scope.id),
      entityType: record.entityType,
      recordId: record.recordId,
      scope: record.scope,
      revision: record.revision,
      payloadHash: record.payloadHash,
      updatedAt: record.updatedAt,
    } satisfies SyncRevision);
  }
  await transactionDone(tx);
}

export async function saveRemoteRevisions(records: RemoteSyncRecord[]): Promise<void> {
  if (!records.length) return;
  const db = await openSyncDatabase();
  const tx = db.transaction(STORE_REVISIONS, "readwrite");
  const store = tx.objectStore(STORE_REVISIONS);
  for (const record of records) {
    store.put({
      key: syncEntityKey(record.entityType, record.recordId, record.scope.type, record.scope.id),
      entityType: record.entityType,
      recordId: record.recordId,
      scope: record.scope,
      revision: record.revision,
      payloadHash: record.payloadHash,
      updatedAt: record.updatedAt,
    } satisfies SyncRevision);
  }
  await transactionDone(tx);
}

export async function saveConflicts(conflicts: SyncConflict[]): Promise<void> {
  if (!conflicts.length) return;
  const db = await openSyncDatabase();
  const tx = db.transaction([STORE_CONFLICTS, STORE_QUEUE], "readwrite");
  for (const conflict of conflicts) {
    tx.objectStore(STORE_CONFLICTS).put({
      ...conflict,
      id: conflict.id || randomId("conflict"),
      reason: conflict.reason || conflictReason(conflict.mutation, conflict.remote),
      createdAt: conflict.createdAt || isoNow(),
    });
    tx.objectStore(STORE_QUEUE).delete(conflict.mutation.mutationId);
  }
  await transactionDone(tx);
}

export async function listConflicts(): Promise<SyncConflict[]> {
  const db = await openSyncDatabase();
  const tx = db.transaction(STORE_CONFLICTS, "readonly");
  const conflicts = await requestResult(tx.objectStore(STORE_CONFLICTS).getAll() as IDBRequest<SyncConflict[]>);
  return conflicts.filter((item) => !item.resolvedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function removeConflict(id: string): Promise<void> {
  const db = await openSyncDatabase();
  const tx = db.transaction(STORE_CONFLICTS, "readwrite");
  tx.objectStore(STORE_CONFLICTS).delete(id);
  await transactionDone(tx);
}

export const getPullCursor = () => readMeta<number>(META_CURSOR, 0);
export const setPullCursor = (cursor: number) => writeMeta(META_CURSOR, Math.max(0, Math.floor(cursor)));
export const getBoundAccountId = () => readMeta<string | null>(META_ACCOUNT_ID, null);
export const setBoundAccountId = (accountId: string | null) => writeMeta(META_ACCOUNT_ID, accountId);
export const isSyncPaused = () => readMeta<boolean>(META_PAUSED, false);
export const setSyncPaused = (paused: boolean) => writeMeta(META_PAUSED, paused);
export const getLastSyncAt = () => readMeta<string | null>(META_LAST_SYNC, null);
export const setLastSyncAt = (at: string) => writeMeta(META_LAST_SYNC, at);
export const getLastSyncError = () => readMeta<string | null>(META_LAST_ERROR, null);
export const setLastSyncError = (error: string | null) => writeMeta(META_LAST_ERROR, error);
export const hasCompletedMigration = (accountId: string) => readMeta<boolean>(`${META_MIGRATION}:${accountId}`, false);
export const setCompletedMigration = (accountId: string, completed: boolean) => writeMeta(`${META_MIGRATION}:${accountId}`, completed);

export async function saveRecoverySnapshot(snapshot: RecoverySnapshot): Promise<void> {
  assertSyncPayloadSafe(snapshot);
  const db = await openSyncDatabase();
  const tx = db.transaction(STORE_RECOVERY, "readwrite");
  tx.objectStore(STORE_RECOVERY).put(snapshot);
  await transactionDone(tx);
}

export async function listRecoverySnapshots(): Promise<RecoverySnapshot[]> {
  const db = await openSyncDatabase();
  const tx = db.transaction(STORE_RECOVERY, "readwrite");
  const store = tx.objectStore(STORE_RECOVERY);
  const all = await requestResult(store.getAll() as IDBRequest<RecoverySnapshot[]>);
  const now = Date.now();
  for (const snapshot of all) if (Date.parse(snapshot.expiresAt) <= now) store.delete(snapshot.id);
  await transactionDone(tx);
  return all.filter((item) => Date.parse(item.expiresAt) > now).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function clearSyncState(options: { keepDeviceId?: boolean; keepRecovery?: boolean } = {}): Promise<void> {
  // Read the retained value before opening the write transaction. Calling
  // getDeviceId() after clearing META would open another transaction and can
  // deadlock or cause the first transaction to auto-close.
  const retainedDeviceId = options.keepDeviceId
    ? await readMeta<string | null>(META_DEVICE_ID, null)
    : null;
  const db = await openSyncDatabase();
  const stores = [STORE_QUEUE, STORE_REVISIONS, STORE_CONFLICTS, STORE_META, ...(options.keepRecovery ? [] : [STORE_RECOVERY])];
  const tx = db.transaction(stores, "readwrite");
  for (const name of stores) tx.objectStore(name).clear();
  if (retainedDeviceId) {
    tx.objectStore(STORE_META).put({ key: META_DEVICE_ID, value: retainedDeviceId, updatedAt: isoNow() } satisfies SyncMeta);
  }
  await transactionDone(tx);
}

export async function pendingMutationCount(): Promise<number> {
  const db = await openSyncDatabase();
  const tx = db.transaction(STORE_QUEUE, "readonly");
  return requestResult(tx.objectStore(STORE_QUEUE).count());
}

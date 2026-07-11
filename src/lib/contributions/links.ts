"use client";

import type { ContributionScope, RecipeDraft } from "./types";

const DB_NAME = "cook-anything-contributions";
const DB_VERSION = 1;
const STORE_DRAFTS = "drafts";

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("contribution_link_request_failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("contribution_link_transaction_failed"));
    transaction.onerror = () => reject(transaction.error ?? new Error("contribution_link_transaction_failed"));
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("indexeddb_unavailable");
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("contribution_indexeddb_open_failed"));
    request.onblocked = () => reject(new Error("contribution_indexeddb_upgrade_blocked"));
  });
}

export async function linkLocalDraftToCloud(input: {
  localDraftId: string;
  cloudDraftId: string;
  ownerId: string;
  scope: ContributionScope;
}): Promise<RecipeDraft> {
  if (!/^[0-9a-f-]{20,100}$/i.test(input.cloudDraftId)) throw new Error("invalid_cloud_draft_id");
  const db = await openDatabase();
  const tx = db.transaction(STORE_DRAFTS, "readwrite");
  const store = tx.objectStore(STORE_DRAFTS);
  const current = await requestResult(store.get(input.localDraftId) as IDBRequest<RecipeDraft | undefined>);
  if (!current) throw new Error("local_draft_not_found");
  const next: RecipeDraft = {
    ...current,
    cloudDraftId: input.cloudDraftId,
    ownerId: input.ownerId,
    scope: input.scope,
    status: input.scope.type === "household" ? "household_draft" : "private_cloud",
    updatedAt: new Date().toISOString(),
  };
  store.put(next);
  await transactionDone(tx);
  db.close();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("cook-anything:contributions"));
  return next;
}

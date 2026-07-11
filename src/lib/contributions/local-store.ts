"use client";

import {
  CONTRIBUTION_EXPORT_FORMAT,
  CONTRIBUTION_SCHEMA_VERSION,
  type ContributionScope,
  type LocalContributionExport,
  type RecipeDraft,
  type RecipeDraftContent,
  type RecipeDraftVersion,
  type RecipeSubmission,
  type RightsAttestation,
} from "./types";
import { assertContributionPayloadSafe, hashDraftContent, validateDraftContent, validateDraftVersion, validateRights } from "./security";

const DB_NAME = "cook-anything-contributions";
const DB_VERSION = 1;
const STORE_DRAFTS = "drafts";
const STORE_VERSIONS = "versions";
const STORE_SUBMISSIONS = "submissions";
const STORE_META = "meta";
const LEGACY_DRAFTS_KEY = "ca:recipe-drafts";
const LEGACY_SUBMITTED_KEY = "ca:submitted-drafts";
const MIGRATION_KEY = "legacy-drafts-migrated";
const EVENT = "cook-anything:contributions";

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("contribution_indexeddb_request_failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("contribution_indexeddb_transaction_aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("contribution_indexeddb_transaction_failed"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("indexeddb_unavailable"));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        const store = db.createObjectStore(STORE_DRAFTS, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_VERSIONS)) {
        const store = db.createObjectStore(STORE_VERSIONS, { keyPath: "id" });
        store.createIndex("draftId", "draftId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SUBMISSIONS)) {
        const store = db.createObjectStore(STORE_SUBMISSIONS, { keyPath: "id" });
        store.createIndex("draftId", "draftId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: "key" });
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
      reject(request.error ?? new Error("contribution_indexeddb_open_failed"));
    };
    request.onblocked = () => reject(new Error("contribution_indexeddb_upgrade_blocked"));
  });
  return databasePromise;
}

function now(): string { return new Date().toISOString(); }
function randomId(prefix: string): string {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${id}`;
}

function emit(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function subscribeContributions(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readonly");
  return requestResult(tx.objectStore(storeName).getAll() as IDBRequest<T[]>);
}

async function getOne<T>(storeName: string, id: IDBValidKey): Promise<T | null> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readonly");
  return (await requestResult(tx.objectStore(storeName).get(id) as IDBRequest<T | undefined>)) ?? null;
}

export class ContributionRepository {
  async listDrafts(): Promise<RecipeDraft[]> {
    return (await getAll<RecipeDraft>(STORE_DRAFTS)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getDraft(id: string): Promise<RecipeDraft | null> {
    return getOne<RecipeDraft>(STORE_DRAFTS, id);
  }

  async listVersions(draftId: string): Promise<RecipeDraftVersion[]> {
    const db = await openDatabase();
    const tx = db.transaction(STORE_VERSIONS, "readonly");
    const index = tx.objectStore(STORE_VERSIONS).index("draftId");
    const versions = await requestResult(index.getAll(draftId) as IDBRequest<RecipeDraftVersion[]>);
    return versions.sort((a, b) => b.versionNumber - a.versionNumber);
  }

  async getVersion(id: string): Promise<RecipeDraftVersion | null> {
    return getOne<RecipeDraftVersion>(STORE_VERSIONS, id);
  }

  async saveVersion(input: {
    draftId?: string;
    content: RecipeDraftContent;
    rights?: RightsAttestation | null;
    scope?: ContributionScope;
    ownerId?: string;
  }): Promise<{ draft: RecipeDraft; version: RecipeDraftVersion }> {
    const content = validateDraftContent(input.content);
    const rights = input.rights ? validateRights(input.rights) : null;
    const contentHash = await hashDraftContent(content);
    const draftId = input.draftId ?? randomId("draft");
    const existing = await this.getDraft(draftId);
    const previous = existing ? await this.getVersion(existing.latestVersionId) : null;
    if (previous?.contentHash === contentHash && JSON.stringify(previous.rights) === JSON.stringify(rights)) {
      return { draft: existing as RecipeDraft, version: previous };
    }
    const timestamp = now();
    const version: RecipeDraftVersion = validateDraftVersion({
      id: randomId("version"),
      draftId,
      versionNumber: (existing?.latestVersionNumber ?? 0) + 1,
      contentHash,
      content,
      rights,
      ...(input.ownerId ? { createdBy: input.ownerId } : {}),
      createdAt: timestamp,
      ...(previous ? { supersedesVersionId: previous.id } : {}),
    });
    const scope = input.scope ?? existing?.scope ?? { type: "personal" as const };
    const status = scope.type === "household" ? "household_draft" as const : input.ownerId ? "private_cloud" as const : "local_only" as const;
    const draft: RecipeDraft = {
      id: draftId,
      ...(input.ownerId ? { ownerId: input.ownerId } : existing?.ownerId ? { ownerId: existing.ownerId } : {}),
      scope,
      status,
      title: content.title,
      latestVersionId: version.id,
      latestVersionNumber: version.versionNumber,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const db = await openDatabase();
    const tx = db.transaction([STORE_DRAFTS, STORE_VERSIONS], "readwrite");
    tx.objectStore(STORE_DRAFTS).put(draft);
    tx.objectStore(STORE_VERSIONS).put(version);
    await transactionDone(tx);
    emit();
    return { draft, version };
  }

  async restoreVersion(draftId: string, versionId: string, ownerId?: string): Promise<{ draft: RecipeDraft; version: RecipeDraftVersion }> {
    const version = await this.getVersion(versionId);
    if (!version || version.draftId !== draftId) throw new Error("draft_version_not_found");
    return this.saveVersion({ draftId, content: version.content, rights: version.rights, ownerId });
  }

  async deleteDraft(draftId: string): Promise<void> {
    const versions = await this.listVersions(draftId);
    const submissions = (await this.listSubmissions()).filter((item) => item.draftId === draftId);
    if (submissions.some((item) => !["withdrawn", "rejected", "superseded", "takedown_completed"].includes(item.status))) {
      throw new Error("submitted_draft_cannot_be_deleted");
    }
    const db = await openDatabase();
    const tx = db.transaction([STORE_DRAFTS, STORE_VERSIONS, STORE_SUBMISSIONS], "readwrite");
    tx.objectStore(STORE_DRAFTS).delete(draftId);
    versions.forEach((item) => tx.objectStore(STORE_VERSIONS).delete(item.id));
    submissions.forEach((item) => tx.objectStore(STORE_SUBMISSIONS).delete(item.id));
    await transactionDone(tx);
    emit();
  }

  async submitVersion(draftId: string, versionId: string, contributorId?: string): Promise<RecipeSubmission> {
    const draft = await this.getDraft(draftId);
    const version = await this.getVersion(versionId);
    if (!draft || !version || version.draftId !== draftId) throw new Error("draft_version_not_found");
    if (!version.rights) throw new Error("rights_incomplete");
    const duplicate = (await this.listSubmissions()).find((item) => item.versionId === versionId && !["withdrawn", "rejected", "superseded"].includes(item.status));
    if (duplicate) return duplicate;
    const timestamp = now();
    const submission: RecipeSubmission = {
      id: randomId("submission"),
      draftId,
      versionId,
      contentHash: version.contentHash,
      ...(contributorId ? { contributorId } : {}),
      status: "submitted",
      submittedAt: timestamp,
      updatedAt: timestamp,
    };
    const nextDraft: RecipeDraft = { ...draft, status: "ready_for_submission", updatedAt: timestamp };
    const db = await openDatabase();
    const tx = db.transaction([STORE_DRAFTS, STORE_SUBMISSIONS], "readwrite");
    tx.objectStore(STORE_DRAFTS).put(nextDraft);
    tx.objectStore(STORE_SUBMISSIONS).put(submission);
    await transactionDone(tx);
    emit();
    return submission;
  }

  async listSubmissions(): Promise<RecipeSubmission[]> {
    return (await getAll<RecipeSubmission>(STORE_SUBMISSIONS)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveSubmission(submission: RecipeSubmission): Promise<void> {
    assertContributionPayloadSafe(submission);
    const db = await openDatabase();
    const tx = db.transaction(STORE_SUBMISSIONS, "readwrite");
    tx.objectStore(STORE_SUBMISSIONS).put(submission);
    await transactionDone(tx);
    emit();
  }

  async exportData(): Promise<LocalContributionExport> {
    return {
      format: CONTRIBUTION_EXPORT_FORMAT,
      schemaVersion: CONTRIBUTION_SCHEMA_VERSION,
      createdAt: now(),
      drafts: await this.listDrafts(),
      versions: await getAll<RecipeDraftVersion>(STORE_VERSIONS),
      submissions: await this.listSubmissions(),
    };
  }

  async deleteAll(): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction([STORE_DRAFTS, STORE_VERSIONS, STORE_SUBMISSIONS, STORE_META], "readwrite");
    [STORE_DRAFTS, STORE_VERSIONS, STORE_SUBMISSIONS, STORE_META].forEach((name) => tx.objectStore(name).clear());
    await transactionDone(tx);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LEGACY_DRAFTS_KEY);
      window.localStorage.removeItem(LEGACY_SUBMITTED_KEY);
    }
    emit();
  }

  async migrateLegacyDrafts(): Promise<number> {
    if (typeof window === "undefined") return 0;
    const db = await openDatabase();
    const metaTx = db.transaction(STORE_META, "readonly");
    const done = await requestResult(metaTx.objectStore(STORE_META).get(MIGRATION_KEY) as IDBRequest<{ key: string; value: boolean } | undefined>);
    if (done?.value) return 0;
    let imported = 0;
    const raw = window.localStorage.getItem(LEGACY_DRAFTS_KEY) ?? window.localStorage.getItem(LEGACY_SUBMITTED_KEY) ?? "[]";
    try {
      const values = JSON.parse(raw) as unknown;
      if (Array.isArray(values)) {
        for (const value of values.slice(0, 200)) {
          if (!value || typeof value !== "object" || Array.isArray(value)) continue;
          const legacy = value as Record<string, unknown>;
          const ingredients = Array.isArray(legacy.ingredients) ? legacy.ingredients : [];
          const steps = Array.isArray(legacy.steps) ? legacy.steps : [];
          if (typeof legacy.title !== "string" || typeof legacy.cuisine !== "string" || ingredients.length < 2 || steps.length < 2) continue;
          const content: RecipeDraftContent = {
            schemaVersion: 1,
            title: legacy.title.slice(0, 180),
            ...(typeof legacy.nativeTitle === "string" && legacy.nativeTitle ? { nativeTitle: legacy.nativeTitle.slice(0, 180) } : {}),
            description: typeof legacy.description === "string" ? legacy.description.slice(0, 1_000) : "Imported local family recipe draft.",
            cuisine: legacy.cuisine.slice(0, 120),
            ...(typeof legacy.region === "string" && legacy.region ? { region: legacy.region.slice(0, 120) } : {}),
            language: typeof legacy.language === "string" ? legacy.language.slice(0, 40) : "en",
            servings: 4,
            ingredients: ingredients.slice(0, 150).map((item, index) => {
              const ingredient = item && typeof item === "object" ? item as Record<string, unknown> : {};
              return {
                id: `ingredient-${index + 1}`,
                name: typeof ingredient.name === "string" ? ingredient.name.slice(0, 200) : `Ingredient ${index + 1}`,
                ...(typeof ingredient.normalizedName === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(ingredient.normalizedName) ? { canonicalSlug: ingredient.normalizedName } : {}),
                ...(typeof ingredient.quantity === "number" ? { quantity: ingredient.quantity } : {}),
                ...(typeof ingredient.unit === "string" && ingredient.unit ? { unit: ingredient.unit.slice(0, 80) } : {}),
                optional: ingredient.optional === true,
              };
            }),
            steps: steps.slice(0, 150).map((item, index) => {
              const step = item && typeof item === "object" ? item as Record<string, unknown> : {};
              return { id: `step-${index + 1}`, order: index + 1, text: typeof step.text === "string" ? step.text.slice(0, 4_000) : `Step ${index + 1}` };
            }),
            cookware: [],
            ...(typeof legacy.culturalNote === "string" && legacy.culturalNote ? { culturalStory: legacy.culturalNote.slice(0, 10_000) } : {}),
            safetyNotes: [],
            claimedDietaryLabels: [],
            declaredAllergens: [],
          };
          await this.saveVersion({ content });
          imported += 1;
        }
      }
    } catch {
      // Invalid legacy storage remains untouched until the migration marker is written.
    }
    const markerDb = await openDatabase();
    const markerTx = markerDb.transaction(STORE_META, "readwrite");
    markerTx.objectStore(STORE_META).put({ key: MIGRATION_KEY, value: true, updatedAt: now() });
    await transactionDone(markerTx);
    if (imported > 0) {
      window.localStorage.removeItem(LEGACY_DRAFTS_KEY);
      window.localStorage.removeItem(LEGACY_SUBMITTED_KEY);
    }
    return imported;
  }
}

export const contributionRepository = new ContributionRepository();

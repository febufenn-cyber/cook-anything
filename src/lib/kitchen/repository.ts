"use client";

import { createDefaultKitchenProfile, isoNow, mergeShoppingItems, parseKitchenExport, publicKitchenExport } from "./schema";
import {
  KITCHEN_EXPORT_FORMAT,
  KITCHEN_SCHEMA_VERSION,
  type CookHistoryEntry,
  type KitchenExport,
  type KitchenSummary,
  type LocalKitchenProfile,
  type MealPlanEntry,
  type PantryItem,
  type SavedRecipe,
  type ShoppingListItem,
} from "./types";

const DB_NAME = "cook-anything-kitchen";
const DB_VERSION = 1;
const CHANNEL_NAME = "cook-anything-kitchen-events";
const STORE_PROFILE = "profile";
const STORE_PANTRY = "pantry";
const STORE_SAVED = "savedRecipes";
const STORE_HISTORY = "history";
const STORE_SHOPPING = "shoppingList";
const STORE_PLAN = "mealPlan";
const STORE_META = "meta";

export type KitchenEventType =
  | "profile_changed"
  | "pantry_updated"
  | "saved_recipes_updated"
  | "cook_session_completed"
  | "shopping_list_updated"
  | "meal_plan_updated"
  | "local_data_replaced"
  | "local_data_deleted";

export interface KitchenEvent {
  type: KitchenEventType;
  at: string;
}

let databasePromise: Promise<IDBDatabase> | null = null;
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null;
  return (channel ??= new BroadcastChannel(CHANNEL_NAME));
}

function broadcast(type: KitchenEventType): void {
  getChannel()?.postMessage({ type, at: isoNow() } satisfies KitchenEvent);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cook-anything:kitchen", { detail: { type } }));
}

export function subscribeKitchenChanges(listener: (event: KitchenEvent) => void): () => void {
  const onWindow = (event: Event) => {
    const type = (event as CustomEvent<{ type?: KitchenEventType }>).detail?.type;
    if (type) listener({ type, at: isoNow() });
  };
  const onChannel = (event: MessageEvent<KitchenEvent>) => listener(event.data);
  if (typeof window !== "undefined") window.addEventListener("cook-anything:kitchen", onWindow);
  const current = getChannel();
  current?.addEventListener("message", onChannel);
  return () => {
    if (typeof window !== "undefined") window.removeEventListener("cook-anything:kitchen", onWindow);
    current?.removeEventListener("message", onChannel);
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb_request_failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("indexeddb_transaction_aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("indexeddb_transaction_failed"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("indexeddb_unavailable"));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PROFILE)) db.createObjectStore(STORE_PROFILE, { keyPath: "profileId" });
      if (!db.objectStoreNames.contains(STORE_PANTRY)) db.createObjectStore(STORE_PANTRY, { keyPath: "ingredientSlug" });
      if (!db.objectStoreNames.contains(STORE_SAVED)) db.createObjectStore(STORE_SAVED, { keyPath: "recipeId" });
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        const history = db.createObjectStore(STORE_HISTORY, { keyPath: "id" });
        history.createIndex("recipeId", "recipeId", { unique: false });
        history.createIndex("completedAt", "completedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SHOPPING)) db.createObjectStore(STORE_SHOPPING, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_PLAN)) db.createObjectStore(STORE_PLAN, { keyPath: "id" });
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
      reject(request.error ?? new Error("indexeddb_open_failed"));
    };
    request.onblocked = () => reject(new Error("indexeddb_upgrade_blocked"));
  });
  return databasePromise;
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readonly");
  return requestResult(transaction.objectStore(storeName).getAll() as IDBRequest<T[]>);
}

async function put<T>(storeName: string, value: T): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(value);
  await transactionDone(transaction);
}

async function remove(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(key);
  await transactionDone(transaction);
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).clear();
  await transactionDone(transaction);
}

export class IndexedDbKitchenRepository {
  async getProfile(): Promise<LocalKitchenProfile> {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_PROFILE, "readonly");
    const profile = await requestResult(transaction.objectStore(STORE_PROFILE).get("local") as IDBRequest<LocalKitchenProfile | undefined>);
    return profile ?? createDefaultKitchenProfile();
  }

  async saveProfile(profile: LocalKitchenProfile): Promise<void> {
    await put(STORE_PROFILE, { ...profile, schemaVersion: KITCHEN_SCHEMA_VERSION, profileId: "local", updatedAt: isoNow() });
    broadcast("profile_changed");
  }

  async listPantryItems(): Promise<PantryItem[]> {
    return (await getAll<PantryItem>(STORE_PANTRY)).sort((a, b) => a.ingredientSlug.localeCompare(b.ingredientSlug));
  }

  async upsertPantryItem(item: PantryItem): Promise<void> {
    await put(STORE_PANTRY, { ...item, updatedAt: isoNow() });
    broadcast("pantry_updated");
  }

  async deletePantryItem(ingredientSlug: string): Promise<void> {
    await remove(STORE_PANTRY, ingredientSlug);
    broadcast("pantry_updated");
  }

  async listSavedRecipes(): Promise<SavedRecipe[]> {
    return (await getAll<SavedRecipe>(STORE_SAVED)).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  async getSavedRecipe(recipeId: string): Promise<SavedRecipe | null> {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_SAVED, "readonly");
    return (await requestResult(transaction.objectStore(STORE_SAVED).get(recipeId) as IDBRequest<SavedRecipe | undefined>)) ?? null;
  }

  async saveRecipe(recipe: SavedRecipe): Promise<void> {
    await put(STORE_SAVED, recipe);
    broadcast("saved_recipes_updated");
  }

  async deleteSavedRecipe(recipeId: string): Promise<void> {
    await remove(STORE_SAVED, recipeId);
    broadcast("saved_recipes_updated");
  }

  async listCookHistory(): Promise<CookHistoryEntry[]> {
    return (await getAll<CookHistoryEntry>(STORE_HISTORY)).sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt));
  }

  async recordCookCompletion(entry: CookHistoryEntry): Promise<void> {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_HISTORY, STORE_SAVED], "readwrite");
    transaction.objectStore(STORE_HISTORY).put(entry);
    const savedStore = transaction.objectStore(STORE_SAVED);
    const saved = await requestResult(savedStore.get(entry.recipeId) as IDBRequest<SavedRecipe | undefined>);
    if (saved) {
      savedStore.put({ ...saved, lastCookedAt: entry.completedAt ?? isoNow(), timesCooked: saved.timesCooked + 1 });
    }
    await transactionDone(transaction);
    broadcast("cook_session_completed");
  }

  async listShoppingItems(): Promise<ShoppingListItem[]> {
    return mergeShoppingItems(await getAll<ShoppingListItem>(STORE_SHOPPING));
  }

  async saveShoppingItem(item: ShoppingListItem): Promise<void> {
    await put(STORE_SHOPPING, { ...item, updatedAt: isoNow() });
    broadcast("shopping_list_updated");
  }

  async deleteShoppingItem(id: string): Promise<void> {
    await remove(STORE_SHOPPING, id);
    broadcast("shopping_list_updated");
  }

  async listMealPlan(): Promise<MealPlanEntry[]> {
    return (await getAll<MealPlanEntry>(STORE_PLAN)).sort((a, b) => `${a.date}-${a.meal}`.localeCompare(`${b.date}-${b.meal}`));
  }

  async saveMealPlanEntry(entry: MealPlanEntry): Promise<void> {
    await put(STORE_PLAN, { ...entry, updatedAt: isoNow() });
    broadcast("meal_plan_updated");
  }

  async deleteMealPlanEntry(id: string): Promise<void> {
    await remove(STORE_PLAN, id);
    broadcast("meal_plan_updated");
  }

  async summary(): Promise<KitchenSummary> {
    const [pantry, savedRecipes, history, shoppingList, mealPlan] = await Promise.all([
      this.listPantryItems(),
      this.listSavedRecipes(),
      this.listCookHistory(),
      this.listShoppingItems(),
      this.listMealPlan(),
    ]);
    return {
      pantry: pantry.filter((item) => item.status === "available" || item.status === "running_low").length,
      savedRecipes: savedRecipes.length,
      history: history.filter((item) => item.outcome === "completed").length,
      shoppingNeeded: shoppingList.filter((item) => item.status === "needed").length,
      mealPlan: mealPlan.length,
    };
  }

  async exportData(): Promise<KitchenExport> {
    const [profile, pantry, savedRecipes, history, shoppingList, mealPlan] = await Promise.all([
      this.getProfile(),
      this.listPantryItems(),
      this.listSavedRecipes(),
      this.listCookHistory(),
      this.listShoppingItems(),
      this.listMealPlan(),
    ]);
    return publicKitchenExport({
      format: KITCHEN_EXPORT_FORMAT,
      schemaVersion: KITCHEN_SCHEMA_VERSION,
      createdAt: isoNow(),
      profile,
      pantry,
      savedRecipes,
      history,
      shoppingList,
      mealPlan,
    });
  }

  async importData(raw: string, mode: "replace" | "merge"): Promise<void> {
    const imported = parseKitchenExport(raw);
    const db = await openDatabase();
    const stores = [STORE_PROFILE, STORE_PANTRY, STORE_SAVED, STORE_HISTORY, STORE_SHOPPING, STORE_PLAN];
    const transaction = db.transaction(stores, "readwrite");
    if (mode === "replace") stores.forEach((name) => transaction.objectStore(name).clear());
    if (imported.profile) transaction.objectStore(STORE_PROFILE).put(imported.profile);
    imported.pantry.forEach((item) => transaction.objectStore(STORE_PANTRY).put(item));
    imported.savedRecipes.forEach((item) => transaction.objectStore(STORE_SAVED).put(item));
    imported.history.forEach((item) => transaction.objectStore(STORE_HISTORY).put(item));
    imported.shoppingList.forEach((item) => transaction.objectStore(STORE_SHOPPING).put(item));
    imported.mealPlan.forEach((item) => transaction.objectStore(STORE_PLAN).put(item));
    await transactionDone(transaction);
    broadcast("local_data_replaced");
  }

  async clearKitchenStores(): Promise<void> {
    await Promise.all([STORE_PROFILE, STORE_PANTRY, STORE_SAVED, STORE_HISTORY, STORE_SHOPPING, STORE_PLAN].map(clearStore));
    broadcast("local_data_deleted");
  }
}

export const kitchenRepository = new IndexedDbKitchenRepository();

export async function deleteAllLocalCookAnythingData(): Promise<void> {
  try { await kitchenRepository.clearKitchenStores(); } catch { /* IndexedDB may be unavailable */ }
  if (typeof window !== "undefined") {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key));
      keys.filter((key) => key.startsWith("cook-anything")).forEach((key) => storage.removeItem(key));
    }
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("cook-anything")).map((name) => caches.delete(name)));
    }
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_LOCAL_CACHES" });
  }
  broadcast("local_data_deleted");
}

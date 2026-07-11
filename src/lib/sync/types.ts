import type {
  CookHistoryEntry,
  LocalKitchenProfile,
  MealPlanEntry,
  PantryItem,
  SavedRecipe,
  ShoppingListItem,
} from "../kitchen/types";

export const SYNC_PROTOCOL_VERSION = 1;
export const SYNC_RECORD_SCHEMA_VERSION = 1;

export type SyncEntityType =
  | "profile"
  | "pantry_item"
  | "saved_recipe"
  | "cook_history"
  | "shopping_item"
  | "meal_plan_entry";

export type SyncOperation = "upsert" | "delete";
export type SyncScopeType = "personal" | "household";
export type SyncStatus = "local_only" | "paused" | "idle" | "syncing" | "offline" | "error" | "migration_required";

export type SyncPayload =
  | LocalKitchenProfile
  | PantryItem
  | SavedRecipe
  | CookHistoryEntry
  | ShoppingListItem
  | MealPlanEntry;

export interface SyncScope {
  type: SyncScopeType;
  /** Personal scope is inferred from the authenticated user when omitted. */
  id?: string;
}

export interface PendingMutation {
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  mutationId: string;
  deviceId: string;
  entityType: SyncEntityType;
  recordId: string;
  operation: SyncOperation;
  scope: SyncScope;
  baseRevision: number | null;
  schemaVersion: typeof SYNC_RECORD_SCHEMA_VERSION;
  payload?: SyncPayload;
  createdAt: string;
  attemptCount: number;
  lastAttemptAt?: string;
}

export interface RemoteSyncRecord {
  entityType: SyncEntityType;
  recordId: string;
  scope: Required<SyncScope>;
  schemaVersion: number;
  revision: number;
  deviceId: string;
  payload: SyncPayload | null;
  payloadHash: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  changeSequence: number;
}

export interface SyncRevision {
  key: string;
  entityType: SyncEntityType;
  recordId: string;
  scope: Required<SyncScope>;
  revision: number;
  payloadHash: string;
  updatedAt: string;
}

export interface SyncConflict {
  id: string;
  mutation: PendingMutation;
  remote: RemoteSyncRecord;
  reason: "stale_revision" | "delete_edit" | "safety_preference" | "meal_slot" | "concurrent_edit";
  createdAt: string;
  resolvedAt?: string;
}

export interface SyncPushResult {
  accepted: Array<{
    mutationId: string;
    record: RemoteSyncRecord;
  }>;
  conflicts: SyncConflict[];
}

export interface SyncPullResult {
  nextCursor: number;
  records: RemoteSyncRecord[];
  serverTime: string;
}

export interface SyncMeta {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface RecoverySnapshot {
  id: string;
  reason: "account_migration" | "use_cloud" | "use_local" | "conflict_resolution";
  accountId: string;
  createdAt: string;
  expiresAt: string;
  exportJson: string;
}

export interface CloudKitchenSummary {
  profile: number;
  pantry: number;
  savedRecipes: number;
  history: number;
  shopping: number;
  mealPlan: number;
  deleted: number;
}

export type MigrationStrategy = "merge" | "use_local" | "use_cloud";

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  user: AuthUser;
}

export interface DeviceInfo {
  id: string;
  name: string;
  current: boolean;
  lastSeenAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface HouseholdSummary {
  id: string;
  name: string;
  role: "owner" | "editor" | "viewer";
  memberCount: number;
  createdAt: string;
}

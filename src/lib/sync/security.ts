import type { PendingMutation, RemoteSyncRecord, SyncConflict, SyncPayload } from "./types";

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const SECRET_KEY_PATTERN = /api.?key|authorization|cookie|session.?token|access.?token|refresh.?token|oauth|password|secret/i;
const MAX_DEPTH = 12;
const MAX_ARRAY = 20_000;
const MAX_STRING = 100_000;
const MAX_MUTATION_BYTES = 256_000;

export function assertSyncPayloadSafe(value: unknown, depth = 0): void {
  if (depth > MAX_DEPTH) throw new Error("sync_payload_too_deep");
  if (value === null || typeof value === "number" || typeof value === "boolean") return;
  if (typeof value === "string") {
    if (value.length > MAX_STRING) throw new Error("sync_payload_too_large");
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY) throw new Error("sync_payload_too_large");
    value.forEach((item) => assertSyncPayloadSafe(item, depth + 1));
    return;
  }
  if (!value || typeof value !== "object") throw new Error("invalid_sync_payload");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error("invalid_sync_payload");
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error("invalid_sync_payload");
    if (SECRET_KEY_PATTERN.test(key)) throw new Error("secret_field_forbidden");
    assertSyncPayloadSafe(child, depth + 1);
  }
}

export function stableJson(value: unknown): string {
  assertSyncPayloadSafe(value);
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (!input || typeof input !== "object") return input;
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalize(child)]),
    );
  };
  return JSON.stringify(normalize(value));
}

export async function payloadHash(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(stableJson(value));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validatePendingMutation(value: unknown): PendingMutation {
  assertSyncPayloadSafe(value);
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  if (encoded.byteLength > MAX_MUTATION_BYTES) throw new Error("sync_mutation_too_large");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_sync_mutation");
  const mutation = value as Partial<PendingMutation>;
  if (mutation.protocolVersion !== 1 || mutation.schemaVersion !== 1) throw new Error("unsupported_sync_protocol");
  if (typeof mutation.mutationId !== "string" || mutation.mutationId.length > 100) throw new Error("invalid_sync_mutation");
  if (typeof mutation.deviceId !== "string" || mutation.deviceId.length > 100) throw new Error("invalid_sync_mutation");
  if (typeof mutation.recordId !== "string" || !mutation.recordId || mutation.recordId.length > 180) throw new Error("invalid_sync_mutation");
  if (!mutation.scope || (mutation.scope.type !== "personal" && mutation.scope.type !== "household")) throw new Error("invalid_sync_scope");
  if (mutation.scope.type === "household" && !mutation.scope.id) throw new Error("invalid_sync_scope");
  if (mutation.operation !== "upsert" && mutation.operation !== "delete") throw new Error("invalid_sync_mutation");
  if (mutation.operation === "upsert" && !mutation.payload) throw new Error("invalid_sync_mutation");
  if (mutation.operation === "delete" && mutation.payload !== undefined) throw new Error("invalid_sync_mutation");
  return mutation as PendingMutation;
}

export function syncEntityKey(
  entityType: string,
  recordId: string,
  scopeType = "personal",
  scopeId = "self",
): string {
  // The server expands personal scope to auth.uid(), but every personal record
  // on one browser must share the same local revision namespace before and after
  // authentication. Household scope retains its explicit UUID.
  const normalizedScopeId = scopeType === "personal" ? "self" : scopeId;
  return `${scopeType}:${normalizedScopeId}:${entityType}:${recordId}`;
}

export function compactMutations(mutations: PendingMutation[]): PendingMutation[] {
  const latest = new Map<string, PendingMutation>();
  for (const mutation of [...mutations].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const key = syncEntityKey(mutation.entityType, mutation.recordId, mutation.scope.type, mutation.scope.id ?? "self");
    latest.set(key, mutation);
  }
  return [...latest.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Safety preferences merge by union so another device cannot silently weaken them. */
export function mergeProfilePayload(local: SyncPayload, remote: SyncPayload): SyncPayload {
  const left = local as Record<string, unknown>;
  const right = remote as Record<string, unknown>;
  if (left.profileId !== "local" || right.profileId !== "local") return local;
  const union = (a: unknown, b: unknown) => [...new Set([
    ...(Array.isArray(a) ? a.filter((item): item is string => typeof item === "string") : []),
    ...(Array.isArray(b) ? b.filter((item): item is string => typeof item === "string") : []),
  ])];
  return {
    ...right,
    ...left,
    allergensToAvoid: union(left.allergensToAvoid, right.allergensToAvoid),
    excludedIngredients: union(left.excludedIngredients, right.excludedIngredients),
    updatedAt: new Date().toISOString(),
  } as SyncPayload;
}

export function conflictReason(mutation: PendingMutation, remote: RemoteSyncRecord): SyncConflict["reason"] {
  if (mutation.operation === "delete" || remote.deletedAt) return "delete_edit";
  if (mutation.entityType === "profile") return "safety_preference";
  if (mutation.entityType === "meal_plan_entry") return "meal_slot";
  return "concurrent_edit";
}

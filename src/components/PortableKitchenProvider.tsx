"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  acceptHouseholdInvite,
  createHousehold,
  createHouseholdInvite,
  deleteCloudAccount,
  getCloudKitchenSummary,
  listDevices,
  listHouseholds,
  migrateKitchen,
  pauseSync,
  resolveConflict,
  revokeDevice,
  syncDiagnostics,
  syncNow,
  type SyncRunResult,
} from "@/lib/sync/engine";
import {
  clearSyncState,
  getLastSyncAt,
  hasCompletedMigration,
  isSyncPaused,
  pendingMutationCount,
} from "@/lib/sync/local-store";
import {
  beginOAuth,
  consumeAuthRedirect,
  isCloudSyncConfigured,
  loadStoredSession,
  sendMagicLink,
  signOutCloud,
  subscribeAuth,
} from "@/lib/sync/supabase-rest";
import type {
  AuthSession,
  CloudKitchenSummary,
  DeviceInfo,
  HouseholdSummary,
  MigrationStrategy,
  SyncConflict,
  SyncStatus,
} from "@/lib/sync/types";

interface PortableKitchenContextValue {
  configured: boolean;
  session: AuthSession | null;
  status: SyncStatus;
  pending: number;
  conflicts: SyncConflict[];
  lastSyncAt: string | null;
  cloudSummary: CloudKitchenSummary | null;
  devices: DeviceInfo[];
  households: HouseholdSummary[];
  error: string | null;
  signInOAuth(provider: "google" | "apple"): Promise<void>;
  sendMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  migrate(strategy: MigrationStrategy): Promise<SyncRunResult>;
  sync(): Promise<SyncRunResult>;
  setPaused(paused: boolean): Promise<void>;
  resolve(conflict: SyncConflict, resolution: "keep_local" | "keep_cloud" | "safe_merge"): Promise<void>;
  revokeDevice(deviceId: string): Promise<void>;
  createHousehold(name: string): Promise<void>;
  createInvite(householdId: string, email: string): Promise<{ token: string; expiresAt: string }>;
  acceptInvite(token: string): Promise<void>;
  deleteAccount(eraseLocal: boolean): Promise<void>;
  refresh(): Promise<void>;
}

const PortableKitchenContext = createContext<PortableKitchenContextValue | null>(null);

export function usePortableKitchen(): PortableKitchenContextValue {
  const context = useContext(PortableKitchenContext);
  if (!context) throw new Error("PortableKitchenProvider is missing");
  return context;
}

export default function PortableKitchenProvider({ children }: { children: React.ReactNode }) {
  const configured = isCloudSyncConfigured();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<SyncStatus>(configured ? "local_only" : "local_only");
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [lastSyncAt, setLastSyncAtState] = useState<string | null>(null);
  const [cloudSummary, setCloudSummary] = useState<CloudKitchenSummary | null>(null);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const current = loadStoredSession();
    setSession(current);
    setPending(await pendingMutationCount().catch(() => 0));
    setLastSyncAtState(await getLastSyncAt().catch(() => null));
    if (!configured || !current) {
      setStatus("local_only");
      setConflicts([]);
      setCloudSummary(null);
      setDevices([]);
      setHouseholds([]);
      return;
    }
    const migrated = await hasCompletedMigration(current.user.id).catch(() => false);
    if (!migrated) {
      setStatus("migration_required");
      setCloudSummary(await getCloudKitchenSummary().catch(() => null));
      const diagnostics = await syncDiagnostics().catch(() => null);
      setConflicts(diagnostics?.conflicts ?? []);
      return;
    }
    const diagnostics = await syncDiagnostics();
    setPending(diagnostics.pending);
    setConflicts(diagnostics.conflicts);
    setStatus(diagnostics.paused ? "paused" : navigator.onLine ? "idle" : "offline");
    const [nextDevices, nextHouseholds] = await Promise.all([
      listDevices().catch(() => []),
      listHouseholds().catch(() => []),
    ]);
    setDevices(nextDevices);
    setHouseholds(nextHouseholds);
  }, [configured]);

  const runSync = useCallback(async () => {
    setStatus(navigator.onLine ? "syncing" : "offline");
    setError(null);
    try {
      const result = await syncNow();
      setLastSyncAtState(result.lastSyncAt);
      await refresh();
      return result;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "sync_failed";
      setError(message);
      setStatus(message === "offline" ? "offline" : message === "migration_required" ? "migration_required" : "error");
      throw cause;
    }
  }, [refresh]);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    consumeAuthRedirect()
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "sign_in_failed"); })
      .finally(() => { if (active) void refresh(); });
    const unsubscribe = subscribeAuth(() => void refresh());
    const onOnline = () => {
      void refresh().then(() => {
        const current = loadStoredSession();
        if (current) void runSync().catch(() => undefined);
      });
    };
    const onOffline = () => setStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [configured, refresh, runSync]);

  useEffect(() => {
    if (!configured || !session || status === "migration_required" || status === "paused") return;
    const interval = window.setInterval(() => {
      if (navigator.onLine && document.visibilityState === "visible") void runSync().catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [configured, session, status, runSync]);

  const value = useMemo<PortableKitchenContextValue>(() => ({
    configured,
    session,
    status,
    pending,
    conflicts,
    lastSyncAt,
    cloudSummary,
    devices,
    households,
    error,
    signInOAuth: beginOAuth,
    sendMagicLink,
    async signOut() {
      await signOutCloud();
      await clearSyncState({ keepDeviceId: true, keepRecovery: true });
      setSession(null);
      setStatus("local_only");
      await refresh();
    },
    async migrate(strategy) {
      setStatus("syncing");
      const result = await migrateKitchen(strategy);
      await refresh();
      return result;
    },
    sync: runSync,
    async setPaused(paused) {
      await pauseSync(paused);
      await refresh();
    },
    async resolve(conflict, resolution) {
      await resolveConflict(conflict, resolution);
      await runSync();
    },
    async revokeDevice(deviceId) {
      await revokeDevice(deviceId);
      await refresh();
    },
    async createHousehold(name) {
      await createHousehold(name);
      await refresh();
    },
    createInvite: createHouseholdInvite,
    async acceptInvite(token) {
      await acceptHouseholdInvite(token);
      await refresh();
    },
    async deleteAccount(eraseLocal) {
      await deleteCloudAccount(eraseLocal);
      await signOutCloud();
      setSession(null);
      setStatus("local_only");
      await refresh();
    },
    refresh,
  }), [configured, session, status, pending, conflicts, lastSyncAt, cloudSummary, devices, households, error, refresh, runSync]);

  return <PortableKitchenContext.Provider value={value}>{children}</PortableKitchenContext.Provider>;
}

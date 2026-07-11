"use client";

import { useEffect, useState } from "react";
import { kitchenRepository } from "@/lib/kitchen/repository";
import { exportCloudKitchen } from "@/lib/sync/engine";
import { listRecoverySnapshots } from "@/lib/sync/local-store";
import type { RecoverySnapshot } from "@/lib/sync/types";
import { usePortableKitchen } from "./PortableKitchenProvider";

function downloadJson(name: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function CloudDataTools() {
  const portable = usePortableKitchen();
  const [snapshots, setSnapshots] = useState<RecoverySnapshot[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void listRecoverySnapshots().then(setSnapshots).catch(() => setSnapshots([]));
  }, [portable.session, portable.lastSyncAt]);

  if (!portable.configured || !portable.session) return null;

  async function exportCloud() {
    try {
      const exported = await exportCloudKitchen();
      downloadJson(`cook-anything-cloud-${new Date().toISOString().slice(0, 10)}.json`, exported);
      setMessage("Cloud export created. Auth tokens and API keys are not included.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Cloud export failed.");
    }
  }

  async function restore(snapshot: RecoverySnapshot) {
    if (!confirm("Replace this browser's local kitchen with this recovery snapshot? Cloud data will not be changed until you sync.")) return;
    try {
      await kitchenRepository.importData(snapshot.exportJson, "replace");
      await portable.refresh();
      setMessage("Recovery snapshot restored locally. Review it before syncing.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Recovery restore failed.");
    }
  }

  return (
    <section className="mt-8 rounded-card border border-cardamom bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-display text-2xl">Export and recovery</h2><p className="mt-1 text-xs text-tamarind-faint">Cloud export includes synchronized records you can access. Local recovery snapshots expire after 14 days.</p></div>
        <button onClick={() => void exportCloud()} className="rounded-full border border-cardamom px-4 py-2 text-sm font-semibold">Export cloud data</button>
      </div>
      {snapshots.length > 0 && <div className="mt-4 divide-y divide-cardamom">{snapshots.map((snapshot) => <div key={snapshot.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{snapshot.reason.replaceAll("_", " ")}</p><p className="text-xs text-tamarind-faint">Created {new Date(snapshot.createdAt).toLocaleString()} · expires {new Date(snapshot.expiresAt).toLocaleDateString()}</p></div><button onClick={() => void restore(snapshot)} className="rounded-full border border-cardamom px-3 py-2 text-xs">Restore locally</button></div>)}</div>}
      {message && <p className="mt-3 text-sm" aria-live="polite">{message}</p>}
    </section>
  );
}

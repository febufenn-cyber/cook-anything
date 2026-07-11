"use client";

import Link from "next/link";
import { usePortableKitchen } from "./PortableKitchenProvider";

export default function SyncStatusPill() {
  const portable = usePortableKitchen();
  const labels = {
    local_only: "Local",
    migration_required: "Connect",
    syncing: "Syncing…",
    idle: portable.pending ? `${portable.pending} pending` : "Synced",
    paused: "Paused",
    offline: "Offline saved",
    error: "Sync issue",
  } as const;
  const warning = portable.status === "error" || portable.status === "migration_required";
  return (
    <Link
      href="/account"
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${warning ? "border-chilli/40 bg-chilli-tint text-chilli" : "border-cardamom bg-card text-tamarind-soft"}`}
      aria-label={`Account and kitchen sync: ${labels[portable.status]}`}
    >
      {labels[portable.status]}
    </Link>
  );
}

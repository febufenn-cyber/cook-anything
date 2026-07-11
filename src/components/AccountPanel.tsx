"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { kitchenRepository, subscribeKitchenChanges } from "@/lib/kitchen/repository";
import type { KitchenSummary } from "@/lib/kitchen/types";
import type { SyncConflict } from "@/lib/sync/types";
import { usePortableKitchen } from "./PortableKitchenProvider";

const EMPTY: KitchenSummary = { pantry: 0, savedRecipes: 0, history: 0, shoppingNeeded: 0, mealPlan: 0 };

function relativeTime(value: string | null): string {
  if (!value) return "Not synced yet";
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1_000));
  if (seconds < 60) return "Just now";
  if (seconds < 3_600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)} hr ago`;
  return `${Math.floor(seconds / 86_400)} days ago`;
}

function SummaryGrid({ title, values }: { title: string; values: KitchenSummary | null }) {
  const rows = values
    ? [
        ["Pantry", values.pantry],
        ["Saved", values.savedRecipes],
        ["Cooked", values.history],
        ["Shopping", values.shoppingNeeded],
        ["Planned", values.mealPlan],
      ]
    : [];
  return (
    <div className="rounded-card border border-cardamom bg-card p-4">
      <h3 className="font-display text-lg">{title}</h3>
      {rows.length ? (
        <dl className="mt-3 grid grid-cols-5 gap-2 text-center">
          {rows.map(([label, count]) => <div key={String(label)}><dt className="text-[10px] uppercase text-tamarind-faint">{label}</dt><dd className="font-semibold">{count}</dd></div>)}
        </dl>
      ) : <p className="mt-2 text-xs text-tamarind-faint">No summary available.</p>}
    </div>
  );
}

function ConflictCard({ conflict }: { conflict: SyncConflict }) {
  const portable = usePortableKitchen();
  const local = conflict.mutation.payload ? JSON.stringify(conflict.mutation.payload, null, 2) : "Deleted on this device";
  const remote = conflict.remote.payload ? JSON.stringify(conflict.remote.payload, null, 2) : "Deleted on the other device";
  return (
    <article className="rounded-card border border-chilli/30 bg-chilli-tint/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="font-semibold">{conflict.mutation.entityType.replaceAll("_", " ")}</p><p className="text-xs text-tamarind-faint">{conflict.mutation.recordId} · {conflict.reason.replaceAll("_", " ")}</p></div>
        <span className="rounded-full bg-card px-2 py-1 text-[11px]">Revision {conflict.remote.revision}</span>
      </div>
      <details className="mt-3 text-xs"><summary className="cursor-pointer font-medium">Review both versions</summary><div className="mt-2 grid gap-2 lg:grid-cols-2"><pre className="max-h-52 overflow-auto rounded bg-card p-2 whitespace-pre-wrap">This device\n{local}</pre><pre className="max-h-52 overflow-auto rounded bg-card p-2 whitespace-pre-wrap">Cloud\n{remote}</pre></div></details>
      <div className="mt-3 flex flex-wrap gap-2">
        {conflict.mutation.entityType === "profile" && <button onClick={() => void portable.resolve(conflict, "safe_merge")} className="rounded-full bg-curry px-3 py-2 text-xs font-semibold text-white">Safely merge restrictions</button>}
        <button onClick={() => void portable.resolve(conflict, "keep_local")} className="rounded-full border border-cardamom bg-card px-3 py-2 text-xs font-semibold">Keep this device</button>
        <button onClick={() => void portable.resolve(conflict, "keep_cloud")} className="rounded-full border border-cardamom bg-card px-3 py-2 text-xs font-semibold">Keep cloud version</button>
      </div>
    </article>
  );
}

export default function AccountPanel() {
  const portable = usePortableKitchen();
  const [localSummary, setLocalSummary] = useState<KitchenSummary>(EMPTY);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteHousehold, setInviteHousehold] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  useEffect(() => {
    const refresh = () => void kitchenRepository.summary().then(setLocalSummary).catch(() => setLocalSummary(EMPTY));
    refresh();
    return subscribeKitchenChanges(refresh);
  }, []);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite");
    if (!token || !portable.session) return;
    setBusy(true);
    portable.acceptInvite(token)
      .then(() => {
        setMessage("Household invitation accepted.");
        const url = new URL(window.location.href);
        url.searchParams.delete("invite");
        window.history.replaceState(null, "", url.toString());
      })
      .catch((cause) => setMessage(cause instanceof Error ? cause.message : "Could not accept invitation."))
      .finally(() => setBusy(false));
  }, [portable.session]);

  const statusCopy = useMemo(() => {
    const copy: Record<string, string> = {
      local_only: "Saved on this device",
      migration_required: "Choose how to connect this local kitchen",
      syncing: "Syncing securely",
      idle: "Saved and synced",
      paused: "Saved locally · cloud sync paused",
      offline: "Saved locally · waiting for connection",
      error: "Saved locally · cloud sync needs attention",
    };
    return copy[portable.status] ?? portable.status;
  }, [portable.status]);

  async function action(task: () => Promise<unknown>, success: string) {
    setBusy(true); setMessage("");
    try { await task(); setMessage(success); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Action failed."); }
    finally { setBusy(false); }
  }

  if (!portable.configured) {
    return (
      <div className="space-y-5">
        <section className="rounded-card border border-cardamom bg-card p-6">
          <h2 className="font-display text-2xl">Your kitchen remains local</h2>
          <p className="mt-2 text-sm text-tamarind-soft">Cloud portability is installed but disabled until a Supabase project, publishable browser key and the Phase 5 database migration are configured. No account is required and no local kitchen data is transmitted.</p>
          <div className="mt-4 flex gap-2"><Link href="/kitchen" className="rounded-full bg-turmeric px-4 py-2 text-sm font-semibold">Open local kitchen</Link><Link href="/privacy" className="rounded-full border border-cardamom px-4 py-2 text-sm">Privacy details</Link></div>
        </section>
        <SummaryGrid title="Stored only on this device" values={localSummary} />
      </div>
    );
  }

  if (!portable.session) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-card border border-cardamom bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-turmeric-deep">Optional portability</p>
          <h2 className="font-display mt-2 text-3xl">Keep your kitchen on every device</h2>
          <p className="mt-3 text-sm text-tamarind-soft">Signing in is optional. Your current kitchen stays usable while offline, and you will preview local and cloud counts before anything is merged or replaced.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button disabled={busy} onClick={() => void action(() => portable.signInOAuth("google"), "Opening Google sign-in…")} className="min-h-12 rounded-card border border-cardamom bg-rice px-4 font-semibold">Continue with Google</button>
            <button disabled={busy} onClick={() => void action(() => portable.signInOAuth("apple"), "Opening Apple sign-in…")} className="min-h-12 rounded-card border border-cardamom bg-rice px-4 font-semibold">Continue with Apple</button>
          </div>
          <div className="mt-5 border-t border-cardamom pt-5">
            <label className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Email magic link</label>
            <div className="mt-2 flex gap-2"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="min-h-11 flex-1 rounded-card border border-cardamom bg-rice px-3"/><button disabled={busy} onClick={() => void action(() => portable.sendMagicLink(email), "Check your email for the sign-in link.")} className="rounded-card bg-turmeric px-4 font-semibold">Send link</button></div>
          </div>
          {message && <p className="mt-4 text-sm" aria-live="polite">{message}</p>}
        </section>
        <SummaryGrid title="Your current local kitchen" values={localSummary} />
      </div>
    );
  }

  if (portable.status === "migration_required") {
    const cloud = portable.cloudSummary ? {
      pantry: portable.cloudSummary.pantry,
      savedRecipes: portable.cloudSummary.savedRecipes,
      history: portable.cloudSummary.history,
      shoppingNeeded: portable.cloudSummary.shopping,
      mealPlan: portable.cloudSummary.mealPlan,
    } : null;
    return (
      <div className="space-y-5">
        <section className="rounded-card border border-turmeric bg-turmeric-tint/40 p-6"><p className="text-xs font-semibold uppercase tracking-wider text-turmeric-deep">Signed in as {portable.session.user.email ?? portable.session.user.displayName ?? "your account"}</p><h2 className="font-display mt-2 text-3xl">Choose how to connect your kitchens</h2><p className="mt-2 text-sm text-tamarind-soft">Nothing has been uploaded or replaced yet. A local recovery snapshot is created before every choice.</p></section>
        <div className="grid gap-4 lg:grid-cols-2"><SummaryGrid title="This device" values={localSummary}/><SummaryGrid title="Cloud kitchen" values={cloud}/></div>
        <div className="grid gap-3 lg:grid-cols-3">
          <button disabled={busy} onClick={() => void action(() => portable.migrate("merge"), "Both kitchens merged and synced.")} className="rounded-card border-2 border-curry bg-curry-tint p-5 text-left"><strong className="text-curry">Merge both kitchens</strong><span className="mt-1 block text-xs text-tamarind-soft">Recommended. Independent records combine; true conflicts stay visible for review.</span></button>
          <button disabled={busy} onClick={() => { if (confirm("Replace the personal cloud kitchen with this device after creating a recovery snapshot?")) void action(() => portable.migrate("use_local"), "This device is now the cloud kitchen."); }} className="rounded-card border border-cardamom bg-card p-5 text-left"><strong>Use this device</strong><span className="mt-1 block text-xs text-tamarind-soft">Resets personal cloud records, then uploads this browser’s kitchen.</span></button>
          <button disabled={busy} onClick={() => { if (confirm("Replace this browser’s kitchen with the cloud copy after creating a recovery snapshot?")) void action(() => portable.migrate("use_cloud"), "Cloud kitchen restored to this device."); }} className="rounded-card border border-cardamom bg-card p-5 text-left"><strong>Use cloud kitchen</strong><span className="mt-1 block text-xs text-tamarind-soft">Clears local kitchen stores, then downloads the cloud copy.</span></button>
        </div>
        {message && <p className="text-sm" aria-live="polite">{message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-card border border-cardamom bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-turmeric-deep">{portable.session.user.email ?? portable.session.user.displayName ?? "Signed in"}</p><h2 className="font-display mt-1 text-2xl">{statusCopy}</h2><p className="mt-1 text-xs text-tamarind-faint">Last sync: {relativeTime(portable.lastSyncAt)} · {portable.pending} pending change{portable.pending === 1 ? "" : "s"}</p></div><div className="flex flex-wrap gap-2"><button disabled={busy || portable.status === "syncing"} onClick={() => void action(portable.sync, "Kitchen synchronized.")} className="rounded-full bg-turmeric px-4 py-2 text-sm font-semibold">Sync now</button><button onClick={() => void action(() => portable.setPaused(portable.status !== "paused"), portable.status === "paused" ? "Sync resumed." : "Sync paused; local saves continue.")} className="rounded-full border border-cardamom px-4 py-2 text-sm">{portable.status === "paused" ? "Resume" : "Pause"}</button></div></div>
        {portable.error && <p className="mt-3 rounded bg-chilli-tint p-3 text-sm text-chilli">{portable.error}</p>}{message && <p className="mt-3 text-sm" aria-live="polite">{message}</p>}
      </section>

      {portable.conflicts.length > 0 && <section><h2 className="font-display text-2xl">Changes needing review</h2><p className="mt-1 text-xs text-tamarind-faint">Nothing here was silently overwritten. Allergen and exclusion conflicts can be merged conservatively.</p><div className="mt-4 space-y-3">{portable.conflicts.map((conflict) => <ConflictCard key={conflict.id} conflict={conflict}/>)}</div></section>}

      <section className="rounded-card border border-cardamom bg-card p-5"><h2 className="font-display text-2xl">Devices</h2><div className="mt-3 divide-y divide-cardamom">{portable.devices.map((device) => <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{device.name}{device.current ? " · this device" : ""}</p><p className="text-xs text-tamarind-faint">Last seen {relativeTime(device.lastSeenAt)}{device.revokedAt ? " · revoked" : ""}</p></div>{!device.current && !device.revokedAt && <button onClick={() => { if (confirm(`Revoke ${device.name}?`)) void action(() => portable.revokeDevice(device.id), "Device revoked."); }} className="rounded-full border border-chilli/30 px-3 py-2 text-xs text-chilli">Revoke</button>}</div>)}{portable.devices.length === 0 && <p className="py-3 text-sm text-tamarind-faint">Device list is unavailable until the first successful sync.</p>}</div></section>

      <section className="rounded-card border border-cardamom bg-card p-5"><h2 className="font-display text-2xl">Private household spaces</h2><p className="mt-1 text-xs text-tamarind-faint">Membership and invitations are implemented. Personal history, allergy preferences, API keys and companion content are never shared automatically.</p><div className="mt-4 flex gap-2"><input value={householdName} onChange={(event) => setHouseholdName(event.target.value)} placeholder="William family" className="min-h-11 flex-1 rounded-card border border-cardamom bg-rice px-3"/><button onClick={() => void action(() => portable.createHousehold(householdName), "Household created.").then(() => setHouseholdName(""))} className="rounded-card bg-turmeric px-4 font-semibold">Create</button></div><div className="mt-4 space-y-3">{portable.households.map((household) => <div key={household.id} className="rounded-card border border-cardamom bg-rice p-4"><div className="flex justify-between gap-2"><div><p className="font-semibold">{household.name}</p><p className="text-xs text-tamarind-faint">{household.role} · {household.memberCount} member{household.memberCount === 1 ? "" : "s"}</p></div><button onClick={() => setInviteHousehold(inviteHousehold === household.id ? "" : household.id)} className="rounded-full border border-cardamom px-3 py-1 text-xs">Invite</button></div>{inviteHousehold === household.id && <div className="mt-3 flex gap-2"><input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="family@example.com" className="min-h-10 flex-1 rounded-card border border-cardamom bg-card px-3"/><button onClick={() => void action(async () => { const invite = await portable.createInvite(household.id, inviteEmail); const link = `${window.location.origin}/account/?invite=${encodeURIComponent(invite.token)}`; setInviteLink(link); await navigator.clipboard?.writeText(link); }, "Single-use invitation copied.")} className="rounded-card bg-curry px-3 text-xs font-semibold text-white">Create invite</button></div>}</div>)}{inviteLink && <p className="break-all rounded bg-curry-tint p-3 text-xs">Invitation link: {inviteLink}</p>}</div></section>

      <section className="rounded-card border border-cardamom bg-card p-5"><h2 className="font-display text-2xl">Account and cloud data</h2><p className="mt-1 text-xs text-tamarind-faint">Signing out keeps this browser’s kitchen. Cloud deletion is separate and asks whether local data should remain.</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void action(portable.signOut, "Signed out. Local kitchen kept on this device.")} className="rounded-full border border-cardamom px-4 py-2 text-sm">Sign out · keep local</button><button onClick={() => { const erase = confirm("Press OK to delete the cloud account AND this browser’s kitchen. Press Cancel to delete only cloud data and keep this device."); if (confirm(`Permanently request cloud account deletion${erase ? " and erase this browser" : " while keeping this browser"}?`)) void action(() => portable.deleteAccount(erase), "Cloud account deletion requested."); }} className="rounded-full border border-chilli/40 px-4 py-2 text-sm text-chilli">Delete cloud account</button></div></section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePortableKitchen } from "./PortableKitchenProvider";
import {
  addCookTest,
  addEditorialReview,
  createPublicationCandidate,
  listReviewQueue,
  type CloudSubmissionBundle,
} from "@/lib/contributions/cloud";
import { canonicalDraftSlug } from "@/lib/contributions/security";
import type { CookTestOutcome, ReviewDecision, ReviewerRole } from "@/lib/contributions/types";

export default function ReviewQueue() {
  const { configured, session } = usePortableKitchen();
  const [queue, setQueue] = useState<CloudSubmissionBundle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [role, setRole] = useState<ReviewerRole>("editorial");
  const [decision, setDecision] = useState<Exclude<ReviewDecision, "approve_publication">>("request_changes");
  const [summary, setSummary] = useState("");
  const [changes, setChanges] = useState("");
  const [testOutcome, setTestOutcome] = useState<CookTestOutcome>("passed");
  const [testSummary, setTestSummary] = useState("");
  const [servings, setServings] = useState(4);
  const [equipment, setEquipment] = useState("");
  const [safetyObservations, setSafetyObservations] = useState("");
  const [canonicalSlug, setCanonicalSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => queue.find((item) => item.submission.id === selectedId) ?? queue[0] ?? null, [queue, selectedId]);

  const refresh = useCallback(async () => {
    if (!configured || !session) {
      setQueue([]);
      setLoading(false);
      return;
    }
    try {
      const next = await listReviewQueue();
      setQueue(next);
      setSelectedId((current) => current && next.some((item) => item.submission.id === current) ? current : next[0]?.submission.id ?? null);
      setError(null);
    } catch (cause) {
      setQueue([]);
      setError(cause instanceof Error ? cause.message.replaceAll("_", " ") : "Review access is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [configured, session]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (selected) {
      setCanonicalSlug(canonicalDraftSlug(selected.version.content.title));
      setServings(selected.version.content.servings);
    }
  }, [selected]);

  async function review() {
    if (!selected) return;
    setWorking(true); setMessage(null); setError(null);
    try {
      await addEditorialReview({
        submissionId: selected.submission.id,
        role,
        decision,
        summary,
        proposedChanges: changes.split("\n").map((item) => item.trim()).filter(Boolean),
      });
      setSummary(""); setChanges("");
      setMessage("Review decision recorded in the append-only audit trail.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replaceAll("_", " ") : "Could not record review.");
    } finally { setWorking(false); }
  }

  async function cookTest() {
    if (!selected) return;
    setWorking(true); setMessage(null); setError(null);
    try {
      await addCookTest({
        submissionId: selected.submission.id,
        versionId: selected.version.id,
        contentHash: selected.version.contentHash,
        servingsAttempted: servings,
        equipmentUsed: equipment.split(",").map((item) => item.trim()).filter(Boolean),
        substitutions: [],
        stepFindings: selected.version.content.steps.map((step) => ({ stepId: step.id, outcome: "clear" as const })),
        criticalSafetyObservations: safetyObservations.split("\n").map((item) => item.trim()).filter(Boolean),
        outcome: testOutcome,
        summary: testSummary,
      });
      setTestSummary(""); setSafetyObservations("");
      setMessage("Cook-test evidence recorded against this exact content hash.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replaceAll("_", " ") : "Could not record cook test.");
    } finally { setWorking(false); }
  }

  async function approveCandidate() {
    if (!selected) return;
    setWorking(true); setMessage(null); setError(null);
    try {
      await createPublicationCandidate(selected.submission.id, canonicalSlug);
      setMessage("Publication candidate created. A trusted operator must still generate a GitHub pull request; this browser cannot publish or merge it.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replaceAll("_", " ") : "Could not create publication candidate.");
    } finally { setWorking(false); }
  }

  const input = "w-full rounded-xl border border-cardamom bg-rice px-4 py-2.5 text-sm outline-none focus:border-turmeric";
  if (loading) return <p className="text-sm text-tamarind-faint">Opening review queue…</p>;
  if (!session) return <p className="rounded-card border border-cardamom bg-card p-6 text-sm text-tamarind-soft">Sign in with an account that has an editorial, safety, cook-tester or publisher role.</p>;
  if (error && queue.length === 0) return <p className="rounded-card border border-chilli/30 bg-chilli/10 p-6 text-sm text-chilli">{error}. Reviewer roles are granted only by a trusted operator.</p>;
  if (!selected) return <p className="rounded-card border border-dashed border-cardamom bg-card p-6 text-sm text-tamarind-soft">No submissions currently need review.</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-2">
        {queue.map((item) => (
          <button key={item.submission.id} onClick={() => setSelectedId(item.submission.id)} className={`w-full rounded-xl border p-4 text-left ${item.submission.id === selected.submission.id ? "border-turmeric bg-turmeric-tint" : "border-cardamom bg-card"}`}>
            <span className="block font-medium">{item.version.content.title}</span>
            <span className="mt-1 block text-xs text-tamarind-faint">{item.submission.status.replaceAll("_", " ")} · {item.version.contentHash.slice(0, 10)}</span>
          </button>
        ))}
      </aside>

      <div className="space-y-6">
        {message && <p className="rounded-xl bg-curry-tint p-4 text-sm text-curry">{message}</p>}
        {error && <p className="rounded-xl bg-chilli/10 p-4 text-sm text-chilli">{error}</p>}

        <section className="rounded-card border border-cardamom bg-card p-6 shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-widest text-turmeric-deep">Frozen submitted version</p>
          <h2 className="mt-1 font-display text-3xl">{selected.version.content.title}</h2>
          <p className="mt-2 text-sm text-tamarind-soft">{selected.version.content.description}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-tamarind-faint">Hash</dt><dd><code>{selected.version.contentHash.slice(0, 16)}</code></dd></div><div><dt className="text-xs text-tamarind-faint">Cuisine</dt><dd>{selected.version.content.cuisine}</dd></div><div><dt className="text-xs text-tamarind-faint">Status</dt><dd>{selected.submission.status.replaceAll("_", " ")}</dd></div></dl>
          <div className="mt-5 grid gap-5 sm:grid-cols-2"><div><h3 className="font-medium">Ingredients</h3><ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{selected.version.content.ingredients.map((ingredient) => <li key={ingredient.id}>{ingredient.name}{ingredient.canonicalSlug ? <span className="text-tamarind-faint"> · {ingredient.canonicalSlug}</span> : <strong className="text-chilli"> · unresolved</strong>}</li>)}</ol></div><div><h3 className="font-medium">Steps</h3><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">{selected.version.content.steps.map((step) => <li key={step.id}>{step.text}</li>)}</ol></div></div>
        </section>

        <section className="rounded-card border border-cardamom bg-card p-6">
          <h2 className="font-display text-2xl">Automated findings</h2>
          {selected.findings.length === 0 ? <p className="mt-3 text-sm text-curry">No automated findings are recorded. Human review is still required.</p> : <ul className="mt-3 space-y-2">{selected.findings.map((finding) => <li key={finding.id} className={`rounded-xl p-3 text-sm ${finding.severity === "error" ? "bg-chilli/10 text-chilli" : "bg-rice text-tamarind-soft"}`}><strong>{finding.code.replaceAll("_", " ")}</strong>: {finding.message}</li>)}</ul>}
        </section>

        <section className="rounded-card border border-cardamom bg-card p-6">
          <h2 className="font-display text-2xl">Editorial or safety decision</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><select className={input} value={role} onChange={(e) => setRole(e.target.value as ReviewerRole)}><option value="editorial">Editorial reviewer</option><option value="safety">Safety reviewer</option></select><select className={input} value={decision} onChange={(e) => setDecision(e.target.value as Exclude<ReviewDecision, "approve_publication">)}><option value="request_changes">Request changes</option><option value="send_to_cook_test">Send to cook test</option><option value="approve_editorially">Approve editorially</option><option value="reject">Reject</option></select></div>
          <textarea className={`${input} mt-3 min-h-24`} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Decision rationale" />
          <textarea className={`${input} mt-3 min-h-20`} value={changes} onChange={(e) => setChanges(e.target.value)} placeholder="Proposed changes, one per line" />
          <button disabled={working || !summary.trim()} onClick={() => void review()} className="mt-3 rounded-full bg-turmeric px-5 py-2.5 text-sm font-semibold disabled:opacity-40">Record review</button>
        </section>

        <section className="rounded-card border border-cardamom bg-card p-6">
          <h2 className="font-display text-2xl">Version-bound cook test</h2>
          <p className="mt-2 text-xs text-tamarind-faint">The server rejects self-testing, duplicate testers and evidence for a different version or hash.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><input className={input} type="number" min={1} max={100} value={servings} onChange={(e) => setServings(Number(e.target.value))} aria-label="Servings attempted" /><select className={input} value={testOutcome} onChange={(e) => setTestOutcome(e.target.value as CookTestOutcome)}><option value="passed">Passed</option><option value="passed_with_changes">Passed with changes</option><option value="failed">Failed</option></select></div>
          <input className={`${input} mt-3`} value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Equipment used, comma separated" />
          <textarea className={`${input} mt-3 min-h-20`} value={safetyObservations} onChange={(e) => setSafetyObservations(e.target.value)} placeholder="Critical safety observations, one per line" />
          <textarea className={`${input} mt-3 min-h-24`} value={testSummary} onChange={(e) => setTestSummary(e.target.value)} placeholder="What happened during the cook test?" />
          <button disabled={working || !testSummary.trim()} onClick={() => void cookTest()} className="mt-3 rounded-full border border-curry bg-curry-tint px-5 py-2.5 text-sm font-semibold text-curry disabled:opacity-40">Record cook test</button>
          {selected.cookTests.length > 0 && <ul className="mt-4 space-y-2 text-xs">{selected.cookTests.map((test) => <li key={test.id} className="rounded-xl bg-rice p-3">{test.outcome.replaceAll("_", " ")} · tester {test.testerId.slice(0, 8)}… · {test.summary}</li>)}</ul>}
        </section>

        <section className="rounded-card border border-cardamom bg-card p-6">
          <h2 className="font-display text-2xl">Publication candidate</h2>
          <p className="mt-2 text-sm text-tamarind-soft">This action cannot publish. It requires publisher role, editorial approval, two independent passed cook tests and zero unresolved error findings. A service-role operator must then create a GitHub PR that runs the full corpus trust gate.</p>
          <input className={`${input} mt-4`} value={canonicalSlug} onChange={(e) => setCanonicalSlug(e.target.value)} placeholder="canonical-recipe-slug" />
          <button disabled={working || !canonicalSlug} onClick={() => void approveCandidate()} className="mt-3 rounded-full bg-tamarind px-5 py-2.5 text-sm font-semibold text-rice disabled:opacity-40">Approve candidate—not publication</button>
        </section>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePortableKitchen } from "./PortableKitchenProvider";
import { contributionRepository, subscribeContributions } from "@/lib/contributions/local-store";
import { listCloudDrafts, listMyCloudSubmissions, withdrawCloudSubmission } from "@/lib/contributions/cloud";
import type { RecipeDraft, RecipeDraftVersion, RecipeSubmission } from "@/lib/contributions/types";

function publicStatus(value: string): string {
  const labels: Record<string, string> = {
    local_only: "Saved only on this device",
    private_cloud: "Private cloud draft",
    household_draft: "Private household draft",
    ready_for_submission: "Submitted version exists",
    submitted: "Submitted",
    automated_checks_failed: "Automated checks need changes",
    awaiting_editorial_review: "Awaiting editorial review",
    changes_requested: "Changes requested",
    awaiting_cook_test: "Awaiting cook test",
    editorially_approved: "Editorially approved",
    publication_candidate: "Approved publication candidate",
    publication_pr_open: "Publication pull request open",
    published: "Published",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
    superseded: "Superseded",
    takedown_pending: "Takedown pending",
    takedown_completed: "Takedown completed",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export default function LivingCookbookDashboard() {
  const { configured, session } = usePortableKitchen();
  const [localDrafts, setLocalDrafts] = useState<RecipeDraft[]>([]);
  const [localSubmissions, setLocalSubmissions] = useState<RecipeSubmission[]>([]);
  const [cloudDrafts, setCloudDrafts] = useState<RecipeDraft[]>([]);
  const [cloudSubmissions, setCloudSubmissions] = useState<RecipeSubmission[]>([]);
  const [versions, setVersions] = useState<Record<string, RecipeDraftVersion[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    await contributionRepository.migrateLegacyDrafts().catch(() => 0);
    const [drafts, submissions] = await Promise.all([
      contributionRepository.listDrafts(),
      contributionRepository.listSubmissions(),
    ]);
    setLocalDrafts(drafts);
    setLocalSubmissions(submissions);
    if (configured && session) {
      const [remoteDrafts, remoteSubmissions] = await Promise.all([
        listCloudDrafts().catch(() => []),
        listMyCloudSubmissions().catch(() => []),
      ]);
      setCloudDrafts(remoteDrafts);
      setCloudSubmissions(remoteSubmissions);
    } else {
      setCloudDrafts([]);
      setCloudSubmissions([]);
    }
    setLoading(false);
  }, [configured, session]);

  useEffect(() => {
    void refresh();
    return subscribeContributions(() => void refresh());
  }, [refresh]);

  async function toggleVersions(draftId: string) {
    if (expanded === draftId) return setExpanded(null);
    if (!versions[draftId]) {
      const list = await contributionRepository.listVersions(draftId);
      setVersions((current) => ({ ...current, [draftId]: list }));
    }
    setExpanded(draftId);
  }

  async function restore(draftId: string, versionId: string) {
    setError(null);
    try {
      const result = await contributionRepository.restoreVersion(draftId, versionId, session?.user.id);
      const refreshedVersions = await contributionRepository.listVersions(draftId);
      setMessage(`Restored version as new version ${result.version.versionNumber}. Existing history was not rewritten.`);
      await refresh();
      setVersions((current) => ({ ...current, [draftId]: refreshedVersions }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replaceAll("_", " ") : "Could not restore version.");
    }
  }

  async function removeDraft(draftId: string) {
    setError(null);
    try {
      await contributionRepository.deleteDraft(draftId);
      setMessage("Local draft and its unsubmitted versions were deleted from this browser.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replaceAll("_", " ") : "Could not delete draft.");
    }
  }

  async function exportLocal() {
    const data = await contributionRepository.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cook-anything-family-recipes-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function withdraw(submissionId: string) {
    setError(null);
    try {
      await withdrawCloudSubmission(submissionId, "Withdrawn by contributor from My Recipes");
      setMessage("Submission withdrawn. Published recipes require the separate takedown process.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replaceAll("_", " ") : "Could not withdraw submission.");
    }
  }

  if (loading) return <p className="text-sm text-tamarind-faint">Opening your Living Cookbook…</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <Link href="/submit-recipe" className="rounded-full bg-turmeric px-5 py-2.5 text-sm font-semibold text-tamarind">Write a family recipe</Link>
        <button onClick={() => void exportLocal()} className="rounded-full border border-cardamom bg-card px-5 py-2.5 text-sm font-medium">Export private recipe data</button>
        <Link href="/account" className="rounded-full border border-cardamom bg-card px-5 py-2.5 text-sm font-medium">Account and sync</Link>
      </div>

      {message && <p className="rounded-xl bg-curry-tint p-4 text-sm text-curry">{message}</p>}
      {error && <p className="rounded-xl bg-chilli/10 p-4 text-sm font-medium text-chilli">{error}</p>}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-turmeric-deep">Private drafts</p><h2 className="font-display text-2xl">On this device</h2></div>
          <p className="text-xs text-tamarind-faint">{localDrafts.length} draft{localDrafts.length === 1 ? "" : "s"}</p>
        </div>
        {localDrafts.length === 0 ? (
          <div className="mt-4 rounded-card border border-dashed border-cardamom bg-card p-8 text-center text-sm text-tamarind-soft">No family recipe drafts yet. Existing saved public recipes remain in My Cookbook.</div>
        ) : (
          <ul className="mt-4 divide-y divide-cardamom rounded-card border border-cardamom bg-card shadow-lift">
            {localDrafts.map((draft) => (
              <li key={draft.id} className="p-5">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-tamarind">{draft.title}</h3>
                    <p className="mt-1 text-xs text-tamarind-faint">{publicStatus(draft.status)} · version {draft.latestVersionNumber} · updated {new Date(draft.updatedAt).toLocaleString()}</p>
                    {draft.cloudDraftId && <p className="mt-1 text-xs text-curry">Linked to private cloud draft {draft.cloudDraftId.slice(0, 8)}…</p>}
                  </div>
                  <Link href={`/submit-recipe?draft=${encodeURIComponent(draft.id)}`} className="rounded-full border border-cardamom px-4 py-2 text-xs font-medium">Edit as new version</Link>
                  <button onClick={() => void toggleVersions(draft.id)} className="rounded-full border border-cardamom px-4 py-2 text-xs font-medium">{expanded === draft.id ? "Hide versions" : "Version history"}</button>
                  <button onClick={() => void removeDraft(draft.id)} className="px-3 py-2 text-xs font-medium text-chilli">Delete local</button>
                </div>
                {expanded === draft.id && (
                  <ol className="mt-4 space-y-2 border-t border-cardamom pt-4">
                    {(versions[draft.id] ?? []).map((version) => (
                      <li key={version.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-rice p-3 text-xs">
                        <span className="font-semibold">Version {version.versionNumber}</span>
                        <span>{new Date(version.createdAt).toLocaleString()}</span>
                        <code className="text-tamarind-faint">{version.contentHash.slice(0, 12)}</code>
                        <span>{version.rights ? `${version.rights.sourceType} · ${version.rights.aiAssistance === "none" ? "no AI declared" : `AI ${version.rights.aiAssistance}`}` : "rights not completed"}</span>
                        {version.id !== draft.latestVersionId && <button onClick={() => void restore(draft.id, version.id)} className="ml-auto font-medium text-turmeric-deep">Restore as new version</button>}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="text-xs font-semibold uppercase tracking-widest text-turmeric-deep">Optional account</p>
        <h2 className="font-display text-2xl">Private cloud and household drafts</h2>
        {!session ? (
          <p className="mt-3 rounded-card border border-cardamom bg-card p-5 text-sm text-tamarind-soft">No account is required. Sign in only when you want multi-device draft backup, private household collaboration or editorial submission.</p>
        ) : cloudDrafts.length === 0 ? (
          <p className="mt-3 rounded-card border border-dashed border-cardamom bg-card p-5 text-sm text-tamarind-soft">No cloud drafts yet. Choose a cloud or household target in the recipe editor.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {cloudDrafts.map((draft) => <li key={draft.id} className="rounded-card border border-cardamom bg-card p-5"><h3 className="font-medium">{draft.title}</h3><p className="mt-1 text-xs text-tamarind-faint">{publicStatus(draft.status)} · version {draft.latestVersionNumber}</p><p className="mt-2 text-xs text-tamarind-soft">Scope: {draft.scope.type === "household" ? "household" : "personal"}. This is not public.</p></li>)}
          </ul>
        )}
      </section>

      <section>
        <p className="text-xs font-semibold uppercase tracking-widest text-turmeric-deep">Frozen versions</p>
        <h2 className="font-display text-2xl">Submissions</h2>
        {(cloudSubmissions.length ? cloudSubmissions : localSubmissions).length === 0 ? (
          <p className="mt-3 rounded-card border border-dashed border-cardamom bg-card p-5 text-sm text-tamarind-soft">No recipe has been submitted. Saving a draft never submits it automatically.</p>
        ) : (
          <ul className="mt-4 divide-y divide-cardamom rounded-card border border-cardamom bg-card">
            {(cloudSubmissions.length ? cloudSubmissions : localSubmissions).map((submission) => (
              <li key={submission.id} className="flex flex-wrap items-center gap-3 p-5">
                <div className="min-w-0 flex-1"><p className="font-medium">{publicStatus(submission.status)}</p><p className="mt-1 text-xs text-tamarind-faint">Immutable content {submission.contentHash.slice(0, 12)} · submitted {new Date(submission.submittedAt).toLocaleString()}</p></div>
                {!['published', 'withdrawn', 'rejected', 'takedown_pending', 'takedown_completed'].includes(submission.status) && session && <button onClick={() => void withdraw(submission.id)} className="text-xs font-medium text-chilli">Withdraw</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="rounded-card border border-cardamom bg-rice p-4 text-xs leading-relaxed text-tamarind-soft">Private family recipes, submitted recipes and published recipes are intentionally separate states. A submission cannot appear in the public corpus until automated checks, human review, version-bound cook tests, a trusted publication candidate and the repository’s existing GitHub CI gate all pass.</p>
    </div>
  );
}

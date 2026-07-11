"use client";

import { callCloudRpc } from "@/lib/sync/supabase-rest";
import { assertContributionPayloadSafe, validateDraftContent, validateRights } from "./security";
import type {
  ContributionScope,
  CookTestRun,
  EditorialReview,
  RecipeDraft,
  RecipeDraftContent,
  RecipeDraftVersion,
  RecipeSubmission,
  RightsAttestation,
  SubmissionFinding,
} from "./types";

export interface CloudDraftBundle {
  draft: RecipeDraft;
  latestVersion: RecipeDraftVersion;
  versions: RecipeDraftVersion[];
}

export interface CloudSubmissionBundle {
  submission: RecipeSubmission;
  draft: RecipeDraft;
  version: RecipeDraftVersion;
  findings: SubmissionFinding[];
  reviews: EditorialReview[];
  cookTests: CookTestRun[];
}

function scopeParameters(scope: ContributionScope): { p_scope_type: string; p_scope_id: string | null } {
  return { p_scope_type: scope.type, p_scope_id: scope.type === "household" ? scope.id : null };
}

export async function saveCloudDraftVersion(input: {
  draftId?: string;
  scope: ContributionScope;
  content: RecipeDraftContent;
  rights: RightsAttestation | null;
  expectedLatestVersionId?: string;
}): Promise<CloudDraftBundle> {
  validateDraftContent(input.content);
  if (input.rights) validateRights(input.rights);
  assertContributionPayloadSafe(input);
  return callCloudRpc<CloudDraftBundle>("save_recipe_draft_version", {
    p_draft_id: input.draftId ?? null,
    ...scopeParameters(input.scope),
    p_content: input.content,
    p_rights: input.rights,
    p_expected_latest_version_id: input.expectedLatestVersionId ?? null,
  });
}

export function listCloudDrafts(): Promise<RecipeDraft[]> {
  return callCloudRpc<RecipeDraft[]>("list_recipe_drafts", {});
}

export function getCloudDraft(draftId: string): Promise<CloudDraftBundle> {
  return callCloudRpc<CloudDraftBundle>("get_recipe_draft", { p_draft_id: draftId });
}

export function submitCloudVersion(draftId: string, versionId: string): Promise<CloudSubmissionBundle> {
  return callCloudRpc<CloudSubmissionBundle>("submit_recipe_version", {
    p_draft_id: draftId,
    p_version_id: versionId,
  });
}

export function listMyCloudSubmissions(): Promise<RecipeSubmission[]> {
  return callCloudRpc<RecipeSubmission[]>("list_my_recipe_submissions", {});
}

export function getCloudSubmission(submissionId: string): Promise<CloudSubmissionBundle> {
  return callCloudRpc<CloudSubmissionBundle>("get_recipe_submission", { p_submission_id: submissionId });
}

export function withdrawCloudSubmission(submissionId: string, reason: string): Promise<RecipeSubmission> {
  return callCloudRpc<RecipeSubmission>("withdraw_recipe_submission", {
    p_submission_id: submissionId,
    p_reason: reason.slice(0, 1_000),
  });
}

export function listReviewQueue(): Promise<CloudSubmissionBundle[]> {
  return callCloudRpc<CloudSubmissionBundle[]>("list_recipe_review_queue", {});
}

export function addEditorialReview(review: Omit<EditorialReview, "id" | "reviewerId" | "createdAt">): Promise<CloudSubmissionBundle> {
  assertContributionPayloadSafe(review);
  return callCloudRpc<CloudSubmissionBundle>("add_recipe_editorial_review", {
    p_submission_id: review.submissionId,
    p_role: review.role,
    p_decision: review.decision,
    p_summary: review.summary,
    p_proposed_changes: review.proposedChanges ?? [],
  });
}

export function addCookTest(run: Omit<CookTestRun, "id" | "testerId" | "createdAt">): Promise<CloudSubmissionBundle> {
  assertContributionPayloadSafe(run);
  return callCloudRpc<CloudSubmissionBundle>("add_recipe_cook_test", {
    p_submission_id: run.submissionId,
    p_version_id: run.versionId,
    p_content_hash: run.contentHash,
    p_servings_attempted: run.servingsAttempted,
    p_prep_minutes_actual: run.prepMinutesActual ?? null,
    p_cook_minutes_actual: run.cookMinutesActual ?? null,
    p_equipment_used: run.equipmentUsed,
    p_substitutions: run.substitutions,
    p_step_findings: run.stepFindings,
    p_safety_observations: run.criticalSafetyObservations,
    p_outcome: run.outcome,
    p_summary: run.summary,
  });
}

export function createPublicationCandidate(submissionId: string, canonicalSlug: string): Promise<CloudSubmissionBundle> {
  return callCloudRpc<CloudSubmissionBundle>("approve_recipe_publication_candidate", {
    p_submission_id: submissionId,
    p_canonical_slug: canonicalSlug,
  });
}

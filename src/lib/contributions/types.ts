export const CONTRIBUTION_SCHEMA_VERSION = 1;
export const CONTRIBUTION_EXPORT_FORMAT = "cook-anything-contribution-export";

export type ContributionScope =
  | { type: "personal" }
  | { type: "household"; id: string };

export type RecipeDraftStatus =
  | "local_only"
  | "private_cloud"
  | "household_draft"
  | "ready_for_submission"
  | "superseded";

export type SubmissionStatus =
  | "submitted"
  | "automated_checks_failed"
  | "awaiting_editorial_review"
  | "changes_requested"
  | "awaiting_cook_test"
  | "editorially_approved"
  | "publication_candidate"
  | "publication_pr_open"
  | "published"
  | "rejected"
  | "withdrawn"
  | "superseded"
  | "takedown_pending"
  | "takedown_completed";

export type SourceType = "original" | "family" | "traditional" | "adapted" | "documented";
export type AiAssistance = "none" | "structure" | "translation" | "drafting";
export type PublicationLicence = "CC0-1.0" | "CC-BY-4.0" | "CC-BY-SA-4.0" | "permission-granted";

export interface DraftIngredient {
  id: string;
  name: string;
  canonicalSlug?: string;
  quantity?: number;
  quantityText?: string;
  unit?: string;
  optional: boolean;
  notes?: string;
}

export interface DraftStep {
  id: string;
  order: number;
  text: string;
  stage?: string;
  timerMinutes?: number;
}

export interface RecipeDraftContent {
  schemaVersion: typeof CONTRIBUTION_SCHEMA_VERSION;
  title: string;
  nativeTitle?: string;
  description: string;
  cuisine: string;
  region?: string;
  language: string;
  servings: number;
  prepMinutes?: number;
  cookMinutes?: number;
  ingredients: DraftIngredient[];
  steps: DraftStep[];
  cookware: string[];
  culturalStory?: string;
  safetyNotes?: string[];
  claimedDietaryLabels: string[];
  declaredAllergens: string[];
}

export interface RightsAttestation {
  sourceType: SourceType;
  writtenInOwnWords: boolean;
  rightToShare: boolean;
  aiAssistance: AiAssistance;
  aiAssistanceNotes?: string;
  publicContributorName?: string;
  publishCulturalStory: boolean;
  licence: PublicationLicence;
  sourceReference?: string;
  acceptedAt: string;
}

export interface RecipeDraft {
  id: string;
  ownerId?: string;
  scope: ContributionScope;
  status: RecipeDraftStatus;
  title: string;
  latestVersionId: string;
  latestVersionNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeDraftVersion {
  id: string;
  draftId: string;
  versionNumber: number;
  contentHash: string;
  content: RecipeDraftContent;
  rights: RightsAttestation | null;
  createdBy?: string;
  createdAt: string;
  supersedesVersionId?: string;
}

export type FindingSeverity = "error" | "warning" | "info";
export type FindingCode =
  | "missing_title"
  | "missing_cuisine"
  | "too_few_ingredients"
  | "too_few_steps"
  | "unresolved_ingredient"
  | "dietary_conflict"
  | "allergen_review_required"
  | "missing_safety_instruction"
  | "possible_duplicate"
  | "rights_incomplete"
  | "unsupported_licence";

export interface SubmissionFinding {
  id: string;
  submissionId: string;
  code: FindingCode;
  severity: FindingSeverity;
  message: string;
  path?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface RecipeSubmission {
  id: string;
  draftId: string;
  versionId: string;
  contentHash: string;
  contributorId?: string;
  status: SubmissionStatus;
  submittedAt: string;
  updatedAt: string;
  withdrawnAt?: string;
}

export type ReviewerRole = "editorial" | "safety" | "publisher";
export type ReviewDecision = "request_changes" | "reject" | "send_to_cook_test" | "approve_editorially" | "approve_publication";

export interface EditorialReview {
  id: string;
  submissionId: string;
  reviewerId: string;
  role: ReviewerRole;
  decision: ReviewDecision;
  summary: string;
  proposedChanges?: string[];
  createdAt: string;
}

export type CookTestOutcome = "failed" | "passed_with_changes" | "passed";

export interface CookTestRun {
  id: string;
  submissionId: string;
  versionId: string;
  contentHash: string;
  testerId: string;
  servingsAttempted: number;
  prepMinutesActual?: number;
  cookMinutesActual?: number;
  equipmentUsed: string[];
  substitutions: Array<{ original: string; replacement: string }>;
  stepFindings: Array<{ stepId: string; outcome: "clear" | "unclear" | "failed"; note?: string }>;
  criticalSafetyObservations: string[];
  outcome: CookTestOutcome;
  summary: string;
  createdAt: string;
}

export interface PublicationCandidate {
  id: string;
  submissionId: string;
  versionId: string;
  contentHash: string;
  canonicalSlug: string;
  candidateJson: Record<string, unknown>;
  status: "ready" | "pr_open" | "published" | "cancelled";
  githubPrUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContributionStatusEvent {
  id: string;
  submissionId: string;
  fromStatus: SubmissionStatus | null;
  toStatus: SubmissionStatus;
  actorId: string;
  actorRole: "contributor" | ReviewerRole | "system";
  reason?: string;
  createdAt: string;
}

export interface LocalContributionExport {
  format: typeof CONTRIBUTION_EXPORT_FORMAT;
  schemaVersion: typeof CONTRIBUTION_SCHEMA_VERSION;
  createdAt: string;
  drafts: RecipeDraft[];
  versions: RecipeDraftVersion[];
  submissions: RecipeSubmission[];
}

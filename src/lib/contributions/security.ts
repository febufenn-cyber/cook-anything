import type {
  ContributionScope,
  CookTestRun,
  EditorialReview,
  RecipeDraftContent,
  RecipeDraftVersion,
  RecipeSubmission,
  RightsAttestation,
  SubmissionFinding,
  SubmissionStatus,
} from "./types";

const MAX_DEPTH = 12;
const MAX_ARRAY = 500;
const MAX_STRING = 20_000;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const SECRET_KEY_PATTERN = /api.?key|authorization|cookie|session.?token|access.?token|refresh.?token|oauth|password|secret/i;
const ALLERGENS = new Set(["dairy", "gluten", "nuts", "peanuts", "soy", "egg", "fish", "shellfish", "sesame", "mustard"]);
const LICENCES = new Set(["CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0", "permission-granted"]);
const SOURCE_TYPES = new Set(["original", "family", "traditional", "adapted", "documented"]);
const AI_ASSISTANCE = new Set(["none", "structure", "translation", "drafting"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= max && (allowEmpty || value.trim().length > 0);
}

export function assertContributionPayloadSafe(value: unknown, depth = 0): void {
  if (depth > MAX_DEPTH) throw new Error("contribution_payload_too_deep");
  if (value === null || typeof value === "number" || typeof value === "boolean") return;
  if (typeof value === "string") {
    if (value.length > MAX_STRING) throw new Error("contribution_payload_too_large");
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY) throw new Error("contribution_payload_too_large");
    value.forEach((item) => assertContributionPayloadSafe(item, depth + 1));
    return;
  }
  if (!isRecord(value)) throw new Error("invalid_contribution_payload");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error("invalid_contribution_payload");
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error("invalid_contribution_payload");
    if (SECRET_KEY_PATTERN.test(key)) throw new Error("secret_field_forbidden");
    assertContributionPayloadSafe(child, depth + 1);
  }
}

export function stableContributionJson(value: unknown): string {
  assertContributionPayloadSafe(value);
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (!isRecord(input)) return input;
    return Object.fromEntries(
      Object.entries(input)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, normalize(child)]),
    );
  };
  return JSON.stringify(normalize(value));
}

export async function hashDraftContent(content: RecipeDraftContent): Promise<string> {
  const bytes = new TextEncoder().encode(stableContributionJson(content));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalDraftSlug(title: string): string {
  return title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}

export function validateScope(value: unknown): ContributionScope {
  if (!isRecord(value) || (value.type !== "personal" && value.type !== "household")) throw new Error("invalid_contribution_scope");
  if (value.type === "household") {
    if (!boundedString(value.id, 100) || !/^[0-9a-f-]{20,100}$/i.test(value.id)) throw new Error("invalid_contribution_scope");
    return { type: "household", id: value.id };
  }
  return { type: "personal" };
}

export function validateDraftContent(value: unknown): RecipeDraftContent {
  assertContributionPayloadSafe(value);
  if (!isRecord(value) || value.schemaVersion !== 1) throw new Error("invalid_draft_content");
  if (!boundedString(value.title, 180) || !boundedString(value.description, 1_000, true)) throw new Error("invalid_draft_content");
  if (!boundedString(value.cuisine, 120) || !boundedString(value.language, 40)) throw new Error("invalid_draft_content");
  if (value.nativeTitle !== undefined && !boundedString(value.nativeTitle, 180, true)) throw new Error("invalid_draft_content");
  if (value.region !== undefined && !boundedString(value.region, 120, true)) throw new Error("invalid_draft_content");
  if (!Number.isInteger(value.servings) || (value.servings as number) < 1 || (value.servings as number) > 100) throw new Error("invalid_draft_content");
  for (const key of ["prepMinutes", "cookMinutes"] as const) {
    const number = value[key];
    if (number !== undefined && (!Number.isInteger(number) || (number as number) < 0 || (number as number) > 10_080)) throw new Error("invalid_draft_content");
  }
  if (!Array.isArray(value.ingredients) || value.ingredients.length < 2 || value.ingredients.length > 150) throw new Error("invalid_draft_content");
  const ingredientIds = new Set<string>();
  value.ingredients.forEach((ingredient) => {
    if (!isRecord(ingredient) || !boundedString(ingredient.id, 100) || ingredientIds.has(ingredient.id)) throw new Error("invalid_draft_content");
    if (!boundedString(ingredient.name, 200) || typeof ingredient.optional !== "boolean") throw new Error("invalid_draft_content");
    if (ingredient.canonicalSlug !== undefined && (!boundedString(ingredient.canonicalSlug, 120) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(ingredient.canonicalSlug))) throw new Error("invalid_draft_content");
    if (ingredient.quantity !== undefined && (typeof ingredient.quantity !== "number" || !Number.isFinite(ingredient.quantity) || ingredient.quantity < 0 || ingredient.quantity > 1_000_000)) throw new Error("invalid_draft_content");
    if (ingredient.quantityText !== undefined && !boundedString(ingredient.quantityText, 100, true)) throw new Error("invalid_draft_content");
    if (ingredient.unit !== undefined && !boundedString(ingredient.unit, 80, true)) throw new Error("invalid_draft_content");
    if (ingredient.notes !== undefined && !boundedString(ingredient.notes, 500, true)) throw new Error("invalid_draft_content");
    ingredientIds.add(ingredient.id);
  });
  if (!Array.isArray(value.steps) || value.steps.length < 2 || value.steps.length > 150) throw new Error("invalid_draft_content");
  const stepIds = new Set<string>();
  value.steps.forEach((step, index) => {
    if (!isRecord(step) || !boundedString(step.id, 100) || stepIds.has(step.id)) throw new Error("invalid_draft_content");
    if (step.order !== index + 1 || !boundedString(step.text, 4_000)) throw new Error("invalid_draft_content");
    if (step.stage !== undefined && !boundedString(step.stage, 80, true)) throw new Error("invalid_draft_content");
    if (step.timerMinutes !== undefined && (!Number.isInteger(step.timerMinutes) || (step.timerMinutes as number) < 0 || (step.timerMinutes as number) > 1_440)) throw new Error("invalid_draft_content");
    stepIds.add(step.id);
  });
  for (const key of ["cookware", "safetyNotes", "claimedDietaryLabels", "declaredAllergens"] as const) {
    const list = value[key];
    if (!Array.isArray(list) || list.length > 50 || !list.every((item) => boundedString(item, 300))) throw new Error("invalid_draft_content");
  }
  if (!(value.declaredAllergens as string[]).every((item) => ALLERGENS.has(item))) throw new Error("invalid_draft_content");
  if (value.culturalStory !== undefined && !boundedString(value.culturalStory, 10_000, true)) throw new Error("invalid_draft_content");
  return value as unknown as RecipeDraftContent;
}

export function validateRights(value: unknown): RightsAttestation {
  assertContributionPayloadSafe(value);
  if (!isRecord(value) || !SOURCE_TYPES.has(String(value.sourceType)) || !AI_ASSISTANCE.has(String(value.aiAssistance))) throw new Error("invalid_rights_attestation");
  if (value.writtenInOwnWords !== true || value.rightToShare !== true) throw new Error("rights_incomplete");
  if (!LICENCES.has(String(value.licence)) || typeof value.publishCulturalStory !== "boolean") throw new Error("invalid_rights_attestation");
  if (!boundedString(value.acceptedAt, 80)) throw new Error("invalid_rights_attestation");
  if (value.publicContributorName !== undefined && !boundedString(value.publicContributorName, 120, true)) throw new Error("invalid_rights_attestation");
  if (value.aiAssistanceNotes !== undefined && !boundedString(value.aiAssistanceNotes, 1_000, true)) throw new Error("invalid_rights_attestation");
  if (value.sourceReference !== undefined && !boundedString(value.sourceReference, 1_000, true)) throw new Error("invalid_rights_attestation");
  if (value.aiAssistance === "drafting" && !boundedString(value.aiAssistanceNotes, 1_000)) throw new Error("ai_disclosure_incomplete");
  return value as unknown as RightsAttestation;
}

const TRANSITIONS: Record<SubmissionStatus, readonly SubmissionStatus[]> = {
  submitted: ["automated_checks_failed", "awaiting_editorial_review", "withdrawn"],
  automated_checks_failed: ["superseded", "withdrawn"],
  awaiting_editorial_review: ["changes_requested", "awaiting_cook_test", "editorially_approved", "rejected", "withdrawn"],
  changes_requested: ["superseded", "withdrawn"],
  awaiting_cook_test: ["changes_requested", "editorially_approved", "rejected", "withdrawn"],
  editorially_approved: ["publication_candidate", "changes_requested", "withdrawn"],
  publication_candidate: ["publication_pr_open", "changes_requested", "withdrawn"],
  publication_pr_open: ["published", "changes_requested", "withdrawn", "takedown_pending"],
  published: ["takedown_pending"],
  rejected: [],
  withdrawn: [],
  superseded: [],
  takedown_pending: ["takedown_completed", "published"],
  takedown_completed: [],
};

export function canTransitionSubmission(from: SubmissionStatus, to: SubmissionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertSubmissionTransition(submission: RecipeSubmission, next: SubmissionStatus): void {
  if (!canTransitionSubmission(submission.status, next)) throw new Error(`invalid_submission_transition:${submission.status}:${next}`);
}

export function automatedDraftFindings(submissionId: string, content: RecipeDraftContent, rights: RightsAttestation | null, now = new Date().toISOString()): SubmissionFinding[] {
  const findings: SubmissionFinding[] = [];
  const add = (code: SubmissionFinding["code"], severity: SubmissionFinding["severity"], message: string, path?: string) => findings.push({
    id: `${submissionId}:${code}:${findings.length + 1}`,
    submissionId,
    code,
    severity,
    message,
    ...(path ? { path } : {}),
    createdAt: now,
  });
  if (!content.title.trim()) add("missing_title", "error", "Add a recipe title.", "title");
  if (!content.cuisine.trim()) add("missing_cuisine", "error", "Identify the cuisine or community context.", "cuisine");
  if (content.ingredients.length < 2) add("too_few_ingredients", "error", "List at least two ingredients.", "ingredients");
  if (content.steps.length < 2) add("too_few_steps", "error", "Describe at least two cooking steps.", "steps");
  content.ingredients.forEach((ingredient, index) => {
    if (!ingredient.canonicalSlug) add("unresolved_ingredient", "warning", `Map “${ingredient.name}” to the ingredient taxonomy before publication.`, `ingredients.${index}`);
  });
  if (content.declaredAllergens.length === 0) add("allergen_review_required", "warning", "No allergens are declared. Automated derivation and human review are still required.", "declaredAllergens");
  if (!rights) add("rights_incomplete", "error", "Complete the rights, provenance, licence and AI-assistance declaration.", "rights");
  return findings;
}

export function validateDraftVersion(value: RecipeDraftVersion): RecipeDraftVersion {
  validateDraftContent(value.content);
  if (value.rights) validateRights(value.rights);
  if (!/^[a-f0-9]{64}$/.test(value.contentHash) || value.versionNumber < 1 || !Number.isInteger(value.versionNumber)) throw new Error("invalid_draft_version");
  return value;
}

export function validateEditorialReview(value: EditorialReview, contributorId?: string): EditorialReview {
  assertContributionPayloadSafe(value);
  if (contributorId && value.reviewerId === contributorId) throw new Error("self_review_forbidden");
  if (!boundedString(value.summary, 5_000) || !boundedString(value.submissionId, 100) || !boundedString(value.reviewerId, 100)) throw new Error("invalid_editorial_review");
  return value;
}

export function validateCookTest(value: CookTestRun, expectedHash: string): CookTestRun {
  assertContributionPayloadSafe(value);
  if (value.contentHash !== expectedHash || !/^[a-f0-9]{64}$/.test(value.contentHash)) throw new Error("cook_test_version_mismatch");
  if (!Number.isInteger(value.servingsAttempted) || value.servingsAttempted < 1 || value.servingsAttempted > 100) throw new Error("invalid_cook_test");
  if (!boundedString(value.summary, 5_000)) throw new Error("invalid_cook_test");
  return value;
}

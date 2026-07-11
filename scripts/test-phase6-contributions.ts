import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  assertContributionPayloadSafe,
  automatedDraftFindings,
  canTransitionSubmission,
  canonicalDraftSlug,
  hashDraftContent,
  validateCookTest,
  validateDraftContent,
  validateEditorialReview,
  validateRights,
} from "../src/lib/contributions/security";
import type {
  CookTestRun,
  EditorialReview,
  RecipeDraftContent,
  RightsAttestation,
} from "../src/lib/contributions/types";

const now = "2026-07-12T00:00:00.000Z";
const content: RecipeDraftContent = {
  schemaVersion: 1,
  title: "Paatti's Kathirikai Curry",
  nativeTitle: "பாட்டி கத்திரிக்காய் கறி",
  description: "A family brinjal curry written in the contributor's own words.",
  cuisine: "tamil",
  region: "Madurai",
  language: "en",
  servings: 4,
  prepMinutes: 15,
  cookMinutes: 30,
  ingredients: [
    { id: "i1", name: "Brinjal", canonicalSlug: "brinjal", quantity: 500, unit: "g", optional: false },
    { id: "i2", name: "Onion", canonicalSlug: "onion", quantity: 1, unit: "piece", optional: false },
  ],
  steps: [
    { id: "s1", order: 1, text: "Cut the brinjal and keep it in water while preparing the aromatics." },
    { id: "s2", order: 2, text: "Cook the aromatics and brinjal until tender, then adjust salt." },
  ],
  cookware: ["kadai"],
  culturalStory: "Made by the family on ordinary rice days.",
  safetyNotes: [],
  claimedDietaryLabels: ["vegetarian"],
  declaredAllergens: [],
};
const rights: RightsAttestation = {
  sourceType: "family",
  writtenInOwnWords: true,
  rightToShare: true,
  aiAssistance: "structure",
  aiAssistanceNotes: "AI helped arrange the ingredient and step fields; the wording and method are mine.",
  publicContributorName: "Family contributor",
  publishCulturalStory: true,
  licence: "CC-BY-4.0",
  acceptedAt: now,
};

async function main(): Promise<void> {
  assert.equal(validateDraftContent(content).title, content.title);
  assert.equal(validateRights(rights).licence, "CC-BY-4.0");
  assert.throws(() => validateRights({ ...rights, rightToShare: false }), /rights_incomplete/);
  assert.throws(() => validateRights({ ...rights, aiAssistance: "drafting", aiAssistanceNotes: "" }), /ai_disclosure_incomplete/);
  assert.throws(() => assertContributionPayloadSafe({ nested: { apiKey: "never" } }), /secret_field_forbidden/);
  assert.throws(() => assertContributionPayloadSafe({ constructor: { prototype: { polluted: true } } }), /invalid_contribution_payload/);

  const firstHash = await hashDraftContent(content);
  const secondHash = await hashDraftContent({ ...content });
  const changedHash = await hashDraftContent({ ...content, servings: 5 });
  assert.match(firstHash, /^[a-f0-9]{64}$/);
  assert.equal(firstHash, secondHash, "stable content must retain the same evidence hash");
  assert.notEqual(firstHash, changedHash, "material edits must invalidate version-bound evidence");
  assert.equal(canonicalDraftSlug("Paatti's Kathirikai Curry"), "paatti-s-kathirikai-curry");

  assert.equal(canTransitionSubmission("submitted", "awaiting_editorial_review"), true);
  assert.equal(canTransitionSubmission("published", "awaiting_editorial_review"), false);
  assert.equal(canTransitionSubmission("editorially_approved", "publication_candidate"), true);

  const findings = automatedDraftFindings("submission-1", {
    ...content,
    ingredients: [{ ...content.ingredients[0], canonicalSlug: undefined }, content.ingredients[1]],
  }, rights, now);
  assert.ok(findings.some((finding) => finding.code === "unresolved_ingredient"));
  assert.ok(findings.some((finding) => finding.code === "allergen_review_required"));

  const review: EditorialReview = {
    id: "review-1",
    submissionId: "submission-1",
    reviewerId: "reviewer-1",
    role: "editorial",
    decision: "request_changes",
    summary: "Clarify the flame level in step two.",
    createdAt: now,
  };
  assert.equal(validateEditorialReview(review, "contributor-1").decision, "request_changes");
  assert.throws(() => validateEditorialReview({ ...review, reviewerId: "contributor-1" }, "contributor-1"), /self_review_forbidden/);

  const cookTest: CookTestRun = {
    id: "test-1",
    submissionId: "submission-1",
    versionId: "version-1",
    contentHash: firstHash,
    testerId: "tester-1",
    servingsAttempted: 4,
    equipmentUsed: ["kadai"],
    substitutions: [],
    stepFindings: content.steps.map((step) => ({ stepId: step.id, outcome: "clear" })),
    criticalSafetyObservations: [],
    outcome: "passed",
    summary: "Completed as written with clear texture cues.",
    createdAt: now,
  };
  assert.equal(validateCookTest(cookTest, firstHash).outcome, "passed");
  assert.throws(() => validateCookTest(cookTest, changedHash), /cook_test_version_mismatch/);

  const root = process.cwd();
  const sql = fs.readFileSync(path.join(root, "supabase", "migrations", "20260712_phase6_living_cookbook.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.recipe_draft_versions/);
  assert.match(sql, /create table if not exists public\.recipe_submissions/);
  assert.match(sql, /create table if not exists public\.editorial_reviews/);
  assert.match(sql, /create table if not exists public\.cook_test_runs/);
  assert.match(sql, /create table if not exists public\.publication_candidates/);
  assert.match(sql, /create table if not exists public\.contribution_status_events/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /self_review_forbidden/);
  assert.match(sql, /self_test_forbidden/);
  assert.match(sql, /self_publication_approval_forbidden/);
  assert.match(sql, /passed_tests < 2/);
  assert.match(sql, /service_role_required/);
  assert.match(sql, /grant execute on function public\.claim_publication_candidate\(uuid\) to service_role/);
  assert.doesNotMatch(sql, /grant\s+(?:select|insert|update|delete|all)\s+on\s+public\.(?:recipe_drafts|recipe_submissions|publication_candidates)\s+to\s+(?:anon|authenticated)/i);
  assert.match(sql, /revoke all on public\.contribution_roles[\s\S]*from anon, authenticated/);

  const publisher = fs.readFileSync(path.join(root, "scripts", "open-publication-candidate-pr.ts"), "utf8");
  assert.match(publisher, /publication_repository_not_allowlisted/);
  assert.match(publisher, /quarantine\/publication-candidates/);
  assert.match(publisher, /draft: true/);
  assert.match(publisher, /mark_publication_candidate_pr/);
  assert.doesNotMatch(publisher, /\/merges|merge_pull_request|wrangler deploy|npm run deploy/i, "publication operator must not merge or deploy");
  assert.doesNotMatch(publisher, /data\/recipes\//, "operator must not invent canonical metadata or publish directly");

  const editor = fs.readFileSync(path.join(root, "src", "components", "SubmitRecipeForm.tsx"), "utf8");
  assert.match(editor, /Saving or syncing never publishes/);
  assert.match(editor, /Submit this exact version for review/);
  assert.match(editor, /right to share/);

  console.log("Phase 6 living-cookbook tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

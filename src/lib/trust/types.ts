import type { Allergen, DietType } from "../types";

export type AllergenAssessmentStatus = "derived" | "reviewed" | "incomplete" | "unknown";

export interface AllergenAssessment {
  status: AllergenAssessmentStatus;
  /** Allergens present according to canonical ingredient metadata and recipe declarations. */
  contains: Allergen[];
  /** Risks that cannot be proven from recipe data alone, such as packaged-ingredient cross-contact. */
  mayContain: Allergen[];
  crossContactNotes: string[];
  basis: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export type ProvenanceSourceType =
  | "original"
  | "ai_assisted_original"
  | "community"
  | "public_domain"
  | "open_license"
  | "licensed"
  | "unknown";

export type LicenseAssessmentStatus = "approved" | "declared" | "blocked" | "unknown";

export interface ProvenanceAssessment {
  sourceType: ProvenanceSourceType;
  sourceLabel: string;
  sourceUrl: string | null;
  licenseId: string;
  licenseStatus: LicenseAssessmentStatus;
  attributionRequired: boolean;
  attributionText: string | null;
  evidence: string[];
  checkedAt: string;
  checkedBy: string;
}

export type EditorialStatus = "unreviewed" | "needs_review" | "reviewed";
export type CookTestStatus = "not_cook_tested" | "partially_cook_tested" | "cook_tested";

export interface VerificationAssessment {
  dataStatus: "validated";
  editorialStatus: EditorialStatus;
  cookTestStatus: CookTestStatus;
  claim: string;
  evidence: string[];
  boundRecipeVersion: string;
}

export type RecipeHazard =
  | "raw_poultry"
  | "raw_meat"
  | "seafood"
  | "egg"
  | "hot_oil"
  | "pressure_cooker"
  | "fermentation"
  | "cross_contamination";

export interface SafetyProfile {
  hazards: RecipeHazard[];
  warnings: string[];
  criticalChecks: string[];
}

export interface DietaryAssessment {
  claimed: DietType[];
  derivedPrimary: "vegan" | "vegetarian" | "eggetarian" | "pescatarian" | "non_vegetarian";
  conflicts: string[];
  basis: string;
}

export interface RecipeTrustRecord {
  schemaVersion: 1;
  recipeId: string;
  recipeVersion: string;
  generatedAt: string;
  allergen: AllergenAssessment;
  dietary: DietaryAssessment;
  provenance: ProvenanceAssessment;
  verification: VerificationAssessment;
  safety: SafetyProfile;
  publication: {
    eligible: boolean;
    blockers: string[];
    warnings: string[];
  };
}

export interface PublicTrustManifest {
  schemaVersion: 1;
  generatedAt: string;
  recipes: Record<string, RecipeTrustRecord>;
}

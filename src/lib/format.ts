import type { Difficulty, SpiceLevel, BudgetLevel, VerificationStatus, RecipeIngredient } from "./types";

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Involved",
};

export const SPICE_LABEL: Record<SpiceLevel, string> = {
  none: "No heat",
  mild: "Mild",
  medium: "Medium heat",
  hot: "Hot",
  very_hot: "Very hot",
};

export const SPICE_CHILLIES: Record<SpiceLevel, number> = {
  none: 0, mild: 1, medium: 2, hot: 3, very_hot: 4,
};

export const BUDGET_LABEL: Record<BudgetLevel, string> = {
  budget: "Budget-friendly",
  moderate: "Moderate cost",
  premium: "Premium",
};

export const VERIFICATION_LABEL: Record<VerificationStatus, { label: string; note: string }> = {
  ai_drafted: {
    label: "AI-assisted draft",
    note: "An original draft generated with editorial AI. It is structurally validated but not automatically human-reviewed or cook-tested.",
  },
  editor_needed: {
    label: "Editorial review needed",
    note: "This draft still needs human editorial review.",
  },
  community_submitted: {
    label: "Community draft",
    note: "Shared by a home cook. It is not independently verified or cook-tested unless separate evidence says so.",
  },
  public_domain_imported: {
    label: "Public-domain source",
    note: "Adapted from a declared public-domain source, with provenance shown on the recipe.",
  },
  open_license_imported: {
    label: "Open-license source",
    note: "Imported under a declared open licence, with attribution and licence details shown.",
  },
  licensed_partner: {
    label: "Licensed source",
    note: "Provided under a declared content licence.",
  },
  verified: {
    label: "Legacy verification claim",
    note: "This legacy status is not sufficient by itself; the Phase 2 trust record controls public evidence claims.",
  },
};

const PUBLIC_LABELS: Record<string, string> = {
  ai_drafted: "AI-assisted draft",
  editor_needed: "Editorial review needed",
  community_submitted: "Community draft",
  public_domain_imported: "Public-domain source",
  open_license_imported: "Open-license source",
  licensed_partner: "Licensed source",
  non_vegetarian: "Non-vegetarian",
  gluten_free_placeholder: "Gluten-free estimate",
  dairy_free_placeholder: "Dairy-free estimate",
  diabetic_friendly_placeholder: "Diabetic-friendly estimate",
  high_protein: "High protein",
  low_carb: "Low carb",
  very_hot: "Very hot",
  pressure_cooker: "Pressure cooker",
  identity_change: "Changes the dish",
  equivalent: "Equivalent",
  good: "Good swap",
  workable: "Workable swap",
  not_cook_tested: "Not cook-tested",
  cook_tested: "Cook-tested",
};

/** One public-safe label function so internal enums never leak into UI. */
export function publicLabel(value: string): string {
  if (PUBLIC_LABELS[value]) return PUBLIC_LABELS[value];
  return value
    .replace(/_placeholder$/, " estimate")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatQuantity(ing: RecipeIngredient): string {
  if (ing.unit === "to_taste") return "to taste";
  if (ing.quantity === null) return ing.unit ?? "";
  const q = Number.isInteger(ing.quantity)
    ? String(ing.quantity)
    : String(Math.round(ing.quantity * 100) / 100);
  if (!ing.unit) return q;
  const unitLabel: Record<string, string> = {
    g: "g", kg: "kg", ml: "ml", l: "L", tsp: "tsp", tbsp: "tbsp", cup: ing.quantity === 1 ? "cup" : "cups",
    piece: "", whole: "whole", clove: ing.quantity === 1 ? "clove" : "cloves",
    sprig: ing.quantity === 1 ? "sprig" : "sprigs", leaf: ing.quantity === 1 ? "leaf" : "leaves",
    pinch: ing.quantity === 1 ? "pinch" : "pinches", handful: ing.quantity === 1 ? "handful" : "handfuls",
    inch: "inch", cm: "cm", slice: ing.quantity === 1 ? "slice" : "slices",
    bunch: ing.quantity === 1 ? "bunch" : "bunches", can: ing.quantity === 1 ? "can" : "cans",
  };
  const u = unitLabel[ing.unit] ?? ing.unit;
  return u ? `${q} ${u}` : q;
}

export function titleFromSlug(slug: string): string {
  return publicLabel(slug);
}

import { PUBLISHABLE_LICENSES } from "../canon";
import type { Allergen, IngredientDef, Recipe } from "../types";
import type {
  CookTestStatus,
  EditorialStatus,
  ProvenanceSourceType,
  RecipeHazard,
  RecipeTrustRecord,
  SafetyProfile,
} from "./types";

const POULTRY_SLUGS = new Set(["chicken", "turkey", "duck", "quail"]);
const MEAT_SLUGS = new Set(["mutton", "lamb", "beef", "pork", "goat", "keema"]);
const SEAFOOD_SLUGS = new Set(["fish", "prawn", "shrimp", "crab", "squid", "mussels", "clam"]);
const EGG_SLUGS = new Set(["egg", "eggs"]);
const ATTRIBUTION_LICENSES = new Set(["CC-BY-4.0", "CC-BY-SA-4.0"]);

function sorted<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort() as T[];
}

function sourceTypeFor(recipe: Recipe): ProvenanceSourceType {
  switch (recipe.verificationStatus) {
    case "ai_drafted": return "ai_assisted_original";
    case "community_submitted": return "community";
    case "public_domain_imported": return "public_domain";
    case "open_license_imported": return "open_license";
    case "licensed_partner": return "licensed";
    case "editor_needed": return recipe.license === "original" ? "original" : "unknown";
    case "verified": return recipe.license === "original" ? "original" : "unknown";
  }
}

function editorialStatusFor(recipe: Recipe): EditorialStatus {
  if (recipe.verificationStatus === "verified") return "reviewed";
  if (recipe.verificationStatus === "editor_needed" || recipe.verificationStatus === "community_submitted") {
    return "needs_review";
  }
  return "unreviewed";
}

function cookTestStatusFor(recipe: Recipe): CookTestStatus {
  return recipe.verificationStatus === "verified" ? "cook_tested" : "not_cook_tested";
}

function safetyProfile(recipe: Recipe, defs: IngredientDef[]): SafetyProfile {
  const slugs = new Set(recipe.ingredients.map((ingredient) => ingredient.normalizedName));
  const hazards = new Set<RecipeHazard>();

  if ([...slugs].some((slug) => POULTRY_SLUGS.has(slug))) {
    hazards.add("raw_poultry");
    hazards.add("cross_contamination");
  }
  if ([...slugs].some((slug) => MEAT_SLUGS.has(slug)) || defs.some((def) => def.category === "meat")) {
    hazards.add("raw_meat");
    hazards.add("cross_contamination");
  }
  if ([...slugs].some((slug) => SEAFOOD_SLUGS.has(slug)) || defs.some((def) => def.category === "seafood")) {
    hazards.add("seafood");
    hazards.add("cross_contamination");
  }
  if ([...slugs].some((slug) => EGG_SLUGS.has(slug)) || defs.some((def) => def.category === "egg")) {
    hazards.add("egg");
  }
  if (recipe.methods.includes("deep-frying") || recipe.methods.includes("shallow-frying")) {
    hazards.add("hot_oil");
  }
  if (recipe.methods.includes("pressure-cooking") || recipe.cookware.includes("pressure-cooker")) {
    hazards.add("pressure_cooker");
  }
  if (recipe.methods.includes("fermenting")) hazards.add("fermentation");

  const warnings: string[] = [];
  const criticalChecks: string[] = [];
  if (hazards.has("cross_contamination")) {
    warnings.push("Keep raw animal products, their plates and utensils separate from cooked food; wash hands and surfaces after contact.");
  }
  if (hazards.has("raw_poultry")) {
    criticalChecks.push("Verify poultry doneness with a food thermometer where possible; do not rely on colour alone.");
  }
  if (hazards.has("raw_meat")) {
    criticalChecks.push("Use an appropriate food thermometer and safe doneness guidance for the specific cut of meat.");
  }
  if (hazards.has("seafood")) {
    criticalChecks.push("Cook seafood until safely done for the species and preparation; keep it chilled before cooking.");
  }
  if (hazards.has("egg")) {
    criticalChecks.push("Use pasteurised eggs for preparations served raw or lightly cooked, especially for higher-risk people.");
  }
  if (hazards.has("hot_oil")) {
    warnings.push("Keep water away from hot oil, lower food gently, avoid overfilling the vessel and never leave frying unattended.");
  }
  if (hazards.has("pressure_cooker")) {
    warnings.push("Follow the cooker manufacturer's fill, venting and opening instructions; never force the lid open under pressure.");
  }
  if (hazards.has("fermentation")) {
    warnings.push("Fermentation conditions affect safety. Discard batches with unexpected mould, putrid odour or other spoilage signs.");
  }

  return { hazards: sorted(hazards), warnings, criticalChecks };
}

function derivedPrimary(defs: IngredientDef[]): RecipeTrustRecord["dietary"]["derivedPrimary"] {
  if (defs.some((def) => def.category === "meat")) return "non_vegetarian";
  if (defs.some((def) => def.category === "seafood")) return "pescatarian";
  if (defs.some((def) => def.category === "egg")) return "eggetarian";
  if (defs.some((def) => def.category === "dairy")) return "vegetarian";
  return "vegan";
}

function dietaryConflicts(recipe: Recipe, primary: RecipeTrustRecord["dietary"]["derivedPrimary"], allergens: Allergen[]): string[] {
  const conflicts: string[] = [];
  if (recipe.dietType.includes("vegan") && primary !== "vegan") {
    conflicts.push(`Claims vegan but canonical ingredients derive as ${primary}.`);
  }
  if (recipe.dietType.includes("vegetarian") && ["eggetarian", "pescatarian", "non_vegetarian"].includes(primary)) {
    conflicts.push(`Claims vegetarian but canonical ingredients derive as ${primary}.`);
  }
  if (recipe.dietType.includes("eggetarian") && ["pescatarian", "non_vegetarian"].includes(primary)) {
    conflicts.push(`Claims eggetarian but contains meat or seafood ingredients.`);
  }
  if (recipe.dietType.includes("pescatarian") && primary === "non_vegetarian") {
    conflicts.push("Claims pescatarian but contains non-seafood meat ingredients.");
  }
  if (recipe.dietType.includes("gluten_free_placeholder") && allergens.includes("gluten")) {
    conflicts.push("Carries a gluten-free estimate tag while canonical ingredients include gluten.");
  }
  if (recipe.dietType.includes("dairy_free_placeholder") && allergens.includes("dairy")) {
    conflicts.push("Carries a dairy-free estimate tag while canonical ingredients include dairy.");
  }
  return conflicts;
}

export function deriveRecipeTrust(
  recipe: Recipe,
  ingredientDefs: Map<string, IngredientDef>,
  recipeVersion: string,
  generatedAt: string,
): RecipeTrustRecord {
  const defs = recipe.ingredients
    .map((ingredient) => ingredientDefs.get(ingredient.normalizedName))
    .filter((definition): definition is IngredientDef => Boolean(definition));
  const missingDefinitions = recipe.ingredients
    .map((ingredient) => ingredient.normalizedName)
    .filter((slug) => !ingredientDefs.has(slug));

  const taxonomyAllergens = sorted(defs.flatMap((definition) => definition.allergens));
  const declaredAllergens = sorted(recipe.allergens);
  const contains = sorted<Allergen>([...taxonomyAllergens, ...declaredAllergens]);
  const allergenWarnings: string[] = [];
  const undeclaredDerived = taxonomyAllergens.filter((allergen) => !declaredAllergens.includes(allergen));
  if (undeclaredDerived.length) {
    allergenWarnings.push(`Recipe allergen field omitted taxonomy-derived: ${undeclaredDerived.join(", ")}. Public output uses the safer union.`);
  }

  const allergenStatus = missingDefinitions.length ? "incomplete" : "derived";
  const primary = derivedPrimary(defs);
  const conflicts = dietaryConflicts(recipe, primary, contains);
  const sourceType = sourceTypeFor(recipe);
  const attributionRequired = ATTRIBUTION_LICENSES.has(recipe.license);
  const publishableLicense = (PUBLISHABLE_LICENSES as readonly string[]).includes(recipe.license);
  const imported = ["open_license_imported", "public_domain_imported", "licensed_partner"].includes(recipe.verificationStatus);
  const provenanceBlockers: string[] = [];

  if (!publishableLicense) provenanceBlockers.push(`License "${recipe.license}" is not approved for publishing full recipe text.`);
  if (imported && !recipe.sourceUrl) provenanceBlockers.push("Imported or partner content requires a source URL.");
  if (attributionRequired && (!recipe.author || !recipe.source)) {
    provenanceBlockers.push(`License ${recipe.license} requires source and author attribution.`);
  }
  if (recipe.verificationStatus === "public_domain_imported" && !["public-domain", "CC0"].includes(recipe.license)) {
    provenanceBlockers.push("Public-domain import status conflicts with the declared license.");
  }
  if (recipe.verificationStatus === "verified") {
    provenanceBlockers.push("Legacy 'verified' status has no version-bound evidence record and cannot be published as verified.");
  }

  const blockers = [
    ...provenanceBlockers,
    ...conflicts,
    ...missingDefinitions.map((slug) => `Missing canonical ingredient definition for ${slug}.`),
    ...(recipe.image && !recipe.imageLicense ? ["Recipe image is missing image-license metadata."] : []),
  ];

  const warnings = [
    ...allergenWarnings,
    ...(recipe.license === "original" && recipe.sourceUrl
      ? ["Recipe claims original text while linking an external source; confirm the wording is independently authored."]
      : []),
  ];

  const editorialStatus = editorialStatusFor(recipe);
  const cookTestStatus = cookTestStatusFor(recipe);
  const sourceTypeLabel: Record<ProvenanceSourceType, string> = {
    original: "Original Cook Anything formulation",
    ai_assisted_original: "AI-assisted original draft",
    community: "Community-submitted draft",
    public_domain: "Public-domain source",
    open_license: "Open-license source",
    licensed: "Licensed source",
    unknown: "Source classification needs review",
  };

  return {
    schemaVersion: 1,
    recipeId: recipe.slug,
    recipeVersion,
    generatedAt,
    allergen: {
      status: allergenStatus,
      contains,
      mayContain: [],
      crossContactNotes: [
        "Ingredient metadata cannot prove an allergen-free kitchen. Check packaged labels and cross-contact statements for your products.",
      ],
      basis: missingDefinitions.length
        ? `Incomplete automated assessment; missing definitions: ${missingDefinitions.join(", ")}.`
        : "Automatically derived from canonical ingredient metadata and recipe declarations; not a medical guarantee.",
    },
    dietary: {
      claimed: recipe.dietType,
      derivedPrimary: primary,
      conflicts,
      basis: "Derived from canonical ingredient categories; packaged ingredients and manufacturing cross-contact still require label checks.",
    },
    provenance: {
      sourceType,
      sourceLabel: sourceTypeLabel[sourceType],
      sourceUrl: recipe.sourceUrl,
      licenseId: recipe.license,
      licenseStatus: publishableLicense ? "declared" : "blocked",
      attributionRequired,
      attributionText: attributionRequired ? `${recipe.source} — ${recipe.author}` : null,
      evidence: ["Repository recipe metadata; external license terms are not automatically re-verified at build time."],
      checkedAt: generatedAt,
      checkedBy: "Cook Anything automated trust policy",
    },
    verification: {
      dataStatus: "validated",
      editorialStatus,
      cookTestStatus,
      claim: cookTestStatus === "cook_tested"
        ? "Marked cook-tested, but publication requires separate version-bound evidence."
        : editorialStatus === "unreviewed"
          ? "Structurally validated; not yet cook-tested or editorially verified."
          : "Structurally validated; editorial review is still required.",
      evidence: ["Structural and referential validation only."],
      boundRecipeVersion: recipeVersion,
    },
    safety: safetyProfile(recipe, defs),
    publication: {
      eligible: blockers.length === 0,
      blockers,
      warnings,
    },
  };
}

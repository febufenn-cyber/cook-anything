/**
 * Adapts a platform Recipe into the role-tagged CompanionRecipe the live
 * cooking agent consumes. Role / criticality / heat-stability are inferred
 * heuristically from the ingredient taxonomy and recipe context.
 */
import type { IngredientDef, Recipe, RecipeIngredient } from "../types";
import type { RecipeTrustRecord } from "../trust/types";
import type {
  CompanionIngredient,
  CompanionRecipe,
  CompanionStep,
  Criticality,
  HeatStability,
  IngredientRole,
} from "./types";

const ACID_SLUGS = new Set([
  "lemon", "lime", "vinegar", "tamarind", "amchur", "kokum", "raw-mango",
]);
const HEAT_HINT = /chilli|chili|pepper|cayenne|schezwan|szechuan|harissa|gochu|sriracha/i;
const UMAMI_SALT_HINT = /salt|soy sauce|fish sauce|miso|msg|ajinomoto|stock cube|bouillon|worcestershire|asafoetida|hing/i;
const THICKENER_HINT = /cornflour|corn starch|cornstarch|arrowroot|slurry/i;
const COATING_CONTEXT = /coat|batter|dredge|dust|crust/i;
const GARNISH_HINT = /garnish|sprinkle on top|to finish|for serving/i;
const ADD_LATE_HINT = /coriander leaves|cilantro|mint|spring onion green|garam masala|lemon|lime|kasuri|curry leaves for garnish/i;
const AROMATIC_CATEGORIES = new Set(["spice", "herb"]);
const BASE_CATEGORIES = new Set(["meat", "seafood", "egg", "pulse", "grain", "vegetable", "fruit"]);

function inferRole(ing: RecipeIngredient, def: IngredientDef | undefined, recipe: Recipe): IngredientRole {
  const text = `${ing.name} ${ing.notes ?? ""}`;
  const slug = ing.normalizedName;
  if (ACID_SLUGS.has(slug)) return "ACID";
  if (def?.category === "sweetener") return "SWEET";
  if (def?.category === "oil" || /ghee|butter/i.test(slug)) return "FAT";
  if (UMAMI_SALT_HINT.test(text) || slug === "salt") return "UMAMI_SALT";
  if (HEAT_HINT.test(text)) return "HEAT";
  if (THICKENER_HINT.test(text)) {
    const fried = recipe.methods.some((m) => /fry/i.test(m));
    return fried && COATING_CONTEXT.test(text) ? "COATING" : "THICKENER";
  }
  if (/flour|besan|maida|rava|semolina/.test(slug) && COATING_CONTEXT.test(text)) return "COATING";
  if (GARNISH_HINT.test(text)) return "GARNISH";
  if (/^(onion|garlic|ginger|shallot|ginger-garlic-paste|curry-leaves|green-chilli)$/.test(slug)) return "AROMATIC";
  if (def && AROMATIC_CATEGORIES.has(def.category)) return "AROMATIC";
  if (def && BASE_CATEGORIES.has(def.category)) return "BASE";
  if (def?.category === "dairy") return /paneer|cheese|cream|coconut milk/.test(slug) ? "BASE" : "FAT";
  return "BASE";
}

function inferCriticality(ing: RecipeIngredient, role: IngredientRole): Criticality {
  if (ing.optional) return "OPTIONAL";
  if (role === "BASE" || role === "COATING") return "STRUCTURAL";
  if (role === "GARNISH") return "OPTIONAL";
  return "FLAVOR";
}

function inferHeatStability(ing: RecipeIngredient, role: IngredientRole): HeatStability {
  const text = `${ing.name} ${ing.notes ?? ""} ${ing.normalizedName}`;
  if (role === "ACID" && /lemon|lime/.test(ing.normalizedName)) return "ADD_LATE";
  if (role === "GARNISH") return "ADD_LATE";
  if (ADD_LATE_HINT.test(text)) return "ADD_LATE";
  return "COOK_STABLE";
}

function stageForStep(text: string, method: string | undefined, index: number, total: number): string {
  const t = `${text} ${method ?? ""}`.toLowerCase();
  if (/marinat/.test(t)) return "MARINATE";
  if (/rest|prove|proof|soak|ferment/.test(t)) return "REST";
  if (/deep.?fry|shallow.?fry|fry until|fry till|fry the/.test(t)) return "FRY";
  if (/temper|tadka|thalippu/.test(t)) return "TEMPER";
  if (/pressure|cooker whistle|instant pot/.test(t)) return "PRESSURE_COOK";
  if (/steam/.test(t)) return "STEAM";
  if (/grill|roast|bake|tandoor/.test(t)) return "ROAST";
  if (/simmer|boil|gravy|sauce|curry|masala/.test(t)) return "SAUCE";
  if (/garnish|serve|plate|finish/.test(t) || index === total - 1) return "FINISH";
  if (/chop|cut|slice|grind|blend|mix|whisk|knead|wash|prep/.test(t) || index === 0) return "PREP";
  return "COOK";
}

export function toCompanionRecipe(
  recipe: Recipe,
  ingredientDefs: Map<string, IngredientDef>,
  trust?: RecipeTrustRecord,
): CompanionRecipe {
  const total = recipe.steps.length;
  const steps: CompanionStep[] = recipe.steps.map((s, i) => ({
    id: `step_${s.order}`,
    stage: stageForStep(s.text, s.method, i, total),
    text: s.text,
    ...(s.timerMinutes ? { timer_minutes: s.timerMinutes } : {}),
  }));
  const stages = [...new Set(steps.map((s) => s.stage))];
  if (!stages.includes("PLATED")) stages.push("PLATED");

  const subsByIngredient = new Map<string, { name: string; notes?: string }[]>();
  for (const sub of recipe.substitutions) {
    const list = subsByIngredient.get(sub.ingredient) ?? [];
    list.push({ name: sub.substitute, ...(sub.notes ? { notes: sub.notes } : {}) });
    subsByIngredient.set(sub.ingredient, list);
  }

  const ingredients: CompanionIngredient[] = recipe.ingredients.map((ing) => {
    const def = ingredientDefs.get(ing.normalizedName);
    const role = inferRole(ing, def, recipe);
    const names = [ing.name, def?.name, ing.normalizedName.replace(/-/g, " ")]
      .filter((n): n is string => Boolean(n))
      .map((n) => n.toLowerCase().replace(/\s*\(.*\)\s*/, ""));
    const consuming = steps.find((s) =>
      names.some((n) => n.length > 2 && s.text.toLowerCase().includes(n)),
    );
    return {
      name: ing.name,
      slug: ing.normalizedName,
      ta: def?.ta ?? null,
      hi: def?.hi ?? null,
      qty: ing.quantity,
      unit: ing.unit,
      role,
      criticality: inferCriticality(ing, role),
      heat_stability: inferHeatStability(ing, role),
      stage: consuming?.stage ?? stages[0],
      ...(ing.notes ? { visual_checks: [ing.notes], notes: ing.notes } : {}),
      ...(subsByIngredient.has(ing.normalizedName)
        ? { subs: subsByIngredient.get(ing.normalizedName) }
        : {}),
    };
  });

  return {
    recipe_id: recipe.slug,
    title: recipe.title,
    base_servings: recipe.servings,
    spice_level: recipe.spiceLevel,
    cookware: recipe.cookware,
    stages,
    ingredients,
    steps,
    trust: trust
      ? {
          allergen_status: trust.allergen.status,
          contains_allergens: trust.allergen.contains,
          cross_contact_notes: trust.allergen.crossContactNotes,
          safety_warnings: trust.safety.warnings,
          critical_checks: trust.safety.criticalChecks,
          cook_test_status: trust.verification.cookTestStatus,
          provenance_summary: `${trust.provenance.sourceLabel}; declared licence ${trust.provenance.licenseId}.`,
          substitution_warning: "A substitution can introduce allergens or change dietary suitability. Never claim a swap is safe without checking the replacement's label and the user's allergy context.",
        }
      : {
          allergen_status: "unknown",
          contains_allergens: recipe.allergens,
          cross_contact_notes: ["Check every packaged ingredient label and cross-contact statement."],
          safety_warnings: [],
          critical_checks: [],
          cook_test_status: "not_cook_tested",
          provenance_summary: `Legacy recipe metadata; declared licence ${recipe.license}.`,
          substitution_warning: "A substitution can introduce allergens or change dietary suitability. Check the replacement label.",
        },
    ...(recipe.substitutions.length
      ? {
          substitution_notes: recipe.substitutions
            .map((s) => `${s.ingredient} → ${s.substitute}${s.notes ? ` (${s.notes})` : ""}`)
            .join("; "),
        }
      : {}),
    indian_kitchen_adaptation: recipe.indianKitchenAdaptation,
  };
}

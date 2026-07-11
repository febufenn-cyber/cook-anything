/**
 * Cooking Companion — shared shapes between the UI, the recipe adapter and
 * the Worker API (/api/companion). Mirrors the Companion Agent prompt v1:
 * role-tagged ingredients, a session-state object the model maintains every
 * turn, and a substitution ledger that is treated as law once written.
 */

export type IngredientRole =
  | "BASE"
  | "AROMATIC"
  | "ACID"
  | "HEAT"
  | "SWEET"
  | "UMAMI_SALT"
  | "THICKENER"
  | "COATING"
  | "FAT"
  | "GARNISH";

export type Criticality = "STRUCTURAL" | "FLAVOR" | "OPTIONAL";
export type HeatStability = "COOK_STABLE" | "ADD_LATE";

export interface CompanionIngredient {
  name: string;
  /** Canonical slug from the ingredient taxonomy (drives multilingual names) */
  slug: string;
  /** Tamil / Hindi names so the agent can mirror the user's vocabulary */
  ta: string | null;
  hi: string | null;
  qty: number | null;
  unit: string | null;
  role: IngredientRole;
  criticality: Criticality;
  heat_stability: HeatStability;
  /** Stage label from the recipe's stages array that consumes this ingredient */
  stage: string;
  visual_checks?: string[];
  subs?: { name: string; notes?: string }[];
  notes?: string;
}

export interface CompanionStep {
  id: string;
  stage: string;
  text: string;
  timer_minutes?: number;
}

/** The recipe JSON handed to the model each turn (Appendix A shape). */
export interface CompanionRecipe {
  recipe_id: string;
  title: string;
  base_servings: number;
  spice_level: string;
  cookware: string[];
  stages: string[];
  ingredients: CompanionIngredient[];
  steps: CompanionStep[];
  /** Free-text grounding the model may draw on for swaps and technique */
  substitution_notes?: string;
  indian_kitchen_adaptation?: string | null;
}

export interface LedgerEntry {
  original: string;
  now: string;
  qty?: string;
  constraint?: string;
  cascade?: string;
}

export interface CompanionTimer {
  label: string;
  remaining_s: number;
}

/** Maintained BY the model, echoed back to it every turn. */
export interface CompanionState {
  recipe_id: string;
  servings: number;
  stage: string;
  steps_done: string[];
  current_step: string;
  substitution_ledger: LedgerEntry[];
  flags: string[];
  timers: CompanionTimer[];
}

/* ----------------------------- API contract ----------------------------- */

export type ChatContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string | ChatContentBlock[];
}

export interface CompanionRequest {
  recipe: CompanionRecipe;
  state: CompanionState;
  messages: ChatMessage[];
  /** Subscription-bridge conversation id (opaque; echo back what you last got) */
  bridge_session_id?: string | null;
}

export interface CompanionResponse {
  reply: string;
  /** Updated session state parsed from the model's <state> block, if any */
  state: CompanionState | null;
  error?: string;
  /** Present when the subscription bridge answered; send it on the next turn */
  bridge_session_id?: string;
}

export function initialCompanionState(recipe: CompanionRecipe): CompanionState {
  return {
    recipe_id: recipe.recipe_id,
    servings: recipe.base_servings,
    stage: recipe.stages[0] ?? "PREP",
    steps_done: [],
    current_step: recipe.steps[0]?.id ?? "start",
    substitution_ledger: [],
    flags: [],
    timers: [],
  };
}

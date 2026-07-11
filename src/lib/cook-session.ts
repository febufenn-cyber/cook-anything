import type { Recipe, RecipeIngredient } from "./types";

export const COOK_SESSION_SCHEMA_VERSION = 1;

export interface PersistedCookTimer {
  stepIndex: number;
  label: string;
  endsAt: number;
  createdAt: number;
}

export interface PersistedCookSession {
  schemaVersion: number;
  recipeId: string;
  recipeVersion: string;
  servings: number;
  stepIndex: number;
  completedSteps: number[];
  timer: PersistedCookTimer | null;
  updatedAt: number;
}

export interface ScaledIngredient extends RecipeIngredient {
  scalingNote?: string;
}

const SEASON_TO_TASTE = /salt|chilli|chili|pepper|garam-masala|masala|spice|asafoetida|hing/i;
const WHOLE_UNIT = /egg|onion|tomato|potato|lemon|lime|banana|apple|capsicum|brinjal|chicken-piece/i;
const FRYING_OIL = /oil/i;

export function cookSessionKey(recipeId: string): string {
  return `cook-anything.cook-session.${recipeId}`;
}

export function recipeCookVersion(recipe: Pick<Recipe, "slug" | "updatedAt" | "steps" | "servings">): string {
  return `${recipe.slug}:${recipe.updatedAt}:${recipe.steps.length}:${recipe.servings}`;
}

export function remainingTimerSeconds(timer: PersistedCookTimer | null, now = Date.now()): number | null {
  if (!timer) return null;
  return Math.max(0, Math.ceil((timer.endsAt - now) / 1_000));
}

export function createCookTimer(stepIndex: number, label: string, minutes: number, now = Date.now()): PersistedCookTimer {
  const boundedMinutes = Math.max(0, Math.min(24 * 60, minutes));
  return {
    stepIndex,
    label,
    createdAt: now,
    endsAt: now + boundedMinutes * 60_000,
  };
}

export function validateCookSession(value: unknown, recipe: Recipe): PersistedCookSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const session = value as Partial<PersistedCookSession>;
  if (session.schemaVersion !== COOK_SESSION_SCHEMA_VERSION) return null;
  if (session.recipeId !== recipe.slug || session.recipeVersion !== recipeCookVersion(recipe)) return null;
  if (!Number.isFinite(session.servings) || session.servings! < 1 || session.servings! > 100) return null;
  if (!Number.isInteger(session.stepIndex) || session.stepIndex! < 0 || session.stepIndex! >= recipe.steps.length) return null;
  if (!Array.isArray(session.completedSteps)
    || session.completedSteps.some((step) => !Number.isInteger(step) || step < 0 || step >= recipe.steps.length)) return null;
  if (new Set(session.completedSteps).size !== session.completedSteps.length) return null;
  if (!Number.isFinite(session.updatedAt)) return null;
  if (session.timer !== null && session.timer !== undefined) {
    const timer = session.timer;
    if (!Number.isInteger(timer.stepIndex) || timer.stepIndex < 0 || timer.stepIndex >= recipe.steps.length) return null;
    if (typeof timer.label !== "string" || timer.label.length > 200) return null;
    if (!Number.isFinite(timer.endsAt) || !Number.isFinite(timer.createdAt) || timer.endsAt < timer.createdAt) return null;
  }
  return {
    schemaVersion: COOK_SESSION_SCHEMA_VERSION,
    recipeId: recipe.slug,
    recipeVersion: recipeCookVersion(recipe),
    servings: session.servings!,
    stepIndex: session.stepIndex!,
    completedSteps: [...session.completedSteps].sort((a, b) => a - b),
    timer: session.timer ?? null,
    updatedAt: session.updatedAt!,
  };
}

export function loadCookSession(recipe: Recipe): PersistedCookSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cookSessionKey(recipe.slug));
    if (!raw) return null;
    const parsed = validateCookSession(JSON.parse(raw), recipe);
    if (!parsed) window.localStorage.removeItem(cookSessionKey(recipe.slug));
    return parsed;
  } catch {
    return null;
  }
}

export function saveCookSession(session: PersistedCookSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cookSessionKey(session.recipeId), JSON.stringify(session));
  } catch {
    // Private browsing or storage pressure: cook mode still works in memory.
  }
}

export function clearCookSession(recipeId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(cookSessionKey(recipeId));
  } catch {
    // Ignore unavailable storage.
  }
}

function roundKitchenQuantity(value: number): number {
  if (value >= 10) return Math.round(value);
  if (value >= 2) return Math.round(value * 2) / 2;
  return Math.round(value * 4) / 4;
}

export function scaleIngredientForServings(
  ingredient: RecipeIngredient,
  baseServings: number,
  targetServings: number,
  methods: string[],
): ScaledIngredient {
  if (ingredient.quantity === null || baseServings <= 0 || targetServings === baseServings) return { ...ingredient };
  const factor = targetServings / baseServings;
  const identity = `${ingredient.normalizedName} ${ingredient.name}`;

  if (FRYING_OIL.test(identity) && methods.includes("deep-frying")) {
    return { ...ingredient, scalingNote: "Use enough for a safe frying depth; do not multiply frying oil mechanically." };
  }

  if (ingredient.unit === "to_taste" || SEASON_TO_TASTE.test(identity)) {
    const conservativeFactor = factor <= 1 ? factor : 1 + (factor - 1) * 0.75;
    return {
      ...ingredient,
      quantity: roundKitchenQuantity(ingredient.quantity * conservativeFactor),
      scalingNote: "Start with this conservative amount, then taste and adjust.",
    };
  }

  const scaled = ingredient.quantity * factor;
  return {
    ...ingredient,
    quantity: roundKitchenQuantity(WHOLE_UNIT.test(identity) ? Math.max(0.5, scaled) : scaled),
    ...(WHOLE_UNIT.test(identity) && !Number.isInteger(scaled)
      ? { scalingNote: "Rounded to a practical kitchen quantity." }
      : {}),
  };
}

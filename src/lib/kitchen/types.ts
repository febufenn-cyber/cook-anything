export const KITCHEN_SCHEMA_VERSION = 1;
export const KITCHEN_EXPORT_FORMAT = "cook-anything-kitchen-export";

export type PantryProfileId = "none" | "minimal" | "indian-basics" | "custom";
export type PantryItemStatus = "available" | "running_low" | "out" | "unknown";
export type PantryItemSource = "user_added" | "shopping_list" | "cook_session" | "imported";
export type ShoppingStatus = "needed" | "purchased" | "dismissed";
export type CookOutcome = "completed" | "abandoned" | "failed";

export interface LocalKitchenProfile {
  schemaVersion: number;
  profileId: "local";
  pantryProfile: PantryProfileId;
  cookware: string[];
  dietaryPreferences: string[];
  allergensToAvoid: string[];
  excludedIngredients: string[];
  preferredLanguages: string[];
  preferredCuisines: string[];
  defaultServings?: number;
  maxWeeknightMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PantryItem {
  ingredientSlug: string;
  status: PantryItemStatus;
  quantity?: number;
  unit?: string;
  expiryDate?: string;
  openedAt?: string;
  source: PantryItemSource;
  updatedAt: string;
}

export interface SavedRecipe {
  recipeId: string;
  recipeSlug: string;
  recipeTitle: string;
  recipeVersion: string;
  savedAt: string;
  lastCookedAt?: string;
  timesCooked: number;
  preferredServings?: number;
  personalNotes?: string;
  pinnedSubstitutions: Array<{ original: string; replacement: string }>;
}

export interface CookHistoryEntry {
  id: string;
  recipeId: string;
  recipeSlug: string;
  recipeTitle: string;
  recipeVersion: string;
  startedAt: string;
  completedAt?: string;
  servings: number;
  substitutions: Array<{ original: string; replacement: string }>;
  outcome: CookOutcome;
  rating?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export interface ShoppingItemSource {
  recipeId?: string;
  recipeSlug?: string;
  mealPlanId?: string;
  reason: string;
}

export interface ShoppingListItem {
  id: string;
  ingredientSlug?: string;
  customLabel?: string;
  quantity?: number;
  unit?: string;
  status: ShoppingStatus;
  sources: ShoppingItemSource[];
  createdAt: string;
  updatedAt: string;
}

export interface MealPlanEntry {
  id: string;
  date: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  recipeId?: string;
  recipeSlug?: string;
  recipeTitle: string;
  recipeVersion?: string;
  servings?: number;
  createdAt: string;
  updatedAt: string;
}

export interface KitchenExport {
  format: typeof KITCHEN_EXPORT_FORMAT;
  schemaVersion: number;
  createdAt: string;
  profile: LocalKitchenProfile | null;
  pantry: PantryItem[];
  savedRecipes: SavedRecipe[];
  history: CookHistoryEntry[];
  shoppingList: ShoppingListItem[];
  mealPlan: MealPlanEntry[];
}

export interface KitchenSummary {
  pantry: number;
  savedRecipes: number;
  history: number;
  shoppingNeeded: number;
  mealPlan: number;
}

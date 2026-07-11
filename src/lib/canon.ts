/**
 * Canonical slug lists — the enum layer of the platform.
 * Taxonomy JSON files in data/taxonomy/ must stay in sync with these
 * (enforced by scripts/validate-recipes.ts).
 */

export const CUISINES = [
  "tamil", "chettinad", "kerala", "andhra", "telangana", "hyderabadi",
  "karnataka", "north-indian", "punjabi", "mughlai", "gujarati", "rajasthani",
  "maharashtrian", "goan", "bengali", "kashmiri", "pakistani", "sri-lankan",
  "bangladeshi", "nepali", "afghan", "chinese", "indo-chinese", "korean",
  "japanese", "thai", "vietnamese", "indonesian", "malaysian", "filipino",
  "italian", "french", "spanish", "greek", "british", "turkish", "lebanese",
  "persian", "middle-eastern", "moroccan", "ethiopian", "west-african",
  "egyptian", "mexican", "american", "brazilian", "peruvian", "caribbean",
  "mediterranean",
] as const;

export const COUNTRIES = [
  "india", "pakistan", "sri-lanka", "bangladesh", "nepal", "afghanistan",
  "china", "south-korea", "japan", "thailand", "vietnam", "indonesia",
  "malaysia", "philippines", "italy", "france", "spain", "greece",
  "united-kingdom", "turkey", "lebanon", "iran", "morocco", "ethiopia",
  "nigeria", "senegal", "egypt", "mexico", "united-states", "brazil", "peru",
  "jamaica",
] as const;

export const REGIONS = [
  "tamil-nadu", "chettinad-region", "kongunadu", "malabar", "travancore",
  "coastal-andhra", "rayalaseema", "telangana-region", "old-mysuru",
  "udupi-mangalore", "punjab", "gujarat", "rajasthan", "maharashtra", "goa",
  "bengal", "kashmir", "awadh", "delhi", "sichuan", "guangdong", "tuscany",
  "sicily", "naples", "provence", "oaxaca", "yucatan", "punjab-pakistan",
  "sindh", "jaffna", "anatolia", "kansai",
] as const;

export const METHODS = [
  "tempering", "pressure-cooking", "kadai-cooking", "tawa-cooking",
  "deep-frying", "shallow-frying", "pan-frying", "stir-frying", "steaming",
  "boiling", "simmering", "braising", "dum", "roasting", "grilling", "baking",
  "air-frying", "sauteing", "fermenting", "no-cook", "one-pot",
  "slow-cooking", "marinating",
] as const;

export const COOKWARE = [
  "kadai", "tawa", "pressure-cooker", "heavy-bottomed-pot", "saucepan",
  "frying-pan", "wok", "oven", "air-fryer", "grill", "idli-steamer",
  "steamer", "mixie", "blender", "rice-cooker", "clay-pot", "baking-tray",
  "skillet", "tandoor",
] as const;

export const TAGS = [
  "street-food", "festival", "diwali", "pongal", "onam", "eid", "christmas",
  "navratri", "bachelor-friendly", "quick", "under-30-minutes", "budget",
  "gym", "comfort-food", "party", "kids-friendly", "one-pot-meal",
  "leftover-friendly", "lunchbox", "tiffin", "no-onion-no-garlic", "summer",
  "monsoon", "winter", "healthy", "low-oil", "gravy", "dry-curry", "salad",
  "soup", "bowl", "wrap", "grill-bbq", "sweet", "fried-snack",
] as const;

export const MEAL_TYPES = [
  "breakfast", "lunch", "dinner", "snack", "dessert", "side", "drink", "tiffin",
] as const;

export const DIET_TYPES = [
  "vegetarian", "vegan", "eggetarian", "non_vegetarian", "pescatarian",
  "high_protein", "low_carb", "gluten_free_placeholder",
  "dairy_free_placeholder", "diabetic_friendly_placeholder",
] as const;

export const PRIMARY_DIETS = [
  "vegetarian", "vegan", "eggetarian", "non_vegetarian", "pescatarian",
] as const;

export const ALLERGENS = [
  "dairy", "gluten", "nuts", "peanuts", "soy", "egg", "fish", "shellfish",
  "sesame", "mustard",
] as const;

export const UNITS = [
  "g", "kg", "ml", "l", "tsp", "tbsp", "cup", "piece", "whole", "clove",
  "sprig", "leaf", "pinch", "handful", "inch", "cm", "slice", "bunch", "can",
  "to_taste",
] as const;

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const SPICE_LEVELS = ["none", "mild", "medium", "hot", "very_hot"] as const;
export const BUDGET_LEVELS = ["budget", "moderate", "premium"] as const;

export const VERIFICATION_STATUSES = [
  "ai_drafted", "editor_needed", "community_submitted",
  "public_domain_imported", "open_license_imported", "licensed_partner",
  "verified",
] as const;

export const KNOWN_LICENSES = [
  "original", "CC0", "CC-BY-4.0", "CC-BY-SA-4.0", "public-domain",
  "licensed", "all-rights-reserved",
] as const;

/** Licenses that are safe to publish full text for */
export const PUBLISHABLE_LICENSES = [
  "original", "CC0", "CC-BY-4.0", "CC-BY-SA-4.0", "public-domain", "licensed",
] as const;

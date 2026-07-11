import assert from "node:assert/strict";
import {
  buildAliasMap,
  matchRecipes,
  parseIngredientInput,
  suggestUnlockIngredients,
} from "../src/lib/match";
import {
  createCookTimer,
  remainingTimerSeconds,
  scaleIngredientForServings,
  validateCookSession,
  recipeCookVersion,
  COOK_SESSION_SCHEMA_VERSION,
} from "../src/lib/cook-session";
import type { Recipe, RecipeIndexEntry } from "../src/lib/types";

function indexedRecipe(overrides: Partial<RecipeIndexEntry> & Pick<RecipeIndexEntry, "slug" | "title" | "req">): RecipeIndexEntry {
  return {
    id: `ca-${overrides.slug}`,
    nativeTitle: null,
    cuisine: "test",
    country: "india",
    region: null,
    mealType: ["dinner"],
    dietType: ["non_vegetarian"],
    difficulty: "easy",
    spiceLevel: "mild",
    budgetLevel: "budget",
    totalTimeMinutes: 20,
    servings: 2,
    opt: [],
    subs: [],
    cookware: ["frying-pan"],
    methods: ["pan-frying"],
    tags: [],
    allergens: [],
    verificationStatus: "ai_drafted",
    ...overrides,
  };
}

const chickenCurry = indexedRecipe({
  slug: "chicken-curry",
  title: "Chicken Curry",
  req: ["chicken", "onion", "garam-masala"],
  ingredientMeta: {
    chicken: { importance: "identity", weight: 8 },
    onion: { importance: "important", weight: 3 },
    "garam-masala": { importance: "flavour", weight: 1.5 },
  },
});
const eggBhurji = indexedRecipe({
  slug: "egg-bhurji",
  title: "Egg Bhurji",
  req: ["egg", "onion", "tomato"],
  dietType: ["eggetarian"],
  allergens: ["egg"],
  ingredientMeta: {
    egg: { importance: "identity", weight: 8 },
    onion: { importance: "important", weight: 3 },
    tomato: { importance: "important", weight: 3 },
  },
});
const lemonRice = indexedRecipe({
  slug: "lemon-rice",
  title: "Lemon Rice",
  req: ["rice", "lemon", "salt"],
  dietType: ["vegan"],
  ingredientMeta: {
    rice: { importance: "identity", weight: 8 },
    lemon: { importance: "important", weight: 3 },
    salt: { importance: "pantry", weight: 0 },
  },
  subs: [["lemon", "tamarind"]],
  subMeta: [{ ingredient: "lemon", substitute: "tamarind", replacementSlugs: ["tamarind"], quality: "good" }],
});
const bakedEgg = indexedRecipe({
  slug: "baked-egg",
  title: "Baked Egg",
  req: ["egg"],
  dietType: ["eggetarian"],
  allergens: ["egg"],
  cookware: ["oven"],
  methods: ["baking"],
  ingredientMeta: { egg: { importance: "identity", weight: 8 } },
});

function testWeightedRanking(): void {
  const results = matchRecipes([chickenCurry, eggBhurji], {
    have: ["egg", "onion", "tomato", "garam-masala"],
    pantrySlugs: new Set(),
  });
  assert.equal(results[0].recipe.slug, "egg-bhurji", "complete identity match must beat flavour overlap");
  const chicken = results.find((result) => result.recipe.slug === "chicken-curry")!;
  assert.equal(chicken.bucket, "needs_shopping");
  assert.ok(chicken.missingDetails.some((item) => item.ingredient === "chicken" && item.essential));
  assert.ok(chicken.score < 0.25, "missing identity ingredient must strongly reduce score");
}

function testSubstitutionFeasibility(): void {
  const unavailable = matchRecipes([lemonRice], {
    have: ["rice"],
    pantrySlugs: new Set(["salt"]),
  })[0];
  assert.equal(unavailable.substitutable[0].available, false);
  assert.deepEqual(unavailable.missing, ["lemon"], "textual substitution must not erase a missing item");
  assert.deepEqual(unavailable.assumedPantry, ["salt"]);

  const available = matchRecipes([lemonRice], {
    have: ["rice", "tamarind"],
    pantrySlugs: new Set(["salt"]),
  })[0];
  assert.equal(available.substitutable[0].available, true);
  assert.equal(available.missing.length, 0);
  assert.equal(available.bucket, "substitutable");
}

function testHardConstraints(): void {
  const allergenBlocked = matchRecipes([eggBhurji], {
    have: ["egg", "onion", "tomato"],
    pantrySlugs: new Set(),
    excludeAllergens: ["egg"],
  });
  assert.equal(allergenBlocked.length, 0, "allergen exclusions must filter, not rank lower");

  const equipmentBlocked = matchRecipes([bakedEgg], {
    have: ["egg"],
    pantrySlugs: new Set(),
    availableCookware: ["pressure-cooker"],
    strictCookware: true,
  });
  assert.equal(equipmentBlocked.length, 0);

  const equipmentExplained = matchRecipes([bakedEgg], {
    have: ["egg"],
    pantrySlugs: new Set(),
    availableCookware: ["pressure-cooker"],
    strictCookware: false,
  })[0];
  assert.deepEqual(equipmentExplained.unavailableCookware, ["oven"]);
}

function testNaturalLanguageParsing(): void {
  const ingredients = [
    { slug: "egg", name: "Egg", ta: "mutta", hi: "anda", aliases: ["eggs"] },
    { slug: "rice", name: "Rice", ta: "saadham", hi: "chawal", aliases: ["cooked rice", "leftover rice"] },
    { slug: "onion", name: "Onion", ta: "vengayam", hi: "pyaz", aliases: ["onions", "pyaaz"] },
    { slug: "chicken", name: "Chicken", ta: "kozhi", hi: "murgh", aliases: [] },
    { slug: "coriander-leaves", name: "Coriander leaves", ta: "kothamalli", hi: "hara dhania", aliases: ["coriander"] },
    { slug: "coriander-seeds", name: "Coriander seeds", ta: "dhania", hi: "sabut dhania", aliases: ["coriander"] },
  ];
  const aliasMap = buildAliasMap(ingredients);
  const parsed = parseIngredientInput("2 mutta, leftover rice and one small vengayam", aliasMap);
  assert.deepEqual(parsed.slugs.sort(), ["egg", "onion", "rice"]);
  assert.deepEqual(parsed.unknown, []);

  const typo = parseIngredientInput("chiken", aliasMap);
  assert.deepEqual(typo.suggestions[0].slugs, ["chicken"]);
  assert.equal(typo.unknown.length, 0);

  const ambiguous = parseIngredientInput("coriander", aliasMap);
  assert.equal(ambiguous.ambiguous.length, 1);
  assert.deepEqual(new Set(ambiguous.ambiguous[0].slugs), new Set(["coriander-leaves", "coriander-seeds"]));
}

function testUnlockSuggestions(): void {
  const suggestions = suggestUnlockIngredients([chickenCurry, eggBhurji, lemonRice], {
    have: ["onion", "tomato", "garam-masala"],
    pantrySlugs: new Set(["salt"]),
  });
  assert.ok(suggestions.some((suggestion) => suggestion.ingredient === "egg" || suggestion.ingredient === "chicken"));
  assert.ok(suggestions.every((suggestion) => suggestion.recipesUnlocked > 0));
}

function recipeFixture(): Recipe {
  return {
    id: "ca-test-dish",
    slug: "test-dish",
    title: "Test Dish",
    nativeTitle: null,
    description: "A sufficiently descriptive test dish for deterministic session tests.",
    cuisine: "tamil",
    country: "india",
    region: null,
    language: "en",
    mealType: ["dinner"],
    dietType: ["vegetarian"],
    difficulty: "easy",
    spiceLevel: "mild",
    budgetLevel: "budget",
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    totalTimeMinutes: 15,
    servings: 2,
    ingredients: [
      { name: "Salt", normalizedName: "salt", quantity: 1, unit: "tsp", optional: false },
      { name: "Potato", normalizedName: "potato", quantity: 1, unit: "whole", optional: false },
      { name: "Oil for deep frying", normalizedName: "oil", quantity: 2, unit: "cup", optional: false },
    ],
    steps: [
      { order: 1, text: "Prepare all ingredients carefully." },
      { order: 2, text: "Cook until safely and visibly done.", timerMinutes: 5 },
      { order: 3, text: "Finish and serve immediately." },
    ],
    cookware: ["kadai"],
    methods: ["deep-frying"],
    tags: [],
    allergens: [],
    nutrition: null,
    substitutions: [],
    culturalNote: null,
    regionalVariation: null,
    indianKitchenAdaptation: null,
    source: "Original test fixture",
    sourceUrl: null,
    license: "original",
    author: "Test",
    verificationStatus: "ai_drafted",
    image: null,
    imageLicense: null,
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
  };
}

function testCookSessionAndScaling(): void {
  const recipe = recipeFixture();
  const timer = createCookTimer(1, "Cook", 5, 1_000_000);
  assert.equal(remainingTimerSeconds(timer, 1_000_000), 300);
  assert.equal(remainingTimerSeconds(timer, 1_120_500), 180, "timer must derive from endsAt, not interval ticks");
  assert.equal(remainingTimerSeconds(timer, 1_400_000), 0);

  const session = {
    schemaVersion: COOK_SESSION_SCHEMA_VERSION,
    recipeId: recipe.slug,
    recipeVersion: recipeCookVersion(recipe),
    servings: 4,
    stepIndex: 1,
    completedSteps: [0],
    timer,
    updatedAt: 1_000_000,
  };
  assert.deepEqual(validateCookSession(session, recipe), session);
  assert.equal(validateCookSession({ ...session, recipeVersion: "stale" }, recipe), null, "stale recipe sessions must not silently resume");

  const salt = scaleIngredientForServings(recipe.ingredients[0], 2, 4, recipe.methods);
  assert.equal(salt.quantity, 1.75, "seasoning must scale conservatively rather than double");
  assert.ok(salt.scalingNote?.includes("taste"));
  const fryingOil = scaleIngredientForServings(recipe.ingredients[2], 2, 6, recipe.methods);
  assert.equal(fryingOil.quantity, 2, "deep-frying oil must be vessel-dependent, not tripled");
  assert.ok(fryingOil.scalingNote?.includes("frying depth"));
}

function main(): void {
  testWeightedRanking();
  testSubstitutionFeasibility();
  testHardConstraints();
  testNaturalLanguageParsing();
  testUnlockSuggestions();
  testCookSessionAndScaling();
  console.log("Phase 3 product-loop tests passed.");
}

main();

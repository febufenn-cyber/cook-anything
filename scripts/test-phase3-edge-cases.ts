import assert from "node:assert/strict";
import { matchRecipes } from "../src/lib/match";
import type { RecipeIndexEntry } from "../src/lib/types";

function recipe(overrides: Partial<RecipeIndexEntry> & Pick<RecipeIndexEntry, "slug" | "title" | "req">): RecipeIndexEntry {
  return {
    id: `ca-${overrides.slug}`,
    nativeTitle: null,
    cuisine: "test",
    country: "india",
    region: null,
    mealType: ["dinner"],
    dietType: ["vegetarian"],
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

const saltedPotato = recipe({
  slug: "salted-potato",
  title: "Salted Potato",
  req: ["potato", "salt"],
  ingredientMeta: {
    potato: { importance: "identity", weight: 8 },
    salt: { importance: "pantry", weight: 0 },
  },
});

const ovenPotato = recipe({
  slug: "oven-potato",
  title: "Oven Potato",
  req: ["potato"],
  cookware: ["oven"],
  methods: ["baking"],
  ingredientMeta: { potato: { importance: "identity", weight: 8 } },
});

const limeRice = recipe({
  slug: "lime-rice",
  title: "Lime Rice",
  req: ["rice", "lime"],
  ingredientMeta: {
    rice: { importance: "identity", weight: 8 },
    lime: { importance: "important", weight: 3 },
  },
  subs: [["lime", "lemon"]],
  subMeta: [{
    ingredient: "lime",
    substitute: "lemon",
    replacementSlugs: ["lemon"],
    quality: "equivalent",
  }],
});

function testAssumeNothing(): void {
  const strict = matchRecipes([saltedPotato], {
    have: ["potato"],
    pantrySlugs: new Set(),
  })[0];
  assert.ok(strict.missing.includes("salt"), "assume-nothing profile must not silently grant pantry staples");
  assert.equal(strict.assumedPantry.length, 0);

  const minimal = matchRecipes([saltedPotato], {
    have: ["potato"],
    pantrySlugs: new Set(["salt"]),
  })[0];
  assert.deepEqual(minimal.assumedPantry, ["salt"]);
  assert.equal(minimal.missing.length, 0);
}

function testEmptyEquipmentInventory(): void {
  const hidden = matchRecipes([ovenPotato], {
    have: ["potato"],
    pantrySlugs: new Set(),
    availableCookware: [],
    strictCookware: true,
  });
  assert.equal(hidden.length, 0, "an explicit empty equipment set means no special equipment is available");

  const undeclared = matchRecipes([ovenPotato], {
    have: ["potato"],
    pantrySlugs: new Set(),
  });
  assert.equal(undeclared.length, 1, "omitted equipment should preserve backwards-compatible unknown availability");
}

function testSubstitutionOnlyCoverage(): void {
  const result = matchRecipes([limeRice], {
    have: ["rice", "lemon"],
    pantrySlugs: new Set(),
  })[0];
  assert.ok(result, "a recipe covered by one exact identity plus one feasible replacement must not disappear");
  assert.equal(result.bucket, "substitutable");
  assert.equal(result.substitutable[0].available, true);
  assert.equal(result.missing.length, 0);
}

function main(): void {
  testAssumeNothing();
  testEmptyEquipmentInventory();
  testSubstitutionOnlyCoverage();
  console.log("Phase 3 edge-case tests passed.");
}

main();

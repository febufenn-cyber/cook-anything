# Cook Anything — Recipe Authoring Spec (v1)

This is the binding contract for every recipe in `data/recipes/*.json`.
The TypeScript source of truth is `src/lib/types.ts` (`Recipe` interface).
Validate any batch with:

```
npx tsx scripts/validate-recipes.ts --file data/recipes/<batch>.json
```

## Legal-safety rules (non-negotiable)

- Recipes must be ORIGINAL structured drafts. Never copy text from cookbooks,
  blogs, or websites. Ingredient lists and generic method knowledge are not
  copyrightable, but written expression is — write every description, step,
  and note in fresh words.
- AI-drafted recipes MUST use `"verificationStatus": "ai_drafted"`,
  `"source": "Cook Anything editorial — AI-drafted original"`,
  `"sourceUrl": null`, `"license": "original"`, `"author": "Cook Anything Kitchen"`.
- Never claim testing/verification. Never invent nutrition beyond rough
  estimates with `"isEstimate": true`.

## File format

Each batch file is a JSON array of `Recipe` objects. 15–25 recipes per file.

## Field rules

- `id`: `"ca-" + slug`.
- `slug`: kebab-case, globally unique, descriptive: `tamil-pepper-chicken-fry`
  (prefix with cuisine where it disambiguates).
- `title`: Plain English display name, e.g. "Tamil Pepper Chicken Fry".
- `nativeTitle`: dish name in native script when it exists
  (e.g. "மிளகு கோழி வறுவல்", "김치볶음밥", "Pollo con mole"), else null.
- `description`: 1–3 sentences, appetizing but factual, ORIGINAL wording.
- `cuisine` / `country` / `region`: MUST be slugs from the canonical lists below.
- `language`: `"en"`.
- `mealType`: 1+ of breakfast|lunch|dinner|snack|dessert|side|drink|tiffin.
- `dietType`: MUST include exactly one of vegetarian|vegan|eggetarian|non_vegetarian|pescatarian,
  plus optional extras (high_protein, low_carb, gluten_free_placeholder,
  dairy_free_placeholder, diabetic_friendly_placeholder).
  Note: vegan implies no dairy/egg/honey. Eggetarian = vegetarian + egg.
- `difficulty`: easy|medium|hard. `spiceLevel`: none|mild|medium|hot|very_hot.
- `budgetLevel`: budget|moderate|premium.
- Times: positive integers, `totalTimeMinutes === prepTimeMinutes + cookTimeMinutes`.
- `servings`: 1–12.
- `ingredients`: 4–20 items. `normalizedName` MUST be a slug from
  `data/taxonomy/ingredients.json`. Quantity in Indian-friendly units
  (g, ml, tsp, tbsp, cup, piece, etc. — see Unit enum). Water/salt/oil are
  pantry staples — include them but they won't count against match scores.
  If an ingredient truly has no canonical slug, use the closest slug and put
  the exact name in `name` — do NOT invent slugs.
- `steps`: 4–15 steps, numbered `order` starting at 1. Each step text is
  2–4 sentences of clear instruction. Add `timerMinutes` on steps with
  timed cooking/resting. Add `method` (method slug) on the defining steps.
  Include cooker whistle counts for pressure cooking.
- `cookware`/`methods`/`tags`: slugs from canonical lists below (1+ each).
- `allergens`: from dairy|gluten|nuts|peanuts|soy|egg|fish|shellfish|sesame|mustard —
  must be consistent with ingredients.
- `nutrition`: rough per-serving estimate, `isEstimate: true`. Round numbers.
- `substitutions`: 2–5 practical entries (ingredient = normalized slug).
- `culturalNote`: 1–2 sentences on origin/occasion. ORIGINAL wording.
- `regionalVariation`: 1–2 sentences, or null.
- `indianKitchenAdaptation`: REQUIRED for non-Indian cuisines — how to cook it
  with kadai/tawa/pressure cooker, Indian grocery names, budget swaps.
  For Indian recipes: null or a practical shortcut note.
- `image`: null. `imageLicense`: null. (No images in seed data.)
- `createdAt`/`updatedAt`: `"2026-07-10T00:00:00.000Z"`.

## Canonical cuisine slugs

tamil, chettinad, kerala, andhra, telangana, hyderabadi, karnataka,
north-indian, punjabi, mughlai, gujarati, rajasthani, maharashtrian, goan,
bengali, kashmiri, pakistani, sri-lankan, bangladeshi, nepali, afghan,
chinese, indo-chinese, korean, japanese, thai, vietnamese, indonesian,
malaysian, filipino, italian, french, spanish, greek, british, turkish,
lebanese, persian, middle-eastern, moroccan, ethiopian, west-african,
egyptian, mexican, american, brazilian, peruvian, caribbean, mediterranean

## Canonical country slugs

india, pakistan, sri-lanka, bangladesh, nepal, afghanistan, china,
south-korea, japan, thailand, vietnam, indonesia, malaysia, philippines,
italy, france, spain, greece, united-kingdom, turkey, lebanon, iran,
morocco, ethiopia, nigeria, senegal, egypt, mexico, united-states, brazil,
peru, jamaica

## Canonical region slugs (use null if none fits)

tamil-nadu, chettinad-region, kongunadu, malabar, travancore, coastal-andhra,
rayalaseema, telangana-region, old-mysuru, udupi-mangalore, punjab, gujarat,
rajasthan, maharashtra, goa, bengal, kashmir, awadh, delhi, sichuan,
guangdong, tuscany, sicily, naples, provence, oaxaca, yucatan,
punjab-pakistan, sindh, jaffna, anatolia, kansai

## Canonical method slugs

tempering, pressure-cooking, kadai-cooking, tawa-cooking, deep-frying,
shallow-frying, pan-frying, stir-frying, steaming, boiling, simmering,
braising, dum, roasting, grilling, baking, air-frying, sauteing, fermenting,
no-cook, one-pot, slow-cooking, marinating

## Canonical cookware slugs

kadai, tawa, pressure-cooker, heavy-bottomed-pot, saucepan, frying-pan, wok,
oven, air-fryer, grill, idli-steamer, steamer, mixie, blender, rice-cooker,
clay-pot, baking-tray, skillet, tandoor

## Canonical tag slugs

street-food, festival, diwali, pongal, onam, eid, christmas, navratri,
bachelor-friendly, quick, under-30-minutes, budget, gym, comfort-food, party,
kids-friendly, one-pot-meal, leftover-friendly, lunchbox, tiffin,
no-onion-no-garlic, summer, monsoon, winter, healthy, low-oil, gravy,
dry-curry, salad, soup, bowl, wrap, grill-bbq, sweet, fried-snack

## Quality bar

Every recipe must be cookable as written by a home cook: realistic
quantities, correct order of operations, sensible times, flame levels,
doneness cues ("until oil separates", "until the raw smell goes").
Prefer Indian-available ingredients; when a recipe needs something exotic,
provide a substitution. An exemplar batch lives at `data/recipes/tamil-core.json`.

# Phase 3 — matching truth and interruption-safe cooking

> Phase 3 improves the anonymous local-first product loop. It does not enable the
> hosted companion, deploy the Worker/VPS, create accounts, upload local drafts or
> weaken any Phase 1/2 security and trust boundary.

## Winning loop

```text
Describe the kitchen
  → understand ingredients without silent guessing
  → enforce hard safety and feasibility constraints
  → rank recognisable dishes
  → explain every recommendation
  → preserve context into cooking
  → finish despite interruptions
```

## Matching invariants

1. Identity ingredients carry more weight than flavour ingredients.
2. Missing an identity ingredient cannot be hidden by matching salt or spices.
3. Optional ingredients have negligible ranking influence.
4. Pantry ingredients are assumed only through an explicit user profile.
5. Every pantry assumption is shown on the result.
6. A substitution contributes only when a canonical replacement is in the user's `have` set.
7. Dish-changing substitutions receive little score credit.
8. Allergen, excluded-ingredient and diet constraints are hard filters.
9. Unavailable special equipment is either a hard filter or an explicit result warning.
10. The same input and corpus version produce the same ordered results.
11. Diversity reranking cannot change feasibility buckets; it only prevents repetitive first screens.
12. No fuzzy ingredient correction is silently accepted.

## Build-generated ingredient importance

Canonical recipe JSON remains unchanged during Phase 3. `scripts/build-search-index.ts`
derives compact matching metadata:

- `identity` — title-defining ingredient, weight 8
- `structural` — recipe base such as meat, seafood, egg, grain or pulse, weight 5
- `important` — major supporting ingredient, weight 3
- `flavour` — seasoning/aromatic contribution, weight 1.5
- `optional` — optional ingredient, weight 0.25
- `pantry` — explicit pantry staple, weight 0

The derivation is deterministic and testable, but it is still heuristic. Editorially
reviewed importance can replace generated metadata later without changing the matcher API.

## Substitution feasibility

The search index extracts canonical replacement slugs from substitution text and assigns:

- `equivalent` — 90% credit
- `good` — 70% credit
- `workable` — 45% credit
- `identity_change` — 10% credit

Text saying “use yoghurt” does not improve a match unless yoghurt is actually in the
user's kitchen. An unrecognised free-text replacement remains visible as advice but does
not erase the missing ingredient.

## Result buckets

- **Ready to cook** — every essential ingredient is exact or explicitly assumed pantry.
- **Very close** — no identity ingredient is missing and only a low-weight item remains.
- **Possible with swaps** — a canonical replacement is present in the kitchen.
- **Needs shopping** — an identity/structural item or unavailable special equipment remains.

The percentage shown is weighted coverage, not a scientific probability of success.

## Ingredient understanding

`parseIngredientInput` performs:

1. Unicode and punctuation normalisation.
2. Quantity, unit and conversational filler removal.
3. Longest-first matching across English, Tamil/Tanglish, Hindi/Hinglish and aliases.
4. Explicit ambiguity when one phrase maps to multiple ingredients.
5. Controlled edit-distance suggestions for likely typos.
6. An unrecognised list for everything not safely understood.

The parser never silently converts a typo or ambiguous term into a pantry ingredient.

## Pantry profiles

- **Assume nothing** — every ingredient must be supplied.
- **Minimal** — only recognised salt, water and cooking-oil staples.
- **Indian basics** — all taxonomy entries explicitly marked `pantryStaple`.

The user can change this per search. Profiles are search assumptions, not claims about
what every household owns.

## Cook Mode persistence

Cook Mode stores one local session per recipe:

- recipe id and version
- serving count
- current and completed steps
- one active timestamp timer
- update time

A session resumes only when its recipe version still matches. Recipe edits invalidate the
old session rather than silently changing instructions mid-cook.

Timers store `endsAt`; intervals only repaint the display. Background tab throttling or a
locked phone therefore cannot stretch the timer.

## Serving scaling boundary

Phase 3 provides practical heuristic scaling:

- normal ingredients scale linearly
- salt, chilli and seasoning scale conservatively, then instruct the cook to taste
- whole units round to practical kitchen fractions
- deep-frying oil remains vessel-dependent rather than multiplying with servings

This does not claim that every recipe scales perfectly. Cook-test evidence is still the
Phase 2 authority.

## Versioned search index

`public/search-index.json` now includes:

```json
{
  "schemaVersion": 3,
  "corpusVersion": "content hash",
  "generatedAt": "ISO timestamp"
}
```

The client rejects an unexpected schema instead of interpreting stale data with new code.

## Regression suite

`npm run test:product` locks down:

- identity-weighted ranking
- feasible versus merely textual substitutions
- pantry disclosure
- allergen and equipment hard filters
- Tanglish/natural-language parsing
- typo suggestions and ambiguity
- unlock-ingredient ranking
- timestamp timer behaviour
- stale recipe-session rejection
- conservative seasoning and frying-oil scaling

## Intentional exclusions

Phase 3 does not add:

- accounts or Supabase
- cloud cookbook sync
- social ratings/comments
- public community publishing
- personalised behavioural recommendations
- invasive analytics
- hosted companion deployment
- bulk recipe expansion

## Release checklist

- [ ] Phase 1 companion tests pass.
- [ ] Phase 2 trust tests and full publication gate pass.
- [ ] Phase 3 golden product tests pass.
- [ ] Search index schema and corpus version are generated.
- [ ] Production static build succeeds.
- [ ] Wrangler dry-run succeeds.
- [ ] Representative mobile checks cover typing, filters, cards and Cook Mode.
- [ ] Keyboard focus and Escape behaviour are verified.
- [ ] Hosted companion remains disabled.
- [ ] No Worker/VPS deployment is performed as part of this phase.

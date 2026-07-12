# Cook-test protocol

Purpose: convert `ai_drafted` structural validity into evidenced cooking
truth. Only recipes with recorded evidence may carry a stronger status — the
corpus is NEVER relabeled in bulk.

## Priority queue (first 50–100 recipes)

Select by: expected traffic (collection membership: quick/bachelor/tamil/
south-indian first) · ingredient popularity (onion-tomato-rice-dal cores) ·
geographic + dietary diversity (≥10 cuisines, veg/non-veg/vegan mix) · safety
complexity (pressure cooker, deep fry, raw meat) · cookware adaptation claims
(every `indianKitchenAdaptation` promise gets tested) · current trust
uncertainty (validator warnings first).

## Per-recipe procedure

Bind the test to the exact recipe version (git blob hash of the recipe JSON).
Cook it as written, recording: ingredient quantities as-experienced (enough?
excessive?) · timings per step vs stated · yield vs servings · step clarity
(where did you hesitate?) · texture checkpoints (photo or one line at each
stage transition) · visual checkpoints · one substitution from the recipe's
own `substitutions` list · one listed cookware adaptation · allergen list
sanity vs what you handled · dietary classification sanity · safety warnings
adequacy · actual problems, honestly.

Two independent testers (different kitchens) per recipe for status upgrades;
one tester marks `cook_tested_once`. Testers must not be the contributor.

## Recording

Evidence lives in the contribution workflow (staging Supabase) or, for corpus
recipes pre-Supabase, as versioned files: `evidence/cook-tests/<slug>/<date>-<tester>.md`
using the template below. Fixes land ONLY as versioned repository changes
(recipe JSON edit + PR) — after a material edit, the recipe returns to the
queue (regression rule).

```md
# Cook test — <slug> @ <recipe-version-hash>
Tester: <pseudonym>  Date: <ISO>  Kitchen: <gas/induction, cookware>
Servings attempted: N  Yield observed: ...
Timings: step 3 said 10m, took 16m on medium flame ...
Texture/visual checkpoints: ...
Substitution tested: X → Y — result ...
Adaptation tested: <indianKitchenAdaptation claim> — result ...
Problems: ...
Verdict: pass / pass-with-edits (list) / fail (reasons)
```

Disputes between testers: third tester decides; all three records retained.

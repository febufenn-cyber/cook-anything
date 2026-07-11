# Phase 4 — Local Kitchen Memory and Offline Reliability

Phase 4 turns the anonymous one-session product into a return loop without introducing accounts or cloud sync.

## Scope

Implemented:

- versioned native IndexedDB repository
- local kitchen profile and pantry
- explicit pantry status and optional expiry dates
- matcher hydration from saved pantry
- version-aware saved recipes
- explicit Cook Mode completion history
- source-aware shopping list
- lightweight local meal plan
- export, validated import and complete deletion
- same-browser multi-tab change notifications
- installable web app manifest
- privacy-bounded service worker
- user-controlled update activation

Not implemented:

- accounts or Supabase authentication
- multi-device sync
- public profiles, comments or ratings
- automatic inventory deduction
- nutrition optimisation
- hosted companion deployment

## Storage boundary

Structured kitchen data is stored in IndexedDB under `cook-anything-kitchen`.

Object stores:

- `profile`
- `pantry`
- `savedRecipes`
- `history`
- `shoppingList`
- `mealPlan`
- `meta`

Cook Mode continues to use small version-bound localStorage records so an in-progress session can recover immediately. The repository API isolates UI code from the storage backend so a future synced repository can be added without rewriting every screen.

## Privacy boundary

Kitchen exports include only:

- profile and explicit preferences
- pantry records
- saved recipe references and notes
- cooking history
- shopping list
- meal plan

Exports never include:

- Anthropic or OpenAI API keys
- hosted cookies or session identifiers
- companion messages
- photos
- authorization headers
- analytics identifiers

Imports are size-limited, schema-versioned and reject prototype-pollution keys and secret-like fields.

## Offline boundary

The service worker may cache same-origin static pages, static assets, the search index and trust manifest.

It must not cache:

- `/api/*`
- `/companion-recipes/*`
- any request carrying `Authorization` or `x-api-key`
- cross-origin BYOK provider requests
- companion messages or responses

Updates are never forced during cooking. A waiting worker is activated only after the user chooses **Update now**.

## Pantry semantics

Pantry status is explicit:

- `available`
- `running_low`
- `out`
- `unknown`

Finishing Cook Mode records completion history but never automatically subtracts ingredients. The user is directed to review pantry state.

## Shopping aggregation

Only compatible canonical units are automatically aggregated. Volume and weight entries remain separate unless a future ingredient-specific conversion table proves the conversion safe.

## Verification

`npm run test:kitchen` checks:

- schema defaults
- canonical slug normalisation
- future-schema rejection
- secret-field rejection
- prototype-pollution rejection
- safe unit aggregation
- incompatible unit separation
- service-worker companion exclusions
- manifest contract

CI also preserves all Phase 1–3 tests, the full recipe trust gate, production static export and Wrangler dry-run.

## Deployment status

Phase 4 is code-complete only when CI is green. It does not enable hosted companion execution and does not deploy Worker or VPS infrastructure.

## Exit gate

Before merging:

1. Phase 1 companion tests pass.
2. Phase 2 trust tests pass.
3. Phase 3 product-loop tests pass.
4. Phase 4 local-kitchen tests pass.
5. Full corpus trust gate passes.
6. Static export succeeds for every route.
7. Service worker parses successfully.
8. Wrangler dry-run succeeds.
9. Hosted companion remains disabled.
10. PR remains stacked on Phase 3 until earlier phases merge.

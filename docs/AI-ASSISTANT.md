# AI Cooking Assistant — architecture foundation

The assistant is layered so deterministic cooking discovery remains useful with
no model, while optional LLM features sit behind explicit trust boundaries.

## Layer 1 — deterministic engine

Pure functions in `src/lib/match.ts`, running client-side against
`public/search-index.json`:

- `matchRecipes(recipes, opts)` — ingredient matching with pantry-staple
  awareness, missing-ingredient computation, substitutions, allergen exclusion,
  and diet/time/cuisine/cookware filters.
- `parseIngredientInput(text, aliasMap)` — free text to canonical ingredient
  slugs across English, Tamil and Hindi names and aliases.
- `buildAliasMap(ingredients)` — multilingual ingredient understanding.

This layer works independently of the companion and remains available when all
hosted AI execution is disabled.

## Layer 1.5 — recipe Cooking Companion

A hands-on guide for one recipe at a time. Main pieces:

- `src/lib/companion/types.ts` — recipe, state, BYOK chat and narrow hosted API
  contracts.
- `src/lib/companion/adapt.ts` — converts platform recipes into the bounded
  companion recipe shape.
- `src/lib/companion/prompt.ts` — cooking protocol, trust boundary, safety
  guidance and hidden `<state>` output parser.
- `scripts/build-companion-recipes.ts` — creates minimal, versioned trusted
  recipe snapshots during the build.
- `src/components/CookCompanion.tsx` — chat UI, voice input, TTS, stage and
  substitution displays, BYOK setup and hosted text-only behavior.
- `worker/index.ts` — the narrow public hosted API boundary.
- `worker/companion-session.ts` — server-owned sessions, ordering, idempotency,
  retention alarms and global execution limits.
- `worker/security.ts` — strict request, recipe and model-state validation.
- `worker/execution.ts` — bounded Anthropic calls or HMAC-signed private bridge
  calls.

### BYOK mode

When a user connects their own key, turns go directly from the browser to the
selected Anthropic or OpenAI-compatible provider. BYOK can use a vision-capable
model for photo check-ins. The key is currently stored in browser local storage
until disconnected or browser data is cleared.

### Hosted mode

Hosted execution is disabled by default and must remain disabled until the Phase
1 staging and canary exit gate passes.

The browser may send only:

```json
{ "recipe_id": "chicken-chettinad" }
```

when creating a session, then:

```json
{ "message": "The onions are browning too fast.", "client_turn_id": "<uuid>" }
```

for a turn. It cannot submit recipe contents, state, history, system prompts,
model selection, Claude session identifiers, tool permissions, paths, upstream
origins or hosted photos.

Hosted API routes:

- `POST /api/companion/session`
- `POST /api/companion/turn`
- `DELETE /api/companion/session`

The retired broad `POST /api/companion` contract is not a supported execution
path. Quick-tunnel origin publication is also retired.

Hosted sessions use an opaque HttpOnly `__Host-` cookie and a Durable Object that
owns the trusted recipe snapshot, validated cooking state, bounded history,
turn ordering and idempotency records. An alarm removes inactive data after the
configured lifetime. A separate singleton Durable Object enforces strict global
concurrency and a daily execution circuit breaker.

Hosted mode is text-only during Phase 1. The optional Claude Code bridge is
stateless, receives only Worker-generated HMAC-signed envelopes, has every tool
and local session persistence disabled, and is reachable only through a stable
private transport. See:

- `docs/PHASE-1-COMPANION.md`
- `docs/VPS-BRIDGE.md`
- `docs/PHASE-0-CONTAINMENT.md`

## Layer 2 — broader discovery assistant

A later assistant may expose the deterministic engine through narrow tools:

```text
search_recipes(query, filters)          -> RecipeIndexEntry[]
match_by_ingredients(have[], filters)   -> MatchResult[]
get_recipe(slug)                        -> Recipe
get_ingredient(slug)                    -> IngredientDef
get_substitutions(recipeSlug)           -> Substitution[]
```

The model plans; deterministic code retrieves. Answers should reference stored
recipe slugs so the UI renders real recipe cards. Variations must be labelled as
variations and must never silently overwrite canonical recipes.

## Layer 3 — placement and guardrails

A future discovery assistant should have a separate endpoint and separate tools,
sessions, quotas and privacy disclosure from the recipe Cooking Companion. It
must not inherit bridge access merely because both features use an LLM.

Guardrails:

- never invent `verified` status
- never make medical claims from placeholder nutrition or diet metadata
- always link to the recipes used
- validate every model-selected tool argument
- bound retrieval, tokens, session length and cost
- log operational metadata rather than full private conversations
- fail closed when configuration or authorization is missing

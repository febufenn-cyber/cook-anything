# AI Cooking Assistant — architecture foundation

The assistant is deliberately layered so the deterministic core works today
(no API keys, no latency, no hallucination) and an LLM can be attached later
without reworking the product.

## Layer 1 — deterministic engine (SHIPPED)

Pure functions in `src/lib/match.ts`, running client-side against
`public/search-index.json`:

- `matchRecipes(recipes, opts)` — ingredient matching with pantry-staple
  awareness, missing-ingredient computation, substitution lookup, allergen
  exclusion, diet/time/cuisine/cookware filters, scored + explained results.
- `parseIngredientInput(text, aliasMap)` — free-text → canonical slugs across
  English/Tamil/Hindi names and aliases ("thayir, pyaz, chicken" works).
- `buildAliasMap(ingredients)` — the multilingual ingredient understanding.

This already answers: *What can I cook? What's missing? What can I substitute?
Show only vegetarian / under 30 minutes / no dairy.*

## Layer 1.5 — Cooking Companion (SHIPPED)

A live, hands-on cooking agent for one recipe at a time — built from
`cooking-companion-agent-prompt-v1` (Robofox AI). Pieces:

- `src/lib/companion/types.ts` — session state, substitution ledger,
  role-tagged recipe shapes, API contract.
- `src/lib/companion/adapt.ts` — adapts a platform Recipe into the role-tagged
  companion JSON (role/criticality/heat-stability inferred from the taxonomy).
- `src/lib/companion/prompt.ts` — the v1 system prompt (photo protocol,
  cannot-see honesty list, substitution engine, live-cook guardrails, recovery
  mode) plus a `<state>` block protocol so the model maintains session state.
- `worker/index.ts` — Cloudflare Worker: serves the static export AND
  `POST /api/companion`, which fronts the Anthropic API. Vision-capable,
  prompt-cached, key held as a Worker secret.
- `src/lib/companion/client.ts` — bring-your-own-key mode: the user connects
  their own key (Claude, or any OpenAI-compatible endpoint — OpenAI,
  OpenRouter, Groq, local Ollama). Stored in localStorage only; turns go
  directly browser → provider, never through our servers.
- `src/components/CookCompanion.tsx` — full-screen chat on every recipe page:
  photo check-ins (client-side compressed), voice input (Web Speech API), TTS
  replies, stage strip, ledger drawer, ⚙️ key settings, quick actions.

Key resolution order: user's own key (⚙️ panel) wins; otherwise the
site-hosted Worker endpoint. Hosting a site-wide key is optional:
`wrangler secret put ANTHROPIC_API_KEY` (prod) or `ANTHROPIC_API_KEY=sk-...`
in `.dev.vars` (local `npm run preview`); without it the endpoint returns
`not_configured` and the UI opens the connect-your-key panel. BYOK works even
on plain `next dev` since it never touches the Worker.
Optional: set `COMPANION_MODEL` var to override the hosted default model.

## Layer 2 — LLM function boundary (NEXT)

Attach an LLM (Claude via the Anthropic API) with the engine exposed as tools:

```
tools:
  search_recipes(query, filters)          -> RecipeIndexEntry[]
  match_by_ingredients(have[], filters)   -> MatchResult[]
  get_recipe(slug)                        -> Recipe (full)
  get_ingredient(slug)                    -> IngredientDef (ta/hi names, aliases, allergens)
  get_substitutions(recipeSlug)           -> Substitution[]
```

The LLM plans; the engine retrieves. Answers cite recipe slugs so the UI can
render real recipe cards. This cleanly supports:

- "Make this vegetarian / cheaper / high-protein" → LLM rewrites using the
  recipe's own substitutions + ingredient taxonomy, marked as a *variation*,
  never silently overwriting the stored recipe.
- "Convert to Indian kitchen style" → recipe's indianKitchenAdaptation field +
  method taxonomy's indianEquivalent notes give grounded material.
- "Cups to grams" → deterministic conversion table (add to format.ts), LLM
  only phrases it.
- "Compare Tamil vs Kerala sambar" → retrieve both recipes, LLM contrasts.
- Weekly meal plans / grocery lists → matchRecipes over pantry + LLM
  composition; grocery list = union of missing ingredients (already computed).

## Layer 3 — placement

A Cloudflare Worker endpoint (`/api/assistant`) holds the API key and the tool
loop; the UI adds a chat panel on /what-can-i-cook. No key is shipped to the
client. Rate-limit per IP. Log only anonymous tool-call shapes.

Guardrails: assistant never invents recipes with `verified` status, never
makes medical claims (diet placeholders stay estimates), and always links to
the underlying recipe pages it drew from.

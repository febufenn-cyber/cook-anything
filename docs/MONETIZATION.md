# Monetization foundation (docs only — nothing implemented)

Ordered by fit with the product's trust-first positioning. None of these
require reworking the data model; most are additive Workers/DB features.

1. **Premium subscription** — meal planning, grocery lists, unlimited family
   cookbook sync across devices, offline cook mode, assistant quota. The
   free/paid seam maps to features that need accounts (schema ready in
   db/schema.sql).
2. **Recipe / ingredient-intelligence API** — the structured database
   (normalized multilingual ingredients, substitutions, allergens, Indian
   kitchen adaptations) is licensable to grocery apps, meal-kit companies and
   appliance makers. `export-recipes` output is the contract.
3. **Grocery affiliate links** — the "missing ingredients" list on every match
   is a natural buy-list (Blinkit/Zepto/BigBasket/Amazon Fresh deep links).
   High intent, zero UX damage. Add per-ingredient affiliate URLs to
   IngredientDef.
4. **Creator cookbook marketplace** — community contributors sell curated
   collections; platform takes a cut. Builds on recipe_collections +
   licensed_partner status.
5. **Brand partnerships** — sponsored collections clearly labelled (e.g. a
   spice brand sponsors a Chettinad collection). Uses the existing collections
   system; must stay visually distinct from editorial.
6. **Ads** — last resort; if ever, only non-interstitial slots on listing
   pages, never inside cook mode.

Sequencing: traffic first (SEO collections are built for this), then affiliate
(no accounts needed), then premium once accounts/sync exist, then API/marketplace.

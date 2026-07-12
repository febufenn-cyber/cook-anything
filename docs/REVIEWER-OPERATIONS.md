# Reviewer operations

Roles (provisioned ONLY by the administrator through service-role SQL — never
self-service; every grant/revoke recorded in `evidence/` with date + reason):
editorial reviewer · safety reviewer · cook tester · publisher · administrator.

Hard rules enforced by schema AND policy (do not rely on goodwill):
contributors cannot review, cook-test, or publish their own recipe; one tester
cannot satisfy the two-tester requirement twice; publisher must differ from
contributor; household membership grants NO reviewer rights.

Provisioning: administrator inserts the role row via service-role; revocation
is the same in reverse plus session invalidation. Access review: monthly list
of role holders against activity; idle 90 days → revoke. Turnaround targets:
editorial 7 days, safety 72h, publication 7 days after second cook-test.
Escalation: safety reviewer → administrator → emergency takedown
(`docs/TAKEDOWN-POLICY.md`). Appeals: contributor may request one re-review by
a different reviewer; administrator arbitrates; outcomes recorded.

## Review guides

- **Clarity**: steps executable by a novice; quantities+units present; no
  ambiguous "cook until done" without a sensory cue.
- **Provenance/rights**: contributor affirms original wording; reject copied
  text (verbatim search on distinctive sentences); family recipes need the
  family-consent affirmation.
- **Cultural attribution**: name the tradition specifically; flag
  misattributed dish names; prefer native names with romanization.
- **Allergens**: recipe allergen list must be a superset of taxonomy-derived
  allergens (the trust gate computes the union — reviewer verifies the union
  makes sense, adds missing cross-contamination notes).
- **Dietary claims**: verify against ingredients; placeholder diets
  (`*_placeholder`) must never be presented as verified suitability.
- **Safety hazards**: raw meat/egg handling steps, pressure-cooker cautions,
  deep-fry warnings present where methods require them.
- **Duplicates**: run `npm run dupes` context; near-duplicates need a
  distinguishing regional/technique note or rejection.
- **AI assistance**: disclosure field complete; undisclosed AI style
  (hallmark phrasings, impossible timings) → request correction.
- **Cook-test evidence**: two INDEPENDENT testers, each bound to the exact
  submission hash, with texture/visual checkpoints and real problems recorded.
- **Publication readiness**: all above green + license valid + hash matches.

Popularity, likes, or contributor status are never evidence of safety or
correctness.

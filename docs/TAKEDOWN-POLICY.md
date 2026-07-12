# Takedown and abuse policy

Applies to published recipes and staged contributions. Owner of takedown
decisions: the administrator (currently the site operator). Urgent authority:
any safety reviewer may execute an emergency unpublish; administrator reviews
within 24h.

## Emergency publication-disable switch

Unpublish = revert the publishing commit in git + redeploy (recipes are
static). `git revert <merge-sha> && npm run deploy:staging` → verify → the
production redeploy requires the standard authorization. For pre-publication
candidates: close the draft PR; nothing is live before merge, so closure is
complete containment.

## Cases and handling

- **Copied recipe / copyrighted wording**: takedown on credible claim;
  contributor may resubmit in original words; repeat offense → contributor ban.
- **Family ownership dispute**: freeze the recipe (unpublish), require
  documented family consent to restore.
- **Cultural attribution dispute**: correction preferred over takedown;
  publish a visible correction note; escalate to takedown if misattribution is
  harmful.
- **Contributor withdrawal**: honored for unpublished content always; for
  published content the granted license survives, but we remove attribution on
  request and consider goodwill takedown.
- **License misunderstanding**: if the contributor did not understand the
  grant, treat as withdrawal (goodwill takedown) — trust > corpus size.
- **Malicious/unsafe submission** (dangerous instructions, allergen
  misinformation): immediate unpublish + safety-reviewer postmortem on how it
  passed; correction notice published if it was live.
- **Repeated abusive contributors**: role/product bans via service-role;
  document pattern in `evidence/`.
- **Public correction**: factual errors found post-publication get a dated
  correction block in the recipe record (versioned repository change).
- **Appeals**: one appeal per decision, decided by the administrator with a
  reviewer who was not involved.

Evidence preservation: before takedown, snapshot the recipe record + review
trail into `evidence/takedowns/<date>-<slug>/` (private repo path; no user
private data beyond what was submitted for publication).

## Rate limits (required before public submissions)

Cloud draft creation, submissions, reviewer actions, household invitations,
publication-candidate requests — enforce per-user daily caps in the Supabase
RPCs (values in the Living Cookbook migration or a follow-up hardening
migration). Public submissions stay DISABLED until moderation staffing and
this policy have a named owner with real availability, not just this document.

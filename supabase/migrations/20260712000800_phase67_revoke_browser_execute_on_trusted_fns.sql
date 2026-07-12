-- Phase 6.7: grant-level hardening for trusted-operator functions.
--
-- Hosted Supabase sets ALTER DEFAULT PRIVILEGES so functions created by the
-- postgres role receive EXECUTE for anon/authenticated/service_role at
-- creation time. Our earlier "revoke ... from public" therefore left explicit
-- anon/authenticated grants in place on the hosted project (found by the
-- Phase 6.7 hosted grant audit; the in-function is_service_role() guard was
-- still enforcing security, so this is defense-in-depth, not a live hole).
begin;

revoke execute on function public.claim_publication_candidate(uuid) from anon, authenticated;
revoke execute on function public.mark_publication_candidate_pr(uuid, text, text) from anon, authenticated;
revoke execute on function public.prepare_contribution_account_deletion(uuid) from anon, authenticated;
revoke execute on function public.recover_expired_publication_claims() from anon, authenticated;
revoke execute on function public.is_service_role() from anon, authenticated;

commit;

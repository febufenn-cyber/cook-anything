-- Phase 6.7: fix pgcrypto resolution for functions with pinned search_path.
--
-- Five SECURITY DEFINER functions call unqualified digest()/gen_random_bytes()
-- while pinning `search_path = public, pg_temp`. On hosted Supabase (and the
-- local CLI stack) pgcrypto lives in the `extensions` schema, so every such
-- call fails with 42883 "function digest(text, unknown) does not exist" —
-- sync_push, personal-scope reset, household invites and cloud draft saves
-- were all inoperable over the API. Found by the Phase 6.7 hosted battery
-- (never exercised via RPC before: local suites test the engine layer, and
-- earlier drills used direct-SQL fixtures). Same defect class as 000700's
-- claim functions, fixed here by extending each function's pinned search_path
-- rather than editing bodies.
begin;

alter function public.sync_push(text, jsonb) set search_path = public, extensions, pg_temp;
alter function public.sync_reset_personal_scope(text) set search_path = public, extensions, pg_temp;
alter function public.create_household_invite(uuid, text) set search_path = public, extensions, pg_temp;
alter function public.accept_household_invite(text) set search_path = public, extensions, pg_temp;
alter function public.save_recipe_draft_version(uuid, text, uuid, jsonb, jsonb, uuid) set search_path = public, extensions, pg_temp;

commit;

-- Phase 6.5: fix the trusted-operator service-role guard.
--
-- The Phase 6 functions checked current_setting('request.jwt.claim.role'),
-- the LEGACY per-claim GUC that modern PostgREST no longer sets. Result: the
-- service role could never call prepare_contribution_account_deletion,
-- claim_publication_candidate or mark_publication_candidate_pr over the API —
-- account deletion and the publication operator were inoperable. Found by the
-- Phase 6.5 deletion drill against a real local stack (see
-- evidence/phase-6-5/artifacts/deletion-drill.log).
--
-- is_service_role() reads the modern request.jwt.claims JSON first and falls
-- back to the legacy GUC so the guard works on both PostgREST generations.
begin;

create or replace function public.is_service_role()
returns boolean
language sql
stable
as $fn$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
    nullif(current_setting('request.jwt.claim.role', true), ''),
    ''
  ) = 'service_role';
$fn$;

revoke all on function public.is_service_role() from public;

create or replace function public.claim_publication_candidate(p_candidate_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare candidate public.publication_candidates;
begin
  if not public.is_service_role() then raise exception 'service_role_required'; end if;
  select * into candidate from public.publication_candidates where id = p_candidate_id and status = 'ready' for update;
  if candidate.id is null then raise exception 'publication_candidate_not_ready'; end if;
  return jsonb_build_object(
    'id', candidate.id::text,
    'submissionId', candidate.submission_id::text,
    'versionId', candidate.version_id::text,
    'contentHash', candidate.content_hash,
    'canonicalSlug', candidate.canonical_slug,
    'candidateJson', candidate.candidate_json,
    'status', candidate.status,
    'createdAt', candidate.created_at
  );
end;
$$;

create or replace function public.mark_publication_candidate_pr(p_candidate_id uuid, p_github_pr_url text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare candidate public.publication_candidates; submission public.recipe_submissions;
begin
  if not public.is_service_role() then raise exception 'service_role_required'; end if;
  if p_github_pr_url !~ '^https://github.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+$' then raise exception 'invalid_github_pr_url'; end if;
  update public.publication_candidates set status = 'pr_open', github_pr_url = p_github_pr_url, updated_at = now()
    where id = p_candidate_id and status = 'ready' returning * into candidate;
  if candidate.id is null then raise exception 'publication_candidate_not_ready'; end if;
  update public.recipe_submissions set status = 'publication_pr_open', updated_at = now()
    where id = candidate.submission_id returning * into submission;
  insert into public.contribution_status_events(submission_id, from_status, to_status, actor_id, actor_role, reason)
  values (submission.id, 'publication_candidate', 'publication_pr_open', null, 'system', left(p_github_pr_url, 1000));
  return jsonb_build_object('ok', true, 'prUrl', p_github_pr_url);
end;
$$;

create or replace function public.prepare_contribution_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  deleted_drafts integer := 0;
  retained_drafts integer := 0;
begin
  if not public.is_service_role() then raise exception 'service_role_required'; end if;
  if p_user_id is null then raise exception 'invalid_user_id'; end if;

  create temporary table contribution_delete_drafts on commit drop as
  select d.id from public.recipe_drafts d
  where d.owner_id = p_user_id
    and not exists (
      select 1 from public.recipe_submissions s
      where s.draft_id = d.id and s.status in ('publication_pr_open', 'published', 'takedown_pending', 'takedown_completed')
    );

  delete from public.publication_candidates pc using public.recipe_submissions s, contribution_delete_drafts dd
    where pc.submission_id = s.id and s.draft_id = dd.id;
  delete from public.recipe_submissions s using contribution_delete_drafts dd where s.draft_id = dd.id;
  delete from public.recipe_drafts d using contribution_delete_drafts dd where d.id = dd.id;
  get diagnostics deleted_drafts = row_count;

  update public.recipe_drafts set
    owner_id = null,
    scope_type = 'personal',
    scope_id = '00000000-0000-0000-0000-000000000000'::uuid,
    status = 'superseded',
    updated_at = now()
  where owner_id = p_user_id;
  get diagnostics retained_drafts = row_count;

  update public.recipe_draft_versions set created_by = null where created_by = p_user_id;
  update public.recipe_submissions set contributor_id = null where contributor_id = p_user_id;
  update public.editorial_reviews set reviewer_id = null where reviewer_id = p_user_id;
  update public.cook_test_runs set tester_id = null where tester_id = p_user_id;
  update public.publication_candidates set created_by = null where created_by = p_user_id;
  update public.contribution_status_events set actor_id = null where actor_id = p_user_id;
  delete from public.recipe_draft_collaborators where user_id = p_user_id;
  delete from public.contribution_roles where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'deletedPrivateDrafts', deleted_drafts, 'retainedPublishedDrafts', retained_drafts);
end;
$$;

-- create or replace preserves existing grants; re-assert the intended surface.
revoke all on function public.claim_publication_candidate(uuid) from public;
grant execute on function public.claim_publication_candidate(uuid) to service_role;
revoke all on function public.mark_publication_candidate_pr(uuid, text) from public;
grant execute on function public.mark_publication_candidate_pr(uuid, text) to service_role;
revoke all on function public.prepare_contribution_account_deletion(uuid) from public;
grant execute on function public.prepare_contribution_account_deletion(uuid) to service_role;

commit;

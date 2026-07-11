-- Phase 6 account-deletion hardening.
-- Apply after 20260712_phase6_living_cookbook.sql.

begin;

alter table public.recipe_drafts drop constraint if exists recipe_drafts_owner_id_fkey;
alter table public.recipe_drafts alter column owner_id drop not null;
alter table public.recipe_drafts add constraint recipe_drafts_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete set null;

alter table public.recipe_draft_versions drop constraint if exists recipe_draft_versions_created_by_fkey;
alter table public.recipe_draft_versions alter column created_by drop not null;
alter table public.recipe_draft_versions add constraint recipe_draft_versions_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.recipe_submissions drop constraint if exists recipe_submissions_contributor_id_fkey;
alter table public.recipe_submissions alter column contributor_id drop not null;
alter table public.recipe_submissions add constraint recipe_submissions_contributor_id_fkey
  foreign key (contributor_id) references auth.users(id) on delete set null;

alter table public.editorial_reviews drop constraint if exists editorial_reviews_reviewer_id_fkey;
alter table public.editorial_reviews alter column reviewer_id drop not null;
alter table public.editorial_reviews add constraint editorial_reviews_reviewer_id_fkey
  foreign key (reviewer_id) references auth.users(id) on delete set null;

alter table public.cook_test_runs drop constraint if exists cook_test_runs_tester_id_fkey;
alter table public.cook_test_runs alter column tester_id drop not null;
alter table public.cook_test_runs add constraint cook_test_runs_tester_id_fkey
  foreign key (tester_id) references auth.users(id) on delete set null;

alter table public.publication_candidates drop constraint if exists publication_candidates_created_by_fkey;
alter table public.publication_candidates alter column created_by drop not null;
alter table public.publication_candidates add constraint publication_candidates_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

create or replace function public.recipe_draft_json(p_draft public.recipe_drafts)
returns jsonb
language sql stable set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p_draft.id::text,
    'ownerId', p_draft.owner_id::text,
    'scope', jsonb_build_object('type', p_draft.scope_type, 'id', case when p_draft.scope_type = 'household' then p_draft.scope_id::text else null end),
    'status', p_draft.status,
    'title', p_draft.title,
    'latestVersionId', p_draft.latest_version_id::text,
    'latestVersionNumber', p_draft.latest_version_number,
    'createdAt', p_draft.created_at,
    'updatedAt', p_draft.updated_at
  );
$$;

create or replace function public.recipe_version_json(p_version public.recipe_draft_versions)
returns jsonb
language sql stable set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p_version.id::text,
    'draftId', p_version.draft_id::text,
    'versionNumber', p_version.version_number,
    'contentHash', p_version.content_hash,
    'content', p_version.content,
    'rights', p_version.rights,
    'createdBy', coalesce(p_version.created_by::text, 'deleted-user'),
    'createdAt', p_version.created_at,
    'supersedesVersionId', p_version.supersedes_version_id::text
  );
$$;

create or replace function public.recipe_submission_json(p_submission public.recipe_submissions)
returns jsonb
language sql stable set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p_submission.id::text,
    'draftId', p_submission.draft_id::text,
    'versionId', p_submission.version_id::text,
    'contentHash', p_submission.content_hash,
    'contributorId', coalesce(p_submission.contributor_id::text, 'deleted-user'),
    'status', p_submission.status,
    'submittedAt', p_submission.submitted_at,
    'updatedAt', p_submission.updated_at,
    'withdrawnAt', p_submission.withdrawn_at
  );
$$;

create or replace function public.recipe_submission_bundle(p_submission_id uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'submission', public.recipe_submission_json(s),
    'draft', public.recipe_draft_json(d),
    'version', public.recipe_version_json(v),
    'findings', coalesce((select jsonb_agg(jsonb_build_object(
      'id', f.id::text, 'submissionId', f.submission_id::text, 'code', f.code,
      'severity', f.severity, 'message', f.message, 'path', f.path,
      'createdAt', f.created_at, 'resolvedAt', f.resolved_at
    ) order by f.created_at) from public.submission_findings f where f.submission_id = s.id), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id::text, 'submissionId', r.submission_id::text,
      'reviewerId', coalesce(r.reviewer_id::text, 'deleted-user'),
      'role', r.role, 'decision', r.decision, 'summary', r.summary,
      'proposedChanges', r.proposed_changes, 'createdAt', r.created_at
    ) order by r.created_at) from public.editorial_reviews r where r.submission_id = s.id), '[]'::jsonb),
    'cookTests', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id::text, 'submissionId', c.submission_id::text, 'versionId', c.version_id::text,
      'contentHash', c.content_hash, 'testerId', coalesce(c.tester_id::text, 'deleted-user'),
      'servingsAttempted', c.servings_attempted, 'prepMinutesActual', c.prep_minutes_actual,
      'cookMinutesActual', c.cook_minutes_actual, 'equipmentUsed', c.equipment_used,
      'substitutions', c.substitutions, 'stepFindings', c.step_findings,
      'criticalSafetyObservations', c.critical_safety_observations, 'outcome', c.outcome,
      'summary', c.summary, 'createdAt', c.created_at
    ) order by c.created_at) from public.cook_test_runs c where c.submission_id = s.id), '[]'::jsonb)
  )
  from public.recipe_submissions s
  join public.recipe_drafts d on d.id = s.draft_id
  join public.recipe_draft_versions v on v.id = s.version_id
  where s.id = p_submission_id and (
    s.contributor_id = auth.uid()
    or public.can_read_recipe_draft(s.draft_id)
    or public.has_contribution_role('editorial')
    or public.has_contribution_role('safety')
    or public.has_contribution_role('cook_tester')
    or public.has_contribution_role('publisher')
  );
$$;

create or replace function public.prepare_contribution_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  deleted_drafts integer := 0;
  retained_drafts integer := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then raise exception 'service_role_required'; end if;
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

revoke all on function public.prepare_contribution_account_deletion(uuid) from public;
grant execute on function public.prepare_contribution_account_deletion(uuid) to service_role;

commit;

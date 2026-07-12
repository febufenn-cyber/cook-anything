-- Phase 6: Living Cookbook contribution, review, cook-test and publication-candidate boundary.
-- Apply only after all Phase 5 migrations. Browser access is RPC-only; service_role is required for publication export.

begin;

create table if not exists public.contribution_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('editorial', 'safety', 'cook_tester', 'publisher', 'administrator')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.recipe_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  scope_type text not null check (scope_type in ('personal', 'household')),
  scope_id uuid not null,
  status text not null default 'private_cloud' check (status in ('private_cloud', 'household_draft', 'ready_for_submission', 'superseded')),
  title text not null check (char_length(title) between 1 and 180),
  latest_version_id uuid,
  latest_version_number integer not null default 0 check (latest_version_number >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_draft_personal_owner check (scope_type <> 'personal' or scope_id = owner_id)
);
create index if not exists recipe_drafts_scope_idx on public.recipe_drafts(scope_type, scope_id, updated_at desc);
create index if not exists recipe_drafts_owner_idx on public.recipe_drafts(owner_id, updated_at desc);

create table if not exists public.recipe_draft_collaborators (
  draft_id uuid not null references public.recipe_drafts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (draft_id, user_id)
);

create table if not exists public.recipe_draft_versions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.recipe_drafts(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  content jsonb not null,
  rights jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  supersedes_version_id uuid references public.recipe_draft_versions(id) on delete restrict,
  unique (draft_id, version_number),
  unique (draft_id, content_hash, created_by, created_at)
);
create index if not exists recipe_versions_draft_idx on public.recipe_draft_versions(draft_id, version_number desc);

alter table public.recipe_drafts
  drop constraint if exists recipe_drafts_latest_version_fk;
alter table public.recipe_drafts
  add constraint recipe_drafts_latest_version_fk
  foreign key (latest_version_id) references public.recipe_draft_versions(id) on delete restrict
  deferrable initially deferred;

create table if not exists public.recipe_submissions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.recipe_drafts(id) on delete restrict,
  version_id uuid not null references public.recipe_draft_versions(id) on delete restrict,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  contributor_id uuid not null references auth.users(id) on delete restrict,
  status text not null check (status in (
    'submitted', 'automated_checks_failed', 'awaiting_editorial_review', 'changes_requested',
    'awaiting_cook_test', 'editorially_approved', 'publication_candidate', 'publication_pr_open',
    'published', 'rejected', 'withdrawn', 'superseded', 'takedown_pending', 'takedown_completed'
  )),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (version_id)
);
create index if not exists recipe_submissions_contributor_idx on public.recipe_submissions(contributor_id, updated_at desc);
create index if not exists recipe_submissions_status_idx on public.recipe_submissions(status, updated_at asc);

create table if not exists public.submission_findings (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.recipe_submissions(id) on delete cascade,
  code text not null check (char_length(code) between 1 and 80),
  severity text not null check (severity in ('error', 'warning', 'info')),
  message text not null check (char_length(message) between 1 and 1000),
  path text check (path is null or char_length(path) <= 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists submission_findings_submission_idx on public.submission_findings(submission_id, created_at);

create table if not exists public.editorial_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.recipe_submissions(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('editorial', 'safety', 'publisher')),
  decision text not null check (decision in ('request_changes', 'reject', 'send_to_cook_test', 'approve_editorially', 'approve_publication')),
  summary text not null check (char_length(summary) between 1 and 5000),
  proposed_changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists editorial_reviews_submission_idx on public.editorial_reviews(submission_id, created_at);

create table if not exists public.cook_test_runs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.recipe_submissions(id) on delete cascade,
  version_id uuid not null references public.recipe_draft_versions(id) on delete restrict,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  tester_id uuid not null references auth.users(id) on delete restrict,
  servings_attempted integer not null check (servings_attempted between 1 and 100),
  prep_minutes_actual integer check (prep_minutes_actual is null or prep_minutes_actual between 0 and 10080),
  cook_minutes_actual integer check (cook_minutes_actual is null or cook_minutes_actual between 0 and 10080),
  equipment_used jsonb not null default '[]'::jsonb,
  substitutions jsonb not null default '[]'::jsonb,
  step_findings jsonb not null default '[]'::jsonb,
  critical_safety_observations jsonb not null default '[]'::jsonb,
  outcome text not null check (outcome in ('failed', 'passed_with_changes', 'passed')),
  summary text not null check (char_length(summary) between 1 and 5000),
  created_at timestamptz not null default now(),
  unique (submission_id, tester_id)
);
create index if not exists cook_test_submission_idx on public.cook_test_runs(submission_id, created_at);

create table if not exists public.publication_candidates (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.recipe_submissions(id) on delete restrict,
  version_id uuid not null references public.recipe_draft_versions(id) on delete restrict,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  canonical_slug text not null unique check (canonical_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  candidate_json jsonb not null,
  status text not null default 'ready' check (status in ('ready', 'pr_open', 'published', 'cancelled')),
  github_pr_url text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contribution_status_events (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.recipe_submissions(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('contributor', 'editorial', 'safety', 'cook_tester', 'publisher', 'administrator', 'system')),
  reason text check (reason is null or char_length(reason) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists contribution_events_submission_idx on public.contribution_status_events(submission_id, created_at);

alter table public.contribution_roles enable row level security;
alter table public.recipe_drafts enable row level security;
alter table public.recipe_draft_collaborators enable row level security;
alter table public.recipe_draft_versions enable row level security;
alter table public.recipe_submissions enable row level security;
alter table public.submission_findings enable row level security;
alter table public.editorial_reviews enable row level security;
alter table public.cook_test_runs enable row level security;
alter table public.publication_candidates enable row level security;
alter table public.contribution_status_events enable row level security;

create or replace function public.has_contribution_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.contribution_roles cr
    where cr.user_id = auth.uid() and cr.role in (p_role, 'administrator')
  );
$$;

create or replace function public.can_read_recipe_draft(p_draft_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.recipe_drafts d
    where d.id = p_draft_id and (
      d.owner_id = auth.uid()
      or exists (select 1 from public.recipe_draft_collaborators c where c.draft_id = d.id and c.user_id = auth.uid())
      or (d.scope_type = 'household' and exists (
        select 1 from public.household_members hm where hm.household_id = d.scope_id and hm.user_id = auth.uid()
      ))
      or public.has_contribution_role('editorial')
      or public.has_contribution_role('safety')
      or public.has_contribution_role('cook_tester')
      or public.has_contribution_role('publisher')
    )
  );
$$;

create or replace function public.can_write_recipe_draft(p_draft_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.recipe_drafts d
    where d.id = p_draft_id and d.status in ('private_cloud', 'household_draft', 'ready_for_submission') and (
      d.owner_id = auth.uid()
      or exists (select 1 from public.recipe_draft_collaborators c where c.draft_id = d.id and c.user_id = auth.uid() and c.role = 'editor')
      or (d.scope_type = 'household' and exists (
        select 1 from public.household_members hm
        where hm.household_id = d.scope_id and hm.user_id = auth.uid() and hm.role in ('owner', 'editor')
      ))
    )
  );
$$;

create or replace function public.contribution_payload_forbidden(p_value jsonb, p_depth integer default 0)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare pair record;
begin
  if p_depth > 12 then return true; end if;
  if p_value is null then return false; end if;
  if jsonb_typeof(p_value) = 'object' then
    for pair in select key, value from jsonb_each(p_value) loop
      if pair.key in ('__proto__', 'prototype', 'constructor')
        or pair.key ~* '(api.?key|authorization|cookie|session.?token|access.?token|refresh.?token|oauth|password|secret)'
      then return true; end if;
      if public.contribution_payload_forbidden(pair.value, p_depth + 1) then return true; end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    if jsonb_array_length(p_value) > 500 then return true; end if;
    for pair in select value from jsonb_array_elements(p_value) loop
      if public.contribution_payload_forbidden(pair.value, p_depth + 1) then return true; end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'string' and length(p_value #>> '{}') > 20000 then
    return true;
  end if;
  return false;
end;
$$;

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
    'createdBy', p_version.created_by::text,
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
    'contributorId', p_submission.contributor_id::text,
    'status', p_submission.status,
    'submittedAt', p_submission.submitted_at,
    'updatedAt', p_submission.updated_at,
    'withdrawnAt', p_submission.withdrawn_at
  );
$$;

create or replace function public.recipe_draft_bundle(p_draft_id uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'draft', public.recipe_draft_json(d),
    'latestVersion', public.recipe_version_json(latest),
    'versions', coalesce((
      select jsonb_agg(public.recipe_version_json(v) order by v.version_number desc)
      from public.recipe_draft_versions v where v.draft_id = d.id
    ), '[]'::jsonb)
  )
  from public.recipe_drafts d
  join public.recipe_draft_versions latest on latest.id = d.latest_version_id
  where d.id = p_draft_id and public.can_read_recipe_draft(d.id);
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
      'id', r.id::text, 'submissionId', r.submission_id::text, 'reviewerId', r.reviewer_id::text,
      'role', r.role, 'decision', r.decision, 'summary', r.summary,
      'proposedChanges', r.proposed_changes, 'createdAt', r.created_at
    ) order by r.created_at) from public.editorial_reviews r where r.submission_id = s.id), '[]'::jsonb),
    'cookTests', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id::text, 'submissionId', c.submission_id::text, 'versionId', c.version_id::text,
      'contentHash', c.content_hash, 'testerId', c.tester_id::text,
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

create or replace function public.save_recipe_draft_version(
  p_draft_id uuid,
  p_scope_type text,
  p_scope_id uuid,
  p_content jsonb,
  p_rights jsonb,
  p_expected_latest_version_id uuid
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  resolved_scope_id uuid;
  draft public.recipe_drafts;
  latest public.recipe_draft_versions;
  version_row public.recipe_draft_versions;
  next_number integer;
  hash_value text;
  title_value text;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if p_scope_type not in ('personal', 'household') then raise exception 'invalid_contribution_scope'; end if;
  resolved_scope_id := case when p_scope_type = 'personal' then actor else p_scope_id end;
  if resolved_scope_id is null then raise exception 'invalid_contribution_scope'; end if;
  if p_scope_type = 'household' and not exists (
    select 1 from public.household_members hm where hm.household_id = resolved_scope_id and hm.user_id = actor and hm.role in ('owner', 'editor')
  ) then raise exception 'contribution_scope_forbidden'; end if;
  if jsonb_typeof(p_content) <> 'object' or pg_column_size(p_content) > 262144 or public.contribution_payload_forbidden(p_content) then raise exception 'invalid_contribution_payload'; end if;
  if p_rights is not null and (jsonb_typeof(p_rights) <> 'object' or public.contribution_payload_forbidden(p_rights)) then raise exception 'invalid_rights_attestation'; end if;
  title_value := trim(coalesce(p_content ->> 'title', ''));
  if char_length(title_value) not between 1 and 180
    or jsonb_typeof(p_content -> 'ingredients') <> 'array' or jsonb_array_length(p_content -> 'ingredients') not between 2 and 150
    or jsonb_typeof(p_content -> 'steps') <> 'array' or jsonb_array_length(p_content -> 'steps') not between 2 and 150
  then raise exception 'invalid_draft_content'; end if;
  hash_value := encode(digest(p_content::text, 'sha256'), 'hex');

  if p_draft_id is null then
    insert into public.recipe_drafts(owner_id, scope_type, scope_id, status, title)
    values (actor, p_scope_type, resolved_scope_id, case when p_scope_type = 'household' then 'household_draft' else 'private_cloud' end, title_value)
    returning * into draft;
  else
    select * into draft from public.recipe_drafts where id = p_draft_id for update;
    if draft.id is null or not public.can_write_recipe_draft(draft.id) then raise exception 'draft_forbidden'; end if;
    if p_expected_latest_version_id is not null and draft.latest_version_id is distinct from p_expected_latest_version_id then raise exception 'draft_revision_conflict'; end if;
    if draft.scope_type <> p_scope_type or draft.scope_id <> resolved_scope_id then raise exception 'draft_scope_immutable'; end if;
    select * into latest from public.recipe_draft_versions where id = draft.latest_version_id;
    if latest.id is not null and latest.content_hash = hash_value and latest.rights is not distinct from p_rights then
      return public.recipe_draft_bundle(draft.id);
    end if;
  end if;

  next_number := draft.latest_version_number + 1;
  insert into public.recipe_draft_versions(draft_id, version_number, content_hash, content, rights, created_by, supersedes_version_id)
  values (draft.id, next_number, hash_value, p_content, p_rights, actor, draft.latest_version_id)
  returning * into version_row;

  update public.recipe_drafts set
    title = title_value,
    latest_version_id = version_row.id,
    latest_version_number = next_number,
    status = case when scope_type = 'household' then 'household_draft' else 'private_cloud' end,
    updated_at = now()
  where id = draft.id;

  return public.recipe_draft_bundle(draft.id);
end;
$$;

create or replace function public.list_recipe_drafts()
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(public.recipe_draft_json(d) order by d.updated_at desc), '[]'::jsonb)
  from public.recipe_drafts d where public.can_read_recipe_draft(d.id);
$$;

create or replace function public.get_recipe_draft(p_draft_id uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$ select public.recipe_draft_bundle(p_draft_id); $$;

create or replace function public.submit_recipe_version(p_draft_id uuid, p_version_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  draft public.recipe_drafts;
  version_row public.recipe_draft_versions;
  submission public.recipe_submissions;
  ingredient record;
  has_errors boolean := false;
  initial_status text;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  select * into draft from public.recipe_drafts where id = p_draft_id for update;
  if draft.id is null or not public.can_write_recipe_draft(draft.id) then raise exception 'draft_forbidden'; end if;
  select * into version_row from public.recipe_draft_versions where id = p_version_id and draft_id = draft.id;
  if version_row.id is null then raise exception 'draft_version_not_found'; end if;
  if version_row.rights is null
    or coalesce((version_row.rights ->> 'writtenInOwnWords')::boolean, false) is not true
    or coalesce((version_row.rights ->> 'rightToShare')::boolean, false) is not true
    or version_row.rights ->> 'licence' not in ('CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'permission-granted')
  then raise exception 'rights_incomplete'; end if;

  select * into submission from public.recipe_submissions where version_id = version_row.id;
  if submission.id is not null then return public.recipe_submission_bundle(submission.id); end if;

  insert into public.recipe_submissions(draft_id, version_id, content_hash, contributor_id, status)
  values (draft.id, version_row.id, version_row.content_hash, actor, 'submitted') returning * into submission;

  for ingredient in select value, ordinality from jsonb_array_elements(version_row.content -> 'ingredients') with ordinality loop
    if nullif(trim(ingredient.value ->> 'canonicalSlug'), '') is null then
      insert into public.submission_findings(submission_id, code, severity, message, path)
      values (submission.id, 'unresolved_ingredient', 'warning', 'Map this ingredient to the canonical taxonomy before publication.', 'ingredients.' || (ingredient.ordinality - 1));
    end if;
  end loop;
  if coalesce(jsonb_array_length(version_row.content -> 'declaredAllergens'), 0) = 0 then
    insert into public.submission_findings(submission_id, code, severity, message, path)
    values (submission.id, 'allergen_review_required', 'warning', 'No allergens are declared. Automated derivation and human review remain required.', 'declaredAllergens');
  end if;
  if version_row.rights ->> 'aiAssistance' = 'drafting' and nullif(trim(version_row.rights ->> 'aiAssistanceNotes'), '') is null then
    insert into public.submission_findings(submission_id, code, severity, message, path)
    values (submission.id, 'rights_incomplete', 'error', 'Explain how AI drafting assistance was used.', 'rights.aiAssistanceNotes');
    has_errors := true;
  end if;

  initial_status := case when has_errors then 'automated_checks_failed' else 'awaiting_editorial_review' end;
  update public.recipe_submissions set status = initial_status, updated_at = now() where id = submission.id returning * into submission;
  update public.recipe_drafts set status = 'ready_for_submission', updated_at = now() where id = draft.id;
  insert into public.contribution_status_events(submission_id, from_status, to_status, actor_id, actor_role, reason)
  values (submission.id, null, initial_status, actor, 'contributor', 'Submitted immutable recipe version');
  return public.recipe_submission_bundle(submission.id);
end;
$$;

create or replace function public.list_my_recipe_submissions()
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(public.recipe_submission_json(s) order by s.updated_at desc), '[]'::jsonb)
  from public.recipe_submissions s where s.contributor_id = auth.uid();
$$;

create or replace function public.get_recipe_submission(p_submission_id uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$ select public.recipe_submission_bundle(p_submission_id); $$;

create or replace function public.withdraw_recipe_submission(p_submission_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare actor uuid := auth.uid(); submission public.recipe_submissions; old_status text;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  select * into submission from public.recipe_submissions where id = p_submission_id for update;
  if submission.id is null or submission.contributor_id <> actor then raise exception 'submission_forbidden'; end if;
  if submission.status in ('published', 'takedown_pending', 'takedown_completed', 'rejected', 'withdrawn') then raise exception 'invalid_submission_transition'; end if;
  old_status := submission.status;
  update public.recipe_submissions set status = 'withdrawn', withdrawn_at = now(), updated_at = now() where id = submission.id returning * into submission;
  insert into public.contribution_status_events(submission_id, from_status, to_status, actor_id, actor_role, reason)
  values (submission.id, old_status, 'withdrawn', actor, 'contributor', left(coalesce(p_reason, 'Contributor withdrew submission'), 1000));
  return public.recipe_submission_json(submission);
end;
$$;

create or replace function public.list_recipe_review_queue()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not (public.has_contribution_role('editorial') or public.has_contribution_role('safety') or public.has_contribution_role('cook_tester') or public.has_contribution_role('publisher')) then
    raise exception 'review_role_required';
  end if;
  return coalesce((select jsonb_agg(public.recipe_submission_bundle(s.id) order by s.updated_at)
    from public.recipe_submissions s
    where s.status in ('awaiting_editorial_review', 'changes_requested', 'awaiting_cook_test', 'editorially_approved', 'publication_candidate')), '[]'::jsonb);
end;
$$;

create or replace function public.add_recipe_editorial_review(
  p_submission_id uuid,
  p_role text,
  p_decision text,
  p_summary text,
  p_proposed_changes jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  submission public.recipe_submissions;
  next_status text;
  old_status text;
begin
  if actor is null or p_role not in ('editorial', 'safety', 'publisher') or not public.has_contribution_role(p_role) then raise exception 'review_role_required'; end if;
  if p_decision not in ('request_changes', 'reject', 'send_to_cook_test', 'approve_editorially', 'approve_publication') then raise exception 'invalid_review_decision'; end if;
  if char_length(trim(p_summary)) not between 1 and 5000 or jsonb_typeof(p_proposed_changes) <> 'array' or public.contribution_payload_forbidden(p_proposed_changes) then raise exception 'invalid_review'; end if;
  select * into submission from public.recipe_submissions where id = p_submission_id for update;
  if submission.id is null then raise exception 'submission_not_found'; end if;
  if submission.contributor_id = actor then raise exception 'self_review_forbidden'; end if;
  old_status := submission.status;
  next_status := case p_decision
    when 'request_changes' then 'changes_requested'
    when 'reject' then 'rejected'
    when 'send_to_cook_test' then 'awaiting_cook_test'
    when 'approve_editorially' then 'editorially_approved'
    when 'approve_publication' then 'publication_candidate'
  end;
  if p_decision = 'approve_publication' then raise exception 'use_publication_candidate_rpc'; end if;
  if old_status not in ('awaiting_editorial_review', 'awaiting_cook_test', 'editorially_approved') then raise exception 'invalid_submission_transition'; end if;

  insert into public.editorial_reviews(submission_id, reviewer_id, role, decision, summary, proposed_changes)
  values (submission.id, actor, p_role, p_decision, trim(p_summary), p_proposed_changes);
  update public.recipe_submissions set status = next_status, updated_at = now() where id = submission.id;
  insert into public.contribution_status_events(submission_id, from_status, to_status, actor_id, actor_role, reason)
  values (submission.id, old_status, next_status, actor, p_role, left(trim(p_summary), 1000));
  return public.recipe_submission_bundle(submission.id);
end;
$$;

create or replace function public.add_recipe_cook_test(
  p_submission_id uuid,
  p_version_id uuid,
  p_content_hash text,
  p_servings_attempted integer,
  p_prep_minutes_actual integer,
  p_cook_minutes_actual integer,
  p_equipment_used jsonb,
  p_substitutions jsonb,
  p_step_findings jsonb,
  p_safety_observations jsonb,
  p_outcome text,
  p_summary text
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare actor uuid := auth.uid(); submission public.recipe_submissions;
begin
  if actor is null or not public.has_contribution_role('cook_tester') then raise exception 'cook_tester_role_required'; end if;
  select * into submission from public.recipe_submissions where id = p_submission_id for update;
  if submission.id is null or submission.status <> 'awaiting_cook_test' then raise exception 'invalid_submission_transition'; end if;
  if submission.contributor_id = actor then raise exception 'self_test_forbidden'; end if;
  if submission.version_id <> p_version_id or submission.content_hash <> p_content_hash then raise exception 'cook_test_version_mismatch'; end if;
  if p_outcome not in ('failed', 'passed_with_changes', 'passed') or p_servings_attempted not between 1 and 100 or char_length(trim(p_summary)) not between 1 and 5000 then raise exception 'invalid_cook_test'; end if;
  if public.contribution_payload_forbidden(p_equipment_used) or public.contribution_payload_forbidden(p_substitutions)
    or public.contribution_payload_forbidden(p_step_findings) or public.contribution_payload_forbidden(p_safety_observations)
  then raise exception 'invalid_cook_test'; end if;
  insert into public.cook_test_runs(
    submission_id, version_id, content_hash, tester_id, servings_attempted,
    prep_minutes_actual, cook_minutes_actual, equipment_used, substitutions,
    step_findings, critical_safety_observations, outcome, summary
  ) values (
    submission.id, p_version_id, p_content_hash, actor, p_servings_attempted,
    p_prep_minutes_actual, p_cook_minutes_actual, p_equipment_used, p_substitutions,
    p_step_findings, p_safety_observations, p_outcome, trim(p_summary)
  ) on conflict (submission_id, tester_id) do nothing;
  return public.recipe_submission_bundle(submission.id);
end;
$$;

create or replace function public.approve_recipe_publication_candidate(p_submission_id uuid, p_canonical_slug text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  submission public.recipe_submissions;
  version_row public.recipe_draft_versions;
  rights_value jsonb;
  passed_tests integer;
  candidate jsonb;
begin
  if actor is null or not public.has_contribution_role('publisher') then raise exception 'publisher_role_required'; end if;
  if p_canonical_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(p_canonical_slug) > 100 then raise exception 'invalid_canonical_slug'; end if;
  select * into submission from public.recipe_submissions where id = p_submission_id for update;
  if submission.id is null or submission.status <> 'editorially_approved' then raise exception 'invalid_submission_transition'; end if;
  if submission.contributor_id = actor then raise exception 'self_publication_approval_forbidden'; end if;
  select * into version_row from public.recipe_draft_versions where id = submission.version_id;
  rights_value := version_row.rights;
  select count(distinct tester_id) into passed_tests from public.cook_test_runs
    where submission_id = submission.id and version_id = submission.version_id and content_hash = submission.content_hash and outcome = 'passed';
  if passed_tests < 2 then raise exception 'insufficient_independent_cook_tests'; end if;
  if exists (select 1 from public.submission_findings f where f.submission_id = submission.id and f.severity = 'error' and f.resolved_at is null) then
    raise exception 'unresolved_submission_errors';
  end if;
  candidate := jsonb_build_object(
    'schemaVersion', 1,
    'submissionId', submission.id::text,
    'versionId', submission.version_id::text,
    'contentHash', submission.content_hash,
    'slug', p_canonical_slug,
    'content', version_row.content,
    'rights', rights_value,
    'evidence', jsonb_build_object(
      'editorialReviews', (select count(*) from public.editorial_reviews r where r.submission_id = submission.id and r.decision = 'approve_editorially'),
      'independentPassedCookTests', passed_tests
    )
  );
  insert into public.publication_candidates(submission_id, version_id, content_hash, canonical_slug, candidate_json, created_by)
  values (submission.id, submission.version_id, submission.content_hash, p_canonical_slug, candidate, actor)
  on conflict (submission_id) do update set candidate_json = excluded.candidate_json, canonical_slug = excluded.canonical_slug, updated_at = now();
  update public.recipe_submissions set status = 'publication_candidate', updated_at = now() where id = submission.id;
  insert into public.editorial_reviews(submission_id, reviewer_id, role, decision, summary)
  values (submission.id, actor, 'publisher', 'approve_publication', 'Approved immutable version for publication PR generation.');
  insert into public.contribution_status_events(submission_id, from_status, to_status, actor_id, actor_role, reason)
  values (submission.id, 'editorially_approved', 'publication_candidate', actor, 'publisher', 'Two independent passed cook tests and no unresolved errors');
  return public.recipe_submission_bundle(submission.id);
end;
$$;

create or replace function public.claim_publication_candidate(p_candidate_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare candidate public.publication_candidates;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then raise exception 'service_role_required'; end if;
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
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then raise exception 'service_role_required'; end if;
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

-- Direct table access remains unavailable to browser roles. RPCs are the only browser surface.
revoke all on public.contribution_roles, public.recipe_drafts, public.recipe_draft_collaborators,
  public.recipe_draft_versions, public.recipe_submissions, public.submission_findings,
  public.editorial_reviews, public.cook_test_runs, public.publication_candidates,
  public.contribution_status_events from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

revoke all on function public.has_contribution_role(text) from public;
revoke all on function public.can_read_recipe_draft(uuid) from public;
revoke all on function public.can_write_recipe_draft(uuid) from public;
revoke all on function public.contribution_payload_forbidden(jsonb, integer) from public;
revoke all on function public.recipe_draft_bundle(uuid) from public;
revoke all on function public.recipe_submission_bundle(uuid) from public;

revoke all on function public.save_recipe_draft_version(uuid, text, uuid, jsonb, jsonb, uuid) from public;
revoke all on function public.list_recipe_drafts() from public;
revoke all on function public.get_recipe_draft(uuid) from public;
revoke all on function public.submit_recipe_version(uuid, uuid) from public;
revoke all on function public.list_my_recipe_submissions() from public;
revoke all on function public.get_recipe_submission(uuid) from public;
revoke all on function public.withdraw_recipe_submission(uuid, text) from public;
revoke all on function public.list_recipe_review_queue() from public;
revoke all on function public.add_recipe_editorial_review(uuid, text, text, text, jsonb) from public;
revoke all on function public.add_recipe_cook_test(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb, jsonb, text, text) from public;
revoke all on function public.approve_recipe_publication_candidate(uuid, text) from public;
revoke all on function public.claim_publication_candidate(uuid) from public;
revoke all on function public.mark_publication_candidate_pr(uuid, text) from public;

grant execute on function public.save_recipe_draft_version(uuid, text, uuid, jsonb, jsonb, uuid) to authenticated;
grant execute on function public.list_recipe_drafts() to authenticated;
grant execute on function public.get_recipe_draft(uuid) to authenticated;
grant execute on function public.submit_recipe_version(uuid, uuid) to authenticated;
grant execute on function public.list_my_recipe_submissions() to authenticated;
grant execute on function public.get_recipe_submission(uuid) to authenticated;
grant execute on function public.withdraw_recipe_submission(uuid, text) to authenticated;
grant execute on function public.list_recipe_review_queue() to authenticated;
grant execute on function public.add_recipe_editorial_review(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.add_recipe_cook_test(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb, jsonb, text, text) to authenticated;
grant execute on function public.approve_recipe_publication_candidate(uuid, text) to authenticated;
grant execute on function public.claim_publication_candidate(uuid) to service_role;
grant execute on function public.mark_publication_candidate_pr(uuid, text) to service_role;

commit;

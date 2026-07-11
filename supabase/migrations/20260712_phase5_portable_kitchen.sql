-- Phase 5: optional portable kitchen sync.
-- Apply in a dedicated Supabase project before setting public browser configuration.
-- The browser receives only the publishable/anon key. Never expose service_role.

begin;

create extension if not exists pgcrypto;

create sequence if not exists public.sync_change_sequence;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_devices (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, id)
);
create index if not exists sync_devices_user_idx on public.sync_devices(user_id, last_seen_at desc);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_members_user_idx on public.household_members(user_id, household_id);

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists household_invites_lookup_idx on public.household_invites(token_hash, expires_at);

create table if not exists public.sync_records (
  scope_type text not null check (scope_type in ('personal', 'household')),
  scope_id uuid not null,
  entity_type text not null check (entity_type in ('profile', 'pantry_item', 'saved_recipe', 'cook_history', 'shopping_item', 'meal_plan_entry')),
  record_id text not null check (char_length(record_id) between 1 and 180),
  schema_version integer not null default 1 check (schema_version = 1),
  revision bigint not null default 1 check (revision > 0),
  payload jsonb,
  payload_hash text not null,
  device_id text not null,
  last_actor_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  change_sequence bigint not null default nextval('public.sync_change_sequence'),
  primary key (scope_type, scope_id, entity_type, record_id),
  constraint personal_scope_profile check (scope_type <> 'personal' or scope_id = last_actor_id or entity_type <> 'profile')
);
create index if not exists sync_records_change_idx on public.sync_records(change_sequence);
create index if not exists sync_records_scope_idx on public.sync_records(scope_type, scope_id, change_sequence);

create table if not exists public.sync_mutation_receipts (
  mutation_id text primary key check (char_length(mutation_id) between 1 and 100),
  actor_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists sync_mutation_actor_idx on public.sync_mutation_receipts(actor_id, created_at desc);

create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'cancelled')),
  completed_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.sync_devices enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.sync_records enable row level security;
alter table public.sync_mutation_receipts enable row level security;
alter table public.account_deletion_requests enable row level security;

create or replace function public.can_read_kitchen_scope(p_scope_type text, p_scope_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when auth.uid() is null then false
    when p_scope_type = 'personal' then p_scope_id = auth.uid()
    when p_scope_type = 'household' then exists (
      select 1 from public.household_members hm
      where hm.household_id = p_scope_id and hm.user_id = auth.uid()
    )
    else false
  end;
$$;

create or replace function public.can_write_kitchen_scope(p_scope_type text, p_scope_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when auth.uid() is null then false
    when p_scope_type = 'personal' then p_scope_id = auth.uid()
    when p_scope_type = 'household' then exists (
      select 1 from public.household_members hm
      where hm.household_id = p_scope_id
        and hm.user_id = auth.uid()
        and hm.role in ('owner', 'editor')
    )
    else false
  end;
$$;

create or replace function public.sync_payload_has_forbidden_key(p_value jsonb, p_depth integer default 0)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  pair record;
begin
  if p_depth > 12 then return true; end if;
  if p_value is null then return false; end if;
  if jsonb_typeof(p_value) = 'object' then
    for pair in select key, value from jsonb_each(p_value) loop
      if pair.key in ('__proto__', 'prototype', 'constructor')
        or pair.key ~* '(api.?key|authorization|cookie|session.?token|access.?token|refresh.?token|oauth|password|secret)'
      then return true; end if;
      if public.sync_payload_has_forbidden_key(pair.value, p_depth + 1) then return true; end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for pair in select value from jsonb_array_elements(p_value) loop
      if public.sync_payload_has_forbidden_key(pair.value, p_depth + 1) then return true; end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'string' and length(p_value #>> '{}') > 100000 then
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.sync_record_json(p_record public.sync_records)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'entityType', p_record.entity_type,
    'recordId', p_record.record_id,
    'scope', jsonb_build_object('type', p_record.scope_type, 'id', p_record.scope_id::text),
    'schemaVersion', p_record.schema_version,
    'revision', p_record.revision,
    'deviceId', p_record.device_id,
    'payload', p_record.payload,
    'payloadHash', p_record.payload_hash,
    'createdAt', p_record.created_at,
    'updatedAt', p_record.updated_at,
    'deletedAt', p_record.deleted_at,
    'changeSequence', p_record.change_sequence
  );
$$;

create or replace function public.register_sync_device(p_device_id text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if char_length(p_device_id) not between 1 and 100 or char_length(trim(p_name)) not between 1 and 80 then
    raise exception 'invalid_device';
  end if;
  insert into public.sync_devices(id, user_id, name, last_seen_at, revoked_at)
  values (p_device_id, actor, trim(p_name), now(), null)
  on conflict (id) do update set
    name = excluded.name,
    last_seen_at = now(),
    revoked_at = case when public.sync_devices.user_id = actor then public.sync_devices.revoked_at else now() end
  where public.sync_devices.user_id = actor;
  if not exists (select 1 from public.sync_devices where id = p_device_id and user_id = actor and revoked_at is null) then
    raise exception 'device_revoked';
  end if;
  insert into public.profiles(user_id) values (actor) on conflict (user_id) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.sync_push(p_device_id text, p_mutations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  mutation jsonb;
  receipt jsonb;
  current_record public.sync_records;
  saved_record public.sync_records;
  mutation_id text;
  entity_type_value text;
  record_id_value text;
  operation_value text;
  scope_type_value text;
  scope_id_value uuid;
  base_revision_value bigint;
  payload_value jsonb;
  result_value jsonb;
  accepted jsonb := '[]'::jsonb;
  conflicts jsonb := '[]'::jsonb;
  reason_value text;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_mutations) <> 'array' or jsonb_array_length(p_mutations) > 100 then raise exception 'invalid_mutation_batch'; end if;
  if not exists (select 1 from public.sync_devices where id = p_device_id and user_id = actor and revoked_at is null) then raise exception 'device_revoked'; end if;

  update public.sync_devices set last_seen_at = now() where id = p_device_id and user_id = actor;

  for mutation in select value from jsonb_array_elements(p_mutations) loop
    if public.sync_payload_has_forbidden_key(mutation) then raise exception 'secret_field_forbidden'; end if;
    mutation_id := mutation ->> 'mutationId';
    if mutation_id is null or char_length(mutation_id) not between 1 and 100 then raise exception 'invalid_mutation'; end if;

    select smr.result into receipt from public.sync_mutation_receipts smr
    where smr.mutation_id = mutation_id and smr.actor_id = actor;
    if receipt is not null then
      if receipt ->> 'kind' = 'accepted' then accepted := accepted || jsonb_build_array(receipt -> 'value');
      else conflicts := conflicts || jsonb_build_array(receipt -> 'value'); end if;
      continue;
    end if;

    if coalesce((mutation ->> 'protocolVersion')::integer, 0) <> 1
      or coalesce((mutation ->> 'schemaVersion')::integer, 0) <> 1
      or mutation ->> 'deviceId' <> p_device_id
    then raise exception 'unsupported_sync_protocol'; end if;

    entity_type_value := mutation ->> 'entityType';
    record_id_value := mutation ->> 'recordId';
    operation_value := mutation ->> 'operation';
    scope_type_value := coalesce(mutation #>> '{scope,type}', 'personal');
    scope_id_value := case when scope_type_value = 'personal' then actor else nullif(mutation #>> '{scope,id}', '')::uuid end;
    payload_value := mutation -> 'payload';
    base_revision_value := case when mutation ? 'baseRevision' and mutation -> 'baseRevision' <> 'null'::jsonb then (mutation ->> 'baseRevision')::bigint else null end;

    if entity_type_value not in ('profile', 'pantry_item', 'saved_recipe', 'cook_history', 'shopping_item', 'meal_plan_entry')
      or operation_value not in ('upsert', 'delete')
      or record_id_value is null or char_length(record_id_value) not between 1 and 180
      or scope_id_value is null
      or not public.can_write_kitchen_scope(scope_type_value, scope_id_value)
    then raise exception 'invalid_mutation'; end if;
    if operation_value = 'upsert' and (payload_value is null or payload_value = 'null'::jsonb) then raise exception 'invalid_mutation'; end if;
    if operation_value = 'delete' then payload_value := null; end if;

    select * into current_record from public.sync_records
    where scope_type = scope_type_value and scope_id = scope_id_value
      and entity_type = entity_type_value and record_id = record_id_value
    for update;

    if (current_record.record_id is not null and base_revision_value is distinct from current_record.revision)
      or (current_record.record_id is null and base_revision_value is not null)
    then
      reason_value := case
        when operation_value = 'delete' or current_record.deleted_at is not null then 'delete_edit'
        when entity_type_value = 'profile' then 'safety_preference'
        when entity_type_value = 'meal_plan_entry' then 'meal_slot'
        else 'concurrent_edit'
      end;
      result_value := jsonb_build_object(
        'id', gen_random_uuid()::text,
        'mutation', mutation,
        'remote', public.sync_record_json(current_record),
        'reason', reason_value,
        'createdAt', now()
      );
      conflicts := conflicts || jsonb_build_array(result_value);
      insert into public.sync_mutation_receipts(mutation_id, actor_id, device_id, result)
      values (mutation_id, actor, p_device_id, jsonb_build_object('kind', 'conflict', 'value', result_value));
      continue;
    end if;

    insert into public.sync_records(
      scope_type, scope_id, entity_type, record_id, schema_version, revision,
      payload, payload_hash, device_id, last_actor_id, created_at, updated_at,
      deleted_at, change_sequence
    ) values (
      scope_type_value, scope_id_value, entity_type_value, record_id_value, 1,
      coalesce(current_record.revision, 0) + 1,
      payload_value,
      encode(digest(coalesce(payload_value, 'null'::jsonb)::text, 'sha256'), 'hex'),
      p_device_id, actor, coalesce(current_record.created_at, now()), now(),
      case when operation_value = 'delete' then now() else null end,
      nextval('public.sync_change_sequence')
    )
    on conflict (scope_type, scope_id, entity_type, record_id) do update set
      schema_version = 1,
      revision = public.sync_records.revision + 1,
      payload = excluded.payload,
      payload_hash = excluded.payload_hash,
      device_id = excluded.device_id,
      last_actor_id = actor,
      updated_at = now(),
      deleted_at = excluded.deleted_at,
      change_sequence = nextval('public.sync_change_sequence')
    returning * into saved_record;

    result_value := jsonb_build_object('mutationId', mutation_id, 'record', public.sync_record_json(saved_record));
    accepted := accepted || jsonb_build_array(result_value);
    insert into public.sync_mutation_receipts(mutation_id, actor_id, device_id, result)
    values (mutation_id, actor, p_device_id, jsonb_build_object('kind', 'accepted', 'value', result_value));
  end loop;

  return jsonb_build_object('accepted', accepted, 'conflicts', conflicts);
end;
$$;

create or replace function public.sync_pull(p_device_id text, p_cursor bigint default 0, p_limit integer default 500)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  bounded_limit integer := least(greatest(coalesce(p_limit, 500), 1), 500);
  records jsonb;
  next_cursor bigint;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if not exists (select 1 from public.sync_devices where id = p_device_id and user_id = actor and revoked_at is null) then raise exception 'device_revoked'; end if;
  update public.sync_devices set last_seen_at = now() where id = p_device_id and user_id = actor;

  with selected as (
    select sr.* from public.sync_records sr
    where sr.change_sequence > greatest(coalesce(p_cursor, 0), 0)
      and public.can_read_kitchen_scope(sr.scope_type, sr.scope_id)
    order by sr.change_sequence asc
    limit bounded_limit
  )
  select coalesce(jsonb_agg(public.sync_record_json(selected) order by selected.change_sequence), '[]'::jsonb),
         coalesce(max(selected.change_sequence), greatest(coalesce(p_cursor, 0), 0))
  into records, next_cursor from selected;

  return jsonb_build_object('nextCursor', next_cursor, 'records', records, 'serverTime', now());
end;
$$;

create or replace function public.sync_kitchen_summary()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'profile', count(*) filter (where entity_type = 'profile' and deleted_at is null),
    'pantry', count(*) filter (where entity_type = 'pantry_item' and deleted_at is null),
    'savedRecipes', count(*) filter (where entity_type = 'saved_recipe' and deleted_at is null),
    'history', count(*) filter (where entity_type = 'cook_history' and deleted_at is null),
    'shopping', count(*) filter (where entity_type = 'shopping_item' and deleted_at is null),
    'mealPlan', count(*) filter (where entity_type = 'meal_plan_entry' and deleted_at is null),
    'deleted', count(*) filter (where deleted_at is not null)
  ) from public.sync_records
  where scope_type = 'personal' and scope_id = auth.uid();
$$;

create or replace function public.sync_reset_personal_scope(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor uuid := auth.uid(); affected integer;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if not exists (select 1 from public.sync_devices where id = p_device_id and user_id = actor and revoked_at is null) then raise exception 'device_revoked'; end if;
  update public.sync_records set
    payload = null,
    payload_hash = encode(digest('null', 'sha256'), 'hex'),
    revision = revision + 1,
    device_id = p_device_id,
    last_actor_id = actor,
    updated_at = now(),
    deleted_at = now(),
    change_sequence = nextval('public.sync_change_sequence')
  where scope_type = 'personal' and scope_id = actor and deleted_at is null;
  get diagnostics affected = row_count;
  return jsonb_build_object('ok', true, 'deleted', affected);
end;
$$;

create or replace function public.list_sync_devices(p_current_device_id text default null)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'name', name,
    'current', id = p_current_device_id,
    'lastSeenAt', last_seen_at,
    'createdAt', created_at,
    'revokedAt', revoked_at
  ) order by last_seen_at desc), '[]'::jsonb)
  from public.sync_devices where user_id = auth.uid();
$$;

create or replace function public.revoke_sync_device(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  update public.sync_devices set revoked_at = now()
  where id = p_device_id and user_id = auth.uid() and revoked_at is null;
  return jsonb_build_object('ok', found);
end;
$$;

create or replace function public.create_kitchen_household(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor uuid := auth.uid(); created public.households;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if char_length(trim(p_name)) not between 1 and 80 then raise exception 'invalid_household_name'; end if;
  insert into public.households(owner_id, name) values (actor, trim(p_name)) returning * into created;
  insert into public.household_members(household_id, user_id, role) values (created.id, actor, 'owner');
  return jsonb_build_object('id', created.id, 'name', created.name, 'role', 'owner', 'memberCount', 1, 'createdAt', created.created_at);
end;
$$;

create or replace function public.list_kitchen_households()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', h.id,
    'name', h.name,
    'role', mine.role,
    'memberCount', (select count(*) from public.household_members all_members where all_members.household_id = h.id),
    'createdAt', h.created_at
  ) order by h.created_at), '[]'::jsonb)
  from public.households h
  join public.household_members mine on mine.household_id = h.id and mine.user_id = auth.uid();
$$;

create or replace function public.create_household_invite(p_household_id uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor uuid := auth.uid(); plain_token text; expiry timestamptz := now() + interval '48 hours';
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if not exists (select 1 from public.household_members where household_id = p_household_id and user_id = actor and role = 'owner') then raise exception 'household_owner_required'; end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(p_email) > 254 then raise exception 'invalid_email'; end if;
  plain_token := encode(gen_random_bytes(32), 'hex');
  insert into public.household_invites(household_id, invited_by, email, token_hash, expires_at)
  values (p_household_id, actor, lower(trim(p_email)), encode(digest(plain_token, 'sha256'), 'hex'), expiry);
  return jsonb_build_object('token', plain_token, 'expiresAt', expiry);
end;
$$;

create or replace function public.accept_household_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor uuid := auth.uid(); invite public.household_invites; household public.households; actor_email text;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  select email into actor_email from auth.users where id = actor;
  select * into invite from public.household_invites
  where token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
    and used_at is null and expires_at > now()
  for update;
  if invite.id is null then raise exception 'invalid_or_expired_invite'; end if;
  if lower(invite.email) <> lower(coalesce(actor_email, '')) then raise exception 'invite_email_mismatch'; end if;
  insert into public.household_members(household_id, user_id, role)
  values (invite.household_id, actor, 'editor')
  on conflict (household_id, user_id) do nothing;
  update public.household_invites set used_at = now() where id = invite.id;
  select * into household from public.households where id = invite.household_id;
  return jsonb_build_object(
    'id', household.id,
    'name', household.name,
    'role', (select role from public.household_members where household_id = household.id and user_id = actor),
    'memberCount', (select count(*) from public.household_members where household_id = household.id),
    'createdAt', household.created_at
  );
end;
$$;

create or replace function public.export_cloud_kitchen()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'format', 'cook-anything-cloud-export',
    'schemaVersion', 1,
    'createdAt', now(),
    'records', coalesce(jsonb_agg(public.sync_record_json(sr) order by sr.change_sequence), '[]'::jsonb)
  ) from public.sync_records sr
  where public.can_read_kitchen_scope(sr.scope_type, sr.scope_id);
$$;

create or replace function public.request_account_deletion()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'authentication_required'; end if;
  insert into public.account_deletion_requests(user_id, requested_at, status)
  values (actor, now(), 'pending')
  on conflict (user_id) do update set requested_at = now(), status = 'pending', completed_at = null;
  update public.sync_devices set revoked_at = now() where user_id = actor;
  return jsonb_build_object('ok', true, 'status', 'pending');
end;
$$;

-- Direct table access is intentionally unavailable to browser roles. The public
-- protocol is the narrow function surface below, which always derives identity
-- from auth.uid() and validates record scope.
revoke all on public.profiles, public.sync_devices, public.households, public.household_members,
  public.household_invites, public.sync_records, public.sync_mutation_receipts,
  public.account_deletion_requests from anon, authenticated;

revoke all on function public.can_read_kitchen_scope(text, uuid) from public;
revoke all on function public.can_write_kitchen_scope(text, uuid) from public;
revoke all on function public.sync_payload_has_forbidden_key(jsonb, integer) from public;
revoke all on function public.sync_record_json(public.sync_records) from public;

grant execute on function public.register_sync_device(text, text) to authenticated;
grant execute on function public.sync_push(text, jsonb) to authenticated;
grant execute on function public.sync_pull(text, bigint, integer) to authenticated;
grant execute on function public.sync_kitchen_summary() to authenticated;
grant execute on function public.sync_reset_personal_scope(text) to authenticated;
grant execute on function public.list_sync_devices(text) to authenticated;
grant execute on function public.revoke_sync_device(text) to authenticated;
grant execute on function public.create_kitchen_household(text) to authenticated;
grant execute on function public.list_kitchen_households() to authenticated;
grant execute on function public.create_household_invite(uuid, text) to authenticated;
grant execute on function public.accept_household_invite(text) to authenticated;
grant execute on function public.export_cloud_kitchen() to authenticated;
grant execute on function public.request_account_deletion() to authenticated;

commit;

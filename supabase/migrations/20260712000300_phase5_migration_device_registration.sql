-- Allow the explicit "use this device" migration choice before the first
-- ordinary sync, while preserving device revocation and cross-user ownership.

begin;

create or replace function public.sync_reset_personal_scope(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  affected integer;
  existing_user uuid;
  existing_revoked timestamptz;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if char_length(p_device_id) not between 1 and 100 then raise exception 'invalid_device'; end if;

  select user_id, revoked_at into existing_user, existing_revoked
  from public.sync_devices
  where id = p_device_id;

  if existing_user is not null and existing_user <> actor then
    raise exception 'invalid_device';
  end if;
  if existing_user = actor and existing_revoked is not null then
    raise exception 'device_revoked';
  end if;

  insert into public.sync_devices(id, user_id, name, last_seen_at)
  values (p_device_id, actor, 'Migration device', now())
  on conflict (id) do update set last_seen_at = now()
  where public.sync_devices.user_id = actor and public.sync_devices.revoked_at is null;

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

grant execute on function public.sync_reset_personal_scope(text) to authenticated;

commit;

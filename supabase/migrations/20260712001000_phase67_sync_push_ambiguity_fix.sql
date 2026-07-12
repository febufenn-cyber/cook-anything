-- Phase 6.7: fix ambiguous column reference in sync_push.
--
-- The plpgsql variable `mutation_id` collided with the
-- sync_mutation_receipts.mutation_id column in the receipt-idempotency lookup
-- (42702 under the default variable_conflict=error), making every sync_push
-- call fail once it passed device validation. Found by the Phase 6.7 hosted
-- battery — engine-level unit suites never exercise the RPC. The variable is
-- renamed v_mutation_id; the pinned search_path keeps the extensions
-- qualification introduced in 000900.
begin;

create or replace function public.sync_push(p_device_id text, p_mutations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  actor uuid := auth.uid();
  mutation jsonb;
  receipt jsonb;
  current_record public.sync_records;
  saved_record public.sync_records;
  v_mutation_id text;
  entity_type_value text;
  record_id_value text;
  operation_value text;
  scope_type_value text;
  scope_id_value uuid;
  base_revision_value bigint;
  payload_value jsonb;
  result_value jsonb;
  remote_value jsonb;
  accepted jsonb := '[]'::jsonb;
  conflicts jsonb := '[]'::jsonb;
  reason_value text;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_mutations) <> 'array' or jsonb_array_length(p_mutations) > 100 then
    raise exception 'invalid_mutation_batch';
  end if;
  if not exists (
    select 1 from public.sync_devices
    where id = p_device_id and user_id = actor and revoked_at is null
  ) then raise exception 'device_revoked'; end if;

  update public.sync_devices set last_seen_at = now()
  where id = p_device_id and user_id = actor;

  for mutation in select value from jsonb_array_elements(p_mutations) loop
    -- PL/pgSQL record variables can otherwise retain data across loop iterations
    -- when a later lookup finds no row. Reset every working value explicitly.
    receipt := null;
    current_record := null;
    saved_record := null;
    remote_value := null;
    result_value := null;
    reason_value := null;

    if public.sync_payload_has_forbidden_key(mutation) then
      raise exception 'secret_field_forbidden';
    end if;
    v_mutation_id := mutation ->> 'mutationId';
    if v_mutation_id is null or char_length(v_mutation_id) not between 1 and 100 then
      raise exception 'invalid_mutation';
    end if;

    select smr.result into receipt
    from public.sync_mutation_receipts smr
    where smr.mutation_id = v_mutation_id and smr.actor_id = actor;
    if receipt is not null then
      if receipt ->> 'kind' = 'accepted' then
        accepted := accepted || jsonb_build_array(receipt -> 'value');
      else
        conflicts := conflicts || jsonb_build_array(receipt -> 'value');
      end if;
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
    scope_id_value := case
      when scope_type_value = 'personal' then actor
      else nullif(mutation #>> '{scope,id}', '')::uuid
    end;
    payload_value := mutation -> 'payload';
    base_revision_value := case
      when mutation ? 'baseRevision' and mutation -> 'baseRevision' <> 'null'::jsonb
      then (mutation ->> 'baseRevision')::bigint
      else null
    end;

    if entity_type_value not in ('profile', 'pantry_item', 'saved_recipe', 'cook_history', 'shopping_item', 'meal_plan_entry')
      or operation_value not in ('upsert', 'delete')
      or record_id_value is null or char_length(record_id_value) not between 1 and 180
      or scope_id_value is null
      or not public.can_write_kitchen_scope(scope_type_value, scope_id_value)
    then raise exception 'invalid_mutation'; end if;
    if operation_value = 'upsert' and (payload_value is null or payload_value = 'null'::jsonb) then
      raise exception 'invalid_mutation';
    end if;
    if operation_value = 'delete' then payload_value := null; end if;

    select * into current_record
    from public.sync_records
    where scope_type = scope_type_value
      and scope_id = scope_id_value
      and entity_type = entity_type_value
      and record_id = record_id_value
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
      remote_value := case
        when current_record.record_id is not null then public.sync_record_json(current_record)
        else jsonb_build_object(
          'entityType', entity_type_value,
          'recordId', record_id_value,
          'scope', jsonb_build_object('type', scope_type_value, 'id', scope_id_value::text),
          'schemaVersion', 1,
          'revision', 0,
          'deviceId', 'server-compacted',
          'payload', null,
          'payloadHash', encode(digest('null', 'sha256'), 'hex'),
          'createdAt', now(),
          'updatedAt', now(),
          'deletedAt', now(),
          'changeSequence', 0
        )
      end;
      result_value := jsonb_build_object(
        'id', gen_random_uuid()::text,
        'mutation', mutation,
        'remote', remote_value,
        'reason', reason_value,
        'createdAt', now()
      );
      conflicts := conflicts || jsonb_build_array(result_value);
      insert into public.sync_mutation_receipts(mutation_id, actor_id, device_id, result)
      values (v_mutation_id, actor, p_device_id, jsonb_build_object('kind', 'conflict', 'value', result_value));
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

    result_value := jsonb_build_object(
      'mutationId', v_mutation_id,
      'record', public.sync_record_json(saved_record)
    );
    accepted := accepted || jsonb_build_array(result_value);
    insert into public.sync_mutation_receipts(mutation_id, actor_id, device_id, result)
    values (v_mutation_id, actor, p_device_id, jsonb_build_object('kind', 'accepted', 'value', result_value));
  end loop;

  return jsonb_build_object('accepted', accepted, 'conflicts', conflicts);
end;
$$;

commit;

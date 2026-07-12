-- Phase 6.5: harden publication-candidate claiming.
--
-- Previously claim_publication_candidate only SELECTed the row (no status
-- transition, no token): two operators could both "claim" a candidate and
-- open duplicate GitHub PRs, and a crashed operator left no recoverable
-- state. This migration makes claiming an atomic ready->claimed transition
-- guarded by a single-use random token with an expiry, requires that token
-- to record the PR, and adds expired-claim recovery.
begin;

alter table public.publication_candidates
  add column if not exists claim_token_hash text,
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_expires_at timestamptz;

alter table public.publication_candidates
  drop constraint if exists publication_candidates_status_check;
alter table public.publication_candidates
  add constraint publication_candidates_status_check
  check (status in ('ready', 'claimed', 'pr_open', 'published', 'cancelled'));

create or replace function public.claim_publication_candidate(p_candidate_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  candidate public.publication_candidates;
  claim_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not public.is_service_role() then raise exception 'service_role_required'; end if;

  -- Self-heal: a claim whose holder crashed becomes reclaimable after expiry.
  update public.publication_candidates
     set status = 'ready', claim_token_hash = null, claimed_at = null,
         claim_expires_at = null, updated_at = now()
   where id = p_candidate_id and status = 'claimed' and claim_expires_at < now();

  -- Atomic transition: exactly one concurrent caller can win this UPDATE.
  update public.publication_candidates
     set status = 'claimed',
         claim_token_hash = encode(extensions.digest(claim_token, 'sha256'), 'hex'),
         claimed_at = now(),
         claim_expires_at = now() + interval '30 minutes',
         updated_at = now()
   where id = p_candidate_id and status = 'ready'
   returning * into candidate;

  if candidate.id is null then
    if exists (select 1 from public.publication_candidates where id = p_candidate_id and status = 'claimed') then
      raise exception 'publication_candidate_already_claimed';
    end if;
    raise exception 'publication_candidate_not_ready';
  end if;

  return jsonb_build_object(
    'id', candidate.id::text,
    'submissionId', candidate.submission_id::text,
    'versionId', candidate.version_id::text,
    'contentHash', candidate.content_hash,
    'canonicalSlug', candidate.canonical_slug,
    'candidateJson', candidate.candidate_json,
    'status', candidate.status,
    'claimToken', claim_token,
    'claimExpiresAt', candidate.claim_expires_at,
    'createdAt', candidate.created_at
  );
end;
$$;

-- The signature changes (claim token now required), so drop the old surface.
drop function if exists public.mark_publication_candidate_pr(uuid, text);

create or replace function public.mark_publication_candidate_pr(
  p_candidate_id uuid,
  p_github_pr_url text,
  p_claim_token text
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare candidate public.publication_candidates; submission public.recipe_submissions;
begin
  if not public.is_service_role() then raise exception 'service_role_required'; end if;
  if p_github_pr_url !~ '^https://github.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+$' then raise exception 'invalid_github_pr_url'; end if;
  if p_claim_token is null or length(p_claim_token) < 32 then raise exception 'claim_token_required'; end if;

  update public.publication_candidates
     set status = 'pr_open', github_pr_url = p_github_pr_url,
         claim_token_hash = null, updated_at = now()
   where id = p_candidate_id
     and status = 'claimed'
     and claim_expires_at >= now()
     and claim_token_hash = encode(extensions.digest(p_claim_token, 'sha256'), 'hex')
   returning * into candidate;

  if candidate.id is null then
    if exists (select 1 from public.publication_candidates
               where id = p_candidate_id and status = 'claimed' and claim_expires_at < now()) then
      raise exception 'claim_expired';
    end if;
    if exists (select 1 from public.publication_candidates where id = p_candidate_id and status = 'claimed') then
      raise exception 'claim_token_mismatch';
    end if;
    raise exception 'publication_candidate_not_claimed';
  end if;

  update public.recipe_submissions set status = 'publication_pr_open', updated_at = now()
    where id = candidate.submission_id returning * into submission;
  insert into public.contribution_status_events(submission_id, from_status, to_status, actor_id, actor_role, reason)
  values (submission.id, 'publication_candidate', 'publication_pr_open', null, 'system', left(p_github_pr_url, 1000));
  return jsonb_build_object('ok', true, 'prUrl', p_github_pr_url);
end;
$$;

-- Operator janitor: bulk-recover expired claims (also happens lazily per-row
-- inside claim_publication_candidate).
create or replace function public.recover_expired_publication_claims()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare recovered integer;
begin
  if not public.is_service_role() then raise exception 'service_role_required'; end if;
  update public.publication_candidates
     set status = 'ready', claim_token_hash = null, claimed_at = null,
         claim_expires_at = null, updated_at = now()
   where status = 'claimed' and claim_expires_at < now();
  get diagnostics recovered = row_count;
  return jsonb_build_object('ok', true, 'recovered', recovered);
end;
$$;

revoke all on function public.claim_publication_candidate(uuid) from public;
grant execute on function public.claim_publication_candidate(uuid) to service_role;
revoke all on function public.mark_publication_candidate_pr(uuid, text, text) from public;
grant execute on function public.mark_publication_candidate_pr(uuid, text, text) to service_role;
revoke all on function public.recover_expired_publication_claims() from public;
grant execute on function public.recover_expired_publication_claims() to service_role;

commit;

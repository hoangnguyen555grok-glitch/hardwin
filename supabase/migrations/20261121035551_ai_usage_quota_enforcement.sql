create table if not exists private.ai_request_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  reserved_tokens integer not null check (reserved_tokens > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  unique (user_id, request_id)
);
create index if not exists ai_request_reservations_user_created_idx
  on private.ai_request_reservations (user_id, created_at);
revoke all on private.ai_request_reservations from public, anon, authenticated;

create unique index if not exists usage_ledger_user_request_uidx
  on public.usage_ledger (user_id, request_id) where request_id is not null;

create or replace function public.geed_reserve_ai_request(
  p_user_id uuid, p_request_id uuid, p_reserved_tokens integer
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  entitlement public.entitlements%rowtype;
  month_start timestamptz := pg_catalog.date_trunc('month', pg_catalog.now());
  used_requests bigint := 0;
  used_tokens bigint := 0;
  pending_requests bigint := 0;
  pending_tokens bigint := 0;
begin
  if p_user_id is null or p_request_id is null or p_reserved_tokens is null
     or p_reserved_tokens < 1 or p_reserved_tokens > 100000 then
    return pg_catalog.jsonb_build_object('allowed', false, 'code', 'INVALID_RESERVATION');
  end if;

  select * into entitlement from public.entitlements
  where user_id = p_user_id for update;

  if not found then return pg_catalog.jsonb_build_object('allowed', false, 'code', 'NO_ENTITLEMENT'); end if;
  if entitlement.status <> 'active' then return pg_catalog.jsonb_build_object('allowed', false, 'code', 'ACCOUNT_NOT_ACTIVE'); end if;
  if not entitlement.ai_access_enabled then return pg_catalog.jsonb_build_object('allowed', false, 'code', 'AI_DISABLED'); end if;
  if entitlement.monthly_ai_request_limit < 1 or entitlement.monthly_ai_token_limit < 1 then
    return pg_catalog.jsonb_build_object('allowed', false, 'code', 'QUOTA_NOT_CONFIGURED');
  end if;

  delete from private.ai_request_reservations
  where user_id = p_user_id and expires_at <= pg_catalog.now();

  select count(*), coalesce(sum(input_tokens + output_tokens), 0)
    into used_requests, used_tokens
  from public.usage_ledger
  where user_id = p_user_id and created_at >= month_start;

  select count(*), coalesce(sum(reserved_tokens), 0)
    into pending_requests, pending_tokens
  from private.ai_request_reservations
  where user_id = p_user_id and created_at >= month_start;

  if used_requests + pending_requests >= entitlement.monthly_ai_request_limit then
    return pg_catalog.jsonb_build_object('allowed', false, 'code', 'REQUEST_QUOTA_EXCEEDED',
      'requests_used', used_requests + pending_requests, 'request_limit', entitlement.monthly_ai_request_limit);
  end if;

  if used_tokens + pending_tokens + p_reserved_tokens > entitlement.monthly_ai_token_limit then
    return pg_catalog.jsonb_build_object('allowed', false, 'code', 'TOKEN_QUOTA_EXCEEDED',
      'tokens_used', used_tokens + pending_tokens, 'tokens_requested', p_reserved_tokens,
      'token_limit', entitlement.monthly_ai_token_limit);
  end if;

  insert into private.ai_request_reservations (user_id, request_id, reserved_tokens)
  values (p_user_id, p_request_id, p_reserved_tokens);

  return pg_catalog.jsonb_build_object('allowed', true,
    'requests_used', used_requests + pending_requests + 1,
    'request_limit', entitlement.monthly_ai_request_limit,
    'tokens_reserved', used_tokens + pending_tokens + p_reserved_tokens,
    'token_limit', entitlement.monthly_ai_token_limit);
exception when unique_violation then
  return pg_catalog.jsonb_build_object('allowed', false, 'code', 'DUPLICATE_REQUEST');
end;
$$;

create or replace function public.geed_finalize_ai_request(
  p_user_id uuid, p_request_id uuid, p_provider text, p_model text, p_task_type text,
  p_input_tokens integer, p_output_tokens integer, p_actual_cost_usd numeric,
  p_cost_status text, p_outcome text
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if p_user_id is null or p_request_id is null
     or p_provider is null or pg_catalog.char_length(p_provider) > 40
     or p_model is null or pg_catalog.char_length(p_model) > 120
     or p_task_type not in ('general', 'coding', 'reasoning', 'creative')
     or p_input_tokens is null or p_input_tokens < 0
     or p_output_tokens is null or p_output_tokens < 0
     or p_cost_status not in ('unknown', 'estimated', 'actual')
     or p_outcome not in ('success', 'provider_error', 'uncertain', 'rejected') then
    return false;
  end if;
  if p_actual_cost_usd is null and p_cost_status <> 'unknown' then return false; end if;
  if p_actual_cost_usd is not null and (p_actual_cost_usd < 0 or p_cost_status = 'unknown') then return false; end if;

  insert into public.usage_ledger (
    user_id, request_id, provider, model, task_type, input_tokens, output_tokens,
    actual_cost_usd, cost_status, outcome
  ) values (
    p_user_id, p_request_id, p_provider, p_model, p_task_type, p_input_tokens,
    p_output_tokens, p_actual_cost_usd, p_cost_status, p_outcome
  )
  on conflict (user_id, request_id) where request_id is not null
  do update set provider=excluded.provider, model=excluded.model, task_type=excluded.task_type,
    input_tokens=excluded.input_tokens, output_tokens=excluded.output_tokens,
    actual_cost_usd=excluded.actual_cost_usd, cost_status=excluded.cost_status,
    outcome=excluded.outcome;

  delete from private.ai_request_reservations
  where user_id=p_user_id and request_id=p_request_id;
  return true;
end;
$$;

revoke all on function public.geed_reserve_ai_request(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.geed_finalize_ai_request(uuid, uuid, text, text, text, integer, integer, numeric, text, text) from public, anon, authenticated;
grant execute on function public.geed_reserve_ai_request(uuid, uuid, integer) to service_role;
grant execute on function public.geed_finalize_ai_request(uuid, uuid, text, text, text, integer, integer, numeric, text, text) to service_role;

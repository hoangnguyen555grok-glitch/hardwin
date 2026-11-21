alter table public.usage_ledger
  add column if not exists estimated_cost_usd numeric(14, 8)
  check (estimated_cost_usd is null or estimated_cost_usd >= 0);

alter table public.usage_ledger
  add constraint usage_ledger_cost_fields_match_status
  check (
    (cost_status = 'unknown' and actual_cost_usd is null and estimated_cost_usd is null)
    or (cost_status = 'estimated' and actual_cost_usd is null and estimated_cost_usd is not null)
    or (cost_status = 'actual' and actual_cost_usd is not null and estimated_cost_usd is null)
  );

drop function if exists public.geed_finalize_ai_request(uuid, uuid, text, text, text, integer, integer, numeric, text, text);

create or replace function public.geed_finalize_ai_request(
  p_user_id uuid, p_request_id uuid, p_provider text, p_model text, p_task_type text,
  p_input_tokens integer, p_output_tokens integer, p_actual_cost_usd numeric,
  p_estimated_cost_usd numeric, p_cost_status text, p_outcome text
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if p_user_id is null or p_request_id is null
     or p_provider is null or pg_catalog.char_length(p_provider) not between 1 and 40
     or p_model is null or pg_catalog.char_length(p_model) not between 1 and 120
     or p_task_type is null or p_task_type not in ('general', 'coding', 'reasoning', 'creative')
     or p_input_tokens is null or p_input_tokens < 0
     or p_output_tokens is null or p_output_tokens < 0
     or p_cost_status is null or p_cost_status not in ('unknown', 'estimated', 'actual')
     or p_outcome is null or p_outcome not in ('success', 'provider_error', 'uncertain', 'rejected') then
    return false;
  end if;

  if p_cost_status = 'unknown' and (p_actual_cost_usd is not null or p_estimated_cost_usd is not null) then return false; end if;
  if p_cost_status = 'estimated' and (p_actual_cost_usd is not null or p_estimated_cost_usd is null or p_estimated_cost_usd < 0) then return false; end if;
  if p_cost_status = 'actual' and (p_actual_cost_usd is null or p_actual_cost_usd < 0 or p_estimated_cost_usd is not null) then return false; end if;

  insert into public.usage_ledger (
    user_id, request_id, provider, model, task_type, input_tokens, output_tokens,
    actual_cost_usd, estimated_cost_usd, cost_status, outcome
  ) values (
    p_user_id, p_request_id, p_provider, p_model, p_task_type, p_input_tokens,
    p_output_tokens, p_actual_cost_usd, p_estimated_cost_usd, p_cost_status, p_outcome
  )
  on conflict (user_id, request_id) where request_id is not null
  do update set provider=excluded.provider, model=excluded.model, task_type=excluded.task_type,
    input_tokens=excluded.input_tokens, output_tokens=excluded.output_tokens,
    actual_cost_usd=excluded.actual_cost_usd, estimated_cost_usd=excluded.estimated_cost_usd,
    cost_status=excluded.cost_status, outcome=excluded.outcome;

  delete from private.ai_request_reservations
  where user_id=p_user_id and request_id=p_request_id;
  return true;
end;
$$;

revoke all on function public.geed_finalize_ai_request(uuid, uuid, text, text, text, integer, integer, numeric, numeric, text, text) from public, anon, authenticated;
grant execute on function public.geed_finalize_ai_request(uuid, uuid, text, text, text, integer, integer, numeric, numeric, text, text) to service_role;

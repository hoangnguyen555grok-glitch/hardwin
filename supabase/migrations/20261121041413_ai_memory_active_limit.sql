create or replace function private.enforce_ai_memory_active_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_count bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  select count(*) into active_count
  from public.ai_memories
  where user_id = new.user_id
    and expires_at > pg_catalog.now();

  if active_count >= 20 then
    raise exception 'AI memory limit reached. Delete an existing memory or wait for expiry.'
      using errcode = '54000';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_ai_memory_active_limit() from public, anon, authenticated;

drop trigger if exists ai_memories_enforce_active_limit on public.ai_memories;
create trigger ai_memories_enforce_active_limit
before insert on public.ai_memories
for each row execute function private.enforce_ai_memory_active_limit();

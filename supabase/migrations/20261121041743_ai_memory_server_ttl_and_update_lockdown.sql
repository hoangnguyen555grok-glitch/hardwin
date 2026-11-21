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

  delete from public.ai_memories
  where user_id = new.user_id
    and expires_at <= pg_catalog.now();

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

create or replace function private.set_ai_memory_expiry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.created_at := pg_catalog.now();
  new.updated_at := new.created_at;
  new.expires_at := new.created_at + pg_catalog.make_interval(days => new.retention_days);
  return new;
end;
$$;

revoke all on function private.enforce_ai_memory_active_limit() from public, anon, authenticated;
revoke all on function private.set_ai_memory_expiry() from public, anon, authenticated;

drop trigger if exists ai_memories_set_expiry on public.ai_memories;
create trigger ai_memories_set_expiry
before insert on public.ai_memories
for each row execute function private.set_ai_memory_expiry();

revoke update on public.ai_memories from authenticated;
grant select, insert, delete on public.ai_memories to authenticated;
drop policy if exists ai_memories_update_own on public.ai_memories;

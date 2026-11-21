create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.cleanup_expired_ai_memories()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count bigint;
begin
  delete from public.ai_memories
  where expires_at <= pg_catalog.now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function private.cleanup_expired_ai_memories() from public, anon, authenticated;

drop policy if exists ai_memories_select_own on public.ai_memories;
create policy ai_memories_select_own on public.ai_memories
for select to authenticated
using ((select auth.uid()) = user_id and expires_at > (select pg_catalog.now()));

select cron.schedule(
  'geed-hardwin-clean-expired-ai-memories',
  '17 3 * * *',
  'select private.cleanup_expired_ai_memories();'
);

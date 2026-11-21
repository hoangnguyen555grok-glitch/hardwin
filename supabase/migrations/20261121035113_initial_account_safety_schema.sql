create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 100),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  locale text not null default 'vi-VN' check (char_length(locale) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'studio')),
  status text not null default 'active' check (status in ('active', 'grace', 'expired', 'suspended')),
  ai_access_enabled boolean not null default false,
  monthly_ai_request_limit integer not null default 0 check (monthly_ai_request_limit >= 0),
  monthly_ai_token_limit integer not null default 0 check (monthly_ai_token_limit >= 0),
  cloud_storage_limit_bytes bigint not null default 0 check (cloud_storage_limit_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid,
  provider text not null check (char_length(provider) <= 40),
  model text not null check (char_length(model) <= 120),
  task_type text not null default 'general' check (task_type in ('general', 'coding', 'reasoning', 'creative')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  actual_cost_usd numeric(14, 8) not null default 0 check (actual_cost_usd >= 0),
  outcome text not null default 'success' check (outcome in ('success', 'provider_error', 'rejected', 'uncertain')),
  created_at timestamptz not null default now()
);

create index if not exists usage_ledger_user_created_idx on public.usage_ledger (user_id, created_at desc);
create index if not exists usage_ledger_request_idx on public.usage_ledger (request_id) where request_id is not null;

create table if not exists public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_key text check (project_key is null or char_length(project_key) <= 160),
  memory_type text not null default 'context' check (memory_type in ('context', 'task', 'preference', 'checkpoint')),
  content text not null check (char_length(content) between 1 and 8000),
  retention_days integer not null check (retention_days in (2, 3, 7, 30)),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at <= created_at + make_interval(days => retention_days) + interval '1 minute')
);

create index if not exists ai_memories_expiry_idx on public.ai_memories (expires_at);
create index if not exists ai_memories_user_project_idx on public.ai_memories (user_id, project_key, expires_at);

create table if not exists public.project_metadata (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_project_key text not null check (char_length(local_project_key) between 1 and 160),
  name text not null check (char_length(name) between 1 and 160),
  summary text check (summary is null or char_length(summary) <= 8000),
  schema_version integer check (schema_version is null or schema_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_project_key)
);

create index if not exists project_metadata_user_updated_idx on public.project_metadata (user_id, updated_at desc);

create or replace function private.set_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 100),
    left(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''), 2048)
  )
  on conflict (user_id) do nothing;
  insert into public.entitlements (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
drop trigger if exists entitlements_set_updated_at on public.entitlements;
create trigger entitlements_set_updated_at before update on public.entitlements for each row execute function private.set_updated_at();
drop trigger if exists ai_memories_set_updated_at on public.ai_memories;
create trigger ai_memories_set_updated_at before update on public.ai_memories for each row execute function private.set_updated_at();
drop trigger if exists project_metadata_set_updated_at on public.project_metadata;
create trigger project_metadata_set_updated_at before update on public.project_metadata for each row execute function private.set_updated_at();

drop trigger if exists on_auth_user_created_geed on auth.users;
create trigger on_auth_user_created_geed after insert on auth.users for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.entitlements enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.ai_memories enable row level security;
alter table public.project_metadata enable row level security;

revoke all on public.profiles, public.entitlements, public.usage_ledger, public.ai_memories, public.project_metadata from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.entitlements, public.usage_ledger to authenticated;
grant select, insert, update, delete on public.ai_memories, public.project_metadata to authenticated;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "entitlements_select_own" on public.entitlements for select to authenticated using ((select auth.uid()) = user_id);
create policy "usage_ledger_select_own" on public.usage_ledger for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_memories_select_own" on public.ai_memories for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_memories_insert_own" on public.ai_memories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ai_memories_update_own" on public.ai_memories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ai_memories_delete_own" on public.ai_memories for delete to authenticated using ((select auth.uid()) = user_id);
create policy "project_metadata_select_own" on public.project_metadata for select to authenticated using ((select auth.uid()) = user_id);
create policy "project_metadata_insert_own" on public.project_metadata for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "project_metadata_update_own" on public.project_metadata for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "project_metadata_delete_own" on public.project_metadata for delete to authenticated using ((select auth.uid()) = user_id);

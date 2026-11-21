-- Geed Hardwin Cloud Workspace v1.
-- Large project snapshots live in a private object store. PostgreSQL keeps ownership,
-- object pointers, versions and quota accounting only.

alter table public.project_metadata
  add column if not exists cloud_object_key text,
  add column if not exists cloud_size_bytes bigint not null default 0,
  add column if not exists cloud_sha256 text,
  add column if not exists cloud_version integer not null default 0,
  add column if not exists cloud_saved_at timestamptz;

alter table public.project_metadata
  drop constraint if exists project_metadata_cloud_size_nonnegative,
  add constraint project_metadata_cloud_size_nonnegative check (cloud_size_bytes >= 0),
  drop constraint if exists project_metadata_cloud_version_nonnegative,
  add constraint project_metadata_cloud_version_nonnegative check (cloud_version >= 0),
  drop constraint if exists project_metadata_cloud_sha256_format,
  add constraint project_metadata_cloud_sha256_format
    check (cloud_sha256 is null or cloud_sha256 ~ '^[0-9a-f]{64}$');

create unique index if not exists project_metadata_cloud_object_key_uidx
  on public.project_metadata (cloud_object_key)
  where cloud_object_key is not null;

create index if not exists project_metadata_cloud_user_saved_idx
  on public.project_metadata (user_id, cloud_saved_at desc)
  where cloud_object_key is not null;

-- The browser may list its own project metadata, but all writes that affect cloud
-- object pointers and storage accounting must pass through the authenticated server.
revoke insert, update, delete on public.project_metadata from authenticated;
grant select on public.project_metadata to authenticated;

create table if not exists private.cloud_storage_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_project_key text not null,
  requested_bytes bigint not null check (requested_bytes > 0),
  previous_bytes bigint not null default 0 check (previous_bytes >= 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  unique (user_id, local_project_key)
);

alter table private.cloud_storage_reservations enable row level security;
revoke all on private.cloud_storage_reservations from public, anon, authenticated, service_role;

create or replace function public.geed_reserve_cloud_storage(
  p_user_id uuid,
  p_local_project_key text,
  p_requested_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit bigint;
  v_used bigint;
  v_previous bigint;
  v_pending bigint;
  v_reservation_id uuid;
begin
  if p_user_id is null
     or p_local_project_key is null
     or p_local_project_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_requested_bytes is null
     or p_requested_bytes < 2
     or p_requested_bytes > 104857600 then
    return pg_catalog.jsonb_build_object('allowed', false, 'code', 'INVALID_CLOUD_RESERVATION');
  end if;

  delete from private.cloud_storage_reservations
   where expires_at <= pg_catalog.now();

  select e.cloud_storage_limit_bytes
    into v_limit
    from public.entitlements e
   where e.user_id = p_user_id
     and e.status = 'active'
   for update;

  if not found or coalesce(v_limit, 0) <= 0 then
    return pg_catalog.jsonb_build_object('allowed', false, 'code', 'CLOUD_STORAGE_NOT_ALLOWED');
  end if;

  if exists (
    select 1 from private.cloud_storage_reservations r
     where r.user_id = p_user_id
       and r.local_project_key = p_local_project_key
  ) then
    return pg_catalog.jsonb_build_object('allowed', false, 'code', 'CLOUD_PROJECT_SAVE_IN_PROGRESS');
  end if;

  select coalesce(pg_catalog.sum(m.cloud_size_bytes), 0)
    into v_used
    from public.project_metadata m
   where m.user_id = p_user_id
     and m.cloud_object_key is not null;

  select coalesce(m.cloud_size_bytes, 0)
    into v_previous
    from public.project_metadata m
   where m.user_id = p_user_id
     and m.local_project_key = p_local_project_key
     and m.cloud_object_key is not null;
  if not found then
    v_previous := 0;
  end if;

  select coalesce(pg_catalog.sum(greatest(r.requested_bytes - r.previous_bytes, 0)), 0)
    into v_pending
    from private.cloud_storage_reservations r
   where r.user_id = p_user_id
     and r.expires_at > pg_catalog.now();

  if v_used + v_pending + greatest(p_requested_bytes - v_previous, 0) > v_limit then
    return pg_catalog.jsonb_build_object(
      'allowed', false,
      'code', 'CLOUD_STORAGE_QUOTA_EXCEEDED',
      'used_bytes', v_used,
      'limit_bytes', v_limit
    );
  end if;

  insert into private.cloud_storage_reservations (
    user_id, local_project_key, requested_bytes, previous_bytes
  ) values (
    p_user_id, p_local_project_key, p_requested_bytes, v_previous
  )
  returning id into v_reservation_id;

  return pg_catalog.jsonb_build_object(
    'allowed', true,
    'reservation_id', v_reservation_id,
    'used_bytes', v_used,
    'limit_bytes', v_limit
  );
end;
$$;

create or replace function public.geed_finalize_cloud_storage(
  p_reservation_id uuid,
  p_user_id uuid,
  p_local_project_key text,
  p_name text,
  p_schema_version integer,
  p_object_key text,
  p_uploaded_bytes bigint,
  p_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation private.cloud_storage_reservations%rowtype;
  v_project public.project_metadata%rowtype;
begin
  if p_reservation_id is null
     or p_user_id is null
     or p_local_project_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_name is null or pg_catalog.char_length(p_name) < 1 or pg_catalog.char_length(p_name) > 160
     or p_schema_version is null or p_schema_version < 1
     or p_uploaded_bytes is null or p_uploaded_bytes < 2 or p_uploaded_bytes > 104857600
     or p_sha256 is null or p_sha256 !~* '^[0-9a-f]{64}
     or p_object_key is null
     or p_object_key <> p_user_id::text || '/' || p_local_project_key || '/project.json' then
    return pg_catalog.jsonb_build_object('saved', false, 'code', 'INVALID_CLOUD_FINALIZATION');
  end if;

  select r.*
    into v_reservation
    from private.cloud_storage_reservations r
   where r.id = p_reservation_id
     and r.user_id = p_user_id
     and r.local_project_key = p_local_project_key
     and r.expires_at > pg_catalog.now()
   for update;

  if not found or v_reservation.requested_bytes <> p_uploaded_bytes then
    return pg_catalog.jsonb_build_object('saved', false, 'code', 'CLOUD_RESERVATION_EXPIRED_OR_MISMATCHED');
  end if;

  insert into public.project_metadata (
    user_id, local_project_key, name, schema_version,
    cloud_object_key, cloud_size_bytes, cloud_sha256, cloud_version, cloud_saved_at
  ) values (
    p_user_id, p_local_project_key, p_name, p_schema_version,
    p_object_key, p_uploaded_bytes, pg_catalog.lower(p_sha256), 1, pg_catalog.now()
  )
  on conflict (user_id, local_project_key) do update
    set name = excluded.name,
        schema_version = excluded.schema_version,
        cloud_object_key = excluded.cloud_object_key,
        cloud_size_bytes = excluded.cloud_size_bytes,
        cloud_sha256 = excluded.cloud_sha256,
        cloud_version = public.project_metadata.cloud_version + 1,
        cloud_saved_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
  returning * into v_project;

  delete from private.cloud_storage_reservations where id = p_reservation_id;

  return pg_catalog.jsonb_build_object(
    'saved', true,
    'project', pg_catalog.to_jsonb(v_project)
  );
end;
$$;

create or replace function public.geed_cancel_cloud_storage(
  p_reservation_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from private.cloud_storage_reservations
   where id = p_reservation_id and user_id = p_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;


create or replace function public.geed_delete_cloud_project(
  p_user_id uuid,
  p_local_project_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $
declare
  v_deleted integer;
begin
  if p_user_id is null
     or p_local_project_key is null
     or p_local_project_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.geed_finalize_cloud_storage(uuid, uuid, text, text, integer, text, bigint, text) from public, anon, authenticated;
revoke all on function public.geed_cancel_cloud_storage(uuid, uuid) from public, anon, authenticated;
revoke all on function public.geed_delete_cloud_project(uuid, text) from public, anon, authenticated;
grant execute on function public.geed_reserve_cloud_storage(uuid, text, bigint) to service_role;
grant execute on function public.geed_finalize_cloud_storage(uuid, uuid, text, text, integer, text, bigint, text) to service_role;
grant execute on function public.geed_cancel_cloud_storage(uuid, uuid) to service_role;
grant execute on function public.geed_delete_cloud_project(uuid, text) to service_role;

     or p_object_key <> p_user_id::text || '/' || p_local_project_key || '/project.json' then
    return pg_catalog.jsonb_build_object('saved', false, 'code', 'INVALID_CLOUD_FINALIZATION');
  end if;

  select r.*
    into v_reservation
    from private.cloud_storage_reservations r
   where r.id = p_reservation_id
     and r.user_id = p_user_id
     and r.local_project_key = p_local_project_key
     and r.expires_at > pg_catalog.now()
   for update;

  if not found or v_reservation.requested_bytes <> p_uploaded_bytes then
    return pg_catalog.jsonb_build_object('saved', false, 'code', 'CLOUD_RESERVATION_EXPIRED_OR_MISMATCHED');
  end if;

  insert into public.project_metadata (
    user_id, local_project_key, name, schema_version,
    cloud_object_key, cloud_size_bytes, cloud_sha256, cloud_version, cloud_saved_at
  ) values (
    p_user_id, p_local_project_key, p_name, p_schema_version,
    p_object_key, p_uploaded_bytes, pg_catalog.lower(p_sha256), 1, pg_catalog.now()
  )
  on conflict (user_id, local_project_key) do update
    set name = excluded.name,
        schema_version = excluded.schema_version,
        cloud_object_key = excluded.cloud_object_key,
        cloud_size_bytes = excluded.cloud_size_bytes,
        cloud_sha256 = excluded.cloud_sha256,
        cloud_version = public.project_metadata.cloud_version + 1,
        cloud_saved_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
  returning * into v_project;

  delete from private.cloud_storage_reservations where id = p_reservation_id;

  return pg_catalog.jsonb_build_object(
    'saved', true,
    'project', pg_catalog.to_jsonb(v_project)
  );
end;
$$;

create or replace function public.geed_cancel_cloud_storage(
  p_reservation_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from private.cloud_storage_reservations
   where id = p_reservation_id and user_id = p_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;

revoke all on function public.geed_reserve_cloud_storage(uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.geed_finalize_cloud_storage(uuid, uuid, text, text, integer, text, bigint, text) from public, anon, authenticated;
revoke all on function public.geed_cancel_cloud_storage(uuid, uuid) from public, anon, authenticated;
grant execute on function public.geed_reserve_cloud_storage(uuid, text, bigint) to service_role;
grant execute on function public.geed_finalize_cloud_storage(uuid, uuid, text, text, integer, text, bigint, text) to service_role;
grant execute on function public.geed_cancel_cloud_storage(uuid, uuid) to service_role;
 then
    return false;
  end if;

  delete from public.project_metadata
   where user_id = p_user_id
     and local_project_key = p_local_project_key
     and cloud_object_key = p_user_id::text || '/' || p_local_project_key || '/project.json';
  get diagnostics v_deleted = row_count;
  delete from private.cloud_storage_reservations
   where user_id = p_user_id and local_project_key = p_local_project_key;
  return v_deleted = 1;
end;
$;

revoke all on function public.geed_reserve_cloud_storage(uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.geed_finalize_cloud_storage(uuid, uuid, text, text, integer, text, bigint, text) from public, anon, authenticated;
revoke all on function public.geed_cancel_cloud_storage(uuid, uuid) from public, anon, authenticated;
grant execute on function public.geed_reserve_cloud_storage(uuid, text, bigint) to service_role;
grant execute on function public.geed_finalize_cloud_storage(uuid, uuid, text, text, integer, text, bigint, text) to service_role;
grant execute on function public.geed_cancel_cloud_storage(uuid, uuid) to service_role;

     or p_object_key <> p_user_id::text || '/' || p_local_project_key || '/project.json' then
    return pg_catalog.jsonb_build_object('saved', false, 'code', 'INVALID_CLOUD_FINALIZATION');
  end if;

  select r.*
    into v_reservation
    from private.cloud_storage_reservations r
   where r.id = p_reservation_id
     and r.user_id = p_user_id
     and r.local_project_key = p_local_project_key
     and r.expires_at > pg_catalog.now()
   for update;

  if not found or v_reservation.requested_bytes <> p_uploaded_bytes then
    return pg_catalog.jsonb_build_object('saved', false, 'code', 'CLOUD_RESERVATION_EXPIRED_OR_MISMATCHED');
  end if;

  insert into public.project_metadata (
    user_id, local_project_key, name, schema_version,
    cloud_object_key, cloud_size_bytes, cloud_sha256, cloud_version, cloud_saved_at
  ) values (
    p_user_id, p_local_project_key, p_name, p_schema_version,
    p_object_key, p_uploaded_bytes, pg_catalog.lower(p_sha256), 1, pg_catalog.now()
  )
  on conflict (user_id, local_project_key) do update
    set name = excluded.name,
        schema_version = excluded.schema_version,
        cloud_object_key = excluded.cloud_object_key,
        cloud_size_bytes = excluded.cloud_size_bytes,
        cloud_sha256 = excluded.cloud_sha256,
        cloud_version = public.project_metadata.cloud_version + 1,
        cloud_saved_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
  returning * into v_project;

  delete from private.cloud_storage_reservations where id = p_reservation_id;

  return pg_catalog.jsonb_build_object(
    'saved', true,
    'project', pg_catalog.to_jsonb(v_project)
  );
end;
$$;

create or replace function public.geed_cancel_cloud_storage(
  p_reservation_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from private.cloud_storage_reservations
   where id = p_reservation_id and user_id = p_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;

revoke all on function public.geed_reserve_cloud_storage(uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.geed_finalize_cloud_storage(uuid, uuid, text, text, integer, text, bigint, text) from public, anon, authenticated;
revoke all on function public.geed_cancel_cloud_storage(uuid, uuid) from public, anon, authenticated;
grant execute on function public.geed_reserve_cloud_storage(uuid, text, bigint) to service_role;
grant execute on function public.geed_finalize_cloud_storage(uuid, uuid, text, text, integer, text, bigint, text) to service_role;
grant execute on function public.geed_cancel_cloud_storage(uuid, uuid) to service_role;

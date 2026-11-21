create or replace function private.enforce_google_only_auth_provider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google' then
    raise exception 'Only Google sign-in is supported.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_google_only_auth_provider() from public, anon, authenticated;

drop trigger if exists geed_google_only_auth_provider on auth.users;
create trigger geed_google_only_auth_provider
before insert on auth.users
for each row execute function private.enforce_google_only_auth_provider();
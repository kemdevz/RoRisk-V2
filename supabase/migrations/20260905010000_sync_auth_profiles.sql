-- Passwords belong to Supabase Auth (auth.users) and are never copied into
-- public.rorisk_users. This trigger keeps the public profile in sync.
create or replace function public.sync_rorisk_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.rorisk_users (uuid, username, avatar_headshot, email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1),
      'Guest'
    ),
    '/default-avatar.png',
    new.email
  )
  on conflict (uuid) do update
  set username = excluded.username,
      email = excluded.email;
  return new;
end;
$$;

revoke all on function public.sync_rorisk_auth_profile() from public;

drop trigger if exists sync_rorisk_auth_profile on auth.users;
create trigger sync_rorisk_auth_profile
after insert or update of email, raw_user_meta_data on auth.users
for each row execute procedure public.sync_rorisk_auth_profile();

insert into public.rorisk_users (uuid, username, avatar_headshot, email)
select
  id,
  coalesce(
    nullif(raw_user_meta_data ->> 'username', ''),
    nullif(raw_user_meta_data ->> 'user_name', ''),
    nullif(raw_user_meta_data ->> 'full_name', ''),
    split_part(email, '@', 1),
    'Guest'
  ),
  '/default-avatar.png',
  email
from auth.users
on conflict (uuid) do update
set username = excluded.username,
    email = excluded.email;

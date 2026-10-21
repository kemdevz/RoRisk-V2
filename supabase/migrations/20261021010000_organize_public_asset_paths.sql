alter table public.rorisk_users
  alter column avatar_headshot set default '/assets/users/default-avatar.png';

update public.rorisk_users
set avatar_headshot = '/assets/users/default-avatar.png'
where avatar_headshot = '/default-avatar.png';

alter table public.rorisk_case_openings
  alter column avatar_headshot set default '/assets/users/default-avatar.png';

update public.rorisk_case_openings
set avatar_headshot = '/assets/users/default-avatar.png'
where avatar_headshot = '/default-avatar.png';

update public.rorisk_cases
set image_url = '/assets/welcome/welcome-chicken.4c912e1c.png'
where image_url = '/Welcome/welcome-chicken.4c912e1c.png';

update public.rorisk_battles
set players = replace(
  replace(
    players::text,
    '/default-avatar.png',
    '/assets/users/default-avatar.png'
  ),
  '/img/battles/risk-bot.png',
  '/assets/images/battles/risk-bot.png'
)::jsonb
where players::text like '%/default-avatar.png%'
   or players::text like '%/img/battles/risk-bot.png%';

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
    '/assets/users/default-avatar.png',
    new.email
  )
  on conflict (uuid) do update
  set username = excluded.username,
      email = excluded.email;
  return new;
end;
$$;

revoke all on function public.sync_rorisk_auth_profile() from public;

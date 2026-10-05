alter table public.rorisk_affiliates
  add column if not exists roblox_id bigint,
  add column if not exists username text,
  add column if not exists referred_users jsonb not null default '[]'::jsonb;

update public.rorisk_affiliates as affiliate
set roblox_id = users.roblox_id,
    username = users.username,
    updated_at = now()
from public.rorisk_users as users
where users.uuid = affiliate.user_uuid;

alter table public.rorisk_affiliates
  alter column username set not null;

create index if not exists rorisk_affiliates_roblox_id_idx
  on public.rorisk_affiliates (roblox_id)
  where roblox_id is not null;
create index if not exists rorisk_affiliates_username_idx
  on public.rorisk_affiliates (lower(username));

create or replace function public.refresh_rorisk_referred_users(p_referrer_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_referrer_uuid is null then
    return;
  end if;
  update public.rorisk_affiliates as owner
  set referred_users = coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'uuid', referred.user_uuid,
            'roblox_id', referred.roblox_id,
            'username', referred.username,
            'referred_at', referred.referred_at
          ) order by referred.referred_at desc nulls last
        )
        from public.rorisk_affiliates as referred
        where referred.referrer_user_uuid = p_referrer_uuid
      ), '[]'::jsonb),
      updated_at = now()
  where owner.user_uuid = p_referrer_uuid;
end;
$$;

do $$
declare
  v_referrer uuid;
begin
  for v_referrer in
    select distinct referrer_user_uuid
    from public.rorisk_affiliates
    where referrer_user_uuid is not null
  loop
    perform public.refresh_rorisk_referred_users(v_referrer);
  end loop;
end;
$$;

create or replace function public.sync_rorisk_referred_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_rorisk_referred_users(old.referrer_user_uuid);
    return old;
  end if;
  if tg_op = 'UPDATE' and old.referrer_user_uuid is distinct from new.referrer_user_uuid then
    perform public.refresh_rorisk_referred_users(old.referrer_user_uuid);
  end if;
  perform public.refresh_rorisk_referred_users(new.referrer_user_uuid);
  return new;
end;
$$;

drop trigger if exists sync_rorisk_referred_users on public.rorisk_affiliates;
create trigger sync_rorisk_referred_users
after insert or delete or update of referrer_user_uuid, roblox_id, username, referred_at on public.rorisk_affiliates
for each row execute function public.sync_rorisk_referred_users();

create or replace function public.sync_rorisk_affiliate_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select users.roblox_id, users.username
  into new.roblox_id, new.username
  from public.rorisk_users as users
  where users.uuid = new.user_uuid;
  if new.username is null then
    raise exception 'Affiliate user profile was not found.';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_rorisk_affiliate_identity on public.rorisk_affiliates;
create trigger sync_rorisk_affiliate_identity
before insert or update of user_uuid on public.rorisk_affiliates
for each row execute function public.sync_rorisk_affiliate_identity();

create or replace function public.propagate_rorisk_affiliate_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rorisk_affiliates
  set roblox_id = new.roblox_id,
      username = new.username,
      updated_at = now()
  where user_uuid = new.uuid;
  return new;
end;
$$;

drop trigger if exists propagate_rorisk_affiliate_identity on public.rorisk_users;
create trigger propagate_rorisk_affiliate_identity
after update of roblox_id, username on public.rorisk_users
for each row execute function public.propagate_rorisk_affiliate_identity();

revoke all on function public.refresh_rorisk_referred_users(uuid), public.sync_rorisk_referred_users(), public.sync_rorisk_affiliate_identity(), public.propagate_rorisk_affiliate_identity() from public, anon, authenticated;

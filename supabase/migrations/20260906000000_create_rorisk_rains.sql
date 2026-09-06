create table if not exists public.rorisk_rains (
  uuid uuid primary key default gen_random_uuid(),
  status text not null default 'created' check (status in ('created', 'running', 'completed')),
  coin_amount bigint not null default 200 check (coin_amount >= 0),
  entries jsonb not null default '[]'::jsonb check (jsonb_typeof(entries) = 'array'),
  tips jsonb not null default '[]'::jsonb check (jsonb_typeof(tips) = 'array'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  join_ends_at timestamptz not null,
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at),
  check (join_ends_at >= starts_at and join_ends_at <= ends_at)
);

create index if not exists rorisk_rains_active_idx
  on public.rorisk_rains (status, created_at desc);

alter table public.rorisk_rains enable row level security;
revoke all on table public.rorisk_rains from anon, authenticated;
grant select, insert, update, delete on table public.rorisk_rains to service_role;

create or replace function public.rorisk_join_rain(p_rain_uuid uuid, p_user_uuid uuid)
returns setof public.rorisk_rains
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rain public.rorisk_rains;
  v_user public.rorisk_users;
begin
  select * into v_rain from public.rorisk_rains where uuid = p_rain_uuid for update;
  if v_rain.uuid is null or v_rain.status <> 'running' or now() >= v_rain.join_ends_at then
    raise exception 'This rain can no longer be joined.';
  end if;

  select * into v_user from public.rorisk_users where uuid = p_user_uuid;
  if v_user.uuid is null then raise exception 'User not found.'; end if;

  if exists (select 1 from jsonb_array_elements(v_rain.entries) entry where entry ->> 'uuid' = p_user_uuid::text) then
    return query select * from public.rorisk_rains where uuid = p_rain_uuid;
    return;
  end if;

  update public.rorisk_rains
  set entries = entries || jsonb_build_array(jsonb_build_object(
        'uuid', v_user.uuid,
        'roblox_id', v_user.roblox_id,
        'username', v_user.username,
        'payout', 0,
        'joined_at', now()
      )),
      updated_at = now()
  where uuid = p_rain_uuid;
  return query select * from public.rorisk_rains where uuid = p_rain_uuid;
end;
$$;

create or replace function public.rorisk_tip_rain(p_rain_uuid uuid, p_user_uuid uuid, p_coin_amount bigint)
returns setof public.rorisk_rains
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rain public.rorisk_rains;
  v_user public.rorisk_users;
begin
  if p_coin_amount <= 0 then raise exception 'Your entered rain tip amount is invalid.'; end if;
  select * into v_rain from public.rorisk_rains where uuid = p_rain_uuid for update;
  if v_rain.uuid is null or v_rain.status = 'completed' or now() >= v_rain.ends_at then
    raise exception 'This rain can no longer receive tips.';
  end if;
  select * into v_user from public.rorisk_users where uuid = p_user_uuid for update;
  if v_user.uuid is null then raise exception 'User not found.'; end if;
  if v_user.coins < p_coin_amount then raise exception 'You do not have enough Coins.'; end if;

  update public.rorisk_users set coins = coins - p_coin_amount where uuid = p_user_uuid;
  update public.rorisk_rains
  set coin_amount = coin_amount + p_coin_amount,
      tips = tips || jsonb_build_array(jsonb_build_object(
        'uuid', v_user.uuid,
        'roblox_id', v_user.roblox_id,
        'username', v_user.username,
        'coin_amount', p_coin_amount,
        'tipped_at', now()
      )),
      updated_at = now()
  where uuid = p_rain_uuid;
  return query select * from public.rorisk_rains where uuid = p_rain_uuid;
end;
$$;

create or replace function public.rorisk_settle_rain(p_rain_uuid uuid)
returns setof public.rorisk_rains
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rain public.rorisk_rains;
  v_count integer;
  v_base bigint;
  v_remainder bigint;
begin
  select * into v_rain from public.rorisk_rains where uuid = p_rain_uuid for update;
  if v_rain.uuid is null then raise exception 'Rain not found.'; end if;
  if v_rain.status = 'completed' then
    return query select * from public.rorisk_rains where uuid = p_rain_uuid;
    return;
  end if;

  v_count := jsonb_array_length(v_rain.entries);
  v_base := case when v_count > 0 then v_rain.coin_amount / v_count else 0 end;
  v_remainder := case when v_count > 0 then v_rain.coin_amount % v_count else 0 end;

  if v_count > 0 then
    with payouts as (
      select (entry ->> 'uuid')::uuid as user_uuid,
             v_base + case when ordinal <= v_remainder then 1 else 0 end as payout
      from jsonb_array_elements(v_rain.entries) with ordinality as item(entry, ordinal)
    )
    update public.rorisk_users users
    set coins = users.coins + payouts.payout
    from payouts
    where users.uuid = payouts.user_uuid;

    select jsonb_agg(entry || jsonb_build_object(
      'payout', v_base + case when ordinal <= v_remainder then 1 else 0 end
    ) order by ordinal)
    into v_rain.entries
    from jsonb_array_elements(v_rain.entries) with ordinality as item(entry, ordinal);
  end if;

  update public.rorisk_rains
  set status = 'completed', entries = v_rain.entries, updated_at = now()
  where uuid = p_rain_uuid;
  return query select * from public.rorisk_rains where uuid = p_rain_uuid;
end;
$$;

revoke all on function public.rorisk_join_rain(uuid, uuid) from public, anon, authenticated;
revoke all on function public.rorisk_tip_rain(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.rorisk_settle_rain(uuid) from public, anon, authenticated;
grant execute on function public.rorisk_join_rain(uuid, uuid) to service_role;
grant execute on function public.rorisk_tip_rain(uuid, uuid, bigint) to service_role;
grant execute on function public.rorisk_settle_rain(uuid) to service_role;

comment on table public.rorisk_rains is
  'Server-managed 30-minute rain cycles; joins open for the final two minutes.';

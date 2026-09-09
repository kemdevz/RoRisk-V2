update public.rorisk_rains
set
  starts_at = created_at + interval '30 minutes',
  ends_at = created_at + interval '32 minutes',
  join_ends_at = created_at + interval '32 minutes',
  updated_at = now()
where status in ('created', 'running')
  and (
    starts_at is distinct from created_at + interval '30 minutes'
    or ends_at is distinct from created_at + interval '32 minutes'
    or join_ends_at is distinct from created_at + interval '32 minutes'
  );

create or replace function public.rorisk_get_or_create_active_rain()
returns setof public.rorisk_rains
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rain public.rorisk_rains;
begin
  perform pg_advisory_xact_lock(hashtext('rorisk-single-active-rain'));

  select * into v_rain
  from public.rorisk_rains
  where status in ('created', 'running')
  order by
    coin_amount desc,
    jsonb_array_length(entries) desc,
    ends_at asc,
    created_at asc,
    uuid asc
  limit 1
  for update;

  if v_rain.uuid is not null then
    if v_rain.starts_at is distinct from v_rain.created_at + interval '30 minutes'
      or v_rain.ends_at is distinct from v_rain.created_at + interval '32 minutes'
      or v_rain.join_ends_at is distinct from v_rain.created_at + interval '32 minutes' then
      update public.rorisk_rains
      set
        starts_at = created_at + interval '30 minutes',
        ends_at = created_at + interval '32 minutes',
        join_ends_at = created_at + interval '32 minutes',
        updated_at = now()
      where uuid = v_rain.uuid
      returning * into v_rain;
    end if;

    update public.rorisk_rains
    set status = 'completed', updated_at = now()
    where uuid <> v_rain.uuid
      and status in ('created', 'running')
      and jsonb_array_length(entries) = 0
      and jsonb_array_length(tips) = 0;

    return next v_rain;
    return;
  end if;

  insert into public.rorisk_rains (
    status,
    coin_amount,
    entries,
    tips,
    starts_at,
    ends_at,
    join_ends_at
  ) values (
    'created',
    200,
    '[]'::jsonb,
    '[]'::jsonb,
    now() + interval '30 minutes',
    now() + interval '32 minutes',
    now() + interval '32 minutes'
  )
  returning * into v_rain;

  return next v_rain;
end;
$$;

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
  select * into v_rain
  from public.rorisk_rains
  where uuid = p_rain_uuid
  for update;

  if v_rain.uuid is null
    or v_rain.status = 'completed'
    or now() < v_rain.starts_at
    or now() >= v_rain.join_ends_at then
    raise exception 'This rain can no longer be joined.';
  end if;

  select * into v_user
  from public.rorisk_users
  where uuid = p_user_uuid;

  if v_user.uuid is null then raise exception 'User not found.'; end if;

  if exists (
    select 1
    from jsonb_array_elements(v_rain.entries) entry
    where entry ->> 'uuid' = p_user_uuid::text
  ) then
    return query select * from public.rorisk_rains where uuid = p_rain_uuid;
    return;
  end if;

  update public.rorisk_rains
  set status = 'running',
      entries = entries || jsonb_build_array(jsonb_build_object(
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
  if p_coin_amount < 100 or p_coin_amount > 500000 then
    raise exception 'Your entered rain tip amount is invalid.';
  end if;

  select * into v_rain
  from public.rorisk_rains
  where uuid = p_rain_uuid
  for update;

  if v_rain.uuid is null
    or v_rain.status = 'completed'
    or now() >= v_rain.starts_at then
    raise exception 'This rain can no longer receive tips.';
  end if;

  select * into v_user
  from public.rorisk_users
  where uuid = p_user_uuid
  for update;

  if v_user.uuid is null then raise exception 'User not found.'; end if;
  if v_user.coins < p_coin_amount then raise exception 'You do not have enough Coins.'; end if;

  update public.rorisk_users
  set coins = coins - p_coin_amount
  where uuid = p_user_uuid;

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

revoke all on function public.rorisk_get_or_create_active_rain() from public, anon, authenticated;
revoke all on function public.rorisk_join_rain(uuid, uuid) from public, anon, authenticated;
revoke all on function public.rorisk_tip_rain(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.rorisk_get_or_create_active_rain() to service_role;
grant execute on function public.rorisk_join_rain(uuid, uuid) to service_role;
grant execute on function public.rorisk_tip_rain(uuid, uuid, bigint) to service_role;

comment on table public.rorisk_rains is
  'Server-managed 30-minute rain pools followed by a separate two-minute claim period.';

comment on function public.rorisk_get_or_create_active_rain() is
  'Atomically returns one active rain or creates a 30-minute pool followed by a two-minute claim period.';

comment on function public.rorisk_tip_rain(uuid, uuid, bigint) is
  'Accepts rain tips during the 30-minute pool period and closes when the two-minute claim period begins.';

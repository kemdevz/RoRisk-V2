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

revoke all on function public.rorisk_join_rain(uuid, uuid) from public, anon, authenticated;
revoke all on function public.rorisk_tip_rain(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.rorisk_join_rain(uuid, uuid) to service_role;
grant execute on function public.rorisk_tip_rain(uuid, uuid, bigint) to service_role;

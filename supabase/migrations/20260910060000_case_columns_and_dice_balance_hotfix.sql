drop function if exists public.open_rorisk_case(uuid, text, integer, uuid, text, text, text);
drop function if exists public.open_rorisk_case(uuid, text, integer, text, text, text);

alter table public.rorisk_case_openings drop column if exists request_id;
alter table public.rorisk_case_openings drop column if exists demo;
alter table public.rorisk_case_openings add column if not exists roblox_id bigint;
alter table public.rorisk_case_openings add column if not exists username text;
alter table public.rorisk_case_openings add column if not exists avatar_headshot text default '/default-avatar.png';

update public.rorisk_case_openings as opening
set roblox_id = profile.roblox_id,
    username = profile.username,
    avatar_headshot = profile.avatar_headshot
from public.rorisk_users as profile
where profile.uuid = opening.user_uuid;

alter table public.rorisk_case_openings alter column username set not null;
alter table public.rorisk_case_openings alter column avatar_headshot set not null;

create or replace function public.open_rorisk_case(
  p_user_uuid uuid,
  p_case_id text,
  p_case_count integer,
  p_client_seed text,
  p_server_seed text,
  p_server_seed_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_case public.rorisk_cases%rowtype;
  v_user public.rorisk_users%rowtype;
  v_opening public.rorisk_case_openings%rowtype;
  v_items jsonb;
  v_item jsonb;
  v_selected jsonb;
  v_outcomes jsonb := '[]'::jsonb;
  v_hash text;
  v_roll numeric;
  v_cumulative numeric;
  v_chance numeric;
  v_nonce bigint;
  v_wager bigint;
  v_payout bigint := 0;
  v_index integer;
begin
  if p_case_count not between 1 and 4 then raise exception 'Select between 1 and 4 cases.'; end if;
  if encode(digest(p_server_seed, 'sha256'), 'hex') <> p_server_seed_hash then raise exception 'The case seed is invalid.'; end if;

  select * into v_user from public.rorisk_users where uuid = p_user_uuid for update;
  if not found then raise exception 'Please sign in to perform this action.'; end if;
  select * into v_case from public.rorisk_cases where case_id = p_case_id and active = true;
  if not found then raise exception 'This case could not be found.'; end if;

  v_items := v_case.items;
  if jsonb_array_length(v_items) = 0 then raise exception 'This case has no available items.'; end if;
  v_wager := v_case.rocoin_amount * p_case_count;
  if coalesce(v_user.rocoins, 0) < v_wager then raise exception 'Insufficient balance.'; end if;

  select coalesce(max(nonce + case_count), 0) into v_nonce from public.rorisk_case_openings where user_uuid = p_user_uuid;
  for v_index in 0..p_case_count - 1 loop
    v_hash := encode(digest(p_server_seed || ':' || p_client_seed || ':' || (v_nonce + v_index)::text, 'sha256'), 'hex');
    v_roll := ((('x' || substr(v_hash, 1, 13))::bit(52)::bigint)::numeric / 4503599627370496::numeric) * 100;
    v_cumulative := 0;
    v_selected := null;
    for v_item in select value from jsonb_array_elements(v_items) loop
      v_chance := coalesce(nullif(replace(v_item->>'chance', '%', ''), '')::numeric, 0);
      v_cumulative := v_cumulative + v_chance;
      if v_roll <= v_cumulative then v_selected := v_item; exit; end if;
    end loop;
    if v_selected is null then v_selected := v_items->(jsonb_array_length(v_items) - 1); end if;
    v_payout := v_payout + greatest(0, coalesce((v_selected->>'price')::bigint, 0));
    v_outcomes := v_outcomes || jsonb_build_array(jsonb_build_object('outcome', round(v_roll, 6), 'item', v_selected));
  end loop;

  update public.rorisk_users set rocoins = coalesce(rocoins, 0) - v_wager + v_payout where uuid = p_user_uuid returning * into v_user;
  insert into public.rorisk_case_openings (
    user_uuid, roblox_id, username, avatar_headshot, case_uuid, case_id, case_name, currency, case_count, wager_amount,
    payout_amount, outcomes, client_seed, server_seed_hash, server_seed, nonce, status, completed_at
  ) values (
    p_user_uuid, v_user.roblox_id, v_user.username, v_user.avatar_headshot, v_case.uuid, v_case.case_id, v_case.name, 'rocoins', p_case_count, v_wager,
    v_payout, v_outcomes, p_client_seed, p_server_seed_hash, p_server_seed, v_nonce, 'completed', now()
  ) returning * into v_opening;
  return jsonb_build_object('opening', to_jsonb(v_opening), 'user', to_jsonb(v_user));
end;
$$;

revoke all on function public.open_rorisk_case(uuid, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.open_rorisk_case(uuid, text, integer, text, text, text) to service_role;

create or replace function public.play_rorisk_dice(
  p_user_uuid uuid,
  p_amount bigint,
  p_currency text,
  p_mode text,
  p_target_low integer,
  p_target_high integer,
  p_client_seed text,
  p_server_seed text,
  p_server_seed_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.rorisk_users%rowtype;
  v_game public.rorisk_dice_games%rowtype;
  v_nonce bigint;
  v_hash text;
  v_roll integer;
  v_win_tickets integer;
  v_chance numeric;
  v_multiplier numeric;
  v_won boolean;
  v_payout bigint;
  v_balance bigint;
begin
  if p_currency not in ('coins', 'rocoins') then raise exception 'The selected currency is invalid.'; end if;
  if p_mode not in ('under', 'over', 'inside', 'outside') then raise exception 'The selected range type is invalid.'; end if;
  if p_amount < 50 then raise exception 'Minimum bet is 50 Coins.'; end if;
  if p_amount > 500000 then raise exception 'Maximum bet is 500,000 Coins.'; end if;
  if p_target_low not between 0 and 9999 or p_target_high not between 0 and 9999 then raise exception 'The selected roll range is invalid.'; end if;
  if encode(digest(p_server_seed, 'sha256'), 'hex') <> p_server_seed_hash then raise exception 'The dice seed is invalid.'; end if;

  v_win_tickets := case p_mode when 'under' then p_target_low when 'over' then 9999 - p_target_low when 'inside' then p_target_high - p_target_low + 1 else p_target_low + (9999 - p_target_high) end;
  if v_win_tickets not between 100 and 9300 then raise exception 'The selected win chance is invalid.'; end if;
  if p_mode in ('inside', 'outside') and p_target_high <= p_target_low then raise exception 'The selected roll range is invalid.'; end if;

  select * into v_user from public.rorisk_users where uuid = p_user_uuid for update;
  if not found then raise exception 'Please sign in to perform this action.'; end if;
  v_balance := case when p_currency = 'coins' then coalesce(v_user.coins, 0) else coalesce(v_user.rocoins, 0) end;
  if v_balance < p_amount then raise exception 'Insufficient balance.'; end if;

  select coalesce(max(nonce) + 1, 0) into v_nonce from public.rorisk_dice_games where user_uuid = p_user_uuid;
  v_hash := encode(digest(p_server_seed || ':' || p_client_seed || ':' || v_nonce::text, 'sha256'), 'hex');
  v_roll := floor(((('x' || substr(v_hash, 1, 13))::bit(52)::bigint)::numeric / 4503599627370496::numeric) * 10000)::integer;
  v_chance := round((v_win_tickets::numeric / 100), 4);
  v_multiplier := floor((0.95::numeric * 10000 / v_win_tickets) * 10000) / 10000;
  v_won := case p_mode when 'under' then v_roll < p_target_low when 'over' then v_roll > p_target_low when 'inside' then v_roll between p_target_low and p_target_high else v_roll < p_target_low or v_roll > p_target_high end;
  v_payout := case when v_won then floor(p_amount * v_multiplier)::bigint else 0 end;

  if p_currency = 'coins' then
    update public.rorisk_users set coins = coins - p_amount + v_payout where uuid = p_user_uuid returning * into v_user;
  else
    update public.rorisk_users set rocoins = rocoins - p_amount + v_payout where uuid = p_user_uuid returning * into v_user;
  end if;
  insert into public.rorisk_dice_games (user_uuid, roblox_id, username, avatar_headshot, currency, bet_amount, mode, target_low, target_high, roll, win_chance, multiplier, won, payout_amount, client_seed, server_seed_hash, server_seed, nonce)
  values (v_user.uuid, v_user.roblox_id, v_user.username, v_user.avatar_headshot, p_currency, p_amount, p_mode, p_target_low, p_target_high, v_roll, v_chance, v_multiplier, v_won, v_payout, p_client_seed, p_server_seed_hash, p_server_seed, v_nonce)
  returning * into v_game;
  return jsonb_build_object('game', to_jsonb(v_game), 'user', to_jsonb(v_user));
end;
$$;

revoke all on function public.play_rorisk_dice(uuid, bigint, text, text, integer, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.play_rorisk_dice(uuid, bigint, text, text, integer, integer, text, text, text) to service_role;

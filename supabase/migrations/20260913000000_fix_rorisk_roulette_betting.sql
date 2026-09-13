create or replace function public.place_rorisk_roulette_bet(
  p_game_uuid uuid,
  p_user_uuid uuid,
  p_amount bigint,
  p_currency text,
  p_target_multiplier_bps integer
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_game public.rorisk_roulette_games%rowtype;
  v_user public.rorisk_users%rowtype;
  v_balance bigint;
  v_bet jsonb;
begin
  if p_currency not in ('coins', 'rocoins') then raise exception 'The selected currency is invalid.'; end if;
  if p_amount < 1 or p_amount > 500000 then raise exception 'Your entered bet amount is invalid.'; end if;
  if p_target_multiplier_bps < 101 then raise exception 'Your entered multiplier is invalid.'; end if;

  select * into v_game from public.rorisk_roulette_games where uuid = p_game_uuid for update;
  if not found or v_game.state <> 'BETTING_OPEN' or clock_timestamp() >= v_game.betting_closes_at then
    raise exception 'Betting is closed for this round.';
  end if;
  select * into v_user from public.rorisk_users where uuid = p_user_uuid for update;
  if not found then raise exception 'Please sign in to perform this action.'; end if;
  v_balance := case when p_currency = 'coins' then coalesce(v_user.coins, 0) else coalesce(v_user.rocoins, 0) end;
  if v_balance < p_amount then raise exception 'Insufficient balance.'; end if;

  if p_currency = 'coins' then
    update public.rorisk_users set coins = coalesce(coins, 0) - p_amount where uuid = p_user_uuid returning * into v_user;
  else
    update public.rorisk_users set rocoins = coalesce(rocoins, 0) - p_amount where uuid = p_user_uuid returning * into v_user;
  end if;

  v_bet := jsonb_build_object(
    'uuid', gen_random_uuid(), 'user_uuid', v_user.uuid, 'roblox_id', v_user.roblox_id,
    'username', v_user.username, 'roblox_avatar_headshot', v_user.avatar_headshot,
    'level', coalesce(v_user.level, 0), 'rank', coalesce(v_user.rank, 'user'),
    'currency', p_currency, 'amount', p_amount, 'target_multiplier_bps', p_target_multiplier_bps,
    'placed_at', clock_timestamp()
  );
  update public.rorisk_roulette_games
  set bets = jsonb_build_array(v_bet) || bets, bet_count = bet_count + 1,
      wagered_amount = wagered_amount + p_amount, updated_at = clock_timestamp()
  where uuid = v_game.uuid returning * into v_game;

  return jsonb_build_object('game', to_jsonb(v_game), 'bet', v_bet, 'user', to_jsonb(v_user));
end;
$$;

revoke all on function public.place_rorisk_roulette_bet(uuid, uuid, bigint, text, integer) from public, anon, authenticated;
grant execute on function public.place_rorisk_roulette_bet(uuid, uuid, bigint, text, integer) to service_role;

alter table public.rorisk_coinflip_games add column if not exists eos_block_id text;
alter table public.rorisk_coinflip_games add column if not exists eos_block_number bigint;
alter table public.rorisk_coinflip_games add column if not exists ticket integer check (ticket between 0 and 999999);

drop function if exists public.join_rorisk_coinflip(uuid, uuid, boolean);

create or replace function public.join_rorisk_coinflip(
  p_game_uuid uuid,
  p_user_uuid uuid,
  p_bot boolean,
  p_eos_block_id text,
  p_eos_block_number bigint,
  p_ticket integer
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.rorisk_users%rowtype;
  v_creator public.rorisk_users%rowtype;
  v_winner public.rorisk_users%rowtype;
  v_game public.rorisk_coinflip_games%rowtype;
  v_join_coin text;
  v_winning_coin text;
  v_winner_uuid uuid;
  v_payout bigint;
  v_balance bigint;
begin
  select * into v_game from public.rorisk_coinflip_games where uuid = p_game_uuid for update;
  if not found then raise exception 'This coinflip game could not be found.'; end if;
  if v_game.state <> 'created' or v_game.opponent_uuid is not null or v_game.opponent_is_bot then
    if p_bot then raise exception 'This game is no longer available.';
    else raise exception 'This game is no longer available for joining.';
    end if;
  end if;
  if encode(digest(v_game.server_seed, 'sha256'), 'hex') <> v_game.server_seed_hash then raise exception 'The coinflip seed is invalid.'; end if;
  if p_eos_block_id !~ '^[a-f0-9]{64}$' or p_eos_block_number < 1 or p_ticket not between 0 and 999999 then raise exception 'The EOS fairness data is invalid.'; end if;
  v_join_coin := case when v_game.creator_coin = 'blue' then 'orange' else 'blue' end;

  select * into v_creator from public.rorisk_users where uuid = v_game.creator_uuid for update;
  if p_bot then
    if p_user_uuid <> v_game.creator_uuid then raise exception 'Only the game creator can call the bot.'; end if;
    v_user := v_creator;
  else
    if p_user_uuid = v_game.creator_uuid then raise exception 'You cannot join your own coinflip game.'; end if;
    select * into v_user from public.rorisk_users where uuid = p_user_uuid for update;
    if not found then raise exception 'Please sign in to perform this action.'; end if;
    v_balance := case when v_game.currency = 'coins' then coalesce(v_user.coins, 0) else coalesce(v_user.rocoins, 0) end;
    if v_balance < v_game.amount then raise exception 'Insufficient balance.'; end if;
    if v_game.currency = 'coins' then
      update public.rorisk_users set coins = coalesce(coins, 0) - v_game.amount where uuid = p_user_uuid returning * into v_user;
    else
      update public.rorisk_users set rocoins = coalesce(rocoins, 0) - v_game.amount where uuid = p_user_uuid returning * into v_user;
    end if;
  end if;

  v_winning_coin := case when p_ticket < 500000 then 'blue' else 'orange' end;
  if v_winning_coin = v_game.creator_coin then v_winner_uuid := v_game.creator_uuid;
  elsif not p_bot then v_winner_uuid := p_user_uuid;
  else v_winner_uuid := null;
  end if;
  v_payout := floor(v_game.amount * 1.95)::bigint;

  if v_winner_uuid is not null then
    if v_game.currency = 'coins' then
      update public.rorisk_users set coins = coalesce(coins, 0) + v_payout where uuid = v_winner_uuid returning * into v_winner;
    else
      update public.rorisk_users set rocoins = coalesce(rocoins, 0) + v_payout where uuid = v_winner_uuid returning * into v_winner;
    end if;
  end if;

  update public.rorisk_coinflip_games
  set opponent_uuid = case when p_bot then null else v_user.uuid end,
      opponent_roblox_id = case when p_bot then null else v_user.roblox_id end,
      opponent_username = case when p_bot then 'Risk Bot' else v_user.username end,
      opponent_avatar_headshot = case when p_bot then '/api/casino-images/coinflip/bot.png' else v_user.avatar_headshot end,
      opponent_coin = v_join_coin,
      opponent_is_bot = p_bot,
      opponent_joined_at = now(),
      state = 'completed',
      winning_coin = v_winning_coin,
      winner_uuid = v_winner_uuid,
      winner_roblox_id = case when v_winner_uuid is null then null else v_winner.roblox_id end,
      winner_username = case when v_winner_uuid is null then 'Risk Bot' else v_winner.username end,
      winner_avatar_headshot = case when v_winner_uuid is null then '/api/casino-images/coinflip/bot.png' else v_winner.avatar_headshot end,
      winner_is_bot = v_winner_uuid is null,
      eos_block_id = p_eos_block_id,
      eos_block_number = p_eos_block_number,
      ticket = p_ticket,
      payout_amount = case when v_winner_uuid is null then 0 else v_payout end,
      started_at = now(),
      completed_at = now() + interval '5.5 seconds',
      updated_at = now()
  where uuid = p_game_uuid returning * into v_game;

  select * into v_user from public.rorisk_users where uuid = p_user_uuid;
  return jsonb_build_object('game', to_jsonb(v_game), 'user', to_jsonb(v_user));
end;
$$;

revoke all on function public.join_rorisk_coinflip(uuid, uuid, boolean, text, bigint, integer) from public, anon, authenticated;
grant execute on function public.join_rorisk_coinflip(uuid, uuid, boolean, text, bigint, integer) to service_role;

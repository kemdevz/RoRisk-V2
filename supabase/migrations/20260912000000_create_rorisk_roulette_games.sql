create table if not exists public.rorisk_roulette_games (
  uuid uuid primary key default gen_random_uuid(),
  state text not null default 'BETTING_OPEN' check (state in ('BETTING_OPEN', 'BETTING_LOCKED', 'ROLLING', 'SETTLING', 'COMPLETE')),
  reel jsonb not null check (jsonb_typeof(reel) = 'array' and jsonb_array_length(reel) >= 24),
  winning_index integer not null check (winning_index >= 0),
  result_name text not null,
  result_image text not null,
  result_asset_id bigint,
  result_multiplier_bps integer not null check (result_multiplier_bps >= 100),
  bets jsonb not null default '[]'::jsonb check (jsonb_typeof(bets) = 'array'),
  bet_count integer not null default 0 check (bet_count >= 0),
  wagered_amount bigint not null default 0 check (wagered_amount >= 0),
  paid_amount bigint not null default 0 check (paid_amount >= 0),
  server_seed_hash text not null,
  server_seed text not null,
  ticket integer not null check (ticket between 0 and 999999),
  eos_block_id text,
  eos_block_number bigint,
  betting_opens_at timestamptz not null,
  betting_closes_at timestamptz not null,
  rolling_started_at timestamptz not null,
  rolling_ends_at timestamptz not null,
  settling_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (betting_opens_at < betting_closes_at and betting_closes_at <= rolling_started_at and rolling_started_at < rolling_ends_at and rolling_ends_at < settling_ends_at),
  check (winning_index < jsonb_array_length(reel))
);

alter table public.rorisk_roulette_games add column if not exists result_asset_id bigint;

create index if not exists rorisk_roulette_games_created_idx on public.rorisk_roulette_games (created_at desc);
create index if not exists rorisk_roulette_games_state_created_idx on public.rorisk_roulette_games (state, created_at desc);

alter table public.rorisk_roulette_games enable row level security;
revoke all on table public.rorisk_roulette_games from anon, authenticated;
grant select, insert, update on table public.rorisk_roulette_games to service_role;

create or replace function public.sync_rorisk_roulette(
  p_reel jsonb,
  p_winning_index integer,
  p_result_name text,
  p_result_image text,
  p_result_multiplier_bps integer,
  p_server_seed text,
  p_server_seed_hash text,
  p_ticket integer
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_game public.rorisk_roulette_games%rowtype;
  v_bet jsonb;
  v_settled_bets jsonb := '[]'::jsonb;
  v_payout bigint;
  v_paid bigint := 0;
  v_now timestamptz := clock_timestamp();
begin
  perform pg_advisory_xact_lock(hashtext('rorisk_roulette_round'));
  select * into v_game from public.rorisk_roulette_games order by created_at desc limit 1 for update;

  if found and v_game.state <> 'COMPLETE' and v_now >= v_game.settling_ends_at then
    for v_bet in select value from jsonb_array_elements(v_game.bets) loop
      v_payout := case when v_game.result_multiplier_bps >= (v_bet ->> 'target_multiplier_bps')::integer
        then floor((v_bet ->> 'amount')::numeric * (v_bet ->> 'target_multiplier_bps')::integer / 100)::bigint else 0 end;
      if v_payout > 0 then
        if v_bet ->> 'currency' = 'coins' then
          update public.rorisk_users set coins = coalesce(coins, 0) + v_payout where uuid = (v_bet ->> 'user_uuid')::uuid;
        else
          update public.rorisk_users set rocoins = coalesce(rocoins, 0) + v_payout where uuid = (v_bet ->> 'user_uuid')::uuid;
        end if;
      end if;
      v_paid := v_paid + v_payout;
      v_settled_bets := v_settled_bets || jsonb_build_array(v_bet || jsonb_build_object('won', v_payout > 0, 'payout_amount', v_payout));
    end loop;
    update public.rorisk_roulette_games
    set state = 'COMPLETE', bets = v_settled_bets, paid_amount = v_paid, completed_at = v_now, updated_at = v_now
    where uuid = v_game.uuid returning * into v_game;
  elsif found and v_game.state <> 'COMPLETE' then
    update public.rorisk_roulette_games
    set state = case
      when v_now < betting_closes_at then 'BETTING_OPEN'
      when v_now < rolling_started_at then 'BETTING_LOCKED'
      when v_now < rolling_ends_at then 'ROLLING'
      else 'SETTLING'
    end,
    updated_at = case when state is distinct from case
      when v_now < betting_closes_at then 'BETTING_OPEN'
      when v_now < rolling_started_at then 'BETTING_LOCKED'
      when v_now < rolling_ends_at then 'ROLLING'
      else 'SETTLING' end then v_now else updated_at end
    where uuid = v_game.uuid returning * into v_game;
  end if;

  if v_game.uuid is null or (v_game.state = 'COMPLETE' and v_game.completed_at <= v_now - interval '2 seconds') then
    if jsonb_typeof(p_reel) <> 'array' or jsonb_array_length(p_reel) < 24 then raise exception 'The roulette reel is invalid.'; end if;
    if p_winning_index < 0 or p_winning_index >= jsonb_array_length(p_reel) then raise exception 'The roulette winner is invalid.'; end if;
    if p_result_multiplier_bps < 100 or p_ticket not between 0 and 999999 then raise exception 'The roulette result is invalid.'; end if;
    if encode(digest(p_server_seed, 'sha256'), 'hex') <> p_server_seed_hash then raise exception 'The roulette seed is invalid.'; end if;
    insert into public.rorisk_roulette_games (
      reel, winning_index, result_name, result_image, result_multiplier_bps, server_seed, server_seed_hash, ticket,
      betting_opens_at, betting_closes_at, rolling_started_at, rolling_ends_at, settling_ends_at
    ) values (
      p_reel, p_winning_index, left(p_result_name, 100), left(p_result_image, 500), p_result_multiplier_bps,
      p_server_seed, p_server_seed_hash, p_ticket, v_now, v_now + interval '15 seconds',
      v_now + interval '17 seconds', v_now + interval '22 seconds', v_now + interval '24 seconds'
    ) returning * into v_game;
  end if;

  return to_jsonb(v_game);
end;
$$;

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

revoke all on function public.sync_rorisk_roulette(jsonb, integer, text, text, integer, text, text, integer) from public, anon, authenticated;
revoke all on function public.place_rorisk_roulette_bet(uuid, uuid, bigint, text, integer) from public, anon, authenticated;
grant execute on function public.sync_rorisk_roulette(jsonb, integer, text, text, integer, text, text, integer) to service_role;
grant execute on function public.place_rorisk_roulette_bet(uuid, uuid, bigint, text, integer) to service_role;

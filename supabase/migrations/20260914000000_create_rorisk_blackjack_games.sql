create table if not exists public.rorisk_blackjack_games (
  uuid uuid primary key default gen_random_uuid(),
  user_uuid uuid not null references public.rorisk_users(uuid) on delete cascade,
  roblox_id bigint,
  username text not null,
  avatar_headshot text,
  currency text not null check (currency in ('coins', 'rocoins')),
  bet_amount bigint not null check (bet_amount between 50 and 500000),
  wager_amount bigint not null check (wager_amount >= bet_amount),
  insurance_amount bigint not null default 0 check (insurance_amount >= 0),
  payout_amount bigint not null default 0 check (payout_amount >= 0),
  multiplier numeric(14, 4) not null default 0 check (multiplier >= 0),
  state text not null check (state in ('insurance', 'playing', 'completed')),
  active_hand text not null default 'main' check (active_hand in ('main', 'right', 'left', 'dealer', 'completed')),
  dealer_cards jsonb not null check (jsonb_typeof(dealer_cards) = 'array'),
  player_cards jsonb not null check (jsonb_typeof(player_cards) = 'array'),
  cards_left jsonb not null default '[]'::jsonb check (jsonb_typeof(cards_left) = 'array'),
  cards_right jsonb not null default '[]'::jsonb check (jsonb_typeof(cards_right) = 'array'),
  deck jsonb not null check (jsonb_typeof(deck) = 'array' and jsonb_array_length(deck) = 52),
  deck_position smallint not null default 4 check (deck_position between 0 and 52),
  actions jsonb not null default '[]'::jsonb check (jsonb_typeof(actions) = 'array'),
  outcomes jsonb not null default '{}'::jsonb check (jsonb_typeof(outcomes) = 'object'),
  won boolean not null default false,
  client_seed text not null,
  server_seed_hash text not null,
  server_seed text not null,
  nonce bigint not null default 0 check (nonce >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists rorisk_blackjack_games_created_idx on public.rorisk_blackjack_games (created_at desc);
create index if not exists rorisk_blackjack_games_user_created_idx on public.rorisk_blackjack_games (user_uuid, created_at desc);
create unique index if not exists rorisk_blackjack_games_one_active_idx on public.rorisk_blackjack_games (user_uuid) where state <> 'completed';

alter table public.rorisk_blackjack_games enable row level security;
revoke all on table public.rorisk_blackjack_games from anon, authenticated;
grant select, insert, update on table public.rorisk_blackjack_games to service_role;

create or replace function public.start_rorisk_blackjack(
  p_user_uuid uuid,
  p_amount bigint,
  p_currency text,
  p_state text,
  p_active_hand text,
  p_dealer_cards jsonb,
  p_player_cards jsonb,
  p_deck jsonb,
  p_deck_position integer,
  p_outcomes jsonb,
  p_payout bigint,
  p_client_seed text,
  p_server_seed text,
  p_server_seed_hash text,
  p_nonce bigint
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.rorisk_users%rowtype;
  v_game public.rorisk_blackjack_games%rowtype;
begin
  if p_currency not in ('coins', 'rocoins') then raise exception 'The selected currency is invalid.'; end if;
  if p_amount < 50 or p_amount > 500000 then raise exception 'Your entered bet amount is invalid.'; end if;
  if p_state not in ('insurance', 'playing', 'completed') then raise exception 'The blackjack state is invalid.'; end if;
  if jsonb_typeof(p_deck) <> 'array' or jsonb_array_length(p_deck) <> 52 then raise exception 'The blackjack deck is invalid.'; end if;
  if encode(digest(p_server_seed, 'sha256'), 'hex') <> p_server_seed_hash then raise exception 'The blackjack seed is invalid.'; end if;

  select * into v_user from public.rorisk_users where uuid = p_user_uuid for update;
  if not found then raise exception 'Please sign in to perform this action.'; end if;
  if exists (select 1 from public.rorisk_blackjack_games where user_uuid = p_user_uuid and state <> 'completed') then
    raise exception 'You already have a running blackjack game.';
  end if;
  if (case when p_currency = 'coins' then coalesce(v_user.coins, 0) else coalesce(v_user.rocoins, 0) end) < p_amount then
    raise exception 'Insufficient balance.';
  end if;

  if p_currency = 'coins' then
    update public.rorisk_users set coins = coalesce(coins, 0) - p_amount + p_payout where uuid = p_user_uuid returning * into v_user;
  else
    update public.rorisk_users set rocoins = coalesce(rocoins, 0) - p_amount + p_payout where uuid = p_user_uuid returning * into v_user;
  end if;

  insert into public.rorisk_blackjack_games (
    user_uuid, roblox_id, username, avatar_headshot, currency, bet_amount, wager_amount, payout_amount,
    multiplier, state, active_hand, dealer_cards, player_cards, deck, deck_position, outcomes, won,
    client_seed, server_seed_hash, server_seed, nonce, completed_at
  ) values (
    v_user.uuid, v_user.roblox_id, v_user.username, v_user.avatar_headshot, p_currency, p_amount, p_amount, p_payout,
    case when p_amount > 0 then p_payout::numeric / p_amount else 0 end, p_state, p_active_hand,
    p_dealer_cards, p_player_cards, p_deck, p_deck_position, coalesce(p_outcomes, '{}'::jsonb), p_payout >= p_amount and p_payout > 0,
    left(coalesce(p_client_seed, p_user_uuid::text), 128), p_server_seed_hash, p_server_seed, p_nonce,
    case when p_state = 'completed' then now() else null end
  ) returning * into v_game;

  return jsonb_build_object('game', to_jsonb(v_game), 'user', to_jsonb(v_user));
end;
$$;

create or replace function public.update_rorisk_blackjack(
  p_game_uuid uuid,
  p_user_uuid uuid,
  p_expected_updated_at timestamptz,
  p_extra_wager bigint,
  p_payout bigint,
  p_state text,
  p_active_hand text,
  p_dealer_cards jsonb,
  p_player_cards jsonb,
  p_cards_left jsonb,
  p_cards_right jsonb,
  p_deck_position integer,
  p_actions jsonb,
  p_outcomes jsonb,
  p_insurance_amount bigint
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.rorisk_users%rowtype;
  v_game public.rorisk_blackjack_games%rowtype;
  v_balance bigint;
  v_new_wager bigint;
begin
  if p_state not in ('insurance', 'playing', 'completed') then raise exception 'The blackjack state is invalid.'; end if;
  if p_extra_wager < 0 or p_payout < 0 then raise exception 'The blackjack balance update is invalid.'; end if;

  select * into v_game from public.rorisk_blackjack_games where uuid = p_game_uuid for update;
  if not found or v_game.user_uuid <> p_user_uuid then raise exception 'You have no running blackjack game at the moment.'; end if;
  if v_game.state = 'completed' then raise exception 'This blackjack game has already completed.'; end if;
  if v_game.updated_at <> p_expected_updated_at then raise exception 'This blackjack game has already changed.'; end if;

  select * into v_user from public.rorisk_users where uuid = p_user_uuid for update;
  v_balance := case when v_game.currency = 'coins' then coalesce(v_user.coins, 0) else coalesce(v_user.rocoins, 0) end;
  if v_balance < p_extra_wager then raise exception 'Insufficient balance.'; end if;
  if v_game.currency = 'coins' then
    update public.rorisk_users set coins = coalesce(coins, 0) - p_extra_wager + p_payout where uuid = p_user_uuid returning * into v_user;
  else
    update public.rorisk_users set rocoins = coalesce(rocoins, 0) - p_extra_wager + p_payout where uuid = p_user_uuid returning * into v_user;
  end if;

  v_new_wager := v_game.wager_amount + p_extra_wager;
  update public.rorisk_blackjack_games set
    wager_amount = v_new_wager,
    insurance_amount = p_insurance_amount,
    payout_amount = p_payout,
    multiplier = case when v_new_wager > 0 then p_payout::numeric / v_new_wager else 0 end,
    state = p_state,
    active_hand = p_active_hand,
    dealer_cards = p_dealer_cards,
    player_cards = p_player_cards,
    cards_left = p_cards_left,
    cards_right = p_cards_right,
    deck_position = p_deck_position,
    actions = p_actions,
    outcomes = p_outcomes,
    won = p_payout >= v_new_wager and p_payout > 0,
    completed_at = case when p_state = 'completed' then now() else null end,
    updated_at = now()
  where uuid = p_game_uuid returning * into v_game;

  return jsonb_build_object('game', to_jsonb(v_game), 'user', to_jsonb(v_user));
end;
$$;

revoke all on function public.start_rorisk_blackjack(uuid, bigint, text, text, text, jsonb, jsonb, jsonb, integer, jsonb, bigint, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.update_rorisk_blackjack(uuid, uuid, timestamptz, bigint, bigint, text, text, jsonb, jsonb, jsonb, jsonb, integer, jsonb, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.start_rorisk_blackjack(uuid, bigint, text, text, text, jsonb, jsonb, jsonb, integer, jsonb, bigint, text, text, text, bigint) to service_role;
grant execute on function public.update_rorisk_blackjack(uuid, uuid, timestamptz, bigint, bigint, text, text, jsonb, jsonb, jsonb, jsonb, integer, jsonb, jsonb, bigint) to service_role;

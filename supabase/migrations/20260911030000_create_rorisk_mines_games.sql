create table if not exists public.rorisk_mines_games (
  uuid uuid primary key default gen_random_uuid(),
  user_uuid uuid not null references public.rorisk_users(uuid) on delete cascade,
  roblox_id bigint,
  username text not null,
  avatar_headshot text,
  currency text not null check (currency in ('coins', 'rocoins')),
  bet_amount bigint not null check (bet_amount between 50 and 500000),
  mines_count smallint not null check (mines_count between 1 and 24),
  deck jsonb not null check (jsonb_typeof(deck) = 'array' and jsonb_array_length(deck) = 25),
  revealed jsonb not null default '[]'::jsonb check (jsonb_typeof(revealed) = 'array'),
  state text not null default 'created' check (state in ('created', 'running', 'completed')),
  multiplier numeric(14, 4) not null default 0.9,
  won boolean not null default false,
  payout_amount bigint not null default 0 check (payout_amount >= 0),
  client_seed text not null,
  server_seed_hash text not null,
  server_seed text not null,
  nonce bigint not null default 0 check (nonce >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists rorisk_mines_games_created_idx on public.rorisk_mines_games (created_at desc);
create index if not exists rorisk_mines_games_user_created_idx on public.rorisk_mines_games (user_uuid, created_at desc);
create unique index if not exists rorisk_mines_games_one_active_idx on public.rorisk_mines_games (user_uuid) where state in ('created', 'running');

alter table public.rorisk_mines_games enable row level security;
revoke all on table public.rorisk_mines_games from anon, authenticated;
grant select, insert, update on table public.rorisk_mines_games to service_role;

create or replace function public.rorisk_mines_multiplier(p_reveals integer, p_mines integer)
returns numeric
language plpgsql
immutable
strict
as $$
declare
  v_multiplier numeric := 0.9;
  v_index integer;
begin
  if p_reveals <= 0 then return 0.9; end if;
  for v_index in 0..p_reveals - 1 loop
    v_multiplier := v_multiplier * (25 - v_index)::numeric / (25 - p_mines - v_index)::numeric;
  end loop;
  return greatest(0.9, floor(v_multiplier * 100) / 100);
end;
$$;

create or replace function public.start_rorisk_mines(
  p_user_uuid uuid,
  p_amount bigint,
  p_currency text,
  p_mines_count integer,
  p_deck jsonb,
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
  v_game public.rorisk_mines_games%rowtype;
  v_balance bigint;
  v_mines integer;
begin
  if p_currency not in ('coins', 'rocoins') then raise exception 'The selected currency is invalid.'; end if;
  if p_amount < 50 or p_amount > 500000 then raise exception 'Your entered bet amount is invalid.'; end if;
  if p_mines_count not between 1 and 24 then raise exception 'Your entered mines count is invalid.'; end if;
  if jsonb_typeof(p_deck) <> 'array' or jsonb_array_length(p_deck) <> 25 then raise exception 'The mines deck is invalid.'; end if;
  select count(*) into v_mines from jsonb_array_elements(p_deck) as element(value) where value = '"mine"'::jsonb;
  if v_mines <> p_mines_count then raise exception 'The mines deck is invalid.'; end if;
  if encode(digest(p_server_seed, 'sha256'), 'hex') <> p_server_seed_hash then raise exception 'The mines seed is invalid.'; end if;
  if p_nonce < 0 then raise exception 'The mines nonce is invalid.'; end if;

  select * into v_user from public.rorisk_users where uuid = p_user_uuid for update;
  if not found then raise exception 'Please sign in to perform this action.'; end if;
  if exists (select 1 from public.rorisk_mines_games where user_uuid = p_user_uuid and state in ('created', 'running')) then
    raise exception 'You already have a running mines game.';
  end if;
  v_balance := case when p_currency = 'coins' then coalesce(v_user.coins, 0) else coalesce(v_user.rocoins, 0) end;
  if v_balance < p_amount then raise exception 'Insufficient balance.'; end if;

  if p_currency = 'coins' then
    update public.rorisk_users set coins = coalesce(coins, 0) - p_amount where uuid = p_user_uuid returning * into v_user;
  else
    update public.rorisk_users set rocoins = coalesce(rocoins, 0) - p_amount where uuid = p_user_uuid returning * into v_user;
  end if;

  insert into public.rorisk_mines_games (
    user_uuid, roblox_id, username, avatar_headshot, currency, bet_amount, mines_count, deck,
    client_seed, server_seed_hash, server_seed, nonce
  ) values (
    v_user.uuid, v_user.roblox_id, v_user.username, v_user.avatar_headshot, p_currency, p_amount, p_mines_count, p_deck,
    left(coalesce(p_client_seed, p_user_uuid::text), 128), p_server_seed_hash, p_server_seed, p_nonce
  ) returning * into v_game;

  return jsonb_build_object('game', to_jsonb(v_game) - 'deck' - 'server_seed', 'user', to_jsonb(v_user));
end;
$$;

create or replace function public.reveal_rorisk_mines(
  p_game_uuid uuid,
  p_user_uuid uuid,
  p_tile integer
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.rorisk_users%rowtype;
  v_game public.rorisk_mines_games%rowtype;
  v_is_mine boolean;
  v_reveals integer;
  v_multiplier numeric;
  v_payout bigint := 0;
begin
  if p_tile not between 0 and 24 then raise exception 'The selected tile is invalid.'; end if;
  select * into v_game from public.rorisk_mines_games where uuid = p_game_uuid for update;
  if not found or v_game.user_uuid <> p_user_uuid then raise exception 'You have no running mines game at the moment.'; end if;
  if v_game.state not in ('created', 'running') then raise exception 'You have no running mines game at the moment.'; end if;
  if exists (select 1 from jsonb_array_elements(v_game.revealed) as element(value) where (value ->> 'tile')::integer = p_tile) then
    raise exception 'This tile has already been revealed.';
  end if;
  v_is_mine := coalesce(v_game.deck ->> p_tile, 'coin') = 'mine';

  if v_is_mine then
    update public.rorisk_mines_games
    set revealed = revealed || jsonb_build_array(jsonb_build_object('tile', p_tile, 'value', 'mine')), state = 'completed', won = false,
        payout_amount = 0, completed_at = now(), updated_at = now()
    where uuid = p_game_uuid returning * into v_game;
  else
    v_reveals := jsonb_array_length(v_game.revealed) + 1;
    v_multiplier := public.rorisk_mines_multiplier(v_reveals, v_game.mines_count);
    if v_reveals = 25 - v_game.mines_count then
      v_payout := floor(v_game.bet_amount * v_multiplier)::bigint;
      if v_game.currency = 'coins' then
        update public.rorisk_users set coins = coalesce(coins, 0) + v_payout where uuid = p_user_uuid returning * into v_user;
      else
        update public.rorisk_users set rocoins = coalesce(rocoins, 0) + v_payout where uuid = p_user_uuid returning * into v_user;
      end if;
      update public.rorisk_mines_games
      set revealed = revealed || jsonb_build_array(jsonb_build_object('tile', p_tile, 'value', 'coin')), state = 'completed', multiplier = v_multiplier,
          won = true, payout_amount = v_payout, completed_at = now(), updated_at = now()
      where uuid = p_game_uuid returning * into v_game;
    else
      update public.rorisk_mines_games
      set revealed = revealed || jsonb_build_array(jsonb_build_object('tile', p_tile, 'value', 'coin')), state = 'running', multiplier = v_multiplier, updated_at = now()
      where uuid = p_game_uuid returning * into v_game;
    end if;
  end if;

  if v_user.uuid is null then select * into v_user from public.rorisk_users where uuid = p_user_uuid; end if;
  return jsonb_build_object('game', case when v_game.state = 'completed' then to_jsonb(v_game) else to_jsonb(v_game) - 'deck' - 'server_seed' end, 'user', to_jsonb(v_user), 'mine', v_is_mine);
end;
$$;

create or replace function public.cashout_rorisk_mines(
  p_game_uuid uuid,
  p_user_uuid uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.rorisk_users%rowtype;
  v_game public.rorisk_mines_games%rowtype;
  v_multiplier numeric;
  v_payout bigint;
begin
  select * into v_game from public.rorisk_mines_games where uuid = p_game_uuid for update;
  if not found or v_game.user_uuid <> p_user_uuid or v_game.state not in ('created', 'running') then
    raise exception 'You have no running mines game at the moment.';
  end if;
  if jsonb_array_length(v_game.revealed) < 1 then raise exception 'Reveal at least one tile before cashing out.'; end if;
  v_multiplier := public.rorisk_mines_multiplier(jsonb_array_length(v_game.revealed), v_game.mines_count);
  v_payout := floor(v_game.bet_amount * v_multiplier)::bigint;

  if v_game.currency = 'coins' then
    update public.rorisk_users set coins = coalesce(coins, 0) + v_payout where uuid = p_user_uuid returning * into v_user;
  else
    update public.rorisk_users set rocoins = coalesce(rocoins, 0) + v_payout where uuid = p_user_uuid returning * into v_user;
  end if;
  update public.rorisk_mines_games
  set state = 'completed', multiplier = v_multiplier, won = true, payout_amount = v_payout,
      completed_at = now(), updated_at = now()
  where uuid = p_game_uuid returning * into v_game;

  return jsonb_build_object('game', to_jsonb(v_game), 'user', to_jsonb(v_user));
end;
$$;

revoke all on function public.rorisk_mines_multiplier(integer, integer) from public, anon, authenticated;
revoke all on function public.start_rorisk_mines(uuid, bigint, text, integer, jsonb, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.reveal_rorisk_mines(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.cashout_rorisk_mines(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rorisk_mines_multiplier(integer, integer) to service_role;
grant execute on function public.start_rorisk_mines(uuid, bigint, text, integer, jsonb, text, text, text, bigint) to service_role;
grant execute on function public.reveal_rorisk_mines(uuid, uuid, integer) to service_role;
grant execute on function public.cashout_rorisk_mines(uuid, uuid) to service_role;

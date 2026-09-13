create table if not exists public.rorisk_upgrader_games (
  uuid uuid primary key default gen_random_uuid(),
  user_uuid uuid not null references public.rorisk_users(uuid) on delete cascade,
  roblox_id bigint,
  username text not null,
  avatar_headshot text,
  currency text not null check (currency in ('coins', 'rocoins')),
  bet_amount bigint not null check (bet_amount between 50 and 500000),
  target_asset_id bigint not null,
  target_name text not null,
  target_image text not null,
  target_value bigint not null check (target_value > 0),
  multiplier_bps integer not null check (multiplier_bps between 101 and 10000),
  mode text not null check (mode in ('under', 'over')),
  range_start integer not null check (range_start between 0 and 99999),
  win_threshold integer not null check (win_threshold between 1 and 99999),
  outcome integer not null check (outcome between 0 and 99999),
  won boolean not null,
  payout_amount bigint not null check (payout_amount >= 0),
  profit_amount bigint generated always as (payout_amount - bet_amount) stored,
  client_seed text not null,
  server_seed_hash text not null,
  server_seed text not null,
  nonce bigint not null check (nonce >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create index if not exists rorisk_upgrader_games_created_idx on public.rorisk_upgrader_games (created_at desc);
create index if not exists rorisk_upgrader_games_user_created_idx on public.rorisk_upgrader_games (user_uuid, created_at desc);

alter table public.rorisk_upgrader_games enable row level security;
revoke all on table public.rorisk_upgrader_games from anon, authenticated;
grant select, insert on table public.rorisk_upgrader_games to service_role;

create or replace function public.play_rorisk_upgrader(
  p_user_uuid uuid,
  p_amount bigint,
  p_currency text,
  p_target_asset_id bigint,
  p_target_name text,
  p_target_image text,
  p_target_value bigint,
  p_mode text,
  p_range_start integer,
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
  v_game public.rorisk_upgrader_games%rowtype;
  v_balance bigint;
  v_multiplier_bps integer;
  v_threshold integer;
  v_nonce bigint;
  v_hash text;
  v_outcome integer;
  v_offset integer;
  v_won boolean;
  v_payout bigint;
begin
  if p_currency not in ('coins', 'rocoins') then raise exception 'The selected currency is invalid.'; end if;
  if p_mode not in ('under', 'over') then raise exception 'The selected game mode is invalid.'; end if;
  if p_amount < 50 then raise exception 'You can only bet a min amount of 50 Coins per game.'; end if;
  if p_amount > 500000 then raise exception 'You can only bet a max amount of 500,000 Coins per game.'; end if;
  if p_target_asset_id < 1 or p_target_value < 1 or length(trim(coalesce(p_target_name, ''))) < 1 then raise exception 'The selected item is invalid.'; end if;
  if p_range_start not between 0 and 99999 then raise exception 'The selected ticket range is invalid.'; end if;
  if encode(digest(p_server_seed, 'sha256'), 'hex') <> p_server_seed_hash then raise exception 'The upgrader seed is invalid.'; end if;

  v_multiplier_bps := floor(p_target_value::numeric / p_amount::numeric * 100)::integer;
  if v_multiplier_bps not between 101 and 10000 then raise exception 'Payout must be 1.01x - 100x your bet. Bet more or pick a lower-value item.'; end if;
  v_threshold := floor(9000000::numeric / v_multiplier_bps)::integer;
  if v_threshold not between 1 and 99999 then raise exception 'The selected win chance is invalid.'; end if;

  select * into v_user from public.rorisk_users where uuid = p_user_uuid for update;
  if not found then raise exception 'Please sign in to perform this action.'; end if;
  v_balance := case when p_currency = 'coins' then coalesce(v_user.coins, 0) else coalesce(v_user.rocoins, 0) end;
  if v_balance < p_amount then raise exception 'Insufficient balance.'; end if;

  select coalesce(max(nonce) + 1, 0) into v_nonce from public.rorisk_upgrader_games where user_uuid = p_user_uuid;
  v_hash := encode(digest(p_server_seed || ':' || left(coalesce(p_client_seed, p_user_uuid::text), 128) || ':' || v_nonce::text, 'sha256'), 'hex');
  v_outcome := floor(((('x' || substr(v_hash, 1, 13))::bit(52)::bigint)::numeric / 4503599627370496::numeric) * 100000)::integer;
  v_offset := ((v_outcome - p_range_start) % 100000 + 100000) % 100000;
  v_won := v_offset < v_threshold;
  v_payout := case when v_won then p_target_value else 0 end;

  if p_currency = 'coins' then
    update public.rorisk_users set coins = coalesce(coins, 0) - p_amount + v_payout where uuid = p_user_uuid returning * into v_user;
  else
    update public.rorisk_users set rocoins = coalesce(rocoins, 0) - p_amount + v_payout where uuid = p_user_uuid returning * into v_user;
  end if;

  insert into public.rorisk_upgrader_games (
    user_uuid, roblox_id, username, avatar_headshot, currency, bet_amount, target_asset_id, target_name,
    target_image, target_value, multiplier_bps, mode, range_start, win_threshold, outcome, won, payout_amount,
    client_seed, server_seed_hash, server_seed, nonce
  ) values (
    v_user.uuid, v_user.roblox_id, v_user.username, v_user.avatar_headshot, p_currency, p_amount, p_target_asset_id,
    left(p_target_name, 200), left(p_target_image, 500), p_target_value, v_multiplier_bps, p_mode, p_range_start,
    v_threshold, v_outcome, v_won, v_payout, left(coalesce(p_client_seed, p_user_uuid::text), 128),
    p_server_seed_hash, p_server_seed, v_nonce
  ) returning * into v_game;

  return jsonb_build_object('game', to_jsonb(v_game), 'user', to_jsonb(v_user));
end;
$$;

revoke all on function public.play_rorisk_upgrader(uuid, bigint, text, bigint, text, text, bigint, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.play_rorisk_upgrader(uuid, bigint, text, bigint, text, text, bigint, text, integer, text, text, text) to service_role;

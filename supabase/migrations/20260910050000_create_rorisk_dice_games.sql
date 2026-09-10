create table if not exists public.rorisk_dice_games (
  uuid uuid primary key default gen_random_uuid(),
  user_uuid uuid not null references public.rorisk_users(uuid) on delete cascade,
  roblox_id bigint,
  username text not null,
  avatar_headshot text,
  currency text not null check (currency in ('coins', 'rocoins')),
  bet_amount bigint not null check (bet_amount > 0),
  mode text not null check (mode in ('under', 'over', 'inside', 'outside')),
  target_low integer not null check (target_low between 0 and 9999),
  target_high integer not null check (target_high between 0 and 9999),
  roll integer not null check (roll between 0 and 9999),
  win_chance numeric(7, 4) not null,
  multiplier numeric(14, 4) not null,
  won boolean not null,
  payout_amount bigint not null check (payout_amount >= 0),
  profit_amount bigint generated always as (payout_amount - bet_amount) stored,
  client_seed text not null,
  server_seed_hash text not null,
  server_seed text not null,
  nonce bigint not null check (nonce >= 0),
  created_at timestamptz not null default now()
);

create index if not exists rorisk_dice_games_created_idx on public.rorisk_dice_games (created_at desc);
create index if not exists rorisk_dice_games_user_created_idx on public.rorisk_dice_games (user_uuid, created_at desc);

alter table public.rorisk_dice_games enable row level security;
revoke all on table public.rorisk_dice_games from anon, authenticated;
grant select, insert on table public.rorisk_dice_games to service_role;

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

  v_win_tickets := case p_mode
    when 'under' then p_target_low
    when 'over' then 9999 - p_target_low
    when 'inside' then p_target_high - p_target_low + 1
    else p_target_low + (9999 - p_target_high)
  end;
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

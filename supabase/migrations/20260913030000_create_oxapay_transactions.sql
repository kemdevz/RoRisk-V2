create table if not exists public.rorisk_crypto_deposits (
  uuid uuid primary key default gen_random_uuid(),
  user_uuid uuid not null references public.rorisk_users(uuid) on delete restrict,
  track_id text unique,
  coin_amount bigint not null check (coin_amount > 0),
  usd_amount numeric(20, 2) not null check (usd_amount > 0),
  pay_amount numeric(36, 18),
  pay_currency text not null,
  network text not null,
  address text,
  memo text,
  qr_code text,
  status text not null default 'creating',
  credited boolean not null default false,
  expires_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.rorisk_crypto_withdrawals (
  uuid uuid primary key default gen_random_uuid(),
  user_uuid uuid not null references public.rorisk_users(uuid) on delete restrict,
  track_id text unique,
  coin_amount bigint not null check (coin_amount > 0),
  usd_amount numeric(20, 2) not null check (usd_amount > 0),
  crypto_amount numeric(36, 18) not null check (crypto_amount > 0),
  currency text not null,
  network text not null,
  address text not null,
  memo text,
  status text not null default 'reserved',
  refunded boolean not null default false,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists rorisk_crypto_deposits_user_created_idx on public.rorisk_crypto_deposits(user_uuid, created_at desc);
create index if not exists rorisk_crypto_withdrawals_user_created_idx on public.rorisk_crypto_withdrawals(user_uuid, created_at desc);

alter table public.rorisk_crypto_deposits enable row level security;
alter table public.rorisk_crypto_withdrawals enable row level security;
revoke all on public.rorisk_crypto_deposits, public.rorisk_crypto_withdrawals from public, anon, authenticated;
grant select, insert, update on public.rorisk_crypto_deposits, public.rorisk_crypto_withdrawals to service_role;

create or replace function public.finalize_rorisk_crypto_deposit(p_order_uuid uuid, p_track_id text, p_status text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_deposit public.rorisk_crypto_deposits%rowtype; v_user public.rorisk_users%rowtype;
begin
  select * into v_deposit from public.rorisk_crypto_deposits
  where (p_order_uuid is not null and uuid = p_order_uuid) or (p_track_id <> '' and track_id = p_track_id)
  order by case when p_order_uuid is not null and uuid = p_order_uuid then 0 else 1 end limit 1 for update;
  if not found then raise exception 'Payment record not found.'; end if;
  update public.rorisk_crypto_deposits set track_id = coalesce(track_id, nullif(p_track_id, '')), status = lower(p_status), provider_payload = coalesce(p_payload, '{}'::jsonb), updated_at = now() where uuid = v_deposit.uuid returning * into v_deposit;
  if lower(p_status) = 'paid' and not v_deposit.credited then
    update public.rorisk_crypto_deposits set credited = true, paid_at = now(), updated_at = now() where uuid = v_deposit.uuid and credited = false returning * into v_deposit;
    if found then update public.rorisk_users set coins = coalesce(coins, 0) + v_deposit.coin_amount where uuid = v_deposit.user_uuid returning * into v_user; end if;
  end if;
  return jsonb_build_object('deposit', to_jsonb(v_deposit), 'user', to_jsonb(v_user));
end; $$;

create or replace function public.reserve_rorisk_crypto_withdrawal(p_uuid uuid, p_user_uuid uuid, p_coin_amount bigint, p_usd_amount numeric, p_crypto_amount numeric, p_currency text, p_network text, p_address text, p_memo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user public.rorisk_users%rowtype; v_withdrawal public.rorisk_crypto_withdrawals%rowtype;
begin
  select * into v_user from public.rorisk_users where uuid = p_user_uuid for update;
  if not found then raise exception 'Please sign in to perform this action.'; end if;
  if coalesce(v_user.coins, 0) < p_coin_amount then raise exception 'Insufficient balance.'; end if;
  update public.rorisk_users set coins = coins - p_coin_amount where uuid = p_user_uuid returning * into v_user;
  insert into public.rorisk_crypto_withdrawals(uuid, user_uuid, coin_amount, usd_amount, crypto_amount, currency, network, address, memo)
  values (p_uuid, p_user_uuid, p_coin_amount, p_usd_amount, p_crypto_amount, upper(p_currency), p_network, p_address, p_memo) returning * into v_withdrawal;
  return jsonb_build_object('withdrawal', to_jsonb(v_withdrawal), 'user', to_jsonb(v_user));
end; $$;

create or replace function public.finalize_rorisk_crypto_withdrawal(p_uuid uuid, p_track_id text, p_status text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_withdrawal public.rorisk_crypto_withdrawals%rowtype; v_user public.rorisk_users%rowtype; v_status text := lower(p_status);
begin
  select * into v_withdrawal from public.rorisk_crypto_withdrawals
  where (p_uuid is not null and uuid = p_uuid) or (coalesce(p_track_id, '') <> '' and track_id = p_track_id)
  order by case when p_uuid is not null and uuid = p_uuid then 0 else 1 end limit 1 for update;
  if not found then raise exception 'Withdrawal record not found.'; end if;
  update public.rorisk_crypto_withdrawals set track_id = coalesce(track_id, nullif(p_track_id, '')), status = v_status, provider_payload = coalesce(p_payload, '{}'::jsonb), updated_at = now(), completed_at = case when v_status in ('confirmed', 'complete', 'failed', 'rejected') then now() else completed_at end where uuid = v_withdrawal.uuid returning * into v_withdrawal;
  if v_status in ('failed', 'rejected') and not v_withdrawal.refunded then
    update public.rorisk_crypto_withdrawals set refunded = true, updated_at = now() where uuid = v_withdrawal.uuid and refunded = false returning * into v_withdrawal;
    if found then update public.rorisk_users set coins = coalesce(coins, 0) + v_withdrawal.coin_amount where uuid = v_withdrawal.user_uuid returning * into v_user; end if;
  end if;
  return jsonb_build_object('withdrawal', to_jsonb(v_withdrawal), 'user', to_jsonb(v_user));
end; $$;

revoke all on function public.finalize_rorisk_crypto_deposit(uuid, text, text, jsonb), public.reserve_rorisk_crypto_withdrawal(uuid, uuid, bigint, numeric, numeric, text, text, text, text), public.finalize_rorisk_crypto_withdrawal(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_rorisk_crypto_deposit(uuid, text, text, jsonb), public.reserve_rorisk_crypto_withdrawal(uuid, uuid, bigint, numeric, numeric, text, text, text, text), public.finalize_rorisk_crypto_withdrawal(uuid, text, text, jsonb) to service_role;

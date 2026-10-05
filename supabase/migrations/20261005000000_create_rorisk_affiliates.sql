create table if not exists public.rorisk_affiliates (
  user_uuid uuid primary key references public.rorisk_users(uuid) on delete cascade,
  roblox_id bigint,
  username text not null,
  affiliate_code text,
  referrer_user_uuid uuid references public.rorisk_users(uuid) on delete set null,
  referred_at timestamptz,
  referred_users jsonb not null default '[]'::jsonb,
  code_updated_at timestamptz,
  reward_cases_claimed integer not null default 0 check (reward_cases_claimed between 0 and 4),
  reward_case_claims jsonb not null default '[]'::jsonb,
  total_wagered bigint not null default 0,
  total_wagered_rocoins bigint not null default 0,
  total_deposited bigint not null default 0,
  total_earnings bigint not null default 0,
  available_earnings bigint not null default 0,
  claimed_earnings bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rorisk_affiliates_not_self_referred check (referrer_user_uuid is null or referrer_user_uuid <> user_uuid),
  constraint rorisk_affiliates_code_format check (affiliate_code is null or affiliate_code ~ '^[A-Za-z0-9_]{3,12}$')
);

create unique index if not exists rorisk_affiliates_code_unique_idx
  on public.rorisk_affiliates (lower(affiliate_code))
  where affiliate_code is not null;
create index if not exists rorisk_affiliates_referrer_idx
  on public.rorisk_affiliates (referrer_user_uuid, referred_at desc);
create index if not exists rorisk_affiliates_roblox_id_idx
  on public.rorisk_affiliates (roblox_id)
  where roblox_id is not null;
create index if not exists rorisk_affiliates_username_idx
  on public.rorisk_affiliates (lower(username));

alter table public.rorisk_affiliates enable row level security;
revoke all on public.rorisk_affiliates from public, anon, authenticated;
grant select, insert, update on public.rorisk_affiliates to service_role;

create or replace function public.refresh_rorisk_referred_users(p_referrer_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_referrer_uuid is null then
    return;
  end if;
  update public.rorisk_affiliates as owner
  set referred_users = coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'uuid', referred.user_uuid,
            'roblox_id', referred.roblox_id,
            'username', referred.username,
            'referred_at', referred.referred_at
          ) order by referred.referred_at desc nulls last
        )
        from public.rorisk_affiliates as referred
        where referred.referrer_user_uuid = p_referrer_uuid
      ), '[]'::jsonb),
      updated_at = now()
  where owner.user_uuid = p_referrer_uuid;
end;
$$;

create or replace function public.sync_rorisk_referred_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_rorisk_referred_users(old.referrer_user_uuid);
    return old;
  end if;
  if tg_op = 'UPDATE' and old.referrer_user_uuid is distinct from new.referrer_user_uuid then
    perform public.refresh_rorisk_referred_users(old.referrer_user_uuid);
  end if;
  perform public.refresh_rorisk_referred_users(new.referrer_user_uuid);
  return new;
end;
$$;

drop trigger if exists sync_rorisk_referred_users on public.rorisk_affiliates;
create trigger sync_rorisk_referred_users
after insert or delete or update of referrer_user_uuid, roblox_id, username, referred_at on public.rorisk_affiliates
for each row execute function public.sync_rorisk_referred_users();

create or replace function public.sync_rorisk_affiliate_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select users.roblox_id, users.username
  into new.roblox_id, new.username
  from public.rorisk_users as users
  where users.uuid = new.user_uuid;
  if new.username is null then
    raise exception 'Affiliate user profile was not found.';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_rorisk_affiliate_identity on public.rorisk_affiliates;
create trigger sync_rorisk_affiliate_identity
before insert or update of user_uuid on public.rorisk_affiliates
for each row execute function public.sync_rorisk_affiliate_identity();

create or replace function public.propagate_rorisk_affiliate_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rorisk_affiliates
  set roblox_id = new.roblox_id,
      username = new.username,
      updated_at = now()
  where user_uuid = new.uuid;
  return new;
end;
$$;

drop trigger if exists propagate_rorisk_affiliate_identity on public.rorisk_users;
create trigger propagate_rorisk_affiliate_identity
after update of roblox_id, username on public.rorisk_users
for each row execute function public.propagate_rorisk_affiliate_identity();

revoke all on function public.refresh_rorisk_referred_users(uuid), public.sync_rorisk_referred_users(), public.sync_rorisk_affiliate_identity(), public.propagate_rorisk_affiliate_identity() from public, anon, authenticated;

create or replace function public.set_rorisk_affiliate_code(p_user_uuid uuid, p_code text)
returns public.rorisk_affiliates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := trim(p_code);
  v_row public.rorisk_affiliates%rowtype;
begin
  if v_code !~ '^[A-Za-z0-9_]{3,12}$' then
    raise exception 'Your entered affiliate code is invalid.';
  end if;
  if exists (
    select 1 from public.rorisk_affiliates
    where lower(affiliate_code) = lower(v_code) and user_uuid <> p_user_uuid
  ) then
    raise exception 'This affiliate code is already in use.';
  end if;
  insert into public.rorisk_affiliates (user_uuid, affiliate_code, code_updated_at)
  values (p_user_uuid, v_code, now())
  on conflict (user_uuid) do update
  set affiliate_code = excluded.affiliate_code,
      code_updated_at = now(),
      updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.redeem_rorisk_affiliate_code(p_user_uuid uuid, p_code text)
returns public.rorisk_affiliates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := trim(p_code);
  v_referrer uuid;
  v_existing public.rorisk_affiliates%rowtype;
  v_row public.rorisk_affiliates%rowtype;
begin
  if v_code !~ '^[A-Za-z0-9_]{3,12}$' then
    raise exception 'Your entered referral code is invalid.';
  end if;
  select user_uuid into v_referrer
  from public.rorisk_affiliates
  where lower(affiliate_code) = lower(v_code)
  limit 1;
  if v_referrer is null or v_referrer = p_user_uuid then
    raise exception 'Your entered referral code is invalid.';
  end if;
  select * into v_existing from public.rorisk_affiliates where user_uuid = p_user_uuid for update;
  if found and v_existing.referrer_user_uuid is not null
    and v_existing.referrer_user_uuid <> v_referrer
    and coalesce(v_existing.referred_at, now()) + interval '14 days' > now() then
    raise exception 'You cannot switch this referral code yet.';
  end if;
  insert into public.rorisk_affiliates (user_uuid, referrer_user_uuid, referred_at)
  values (p_user_uuid, v_referrer, now())
  on conflict (user_uuid) do update
  set referrer_user_uuid = excluded.referrer_user_uuid,
      referred_at = excluded.referred_at,
      updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.claim_rorisk_affiliate_earnings(p_user_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affiliate public.rorisk_affiliates%rowtype;
  v_user public.rorisk_users%rowtype;
begin
  select * into v_affiliate from public.rorisk_affiliates where user_uuid = p_user_uuid for update;
  if not found or coalesce(v_affiliate.available_earnings, 0) <= 0 then
    raise exception 'You have no earnings available to claim.';
  end if;
  update public.rorisk_users
  set coins = coalesce(coins, 0) + v_affiliate.available_earnings
  where uuid = p_user_uuid
  returning * into v_user;
  update public.rorisk_affiliates
  set claimed_earnings = claimed_earnings + available_earnings,
      available_earnings = 0,
      updated_at = now()
  where user_uuid = p_user_uuid
  returning * into v_affiliate;
  return jsonb_build_object('affiliate', to_jsonb(v_affiliate), 'user', to_jsonb(v_user));
end;
$$;

create or replace function public.open_rorisk_welcome_case(
  p_user_uuid uuid,
  p_currency text,
  p_item jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affiliate public.rorisk_affiliates%rowtype;
  v_user public.rorisk_users%rowtype;
  v_claim jsonb;
  v_payout bigint;
begin
  select * into v_affiliate from public.rorisk_affiliates where user_uuid = p_user_uuid for update;
  if not found or v_affiliate.referrer_user_uuid is null then
    raise exception 'Redeem an affiliate code to unlock reward cases.';
  end if;
  if v_affiliate.reward_cases_claimed >= 4 then
    raise exception 'You have already claimed this reward case.';
  end if;
  if not exists (
    select 1 from public.rorisk_crypto_deposits
    where user_uuid = p_user_uuid and credited = true
    group by user_uuid having sum(usd_amount) >= 10
  ) then
    raise exception 'You need to deposit at least $10 to open welcome cases.';
  end if;
  v_payout := greatest(0, trunc(coalesce(
    case when lower(p_currency) = 'coins' then p_item ->> 'coinPrice' else p_item ->> 'rocoinPrice' end,
    p_item ->> 'price',
    '0'
  )::numeric));
  if lower(p_currency) = 'coins' then
    update public.rorisk_users set coins = coalesce(coins, 0) + v_payout where uuid = p_user_uuid returning * into v_user;
  else
    update public.rorisk_users set rocoins = coalesce(rocoins, 0) + v_payout where uuid = p_user_uuid returning * into v_user;
  end if;
  v_claim := jsonb_build_object(
    'index', v_affiliate.reward_cases_claimed + 1,
    'currency', lower(p_currency),
    'payout', v_payout,
    'item', p_item,
    'claimedAt', now()
  );
  update public.rorisk_affiliates
  set reward_cases_claimed = reward_cases_claimed + 1,
      reward_case_claims = reward_case_claims || jsonb_build_array(v_claim),
      updated_at = now()
  where user_uuid = p_user_uuid
  returning * into v_affiliate;
  return jsonb_build_object('affiliate', to_jsonb(v_affiliate), 'user', to_jsonb(v_user), 'claim', v_claim);
end;
$$;

revoke all on function public.set_rorisk_affiliate_code(uuid, text), public.redeem_rorisk_affiliate_code(uuid, text), public.claim_rorisk_affiliate_earnings(uuid), public.open_rorisk_welcome_case(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.set_rorisk_affiliate_code(uuid, text), public.redeem_rorisk_affiliate_code(uuid, text), public.claim_rorisk_affiliate_earnings(uuid), public.open_rorisk_welcome_case(uuid, text, jsonb) to service_role;

create or replace function public.credit_rorisk_affiliate_deposit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
  v_earnings bigint;
begin
  if new.credited is not true or (tg_op = 'UPDATE' and old.credited is true) then
    return new;
  end if;
  insert into public.rorisk_affiliates (user_uuid, total_deposited)
  values (new.user_uuid, new.coin_amount)
  on conflict (user_uuid) do update
  set total_deposited = rorisk_affiliates.total_deposited + excluded.total_deposited,
      updated_at = now();
  select referrer_user_uuid into v_referrer from public.rorisk_affiliates where user_uuid = new.user_uuid;
  if v_referrer is not null then
    v_earnings := greatest(0, floor(new.coin_amount * 0.10));
    insert into public.rorisk_affiliates (user_uuid, total_earnings, available_earnings)
    values (v_referrer, v_earnings, v_earnings)
    on conflict (user_uuid) do update
    set total_earnings = rorisk_affiliates.total_earnings + excluded.total_earnings,
        available_earnings = rorisk_affiliates.available_earnings + excluded.available_earnings,
        updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists credit_rorisk_affiliate_deposit on public.rorisk_crypto_deposits;
create trigger credit_rorisk_affiliate_deposit
after insert or update of credited on public.rorisk_crypto_deposits
for each row execute function public.credit_rorisk_affiliate_deposit();

revoke all on function public.credit_rorisk_affiliate_deposit() from public, anon, authenticated;

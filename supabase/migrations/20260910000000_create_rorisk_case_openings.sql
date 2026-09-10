create table if not exists public.rorisk_case_openings (
  uuid uuid primary key default gen_random_uuid(),
  user_uuid uuid not null references public.rorisk_users(uuid) on delete cascade,
  roblox_id bigint,
  username text not null,
  avatar_headshot text not null default '/default-avatar.png',
  case_uuid uuid not null references public.rorisk_cases(uuid) on delete restrict,
  case_id text not null,
  case_name text not null,
  currency text not null default 'rocoins' check (currency in ('coins', 'rocoins')),
  case_count smallint not null check (case_count between 1 and 4),
  wager_amount bigint not null check (wager_amount >= 0),
  payout_amount bigint not null check (payout_amount >= 0),
  profit_amount bigint generated always as (payout_amount - wager_amount) stored,
  outcomes jsonb not null check (jsonb_typeof(outcomes) = 'array'),
  client_seed text not null,
  server_seed_hash text not null,
  server_seed text not null,
  nonce bigint not null check (nonce >= 0),
  status text not null default 'completed' check (status in ('pending', 'completed', 'cancelled', 'refunded')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists rorisk_case_openings_user_created_idx
  on public.rorisk_case_openings (user_uuid, created_at desc);

create index if not exists rorisk_case_openings_case_created_idx
  on public.rorisk_case_openings (case_id, created_at desc);

alter table public.rorisk_case_openings enable row level security;

revoke all on table public.rorisk_case_openings from anon, authenticated;
grant select, insert, update, delete on table public.rorisk_case_openings to service_role;

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
  if p_case_count not between 1 and 4 then
    raise exception 'Select between 1 and 4 cases.';
  end if;

  if encode(digest(p_server_seed, 'sha256'), 'hex') <> p_server_seed_hash then
    raise exception 'The case seed is invalid.';
  end if;

  select * into v_user
  from public.rorisk_users
  where uuid = p_user_uuid
  for update;

  if not found then
    raise exception 'Please sign in to perform this action.';
  end if;

  select * into v_case
  from public.rorisk_cases
  where case_id = p_case_id and active = true;

  if not found then
    raise exception 'This case could not be found.';
  end if;

  v_items := v_case.items;
  if jsonb_array_length(v_items) = 0 then
    raise exception 'This case has no available items.';
  end if;

  v_wager := v_case.rocoin_amount * p_case_count;
  if coalesce(v_user.rocoins, 0) < v_wager then
    raise exception 'Insufficient balance.';
  end if;

  select coalesce(max(nonce + case_count), 0) into v_nonce
  from public.rorisk_case_openings
  where user_uuid = p_user_uuid;

  for v_index in 0..p_case_count - 1 loop
    v_hash := encode(digest(p_server_seed || ':' || p_client_seed || ':' || (v_nonce + v_index)::text, 'sha256'), 'hex');
    v_roll := ((('x' || substr(v_hash, 1, 13))::bit(52)::bigint)::numeric / 4503599627370496::numeric) * 100;
    v_cumulative := 0;
    v_selected := null;

    for v_item in select value from jsonb_array_elements(v_items) loop
      v_chance := coalesce(nullif(replace(v_item->>'chance', '%', ''), '')::numeric, 0);
      v_cumulative := v_cumulative + v_chance;
      if v_roll <= v_cumulative then
        v_selected := v_item;
        exit;
      end if;
    end loop;

    if v_selected is null then
      v_selected := v_items->(jsonb_array_length(v_items) - 1);
    end if;

    v_payout := v_payout + greatest(0, coalesce((v_selected->>'price')::bigint, 0));
    v_outcomes := v_outcomes || jsonb_build_array(jsonb_build_object(
      'outcome', round(v_roll, 6),
      'item', v_selected
    ));
  end loop;

  update public.rorisk_users
  set rocoins = coalesce(rocoins, 0) - v_wager + v_payout
  where uuid = p_user_uuid
  returning * into v_user;

  insert into public.rorisk_case_openings (
    user_uuid, roblox_id, username, avatar_headshot, case_uuid, case_id, case_name, currency,
    case_count, wager_amount, payout_amount, outcomes, client_seed,
    server_seed_hash, server_seed, nonce, status, completed_at
  ) values (
    p_user_uuid, v_user.roblox_id, v_user.username, v_user.avatar_headshot, v_case.uuid, v_case.case_id, v_case.name, 'rocoins',
    p_case_count, v_wager, v_payout, v_outcomes, p_client_seed,
    p_server_seed_hash, p_server_seed, v_nonce, 'completed', now()
  ) returning * into v_opening;

  return jsonb_build_object('opening', to_jsonb(v_opening), 'user', to_jsonb(v_user));
end;
$$;

revoke all on function public.open_rorisk_case(uuid, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.open_rorisk_case(uuid, text, integer, text, text, text) to service_role;

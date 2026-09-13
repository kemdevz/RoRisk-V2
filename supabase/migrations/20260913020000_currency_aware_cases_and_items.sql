alter table public.rorisk_cases add column if not exists coin_amount bigint;

update public.rorisk_cases
set coin_amount = greatest(0, rocoin_amount),
    rocoin_amount = greatest(0, rocoin_amount) * 5
where coin_amount is null;

alter table public.rorisk_cases alter column coin_amount set not null;
alter table public.rorisk_cases drop constraint if exists rorisk_cases_coin_amount_check;
alter table public.rorisk_cases add constraint rorisk_cases_coin_amount_check check (coin_amount >= 0);

update public.rorisk_cases as cases
set items = normalized.items,
    updated_at = now()
from (
  select uuid,
         coalesce(jsonb_agg(
           item || jsonb_build_object(
             'coinPrice', greatest(0, coalesce(nullif(item->>'coinPrice', '')::bigint, nullif(item->>'coin_price', '')::bigint, nullif(item->>'price', '')::bigint, nullif(item->>'amount', '')::bigint, 0)),
             'rocoinPrice', greatest(0, coalesce(nullif(item->>'rocoinPrice', '')::bigint, nullif(item->>'rocoin_price', '')::bigint, coalesce(nullif(item->>'coinPrice', '')::bigint, nullif(item->>'coin_price', '')::bigint, nullif(item->>'price', '')::bigint, nullif(item->>'amount', '')::bigint, 0) * 5))
           ) order by ordinal
         ), '[]'::jsonb) as items
  from public.rorisk_cases
  cross join lateral jsonb_array_elements(items) with ordinality as entry(item, ordinal)
  group by uuid
) as normalized
where normalized.uuid = cases.uuid;

alter table public.rorisk_limited_items add column if not exists coin_value bigint;
alter table public.rorisk_limited_items add column if not exists rocoin_value bigint;

update public.rorisk_limited_items
set coin_value = least(40000000, floor(greatest(0, case when coalesce(value, 0) > 0 then value when coalesce(default_value, 0) > 0 then default_value else coalesce(rap, 0) end))),
    rocoin_value = least(40000000, floor(greatest(0, case when coalesce(value, 0) > 0 then value when coalesce(default_value, 0) > 0 then default_value else coalesce(rap, 0) end))),
    image_url = '/api/limited-items/' || asset_id::text || '/image',
    updated_at = now()
where coin_value is null
   or rocoin_value is null
   or image_url is null
   or btrim(image_url) = '';

alter table public.rorisk_limited_items alter column coin_value set not null;
alter table public.rorisk_limited_items alter column rocoin_value set not null;
alter table public.rorisk_limited_items add constraint rorisk_limited_items_coin_value_check check (coin_value >= 0);
alter table public.rorisk_limited_items add constraint rorisk_limited_items_rocoin_value_check check (rocoin_value >= 0);

drop view if exists public.rorisk_items;
create view public.rorisk_items
with (security_invoker = true)
as select * from public.rorisk_limited_items;

revoke all on public.rorisk_items from public, anon, authenticated;
grant select on public.rorisk_items to service_role;

drop function if exists public.open_rorisk_case(uuid, text, integer, text, text, text);

create or replace function public.open_rorisk_case(
  p_user_uuid uuid,
  p_case_id text,
  p_case_count integer,
  p_currency text,
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
  v_public_item jsonb;
  v_outcomes jsonb := '[]'::jsonb;
  v_hash text;
  v_roll numeric;
  v_cumulative numeric;
  v_chance numeric;
  v_nonce bigint;
  v_wager bigint;
  v_payout bigint := 0;
  v_item_price bigint;
  v_index integer;
begin
  if p_case_count not between 1 and 4 then raise exception 'Select between 1 and 4 cases.'; end if;
  if p_currency not in ('coins', 'rocoins') then raise exception 'The selected currency is invalid.'; end if;
  if encode(digest(p_server_seed, 'sha256'), 'hex') <> p_server_seed_hash then raise exception 'The case seed is invalid.'; end if;

  select * into v_user from public.rorisk_users where uuid = p_user_uuid for update;
  if not found then raise exception 'Please sign in to perform this action.'; end if;
  select * into v_case from public.rorisk_cases where case_id = p_case_id and active = true;
  if not found then raise exception 'This case could not be found.'; end if;

  v_items := v_case.items;
  if jsonb_array_length(v_items) = 0 then raise exception 'This case has no available items.'; end if;
  v_wager := (case when p_currency = 'coins' then v_case.coin_amount else v_case.rocoin_amount end) * p_case_count;
  if (case when p_currency = 'coins' then coalesce(v_user.coins, 0) else coalesce(v_user.rocoins, 0) end) < v_wager then raise exception 'Insufficient balance.'; end if;

  select coalesce(max(nonce + case_count), 0) into v_nonce from public.rorisk_case_openings where user_uuid = p_user_uuid;
  for v_index in 0..p_case_count - 1 loop
    v_hash := encode(digest(p_server_seed || ':' || p_client_seed || ':' || (v_nonce + v_index)::text, 'sha256'), 'hex');
    v_roll := ((('x' || substr(v_hash, 1, 13))::bit(52)::bigint)::numeric / 4503599627370496::numeric) * 100;
    v_cumulative := 0;
    v_selected := null;
    for v_item in select value from jsonb_array_elements(v_items) loop
      v_chance := coalesce(nullif(replace(v_item->>'chance', '%', ''), '')::numeric, 0);
      v_cumulative := v_cumulative + v_chance;
      if v_roll <= v_cumulative then v_selected := v_item; exit; end if;
    end loop;
    if v_selected is null then v_selected := v_items->(jsonb_array_length(v_items) - 1); end if;
    v_item_price := greatest(0, case when p_currency = 'coins'
      then coalesce(nullif(v_selected->>'coinPrice', '')::bigint, floor(coalesce(nullif(v_selected->>'price', '')::bigint, 0)::numeric / 5)::bigint)
      else coalesce(nullif(v_selected->>'rocoinPrice', '')::bigint, nullif(v_selected->>'price', '')::bigint, 0)
    end);
    v_public_item := v_selected || jsonb_build_object('price', v_item_price, 'coinPrice', coalesce(nullif(v_selected->>'coinPrice', '')::bigint, floor(v_item_price::numeric / case when p_currency = 'coins' then 1 else 5 end)::bigint), 'rocoinPrice', coalesce(nullif(v_selected->>'rocoinPrice', '')::bigint, v_item_price * case when p_currency = 'coins' then 5 else 1 end));
    v_payout := v_payout + v_item_price;
    v_outcomes := v_outcomes || jsonb_build_array(jsonb_build_object('outcome', round(v_roll, 6), 'item', v_public_item));
  end loop;

  if p_currency = 'coins' then
    update public.rorisk_users set coins = coalesce(coins, 0) - v_wager + v_payout where uuid = p_user_uuid returning * into v_user;
  else
    update public.rorisk_users set rocoins = coalesce(rocoins, 0) - v_wager + v_payout where uuid = p_user_uuid returning * into v_user;
  end if;
  insert into public.rorisk_case_openings (
    user_uuid, roblox_id, username, avatar_headshot, case_uuid, case_id, case_name, currency, case_count, wager_amount,
    payout_amount, outcomes, client_seed, server_seed_hash, server_seed, nonce, status, completed_at
  ) values (
    p_user_uuid, v_user.roblox_id, v_user.username, v_user.avatar_headshot, v_case.uuid, v_case.case_id, v_case.name, p_currency, p_case_count, v_wager,
    v_payout, v_outcomes, p_client_seed, p_server_seed_hash, p_server_seed, v_nonce, 'completed', now()
  ) returning * into v_opening;
  return jsonb_build_object('opening', to_jsonb(v_opening), 'user', to_jsonb(v_user));
end;
$$;

revoke all on function public.open_rorisk_case(uuid, text, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function public.open_rorisk_case(uuid, text, integer, text, text, text, text) to service_role;

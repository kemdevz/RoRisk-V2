alter table public.rorisk_cases
  add column if not exists risk_level numeric(7, 4);

create or replace function public.calculate_rorisk_case_risk_level(
  p_items jsonb,
  p_coin_amount bigint
)
returns numeric
language sql
immutable
set search_path = public
as $$
  with parsed_items as (
    select
      coalesce(
        nullif(regexp_replace(item ->> 'chance', '[^0-9.-]', '', 'g'), '')::numeric,
        case
          when nullif(item ->> 'tickets', '') is not null
            then (item ->> 'tickets')::numeric / 1000
          else 0
        end
      ) as chance_percent,
      coalesce(
        nullif(item ->> 'coinPrice', '')::numeric,
        nullif(item ->> 'coin_price', '')::numeric,
        nullif(item ->> 'price', '')::numeric,
        nullif(item ->> 'amount', '')::numeric,
        0
      ) as item_value
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as entry(item)
  ), totals as (
    select
      coalesce(sum(chance_percent), 0) as total_chance,
      coalesce(sum(chance_percent) filter (where item_value < greatest(p_coin_amount, 0)), 0) as losing_chance
    from parsed_items
  )
  select case
    when total_chance <= 0 then 50.0000
    else round(least(100, greatest(0, losing_chance / total_chance * 100)), 4)
  end
  from totals;
$$;

create or replace function public.set_rorisk_case_risk_level()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.risk_level is null then
      new.risk_level := public.calculate_rorisk_case_risk_level(new.items, new.coin_amount);
    end if;
  elsif new.risk_level is not distinct from old.risk_level
    and (
      new.items is distinct from old.items
      or new.coin_amount is distinct from old.coin_amount
    ) then
    new.risk_level := public.calculate_rorisk_case_risk_level(new.items, new.coin_amount);
  end if;
  return new;
end;
$$;

update public.rorisk_cases
set risk_level = public.calculate_rorisk_case_risk_level(items, coin_amount)
where risk_level is null;

alter table public.rorisk_cases
  alter column risk_level drop default,
  alter column risk_level set not null;

alter table public.rorisk_cases
  drop constraint if exists rorisk_cases_risk_level_check;

alter table public.rorisk_cases
  add constraint rorisk_cases_risk_level_check
  check (risk_level >= 0 and risk_level <= 100);

drop trigger if exists set_rorisk_case_risk_level on public.rorisk_cases;

create trigger set_rorisk_case_risk_level
before insert or update of items, coin_amount, risk_level
on public.rorisk_cases
for each row
execute function public.set_rorisk_case_risk_level();

comment on column public.rorisk_cases.risk_level is
  'Percentage chance that an opening returns an item worth less than the case price.';

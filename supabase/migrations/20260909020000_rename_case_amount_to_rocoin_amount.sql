do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rorisk_cases'
      and column_name = 'amount'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rorisk_cases'
      and column_name = 'rocoin_amount'
  ) then
    alter table public.rorisk_cases rename column amount to rocoin_amount;
  end if;
end
$$;

drop index if exists public.rorisk_cases_active_order_idx;

create index if not exists rorisk_cases_active_order_idx
  on public.rorisk_cases (active, sort_order, rocoin_amount desc);

comment on column public.rorisk_cases.rocoin_amount is
  'Case price in display-unit RoCoins.';

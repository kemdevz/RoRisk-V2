update public.rorisk_rains
set
  starts_at = created_at + interval '28 minutes',
  ends_at = created_at + interval '30 minutes',
  join_ends_at = created_at + interval '30 minutes',
  updated_at = now()
where status in ('created', 'running')
  and (
    ends_at > created_at + interval '30 minutes'
    or starts_at is distinct from ends_at - interval '2 minutes'
    or join_ends_at is distinct from ends_at
  );

create or replace function public.rorisk_get_or_create_active_rain()
returns setof public.rorisk_rains
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rain public.rorisk_rains;
begin
  perform pg_advisory_xact_lock(hashtext('rorisk-single-active-rain'));

  select * into v_rain
  from public.rorisk_rains
  where status in ('created', 'running')
  order by
    coin_amount desc,
    jsonb_array_length(entries) desc,
    ends_at asc,
    created_at asc,
    uuid asc
  limit 1
  for update;

  if v_rain.uuid is not null then
    if v_rain.ends_at > v_rain.created_at + interval '30 minutes'
      or v_rain.starts_at is distinct from v_rain.ends_at - interval '2 minutes'
      or v_rain.join_ends_at is distinct from v_rain.ends_at then
      update public.rorisk_rains
      set
        starts_at = least(ends_at, created_at + interval '30 minutes') - interval '2 minutes',
        ends_at = least(ends_at, created_at + interval '30 minutes'),
        join_ends_at = least(ends_at, created_at + interval '30 minutes'),
        updated_at = now()
      where uuid = v_rain.uuid
      returning * into v_rain;
    end if;

    update public.rorisk_rains
    set status = 'completed', updated_at = now()
    where uuid <> v_rain.uuid
      and status in ('created', 'running')
      and jsonb_array_length(entries) = 0
      and jsonb_array_length(tips) = 0;

    return next v_rain;
    return;
  end if;

  insert into public.rorisk_rains (
    status,
    coin_amount,
    entries,
    tips,
    starts_at,
    ends_at,
    join_ends_at
  ) values (
    'created',
    200,
    '[]'::jsonb,
    '[]'::jsonb,
    now() + interval '28 minutes',
    now() + interval '30 minutes',
    now() + interval '30 minutes'
  )
  returning * into v_rain;

  return next v_rain;
end;
$$;

revoke all on function public.rorisk_get_or_create_active_rain() from public, anon, authenticated;
grant execute on function public.rorisk_get_or_create_active_rain() to service_role;

comment on function public.rorisk_get_or_create_active_rain() is
  'Atomically returns one active rain, clamps legacy cycles to 30 minutes, or creates a new 30-minute cycle.';

create table if not exists public.rorisk_limited_items (
  asset_id bigint primary key check (asset_id > 0),
  name text not null,
  acronym text not null default '',
  rap bigint not null default 0 check (rap >= 0),
  value bigint not null default 0 check (value >= 0),
  default_value bigint not null default 0 check (default_value >= 0),
  demand integer,
  trend integer,
  projected boolean not null default false,
  hyped boolean not null default false,
  rare boolean not null default false,
  image_url text not null,
  active boolean not null default true,
  catalog_source text not null default 'rolimons',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rorisk_limited_items_active_value_idx
  on public.rorisk_limited_items (active, value desc, rap desc);

create index if not exists rorisk_limited_items_name_idx
  on public.rorisk_limited_items (lower(name));

alter table public.rorisk_limited_items enable row level security;
revoke all on table public.rorisk_limited_items from anon, authenticated;
grant select, insert, update on table public.rorisk_limited_items to service_role;

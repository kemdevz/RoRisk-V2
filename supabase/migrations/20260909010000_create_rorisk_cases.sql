create extension if not exists pgcrypto;

create table if not exists public.rorisk_cases (
  uuid uuid primary key default gen_random_uuid(),
  case_id text not null unique,
  name text not null,
  slug text not null unique,
  rocoin_amount bigint not null check (rocoin_amount >= 0),
  type text not null default 'limiteds',
  categories text[] not null default array['featured']::text[],
  level_min integer check (level_min is null or level_min >= 0),
  image_url text not null,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rorisk_cases_active_order_idx
  on public.rorisk_cases (active, sort_order, rocoin_amount desc);

create index if not exists rorisk_cases_categories_idx
  on public.rorisk_cases using gin (categories);

alter table public.rorisk_cases enable row level security;

revoke all on table public.rorisk_cases from anon, authenticated;
grant select, insert, update, delete on table public.rorisk_cases to service_role;

comment on table public.rorisk_cases is
  'Server-managed case catalogue. rocoin_amount stores display-unit RoCoins.';

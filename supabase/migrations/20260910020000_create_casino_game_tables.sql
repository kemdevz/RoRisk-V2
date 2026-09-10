create extension if not exists pgcrypto;

create table if not exists public.rorisk_slots (
  uuid uuid primary key default gen_random_uuid(),
  game_code text not null unique,
  game_name text not null,
  provider text not null,
  provider_code text not null,
  image_url text,
  launch_count bigint not null default 0,
  popular_rank integer not null default 0,
  newest_rank integer,
  demo_support boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rorisk_live_games (
  uuid uuid primary key default gen_random_uuid(),
  game_code text not null unique,
  game_name text not null,
  provider text not null,
  provider_code text not null,
  image_url text,
  launch_count bigint not null default 0,
  popular_rank integer not null default 0,
  newest_rank integer,
  demo_support boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rorisk_slots_active_popular_idx on public.rorisk_slots (active, popular_rank);
create index if not exists rorisk_slots_active_newest_idx on public.rorisk_slots (active, newest_rank);
create index if not exists rorisk_slots_provider_idx on public.rorisk_slots (provider_code);
create index if not exists rorisk_live_games_active_popular_idx on public.rorisk_live_games (active, popular_rank);
create index if not exists rorisk_live_games_active_newest_idx on public.rorisk_live_games (active, newest_rank);
create index if not exists rorisk_live_games_provider_idx on public.rorisk_live_games (provider_code);

alter table public.rorisk_slots enable row level security;
alter table public.rorisk_live_games enable row level security;

create or replace function public.set_casino_game_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_rorisk_slots_updated_at on public.rorisk_slots;
create trigger set_rorisk_slots_updated_at
before update on public.rorisk_slots
for each row execute function public.set_casino_game_updated_at();

drop trigger if exists set_rorisk_live_games_updated_at on public.rorisk_live_games;
create trigger set_rorisk_live_games_updated_at
before update on public.rorisk_live_games
for each row execute function public.set_casino_game_updated_at();

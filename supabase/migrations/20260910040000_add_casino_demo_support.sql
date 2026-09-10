alter table public.rorisk_slots
  add column if not exists demo_support boolean not null default false;

alter table public.rorisk_live_games
  add column if not exists demo_support boolean not null default false;

create extension if not exists pgcrypto;

create table if not exists public.rorisk_users (
  uuid uuid primary key default gen_random_uuid(),
  roblox_id bigint unique,
  username text not null,
  avatar_headshot text not null default '/default-avatar.png',
  coins bigint not null default 0 check (coins >= 0),
  rocoins bigint not null default 0 check (rocoins >= 0),
  rank text not null default 'user',
  level integer not null default 0 check (level >= 0),
  email text unique,
  joined_at timestamptz not null default now()
);

alter table public.rorisk_users enable row level security;

revoke all on table public.rorisk_users from anon, authenticated;
grant select, insert, update, delete on table public.rorisk_users to service_role;

comment on table public.rorisk_users is
  'Server-managed RoRisk profiles. Balance, rank and progression writes require the service role.';

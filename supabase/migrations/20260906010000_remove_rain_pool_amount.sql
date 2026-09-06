alter table public.rorisk_rains
  drop column if exists pool_amount;

notify pgrst, 'reload schema';

insert into public.rorisk_cases (
  case_id,
  name,
  slug,
  coin_amount,
  rocoin_amount,
  type,
  categories,
  level_min,
  image_url,
  items,
  sort_order,
  active,
  risk_level
)
values (
  '6abc52a32512db6b65a8f5c9',
  'Welcome Chicken',
  'welcome-chicken',
  2,
  12,
  'site',
  array['rewards']::text[],
  null,
  '/Welcome/welcome-chicken.4c912e1c.png',
  '[
    {
      "id": "6abc55f9f1205813968830f2",
      "itemId": "685a0c23831c062328d2d390",
      "name": "Telamon''s Chicken Suit",
      "image": "/api/case-images/items/24112667.png",
      "index": 1,
      "tickets": 1,
      "chance": "0.001%",
      "color": "yellow",
      "price": 125000,
      "coinPrice": 125000,
      "rocoinPrice": 625000
    },
    {
      "id": "6abc55f9f1205813968830f3",
      "itemId": "685a0c57831c062328d2e34d",
      "name": "Fried Chicken Egg",
      "image": "/api/case-images/items/4786883113.png",
      "index": 2,
      "tickets": 99999,
      "chance": "99.999%",
      "color": "blue",
      "price": 1,
      "coinPrice": 1,
      "rocoinPrice": 5
    }
  ]'::jsonb,
  0,
  true,
  99.3216
)
on conflict (slug) do update
set name = excluded.name,
    slug = excluded.slug,
    coin_amount = excluded.coin_amount,
    rocoin_amount = excluded.rocoin_amount,
    type = excluded.type,
    categories = excluded.categories,
    level_min = excluded.level_min,
    image_url = excluded.image_url,
    items = excluded.items,
    sort_order = excluded.sort_order,
    active = excluded.active,
    risk_level = excluded.risk_level,
    updated_at = now();

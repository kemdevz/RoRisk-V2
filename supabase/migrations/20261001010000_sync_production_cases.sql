drop trigger if exists set_rorisk_case_risk_level on public.rorisk_cases;

alter table public.rorisk_cases
  alter column risk_level type numeric(7, 4);

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

create trigger set_rorisk_case_risk_level
before insert or update of items, coin_amount, risk_level
on public.rorisk_cases
for each row
execute function public.set_rorisk_case_risk_level();

with production_cases(case_id, name, slug, raw_amount, type, categories, risk_level, sort_order) as (
values
  ('6966cca0cb50b3e66c54b28d', 'Sword Pack', 'sword-pack', 2585202, 'limiteds', array['featured']::text[], 75.5403, 0),
  ('6966d0e0cb50b3e66c54bc76', 'Crown Casino', 'crown-casino', 5111338, 'limiteds', array['featured']::text[], 74.9123, 1),
  ('6966c896cb50b3e66c54a5a3', 'Fiery Fire', 'fiery-fire', 13003818, 'limiteds', array['featured']::text[], 70.0421, 2),
  ('6966e67f82ce1f937fe81170', 'Trouble Bubble', 'trouble-bubble', 10175445, 'limiteds', array['featured']::text[], 53.1204, 3),
  ('6967a120f93888d6f7e07241', 'Pink Dream', 'pink-dream', 20284958, 'limiteds', array['featured']::text[], 57.0484, 4),
  ('6967a7abf93888d6f7e0843e', 'Chicken Jerky', 'chicken-jerky', 1833825, 'limiteds', array['featured']::text[], 61.8393, 5),
  ('6967b326f93888d6f7e0d105', 'Chrome Carrier', 'chrome-carrier', 1431166, 'limiteds', array['featured']::text[], 69.6363, 6),
  ('6967f8f9a4dc4f36a3423156', 'Trash Cap', 'trash-cap', 246664, 'limiteds', array['featured']::text[], 72.7472, 7),
  ('69696219bd0f951aff50765b', 'Egg Hunt', 'egg-hunt', 9698401, 'limiteds', array['featured']::text[], 60.9862, 8),
  ('696964cabd0f951aff5084b1', 'Face Case', 'face-case', 7694825, 'limiteds', array['featured']::text[], 39.0010, 9),
  ('69696893bd0f951aff5095b8', 'Fedora Legacy', 'fedora-legacy', 17930924, 'limiteds', array['featured']::text[], 58.2872, 10),
  ('69696cb9bd0f951aff50a2c3', 'Gold Rush', 'gold-rush', 23253267, 'limiteds', array['featured']::text[], 70.2822, 11),
  ('69697343bd0f951aff50bbee', 'Star Drop', 'star-drop', 2134330, 'limiteds', array['featured']::text[], 55.4749, 12),
  ('6969916e3df0617bac576378', 'Midnight Prestige', 'midnight-prestige', 4848788, 'limiteds', array['featured']::text[], 66.9985, 13),
  ('696acc39213287493ff21d11', 'Donut Hair', 'donut-hair', 6438989, 'limiteds', array['featured']::text[], 72.7034, 14),
  ('696ad0b9213287493ff2261b', 'Striped Hats', 'striped-hats', 8949411, 'limiteds', array['featured']::text[], 56.9256, 15),
  ('696ad645213287493ff239d4', 'Silver Saver', 'silver-saver', 11497642, 'limiteds', array['featured']::text[], 67.0356, 16),
  ('696ad999213287493ff240ae', 'Refresher', 'refresher', 13960745, 'limiteds', array['featured']::text[], 50.1809, 17),
  ('697e556d003df9aaef49d740', 'Robloxia Roll', 'robloxia-roll', 2542800, 'limiteds', array['featured']::text[], 50.8593, 18),
  ('698ba31fd48e5bca14b584f3', 'Seer Sword', 'seer-sword', 3529574, 'limiteds', array['featured']::text[], 49.8372, 19),
  ('698ba60cd48e5bca14b5bdd7', 'Green Lantern', 'green-lantern', 5804856, 'limiteds', array['featured']::text[], 63.5951, 20),
  ('6a68c5d9fd23b15430ee198c', 'Frozen Fantasy', 'frozen-fantasy', 863850, 'mm2', array['featured']::text[], 84.5210, 21),
  ('6a68c5d9fd23b15430ee1992', 'Chroma Chaos', 'chroma-chaos', 8748570, 'mm2', array['featured']::text[], 74.2952, 22),
  ('6a68c5d9fd23b15430ee1998', 'Vampire''s Vault', 'vampires-vault', 1389850, 'mm2', array['featured']::text[], 85.6987, 23),
  ('6a68c5dafd23b15430ee199e', 'Harvester Flip 50/50', 'harvesterflip5050', 1608390, 'mm2', array['featured']::text[], 45.2821, 24),
  ('6a68c5dafd23b15430ee19a7', 'Blackout Case', 'blackout', 329265, 'mm2', array['featured']::text[], 73.2637, 25),
  ('6a68c5dafd23b15430ee19ad', 'Gingerscope Flip', 'gingerscope-flip', 28496615, 'mm2', array['featured']::text[], 45.3428, 26),
  ('6a68c5dbfd23b15430ee19b3', 'Box O'' Blossoms', 'box-o-blossoms', 1154865, 'mm2', array['featured']::text[], 63.7501, 27),
  ('6a68c5dbfd23b15430ee19b9', 'Snowball', 'snowball', 8165975, 'mm2', array['featured']::text[], 77.6383, 28),
  ('6a68c5dbfd23b15430ee19c5', 'Flicker', 'flicker', 3461580, 'mm2', array['featured']::text[], 65.0217, 29),
  ('6a68c5dcfd23b15430ee19ce', '5% Event', '5event', 950810, 'mm2', array['featured']::text[], 88.1535, 30),
  ('6a68c5dcfd23b15430ee19d3', '70% Godly', '70-godly', 1759600, 'mm2', array['featured']::text[], 58.3006, 31),
  ('6a68c5dcfd23b15430ee19d9', 'Flip or Flop', 'flip-or-flop', 50264200, 'mm2', array['featured']::text[], 73.0038, 32),
  ('6a68c5dcfd23b15430ee19dc', 'Fire and Ice', 'fire-and-ice', 8430575, 'mm2', array['featured']::text[], 90.1129, 33),
  ('6a68c5ddfd23b15430ee19e2', 'Xmas Juicer', 'xmas-juicer', 3324780, 'mm2', array['featured']::text[], 85.1394, 34),
  ('6a68c5ddfd23b15430ee19e7', 'Whale''s Crate', 'whales-crate', 106259500, 'mm2', array['featured']::text[], 74.9965, 35),
  ('6a68c5ddfd23b15430ee19eb', 'Circus', 'circus', 3310430, 'mm2', array['featured']::text[], 87.5518, 36),
  ('6a68c5ddfd23b15430ee19f1', 'Traveler''s Fortune', 'travelers-fortune', 16465755, 'mm2', array['featured']::text[], 70.7843, 37),
  ('6a68c5ddfd23b15430ee19f8', 'Celestial Orbit', 'celestial-orbit', 19363360, 'mm2', array['featured']::text[], 56.7390, 38),
  ('6a68c5ddfd23b15430ee19fe', 'Sunset Showdown', 'sunset-showdown', 5689285, 'mm2', array['featured']::text[], 63.7581, 39),
  ('6a68c5defd23b15430ee1a01', 'Sunken Fortune', 'sunken-fortune', 338935, 'mm2', array['featured']::text[], 84.6574, 40),
  ('6a68c5defd23b15430ee1a06', 'Gold Mine', 'gold-mine', 263718005, 'mm2', array['featured']::text[], 63.4539, 41),
  ('6a68c5defd23b15430ee1a0c', 'OG Millionaire', 'og-millionaire', 847430, 'mm2', array['featured']::text[], 86.3050, 42),
  ('6a68c5defd23b15430ee1a0f', 'Candy Land', 'candy-land', 1614200, 'mm2', array['featured']::text[], 64.9038, 43),
  ('6a68c5defd23b15430ee1a15', 'Vampire''s Curse', 'vampires-curse', 19468520, 'mm2', array['featured']::text[], 63.7028, 44),
  ('6a68c5dffd23b15430ee1a27', 'Corrupted Reality', 'corrupted-reality', 983630, 'mm2', array['featured']::text[], 51.7179, 45),
  ('6a68c5e0fd23b15430ee1a2d', 'Rainbow Road', 'rainbow-road', 1494860, 'mm2', array['featured']::text[], 59.1685, 46),
  ('6ab6a036ce3217a1dfaff75c', 'Dominus Delight', 'dominus-delight', 22484180, 'limiteds', array['featured', 'new']::text[], 86.2195, 47),
  ('6ab6ad24ce3217a1dfb048e8', 'Headphone Fiasco', 'headphone-fiasco', 3329279, 'limiteds', array['featured', 'new']::text[], 75.1043, 48),
  ('6abd47790bf2fe98671d840b', 'Purple Haze', 'purple-haze', 38041924, 'limiteds', array['featured', 'new']::text[], 82.3486, 49),
  ('6abd48690bf2fe98671d8911', 'Valkyrie Vault', 'valkyrie-vault', 3401864, 'limiteds', array['featured', 'new']::text[], 75.9238, 50),
  ('6abd49570bf2fe98671d8e12', 'Rainbow Rush', 'rainbow-rush', 1467459, 'limiteds', array['featured', 'new']::text[], 35.5275, 51),
  ('6abd49e50bf2fe98671d9211', 'Golden Ticket', 'golden-ticket', 8641250, 'limiteds', array['featured', 'new']::text[], 43.4506, 52),
  ('6abd4bee0bf2fe98671d99d5', 'Ice Prince', 'ice-prince', 292687, 'limiteds', array['featured', 'new']::text[], 61.8236, 53),
  ('6abd4d5f0bf2fe98671da2b9', 'Deviled Egg', 'deviled-egg', 171709, 'limiteds', array['featured', 'new']::text[], 45.2931, 54),
  ('6abd4e8a0bf2fe98671db01a', 'Cryptic Commando', 'cryptic-commando', 338625, 'limiteds', array['featured', 'new']::text[], 60.9261, 55)
)
update public.rorisk_cases as local
set case_id = production.case_id,
    name = production.name,
    coin_amount = floor(production.raw_amount::numeric / 1000)::bigint,
    rocoin_amount = floor(production.raw_amount::numeric * 5 / 1000)::bigint,
    type = production.type,
    categories = production.categories,
    risk_level = production.risk_level,
    sort_order = production.sort_order,
    updated_at = now()
from production_cases as production
where local.slug = production.slug;

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
values
  ('6ab6a036ce3217a1dfaff75c', 'Dominus Delight', 'dominus-delight', 22484, 112420, 'limiteds', array['featured', 'new']::text[], null, '/api/case-images/main/dominus-delight.png', '[{"name":"Dominus Empyreus","color":"rarity","image":"/api/case-images/items/21070012.png","index":1,"price":2171846,"chance":"0.25%","rarity":"godly","coinPrice":2171846,"rocoinPrice":10859230,"priceFormatted":"2,171,846"},{"name":"Dominus Infernus","color":"rarity","image":"/api/case-images/items/31101391.png","index":2,"price":1433853,"chance":"0.25%","rarity":"godly","coinPrice":1433853,"rocoinPrice":7169265,"priceFormatted":"1,433,853"},{"name":"Dominus Aureus","color":"rarity","image":"/api/case-images/items/138932314.png","index":3,"price":1125105,"chance":"0.35%","rarity":"godly","coinPrice":1125105,"rocoinPrice":5625525,"priceFormatted":"1,125,105"},{"name":"DIY Dominus Empyreus ","color":"rarity","image":"/api/case-images/items/151789690.png","index":4,"price":2827,"chance":"96.5%","rarity":"common","coinPrice":2827,"rocoinPrice":14135,"priceFormatted":"2,827"},{"name":"Dominus Formidulosus","color":"rarity","image":"/api/case-images/items/4255053867.png","index":5,"price":35134,"chance":"1.5%","rarity":"godly","coinPrice":35134,"rocoinPrice":175670,"priceFormatted":"35,134"},{"name":"Dominus Praefectus","color":"rarity","image":"/api/case-images/items/527365852.png","index":6,"price":180541,"chance":"0.75%","rarity":"godly","coinPrice":180541,"rocoinPrice":902705,"priceFormatted":"180,541"},{"name":"Dominus Vespertilio","color":"rarity","image":"/api/case-images/items/96103379.png","index":7,"price":650987,"chance":"0.4%","rarity":"godly","coinPrice":650987,"rocoinPrice":3254935,"priceFormatted":"650,987"}]'::jsonb, 47, true, 86.2195),
  ('6ab6ad24ce3217a1dfb048e8', 'Headphone Fiasco', 'headphone-fiasco', 3329, 16646, 'limiteds', array['featured', 'new']::text[], null, '/api/case-images/main/headphone-fiasco.png', '[{"name":"WC Ultimates: Aquamarine Attitude","color":"rarity","image":"/api/case-images/items/323417812.png","index":1,"price":105951,"chance":"0.25%","rarity":"godly","coinPrice":105951,"rocoinPrice":529755,"priceFormatted":"105,951"},{"name":"WC Ultimates: Pink Diamond Distraction","color":"rarity","image":"/api/case-images/items/315549204.png","index":2,"price":100571,"chance":"0.25%","rarity":"godly","coinPrice":100571,"rocoinPrice":502855,"priceFormatted":"100,571"},{"name":"CW Ultimate: Ruby Rapture","color":"rarity","image":"/api/case-images/items/583635712.png","index":3,"price":67500,"chance":"0.25%","rarity":"godly","coinPrice":67500,"rocoinPrice":337500,"priceFormatted":"67,500"},{"name":"WC Ultimates: Citrine Celebration","color":"rarity","image":"/api/case-images/items/1191152570.png","index":4,"price":44051,"chance":"0.5%","rarity":"godly","coinPrice":44051,"rocoinPrice":220255,"priceFormatted":"44,051"},{"name":"WC Ultimates - Garnet Gratitude","color":"rarity","image":"/api/case-images/items/2566024668.png","index":5,"price":40760,"chance":"0.5%","rarity":"godly","coinPrice":40760,"rocoinPrice":203800,"priceFormatted":"40,760"},{"name":"CW Ultimate: Amethyst Addiction","color":"rarity","image":"/api/case-images/items/188004500.png","index":6,"price":40024,"chance":"0.5%","rarity":"godly","coinPrice":40024,"rocoinPrice":200120,"priceFormatted":"40,024"},{"name":"CW Ultimate: Sapphire Serenity","color":"rarity","image":"/api/case-images/items/188888052.png","index":7,"price":37025,"chance":"0.5%","rarity":"godly","coinPrice":37025,"rocoinPrice":185125,"priceFormatted":"37,025"},{"name":"WC Ultimates: Sugilite Satisfaction","color":"rarity","image":"/api/case-images/items/878908562.png","index":8,"price":28021,"chance":"2%","rarity":"godly","coinPrice":28021,"rocoinPrice":140105,"priceFormatted":"28,021"},{"name":"WC Ultimates: Peridot Panic","color":"rarity","image":"/api/case-images/items/553858732.png","index":9,"price":15025,"chance":"2%","rarity":"godly","coinPrice":15025,"rocoinPrice":75125,"priceFormatted":"15,025"},{"name":"CW Ultimate: Rose Quartz Rebellion","color":"rarity","image":"/api/case-images/items/228449574.png","index":10,"price":14092,"chance":"2%","rarity":"godly","coinPrice":14092,"rocoinPrice":70460,"priceFormatted":"14,092"},{"name":"CW Ultimate: Wulfinite Will","color":"rarity","image":"/api/case-images/items/286524947.png","index":11,"price":14048,"chance":"2%","rarity":"godly","coinPrice":14048,"rocoinPrice":70240,"priceFormatted":"14,048"},{"name":"Recycled Cardboard Headphones","color":"rarity","image":"/api/case-images/items/154415221.png","index":12,"price":76,"chance":"89.25%","rarity":"common","coinPrice":76,"rocoinPrice":380,"priceFormatted":"76"}]'::jsonb, 48, true, 75.1043),
  ('6abd47790bf2fe98671d840b', 'Purple Haze', 'purple-haze', 38041, 190209, 'limiteds', array['featured', 'new']::text[], null, '/api/case-images/main/purple-haze.png', '[{"name":"Dominus Empyreus","color":"rarity","image":"/api/case-images/items/21070012.png","index":1,"price":2171846,"chance":"0.5%","rarity":"godly","coinPrice":2171846,"rocoinPrice":10859230,"priceFormatted":"2,171,846"},{"name":"Purple Sparkle Time Fedora","color":"rarity","image":"/api/case-images/items/63043890.png","index":2,"price":1158219,"chance":"1%","rarity":"godly","coinPrice":1158219,"rocoinPrice":5791095,"priceFormatted":"1,158,219"},{"name":"Bling $$ Necklace","color":"rarity","image":"/api/case-images/items/33171947.png","index":3,"price":100042,"chance":"2.5%","rarity":"godly","coinPrice":100042,"rocoinPrice":500210,"priceFormatted":"100,042"},{"name":"Purple Queen of the Night","color":"rarity","image":"/api/case-images/items/553971858.png","index":4,"price":25321,"chance":"10%","rarity":"legendary","coinPrice":25321,"rocoinPrice":126605,"priceFormatted":"25,321"},{"name":"Purple Crystal Circlet","color":"rarity","image":"/api/case-images/items/151327351.png","index":5,"price":202,"chance":"50%","rarity":"common","coinPrice":202,"rocoinPrice":1010,"priceFormatted":"202"},{"name":"White Ninja Headband of the Unimpeachable Soul","color":"rarity","image":"/api/case-images/items/11297746.png","index":6,"price":1971,"chance":"25%","rarity":"rare","coinPrice":1971,"rocoinPrice":9855,"priceFormatted":"1,971"},{"name":"Purple Bubble Trouble","color":"rarity","image":"/api/case-images/items/362051999.png","index":7,"price":55000,"chance":"11%","rarity":"legendary","coinPrice":55000,"rocoinPrice":275000,"priceFormatted":"55,000"}]'::jsonb, 49, true, 82.3486),
  ('6abd48690bf2fe98671d8911', 'Valkyrie Vault', 'valkyrie-vault', 3401, 17009, 'limiteds', array['featured', 'new']::text[], null, '/api/case-images/main/valkyrie-vault.png', '[{"name":"Ice Valkyrie","color":"rarity","image":"/api/case-images/items/4390891467.png","index":1,"price":90000,"chance":"1%","rarity":"godly","coinPrice":90000,"rocoinPrice":450000,"priceFormatted":"90,000"},{"name":"Valkyrie Helm","color":"rarity","image":"/api/case-images/items/1365767.png","index":2,"price":35000,"chance":"5%","rarity":"godly","coinPrice":35000,"rocoinPrice":175000,"priceFormatted":"35,000"},{"name":"Blackvalk Shades","color":"rarity","image":"/api/case-images/items/175134718.png","index":3,"price":1250,"chance":"15%","rarity":"legendary","coinPrice":1250,"rocoinPrice":6250,"priceFormatted":"1,250"},{"name":"Emerald Valk Shades","color":"rarity","image":"/api/case-images/items/3210243135.png","index":4,"price":650,"chance":"29%","rarity":"rare","coinPrice":650,"rocoinPrice":3250,"priceFormatted":"650"},{"name":"Valkyrie 3000","color":"rarity","image":"/api/case-images/items/74214775.png","index":5,"price":50,"chance":"50%","rarity":"common","coinPrice":50,"rocoinPrice":250,"priceFormatted":"50"}]'::jsonb, 50, true, 75.9238),
  ('6abd49570bf2fe98671d8e12', 'Rainbow Rush', 'rainbow-rush', 1467, 7337, 'limiteds', array['featured', 'new']::text[], null, '/api/case-images/main/rainbow-rush.png', '[{"name":"Rainbow Shaggy","color":"rarity","image":"/api/case-images/items/64082730.png","index":1,"price":16291,"chance":"0.1%","rarity":"godly","coinPrice":16291,"rocoinPrice":81455,"priceFormatted":"16,291"},{"name":"Rainbowrath: The Avenger","color":"rarity","image":"/api/case-images/items/346686597.png","index":2,"price":3058,"chance":"7.4%","rarity":"legendary","coinPrice":3058,"rocoinPrice":15290,"priceFormatted":"3,058"},{"name":"Rainbow Periastron Omega","color":"rarity","image":"/api/case-images/items/159229806.png","index":3,"price":2201,"chance":"12.5%","rarity":"legendary","coinPrice":2201,"rocoinPrice":11005,"priceFormatted":"2,201"},{"name":"Rainbow Fedora","color":"rarity","image":"/api/case-images/items/82332012.png","index":4,"price":1518,"chance":"30%","rarity":"uncommon","coinPrice":1518,"rocoinPrice":7590,"priceFormatted":"1,518"},{"name":"Rainbow Pixels Bandana","color":"rarity","image":"/api/case-images/items/3267569146.png","index":5,"price":686,"chance":"50%","rarity":"common","coinPrice":686,"rocoinPrice":3430,"priceFormatted":"686"}]'::jsonb, 51, true, 35.5275),
  ('6abd49e50bf2fe98671d9211', 'Golden Ticket', 'golden-ticket', 8641, 43206, 'limiteds', array['featured', 'new']::text[], null, '/api/case-images/main/golden-ticket.png', '[{"name":"Tix Shaggy","color":"rarity","image":"/api/case-images/items/382881373.png","index":1,"price":23000,"chance":"10%","rarity":"legendary","coinPrice":23000,"rocoinPrice":115000,"priceFormatted":"23,000"},{"name":"Tixvalk","color":"rarity","image":"/api/case-images/items/382881237.png","index":2,"price":12500,"chance":"30%","rarity":"uncommon","coinPrice":12500,"rocoinPrice":62500,"priceFormatted":"12,500"},{"name":"Lord of the Tixeration","color":"rarity","image":"/api/case-images/items/382880833.png","index":3,"price":7500,"chance":"20%","rarity":"rare","coinPrice":7500,"rocoinPrice":37500,"priceFormatted":"7,500"},{"name":"Tixsplosion","color":"rarity","image":"/api/case-images/items/6512277.png","index":4,"price":500,"chance":"40%","rarity":"uncommon","coinPrice":500,"rocoinPrice":2500,"priceFormatted":"500"}]'::jsonb, 52, true, 43.4506),
  ('6abd4bee0bf2fe98671d99d5', 'Ice Prince', 'ice-prince', 292, 1463, 'limiteds', array['featured', 'new']::text[], null, '/api/case-images/main/ice-prince.png', '[{"name":"Diademed Barbarian Prince","color":"rarity","image":"/api/case-images/items/18821202.png","index":1,"price":2200,"chance":"5%","rarity":"godly","coinPrice":2200,"rocoinPrice":11000,"priceFormatted":"2,200"},{"name":"Pretty Pretty Princess","color":"rarity","image":"/api/case-images/items/53039427.png","index":2,"price":1250,"chance":"5%","rarity":"godly","coinPrice":1250,"rocoinPrice":6250,"priceFormatted":"1,250"},{"name":"Princess Hat","color":"rarity","image":"/api/case-images/items/1032641.png","index":3,"price":100,"chance":"90%","rarity":"common","coinPrice":100,"rocoinPrice":500,"priceFormatted":"100"}]'::jsonb, 53, true, 61.8236),
  ('6abd4d5f0bf2fe98671da2b9', 'Deviled Egg', 'deviled-egg', 171, 858, 'limiteds', array['featured', 'new']::text[], null, '/api/case-images/main/deviled-egg.png', '[{"name":"Deviled Egg","color":"rarity","image":"/api/case-images/items/110706148.png","index":1,"price":307,"chance":"50%","rarity":"common","coinPrice":307,"rocoinPrice":1535,"priceFormatted":"307"},{"name":"Terrordactyl Egg","color":"rarity","image":"/api/case-images/items/76692790.png","index":2,"price":1,"chance":"50%","rarity":"common","coinPrice":1,"rocoinPrice":5,"priceFormatted":"1"}]'::jsonb, 54, true, 45.2931),
  ('6abd4e8a0bf2fe98671db01a', 'Cryptic Commando', 'cryptic-commando', 338, 1693, 'limiteds', array['featured', 'new']::text[], null, '/api/case-images/main/cryptic-commando.png', '[{"name":"Virtual Commando","color":"rarity","image":"/api/case-images/items/362081769.png","index":1,"price":1900,"chance":"10%","rarity":"legendary","coinPrice":1900,"rocoinPrice":9500,"priceFormatted":"1,900"},{"name":"Virtual BLOXcon Headphones","color":"rarity","image":"/api/case-images/items/130106467.png","index":2,"price":721,"chance":"10%","rarity":"legendary","coinPrice":721,"rocoinPrice":3605,"priceFormatted":"721"},{"name":"Black Cat Scarf","color":"rarity","image":"/api/case-images/items/1609384691.png","index":3,"price":52,"chance":"80%","rarity":"common","coinPrice":52,"rocoinPrice":260,"priceFormatted":"52"}]'::jsonb, 55, true, 60.9261)
on conflict (case_id) do update
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

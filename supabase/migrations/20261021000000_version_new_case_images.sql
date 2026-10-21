-- Bust immutable browser caches after restoring the original case artwork.
update public.rorisk_cases
set image_url = regexp_replace(image_url, '\?.*$', '') || '?v=original-20261021'
where case_id in (
  '6abf024e818dbc1add7d5d28',
  '6abfe4c6818dbc1add86c83f',
  '6ac138a3d71ccf0f01cc0893',
  '6ac29229dc956a667593411d',
  '6ac3ed16dc956a6675a0c454',
  '6ac57da0dc956a6675b1c75a',
  '6ac68e4cdc956a6675bf93ab',
  '6acb1e921caedb5389d9e982',
  '6acb1f8c1caedb5389d9f521',
  '6acb20e31caedb5389da05e6',
  '6acb21881caedb5389da0ccb',
  '6acb24011caedb5389da2236'
);

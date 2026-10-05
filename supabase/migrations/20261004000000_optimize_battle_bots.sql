create or replace function public.add_rorisk_battle_bots(
  p_battle_uuid uuid,
  p_creator_uuid uuid,
  p_bots jsonb
) returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_battle public.rorisk_battles%rowtype;
  v_bot jsonb;
  v_player jsonb;
  v_players jsonb;
  v_slot integer;
  v_team integer;
  v_count integer;
begin
  select * into v_battle from public.rorisk_battles where uuid = p_battle_uuid for update;
  if not found then raise exception 'This battle could not be found.'; end if;
  if v_battle.creator_uuid <> p_creator_uuid then raise exception 'Only the battle creator can call a bot.'; end if;
  if v_battle.state <> 'created' then raise exception 'This battle can no longer be joined.'; end if;
  if jsonb_typeof(p_bots) <> 'array' then raise exception 'The bot selection is invalid.'; end if;

  v_players := coalesce(v_battle.players, '[]'::jsonb);
  for v_bot in select value from jsonb_array_elements(p_bots) loop
    v_slot := (v_bot->>'slot')::integer;
    if v_slot < 0 or v_slot >= v_battle.player_count then raise exception 'That battle seat is invalid.'; end if;
    if exists (select 1 from jsonb_array_elements(v_players) player where (player->>'slot')::integer = v_slot) then
      raise exception 'That battle seat is already occupied.';
    end if;
    v_team := case when v_battle.mode in ('2v2', '2v2v2') then v_slot / 2 when v_battle.mode = '3v3' then v_slot / 3 else v_slot end;
    v_player := jsonb_build_object(
      'uuid', gen_random_uuid(), 'slot', v_slot, 'team', v_team, 'user_uuid', null,
      'roblox_id', null, 'username', left(coalesce(v_bot->>'username', 'Risk Bot'), 64),
      'avatar_headshot', coalesce(nullif(v_bot->>'avatar', ''), '/img/battles/risk-bot.png'),
      'rank', 'bot', 'level', 0, 'is_bot', true, 'wager_amount', 0,
      'outcome_total', 0, 'payout_amount', 0, 'joined_at', now()
    );
    v_players := v_players || jsonb_build_array(v_player);
  end loop;

  v_count := jsonb_array_length(v_players);
  update public.rorisk_battles
  set players = v_players,
      state = case when v_count >= player_count then 'countdown' else state end,
      started_at = case when v_count >= player_count then now() else started_at end,
      updated_at = now(), version = version + 1
  where uuid = p_battle_uuid returning * into v_battle;
  return jsonb_build_object('battle', to_jsonb(v_battle), 'ready', v_count >= v_battle.player_count);
end;
$$;

revoke all on function public.add_rorisk_battle_bots(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.add_rorisk_battle_bots(uuid,uuid,jsonb) to service_role;

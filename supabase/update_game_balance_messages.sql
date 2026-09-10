do $migration$
declare
  game_function record;
  current_definition text;
  updated_definition text;
begin
  for game_function in
    select procedure.oid
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in ('open_rorisk_case', 'play_rorisk_dice')
  loop
    current_definition := pg_get_functiondef(game_function.oid);
    updated_definition := regexp_replace(
      current_definition,
      'raise[[:space:]]+exception[[:space:]]+''You do not have enough[^'']*''[^;]*;',
      'raise exception ''Insufficient balance.'';',
      'gi'
    );

    if updated_definition <> current_definition then
      execute updated_definition;
    end if;
  end loop;
end;
$migration$;

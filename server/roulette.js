export async function handleRouletteRequest({ request, response, url, env, api }) {
  const { sendJson, readJson, startRealtimeSession, supabaseRequest, requestSessionUser, publicRouletteGame, publicRouletteBets, scheduleRouletteTransition, syncRouletteRound, broadcastRealtime } = api
    if (request.method === 'GET' && url.pathname === '/api/x-roulette/state') {
      const row = await syncRouletteRound(env)
      scheduleRouletteTransition(env, row)
      const historyQuery = new URLSearchParams({ state: 'eq.COMPLETE', select: 'uuid,state,reel,winning_index,result_name,result_image,result_multiplier_bps,bet_count,wagered_amount,paid_amount,server_seed_hash,server_seed,ticket,eos_block_id,eos_block_number,created_at,completed_at,updated_at', order: 'completed_at.desc', limit: '12' })
      const history = await supabaseRequest(env, `/rest/v1/rorisk_roulette_games?${historyQuery}`)
      const sessionUser = requestSessionUser(request, env)
      let user = null
      if (sessionUser?.uuid && row.state === 'COMPLETE') {
        const users = await supabaseRequest(env, `/rest/v1/rorisk_users?${new URLSearchParams({ uuid: `eq.${sessionUser.uuid}`, select: '*', limit: '1' })}`)
        user = users?.[0] || null
        if (user) startRealtimeSession(request, response, env, user)
      }
      sendJson(response, 200, {
        game: publicRouletteGame(row),
        bets: publicRouletteBets(row),
        history: (history || []).map(publicRouletteGame),
        config: { minAmount: 1, maxAmount: 500000, minMultiplier: 1.01 },
        maintenance: { active: false, reason: '' },
        serverTime: new Date().toISOString(),
        ...(user ? { user } : {}),
      })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/x-roulette/bet') {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const body = await readJson(request)
      const amount = Math.trunc(Number(body.amount))
      const targetMultiplierBps = Math.round(Number(body.targetMultiplier) * 100)
      if (!Number.isSafeInteger(amount)) throw new Error('Your entered bet amount is invalid.')
      if (!Number.isInteger(targetMultiplierBps)) throw new Error('Your entered multiplier is invalid.')
      const current = await syncRouletteRound(env)
      const result = await supabaseRequest(env, '/rest/v1/rpc/place_rorisk_roulette_bet', {
        method: 'POST',
        body: JSON.stringify({
          p_game_uuid: current.uuid,
          p_user_uuid: sessionUser.uuid,
          p_amount: amount,
          p_currency: String(body.currency || ''),
          p_target_multiplier_bps: targetMultiplierBps,
        }),
      })
      if (result?.user) startRealtimeSession(request, response, env, result.user)
      const game = publicRouletteGame(result.game)
      broadcastRealtime({ type: 'rouletteBet', game, bet: result.bet })
      sendJson(response, 200, { ...result, game, bets: publicRouletteBets(result.game) })
      return true
    }

  return false
}


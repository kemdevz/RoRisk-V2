import { createHash, randomBytes } from 'node:crypto'

export async function handleMinesRequest({ request, response, url, env, api }) {
  const { sendJson, readJson, startRealtimeSession, supabaseRequest, requestSessionUser, publicMinesGame, createMinesDeck, broadcastRealtime } = api
    if (request.method === 'GET' && url.pathname === '/api/mines/current') {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) {
        sendJson(response, 200, { game: null })
        return true
      }
      const query = new URLSearchParams({
        user_uuid: `eq.${sessionUser.uuid}`,
        state: 'in.(created,running)',
        select: '*',
        order: 'created_at.desc',
        limit: '1',
      })
      const games = await supabaseRequest(env, `/rest/v1/rorisk_mines_games?${query}`)
      sendJson(response, 200, { game: games?.[0] ? publicMinesGame(games[0]) : null })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/mines/start') {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const body = await readJson(request)
      const amount = Math.trunc(Number(body.amount))
      const minesCount = Math.trunc(Number(body.minesCount))
      const nonce = Math.max(0, Math.trunc(Number(body.nonce)) || 0)
      if (!Number.isSafeInteger(amount)) throw new Error('Your entered bet amount is invalid.')
      if (!Number.isInteger(minesCount)) throw new Error('Your entered mines count is invalid.')
      const clientSeed = String(body.clientSeed || sessionUser.uuid).slice(0, 128)
      const serverSeed = randomBytes(24).toString('hex')
      const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex')
      const deck = createMinesDeck(serverSeed, clientSeed, nonce, minesCount)
      const result = await supabaseRequest(env, '/rest/v1/rpc/start_rorisk_mines', {
        method: 'POST',
        body: JSON.stringify({
          p_user_uuid: sessionUser.uuid,
          p_amount: amount,
          p_currency: String(body.currency || ''),
          p_mines_count: minesCount,
          p_deck: deck,
          p_client_seed: clientSeed,
          p_server_seed: serverSeed,
          p_server_seed_hash: serverSeedHash,
          p_nonce: nonce,
        }),
      })
      if (result?.user) startRealtimeSession(request, response, env, result.user)
      sendJson(response, 200, { ...result, game: publicMinesGame({ ...result.game, level: result.user?.level, rank: result.user?.rank }) })
      return true
    }

    const minesActionRoute = url.pathname.match(/^\/api\/mines\/([a-fA-F0-9-]+)\/(reveal|cashout)$/)
    if (request.method === 'POST' && minesActionRoute) {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const body = await readJson(request)
      const action = minesActionRoute[2]
      const tile = Math.trunc(Number(body.tile))
      if (action === 'reveal' && (!Number.isInteger(tile) || tile < 0 || tile > 24)) throw new Error('The selected tile is invalid.')
      const result = await supabaseRequest(env, `/rest/v1/rpc/${action === 'reveal' ? 'reveal_rorisk_mines' : 'cashout_rorisk_mines'}`, {
        method: 'POST',
        body: JSON.stringify(action === 'reveal'
          ? { p_game_uuid: minesActionRoute[1], p_user_uuid: sessionUser.uuid, p_tile: tile }
          : { p_game_uuid: minesActionRoute[1], p_user_uuid: sessionUser.uuid }),
      })
      if (result?.user) startRealtimeSession(request, response, env, result.user)
      const game = publicMinesGame({ ...result.game, level: result.user?.level, rank: result.user?.rank })
      if (game.state === 'completed') broadcastRealtime({ type: 'minesBet', game })
      sendJson(response, 200, { ...result, game })
      return true
    }

  return false
}


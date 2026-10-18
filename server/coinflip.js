import { createHash, randomBytes } from 'node:crypto'

export async function handleCoinflipRequest({ request, response, url, env, api }) {
  const { sendJson, readJson, startRealtimeSession, supabaseRequest, requestSessionUser, publicCoinflipGame, latestEosBlock, coinflipGameByUuid, broadcastRealtime, COINFLIP_GAME_SELECT } = api
    if (request.method === 'GET' && url.pathname === '/api/coinflip/games') {
      const query = new URLSearchParams({
        state: 'in.(created,completed)',
        select: COINFLIP_GAME_SELECT,
        order: 'created_at.desc',
        limit: String(Math.min(500, Math.max(25, Number(url.searchParams.get('limit')) || 200))),
      })
      const games = await supabaseRequest(env, `/rest/v1/rorisk_coinflip_games?${query}`)
      const mappedGames = (games || []).map(publicCoinflipGame)
      sendJson(response, 200, {
        games: [
          ...mappedGames.filter((game) => game.state !== 'completed'),
          ...mappedGames.filter((game) => game.state === 'completed').slice(0, 25),
        ],
      })
      return true
    }

    const coinflipGameRoute = url.pathname.match(/^\/api\/coinflip\/games\/([a-zA-Z0-9-]+)$/)
    if (request.method === 'GET' && coinflipGameRoute) {
      const identifier = coinflipGameRoute[1]
      const query = new URLSearchParams({
        [identifier.includes('-') ? 'uuid' : 'game_id']: `eq.${identifier}`,
        select: COINFLIP_GAME_SELECT,
        limit: '1',
      })
      const rows = await supabaseRequest(env, `/rest/v1/rorisk_coinflip_games?${query}`)
      if (!rows?.[0]) throw new Error('This coinflip game could not be found.')
      sendJson(response, 200, { game: publicCoinflipGame(rows[0]) })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/coinflip/games') {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const body = await readJson(request)
      const amount = Math.trunc(Number(body.amount))
      if (!Number.isSafeInteger(amount)) throw new Error('Your entered bet amount is invalid.')
      const serverSeed = randomBytes(32).toString('hex')
      const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex')
      const result = await supabaseRequest(env, '/rest/v1/rpc/create_rorisk_coinflip', {
        method: 'POST',
        body: JSON.stringify({
          p_user_uuid: sessionUser.uuid,
          p_amount: amount,
          p_currency: String(body.currency || ''),
          p_coin: String(body.coin || ''),
          p_client_seed: String(body.clientSeed || sessionUser.uuid).slice(0, 128),
          p_server_seed: serverSeed,
          p_server_seed_hash: serverSeedHash,
        }),
      })
      if (result?.user) startRealtimeSession(request, response, env, result.user)
      const game = publicCoinflipGame(await coinflipGameByUuid(env, result.game.uuid))
      broadcastRealtime({ type: 'coinflip', game })
      sendJson(response, 200, { ...result, game })
      return true
    }

    const coinflipActionRoute = url.pathname.match(/^\/api\/coinflip\/games\/([a-fA-F0-9-]+)\/(join|bot)$/)
    if (request.method === 'POST' && coinflipActionRoute) {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const eosBlock = await latestEosBlock(env)
      const existingGame = await coinflipGameByUuid(env, coinflipActionRoute[1])
      const outcomeHash = createHash('sha512').update(`${existingGame.server_seed}-${eosBlock.blockId}`).digest('hex')
      const ticket = Number.parseInt(outcomeHash.slice(0, 16), 16) % 1000000
      const result = await supabaseRequest(env, '/rest/v1/rpc/join_rorisk_coinflip', {
        method: 'POST',
        body: JSON.stringify({
          p_game_uuid: coinflipActionRoute[1],
          p_user_uuid: sessionUser.uuid,
          p_bot: coinflipActionRoute[2] === 'bot',
          p_eos_block_id: eosBlock.blockId,
          p_eos_block_number: eosBlock.blockNumber,
          p_ticket: ticket,
        }),
      })
      if (result?.user) startRealtimeSession(request, response, env, result.user)
      const game = publicCoinflipGame(await coinflipGameByUuid(env, result.game.uuid))
      broadcastRealtime({ type: 'coinflip', game })
      sendJson(response, 200, { ...result, game })
      return true
    }

  return false
}


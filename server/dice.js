import { createHash, randomBytes } from 'node:crypto'

export async function handleDiceRequest({ request, response, url, env, api }) {
  const { sendJson, readJson, startRealtimeSession, supabaseRequest, requestSessionUser, broadcastRealtime } = api
    if (request.method === 'GET' && url.pathname === '/api/dice/games') {
      const query = new URLSearchParams({
        select: 'uuid,username,avatar_headshot,currency,bet_amount,mode,target_low,target_high,roll,win_chance,multiplier,won,payout_amount,created_at,profile:rorisk_users!rorisk_dice_games_user_uuid_fkey(level)',
        order: 'created_at.desc',
        limit: String(Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 30))),
      })
      const games = await supabaseRequest(env, `/rest/v1/rorisk_dice_games?${query}`)
      sendJson(response, 200, { games: (games || []).map(({ profile, ...game }) => ({ ...game, level: Number(profile?.level) || 0 })) })
      return true
    }

    if (request.method === 'GET' && url.pathname === '/api/bets') {
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 30))
      const [diceResult, casesResult, coinflipResult, minesResult, rouletteResult, upgraderResult, blackjackResult] = await Promise.allSettled([
        supabaseRequest(env, `/rest/v1/rorisk_dice_games?${new URLSearchParams({ select: 'uuid,user_uuid,roblox_id,username,avatar_headshot,currency,bet_amount,multiplier,won,payout_amount,created_at,profile:rorisk_users!rorisk_dice_games_user_uuid_fkey(level,rank)', order: 'created_at.desc', limit: String(limit) })}`),
        supabaseRequest(env, `/rest/v1/rorisk_case_openings?${new URLSearchParams({ status: 'eq.completed', select: 'uuid,user_uuid,roblox_id,username,avatar_headshot,currency,wager_amount,payout_amount,created_at,profile:rorisk_users!rorisk_case_openings_user_uuid_fkey(level,rank)', order: 'created_at.desc', limit: String(limit) })}`),
        supabaseRequest(env, `/rest/v1/rorisk_coinflip_games?${new URLSearchParams({ state: 'eq.completed', select: 'uuid,creator_uuid,creator_roblox_id,creator_username,creator_avatar_headshot,opponent_uuid,opponent_roblox_id,opponent_username,opponent_avatar_headshot,currency,amount,winner_uuid,payout_amount,completed_at,created_at,creator_profile:rorisk_users!rorisk_coinflip_games_creator_uuid_fkey(level,rank),opponent_profile:rorisk_users!rorisk_coinflip_games_opponent_uuid_fkey(level,rank)', order: 'created_at.desc', limit: String(limit) })}`),
        supabaseRequest(env, `/rest/v1/rorisk_mines_games?${new URLSearchParams({ state: 'eq.completed', select: 'uuid,user_uuid,roblox_id,username,avatar_headshot,currency,bet_amount,multiplier,won,payout_amount,completed_at,created_at,profile:rorisk_users!rorisk_mines_games_user_uuid_fkey(level,rank)', order: 'completed_at.desc', limit: String(limit) })}`),
        supabaseRequest(env, `/rest/v1/rorisk_roulette_games?${new URLSearchParams({ state: 'eq.COMPLETE', select: 'uuid,bets,result_multiplier_bps,completed_at,created_at', order: 'completed_at.desc', limit: String(limit) })}`),
        supabaseRequest(env, `/rest/v1/rorisk_upgrader_games?${new URLSearchParams({ select: 'uuid,user_uuid,roblox_id,username,avatar_headshot,currency,bet_amount,multiplier_bps,won,payout_amount,created_at,completed_at,profile:rorisk_users!rorisk_upgrader_games_user_uuid_fkey(level,rank)', order: 'created_at.desc', limit: String(limit) })}`),
        supabaseRequest(env, `/rest/v1/rorisk_blackjack_games?${new URLSearchParams({ state: 'eq.completed', select: 'uuid,user_uuid,roblox_id,username,avatar_headshot,currency,wager_amount,multiplier,won,payout_amount,created_at,completed_at,profile:rorisk_users!rorisk_blackjack_games_user_uuid_fkey(level,rank)', order: 'completed_at.desc', limit: String(limit) })}`),
      ])
      const diceGames = diceResult.status === 'fulfilled' ? diceResult.value : []
      const caseGames = casesResult.status === 'fulfilled' ? casesResult.value : []
      const coinflipGames = coinflipResult.status === 'fulfilled' ? coinflipResult.value : []
      const minesGames = minesResult.status === 'fulfilled' ? minesResult.value : []
      const rouletteGames = rouletteResult.status === 'fulfilled' ? rouletteResult.value : []
      const upgraderGames = upgraderResult.status === 'fulfilled' ? upgraderResult.value : []
      const blackjackGames = blackjackResult.status === 'fulfilled' ? blackjackResult.value : []
      const bets = [
        ...diceGames.map(({ profile, ...game }) => ({ ...game, method: 'dice', level: Number(profile?.level) || 0, rank: profile?.rank || 'user', updated_at: game.created_at })),
        ...caseGames.map(({ profile, wager_amount: betAmount, ...game }) => ({ ...game, method: 'cases', bet_amount: betAmount, multiplier: betAmount > 0 ? Number(game.payout_amount) / Number(betAmount) : 0, won: Number(game.payout_amount) >= Number(betAmount), level: Number(profile?.level) || 0, rank: profile?.rank || 'user', updated_at: game.created_at })),
        ...coinflipGames.flatMap((game) => {
          const completedAt = game.completed_at || game.created_at
          const creator = { uuid: `${game.uuid}:creator`, user_uuid: game.creator_uuid, roblox_id: game.creator_roblox_id, username: game.creator_username, avatar_headshot: game.creator_avatar_headshot, currency: game.currency, bet_amount: game.amount, payout_amount: game.winner_uuid === game.creator_uuid ? game.payout_amount : 0, multiplier: game.winner_uuid === game.creator_uuid ? Number(game.payout_amount) / Number(game.amount) : 0, won: game.winner_uuid === game.creator_uuid, method: 'coinflip', level: Number(game.creator_profile?.level) || 0, rank: game.creator_profile?.rank || 'user', created_at: completedAt, updated_at: completedAt }
          if (!game.opponent_uuid) return [creator]
          return [creator, { uuid: `${game.uuid}:opponent`, user_uuid: game.opponent_uuid, roblox_id: game.opponent_roblox_id, username: game.opponent_username, avatar_headshot: game.opponent_avatar_headshot, currency: game.currency, bet_amount: game.amount, payout_amount: game.winner_uuid === game.opponent_uuid ? game.payout_amount : 0, multiplier: game.winner_uuid === game.opponent_uuid ? Number(game.payout_amount) / Number(game.amount) : 0, won: game.winner_uuid === game.opponent_uuid, method: 'coinflip', level: Number(game.opponent_profile?.level) || 0, rank: game.opponent_profile?.rank || 'user', created_at: completedAt, updated_at: completedAt }]
        }),
        ...minesGames.map(({ profile, ...game }) => ({ ...game, method: 'mines', level: Number(profile?.level) || 0, rank: profile?.rank || 'user', updated_at: game.completed_at || game.created_at })),
        ...rouletteGames.flatMap((game) => (Array.isArray(game.bets) ? game.bets : []).map((bet) => ({
          uuid: `${game.uuid}:${bet.uuid}`,
          user_uuid: bet.user_uuid,
          roblox_id: bet.roblox_id,
          username: bet.username,
          avatar_headshot: bet.roblox_avatar_headshot,
          currency: bet.currency,
          bet_amount: Number(bet.amount) || 0,
          payout_amount: Number(bet.payout_amount) || 0,
          multiplier: bet.won ? Number(bet.target_multiplier_bps) / 100 : 0,
          won: bet.won === true,
          method: 'xroulette',
          level: Number(bet.level) || 0,
          created_at: game.completed_at || game.created_at,
          updated_at: game.completed_at || game.created_at,
        }))),
        ...upgraderGames.map(({ profile, multiplier_bps: multiplierBps, ...game }) => ({ ...game, method: 'upgrader', multiplier: Number(multiplierBps) / 100, level: Number(profile?.level) || 0, rank: profile?.rank || 'user', updated_at: game.completed_at || game.created_at })),
        ...blackjackGames.map(({ profile, wager_amount: betAmount, ...game }) => ({ ...game, method: 'blackjack', bet_amount: betAmount, level: Number(profile?.level) || 0, rank: profile?.rank || 'user', updated_at: game.completed_at || game.created_at })),
      ].sort((first, second) => new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime()).slice(0, limit)
      sendJson(response, 200, { games: bets })
      return true
    }

    if (request.method === 'GET' && url.pathname === '/api/fairness/past-seeds') {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const page = Math.max(1, Math.trunc(Number(url.searchParams.get('page')) || 1))
      const pageSize = 10
      const userFilter = `eq.${sessionUser.uuid}`
      const [diceResult, casesResult, minesResult, upgraderResult, blackjackResult] = await Promise.allSettled([
        supabaseRequest(env, `/rest/v1/rorisk_dice_games?${new URLSearchParams({ user_uuid: userFilter, select: 'uuid,client_seed,server_seed_hash,server_seed,nonce,created_at', order: 'created_at.desc', limit: '1000' })}`),
        supabaseRequest(env, `/rest/v1/rorisk_case_openings?${new URLSearchParams({ user_uuid: userFilter, status: 'eq.completed', select: 'uuid,client_seed,server_seed_hash,server_seed,nonce,created_at,completed_at', order: 'created_at.desc', limit: '1000' })}`),
        supabaseRequest(env, `/rest/v1/rorisk_mines_games?${new URLSearchParams({ user_uuid: userFilter, state: 'eq.completed', select: 'uuid,client_seed,server_seed_hash,server_seed,nonce,created_at,completed_at', order: 'created_at.desc', limit: '1000' })}`),
        supabaseRequest(env, `/rest/v1/rorisk_upgrader_games?${new URLSearchParams({ user_uuid: userFilter, select: 'uuid,client_seed,server_seed_hash,server_seed,nonce,created_at,completed_at', order: 'created_at.desc', limit: '1000' })}`),
        supabaseRequest(env, `/rest/v1/rorisk_blackjack_games?${new URLSearchParams({ user_uuid: userFilter, state: 'eq.completed', select: 'uuid,client_seed,server_seed_hash,server_seed,nonce,created_at,completed_at', order: 'created_at.desc', limit: '1000' })}`),
      ])
      if (diceResult.status === 'rejected' && casesResult.status === 'rejected' && minesResult.status === 'rejected' && upgraderResult.status === 'rejected' && blackjackResult.status === 'rejected') throw diceResult.reason
      const diceSeeds = diceResult.status === 'fulfilled' ? diceResult.value : []
      const caseSeeds = casesResult.status === 'fulfilled' ? casesResult.value : []
      const minesSeeds = minesResult.status === 'fulfilled' ? minesResult.value : []
      const upgraderSeeds = upgraderResult.status === 'fulfilled' ? upgraderResult.value : []
      const blackjackSeeds = blackjackResult.status === 'fulfilled' ? blackjackResult.value : []
      const allSeeds = [
        ...diceSeeds.map((seed) => ({
          id: `dice:${seed.uuid}`,
          clientSeed: seed.client_seed,
          serverSeed: seed.server_seed,
          hash: seed.server_seed_hash,
          nonce: Number(seed.nonce) || 0,
          completedAt: seed.created_at,
        })),
        ...caseSeeds.map((seed) => ({
          id: `case:${seed.uuid}`,
          clientSeed: seed.client_seed,
          serverSeed: seed.server_seed,
          hash: seed.server_seed_hash,
          nonce: Number(seed.nonce) || 0,
          completedAt: seed.completed_at || seed.created_at,
        })),
        ...minesSeeds.map((seed) => ({
          id: `mines:${seed.uuid}`,
          clientSeed: seed.client_seed,
          serverSeed: seed.server_seed,
          hash: seed.server_seed_hash,
          nonce: Number(seed.nonce) || 0,
          completedAt: seed.completed_at || seed.created_at,
        })),
        ...upgraderSeeds.map((seed) => ({
          id: `upgrader:${seed.uuid}`,
          clientSeed: seed.client_seed,
          serverSeed: seed.server_seed,
          hash: seed.server_seed_hash,
          nonce: Number(seed.nonce) || 0,
          completedAt: seed.completed_at || seed.created_at,
        })),
        ...blackjackSeeds.map((seed) => ({
          id: `blackjack:${seed.uuid}`,
          clientSeed: seed.client_seed,
          serverSeed: seed.server_seed,
          hash: seed.server_seed_hash,
          nonce: Number(seed.nonce) || 0,
          completedAt: seed.completed_at || seed.created_at,
        })),
      ].sort((first, second) => new Date(second.completedAt).getTime() - new Date(first.completedAt).getTime())
      const total = allSeeds.length
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      const selectedPage = Math.min(page, totalPages)
      const offset = (selectedPage - 1) * pageSize
      sendJson(response, 200, {
        seeds: allSeeds.slice(offset, offset + pageSize),
        pagination: { page: selectedPage, pageSize, total, totalPages },
      })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/dice/play') {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const body = await readJson(request)
      const amount = Math.trunc(Number(body.amount))
      const targetLow = Math.trunc(Number(body.targetLow))
      const targetHigh = Math.trunc(Number(body.targetHigh))
      if (!Number.isSafeInteger(amount) || !Number.isInteger(targetLow) || !Number.isInteger(targetHigh)) throw new Error('The dice game request is invalid.')
      const serverSeed = randomBytes(32).toString('hex')
      const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex')
      const result = await supabaseRequest(env, '/rest/v1/rpc/play_rorisk_dice', {
        method: 'POST',
        body: JSON.stringify({
          p_user_uuid: sessionUser.uuid,
          p_amount: amount,
          p_currency: String(body.currency || ''),
          p_mode: String(body.mode || ''),
          p_target_low: targetLow,
          p_target_high: targetHigh,
          p_client_seed: String(body.clientSeed || sessionUser.uuid).slice(0, 128),
          p_server_seed: serverSeed,
          p_server_seed_hash: serverSeedHash,
        }),
      })
      if (result?.user) startRealtimeSession(request, response, env, result.user)
      if (result?.game) result.game.level = Number(result.user?.level) || 0
      if (result?.game) broadcastRealtime({ type: 'diceBet', game: result.game })
      sendJson(response, 200, result)
      return true
    }

  return false
}


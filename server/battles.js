import { createHash, randomBytes } from 'node:crypto'

const BATTLE_SELECT = '*'
const BOT_PROFILES = [
  ['Risk Bot', '/img/battles/risk-bot.png'],
  ['Kanye', '/img/battles/kanye.png'],
  ['Adin', '/img/battles/adin.png'],
  ['Tate', '/img/battles/tate.png'],
  ['PvP Bot', '/img/battles/pvp-bot.png'],
]
const BATTLE_FINALIZATIONS = new Map()

function selectBotProfile(battleUuid, slot, players = []) {
  const usage = new Map(BOT_PROFILES.map(([name]) => [name, 0]))
  for (const player of players) {
    if (!player?.is_bot) continue
    const name = String(player.username || '')
    if (usage.has(name)) usage.set(name, usage.get(name) + 1)
  }
  const start = Math.abs(
    createHash('sha256').update(`${battleUuid}:${slot}`).digest().readInt32BE(0),
  ) % BOT_PROFILES.length
  const minimumUsage = Math.min(...usage.values())
  for (let offset = 0; offset < BOT_PROFILES.length; offset += 1) {
    const profile = BOT_PROFILES[(start + offset) % BOT_PROFILES.length]
    if (usage.get(profile[0]) === minimumUsage) return profile
  }
  return BOT_PROFILES[start]
}

function integer(value, fallback = 0) {
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : fallback
}

function currencyIconValue(item, currency) {
  return Math.max(0, integer(currency === 'coins'
    ? item?.coinPrice ?? item?.coin_price ?? item?.price ?? item?.amount
    : item?.rocoinPrice ?? item?.rocoin_price ?? item?.price ?? item?.amount))
}

function caseChance(item) {
  const chance = Number.parseFloat(String(item?.chance ?? '').replace('%', ''))
  if (Number.isFinite(chance)) return Math.max(0, chance)
  return Math.max(0, Number(item?.tickets) || 0) / 1000
}

function teamFor(mode, slot) {
  if (mode === '2v2' || mode === '2v2v2') return Math.floor(slot / 2)
  if (mode === '3v3') return Math.floor(slot / 3)
  return slot
}

function publicBattle(row) {
  const cases = [...(row.cases || [])].map((entry, index) => ({
    ...entry,
    round_index: Number(entry.round_index ?? entry.roundIndex ?? index),
    case_id: entry.case_id ?? entry.caseId,
    image_url: entry.image_url ?? entry.imageUrl ?? entry.image,
  })).sort((a, b) => a.round_index - b.round_index)
  const players = [...(row.players || [])].map((entry) => ({
    ...entry,
    user_uuid: entry.user_uuid ?? entry.userUuid,
    roblox_id: entry.roblox_id ?? entry.robloxId,
    avatar_headshot: entry.avatar_headshot ?? entry.avatarHeadshot ?? entry.avatar,
    is_bot: entry.is_bot ?? entry.isBot ?? false,
    payout_amount: entry.payout_amount ?? entry.payoutAmount ?? 0,
    outcome_total: entry.outcome_total ?? entry.outcomeTotal ?? 0,
  })).sort((a, b) => a.slot - b.slot)
  const results = [...(row.results || [])].map((entry) => ({
    ...entry,
    round_index: Number(entry.round_index ?? entry.roundIndex ?? 0),
    item_index: Number(entry.item_index ?? entry.itemIndex ?? 0),
    item_amount: Number(entry.item_amount ?? entry.itemAmount ?? 0),
  })).sort((a, b) => a.round_index - b.round_index || a.slot - b.slot)
  const groupedBoxes = []
  for (const battleCase of cases) {
    const previous = groupedBoxes[groupedBoxes.length - 1]
    const box = {
      _id: battleCase.case_id,
      caseId: battleCase.case_id,
      name: battleCase.name,
      slug: battleCase.slug,
      imageUrl: battleCase.image_url,
      image: battleCase.image_url,
      amount: Number(battleCase.amount) || 0,
      type: battleCase.type,
      items: battleCase.items || [],
    }
    if (previous?.box?._id === box._id) previous.count += 1
    else groupedBoxes.push({ box, count: 1 })
  }

  const startedAt = row.started_at ? new Date(row.started_at).getTime() : 0
  const replayEpoch = row.started_at || row.completed_at || row.updated_at
  const replayStartedAt = replayEpoch ? new Date(replayEpoch).getTime() : 0
  const elapsed = replayStartedAt ? Math.max(0, Date.now() - replayStartedAt) : 0
  const fast = Boolean(row.options?.fastSpin)
  const leadMs = 3000
  const totalRounds = Number(row.total_rounds) || cases.length || 1
  const riskRounds = new Set(
    row.options?.riskSpin
      ? results
          .filter((result) => {
            const chance = caseChance(result.item)
            return chance > 0 && chance < 10
          })
          .map((result) => Number(result.round_index))
      : [],
  )
  const celebrationRounds = new Set(
    results
      .filter((result) => {
        const battleCase = cases[Number(result.round_index)]
        return caseChance(result.item) < 15 &&
          Number(result.item_amount || 0) >= Number(battleCase?.amount || 0)
      })
      .map((result) => Number(result.round_index)),
  )
  const roundDurations = Array.from(
    { length: totalRounds },
    (_, index) => {
      const risk = riskRounds.has(index)
      const base = fast
        ? (risk ? 6350 : 3900)
        : (risk ? 8650 : 6700)
      return base + 750 + (risk || celebrationRounds.has(index) ? 500 : 0)
    },
  )
  const rollingDuration = roundDurations.reduce((sum, duration) => sum + duration, 0)
  const finishAt = leadMs + rollingDuration + (row.options?.jackpot ? 5500 : 500)
  let state = row.state
  let currentRound = Number(row.current_round) || 0
  let eosCountdown = null
  if (row.state === 'countdown' && startedAt) {
    state = 'pending'
    currentRound = 0
    eosCountdown = elapsed < leadMs
      ? Math.min(3, Math.max(1, Math.ceil((leadMs - elapsed) / 1000)))
      : null
  } else if (row.state === 'completed' && startedAt && elapsed < finishAt) {
    if (elapsed < leadMs) {
      state = 'pending'
      eosCountdown = Math.min(3, Math.max(1, Math.ceil((leadMs - elapsed) / 1000)))
    } else {
      const animationElapsed = elapsed - leadMs
      let roundElapsed = 0
      currentRound = totalRounds
      for (let index = 0; index < roundDurations.length; index += 1) {
        roundElapsed += roundDurations[index]
        if (animationElapsed < roundElapsed) {
          currentRound = index + 1
          break
        }
      }
      state = row.options?.jackpot && animationElapsed >= rollingDuration ? 'jackpot_spinning' : 'rolling'
    }
  }

  const resultsBySlot = new Map()
  for (const result of results) {
    if (!resultsBySlot.has(result.slot)) resultsBySlot.set(result.slot, [])
    resultsBySlot.get(result.slot).push(result)
  }
  const winnerSlots = (row.winner_slots || []).map(Number)
  const legacyRealWinners = players.filter((player) => winnerSlots.includes(Number(player.slot)) && !player.is_bot)
  const legacyWinnerPayout = legacyRealWinners.length
    ? Math.floor((Number(row.payout_amount) || 0) / legacyRealWinners.length)
    : 0
  const bets = players.map((player) => {
    const slotResults = resultsBySlot.get(player.slot) || []
    const storedPayout = Number(player.payout_amount) || 0
    return {
      _id: player.uuid,
      slot: player.slot,
      team: player.team,
      bot: player.is_bot,
      user: {
        _id: player.user_uuid,
        uuid: player.user_uuid,
        robloxId: player.roblox_id,
        username: player.username,
        avatar: player.avatar_headshot,
        avatarHeadshot: player.avatar_headshot,
        rank: player.rank,
        level: player.level,
      },
      payout: storedPayout || (winnerSlots.includes(Number(player.slot)) && !player.is_bot ? legacyWinnerPayout : 0),
      total: Number(player.outcome_total) || 0,
      outcomes: slotResults.map((result) => result.item_index),
      riskOutcomes: slotResults.map((result) => {
        const chance = caseChance(result.item)
        return row.options?.riskSpin && chance > 0 && chance < 10
          ? result.item_index
          : -1
      }),
      outcomeAmounts: slotResults.map((result) => Number(result.item_amount) || 0),
      results: slotResults.map((result) => ({
        roundIndex: result.round_index,
        ticket: result.ticket,
        itemIndex: result.item_index,
        item: result.item,
        itemAmount: Number(result.item_amount) || 0,
      })),
    }
  })
  const jackpotRawWeights = bets.map((bet) => Math.max(
    1,
    row.options?.crazy
      ? Math.floor(1e9 / Math.max(1, Number(bet.total) || 0))
      : Number(bet.total) || 0,
  ))
  const jackpotWeightTotal = jackpotRawWeights.reduce((sum, weight) => sum + weight, 0)
  const jackpotWeights = row.options?.jackpot
    ? jackpotRawWeights.map((weight, index) => ({
        slot: Number(bets[index]?.slot) || index,
        weight,
        percentage: Number(((weight / Math.max(1, jackpotWeightTotal)) * 100).toFixed(2)),
      }))
    : []
  const jackpotWinnerIndex = row.options?.jackpot
    ? bets.findIndex((bet) => winnerSlots.includes(Number(bet.slot)))
    : -1
  return {
    _id: row.uuid,
    uuid: row.uuid,
    gameId: row.battle_id,
    state,
    storedState: row.state,
    mode: row.mode,
    playerCount: row.player_count,
    amount: Number(row.amount) || 0,
    joinAmount: Number(row.join_amount) || 0,
    currency: row.currency,
    boxes: groupedBoxes,
    rounds: cases.map((entry) => ({
      _id: entry.uuid || `${row.uuid}-${entry.round_index}`,
      roundIndex: entry.round_index,
      box: {
        _id: entry.case_id,
        caseId: entry.case_id,
        name: entry.name,
        slug: entry.slug,
        imageUrl: entry.image_url,
        image: entry.image_url,
        amount: Number(entry.amount) || 0,
        type: entry.type,
        items: entry.items || [],
      },
    })),
    bets,
    jackpotWeights,
    jackpotWinnerIndex,
    options: row.options || {},
    currentRound,
    totalRounds,
    winnerSlots,
    payoutAmount: Number(row.payout_amount) || 0,
    fair: {
      serverSeedHash: row.server_seed_hash,
      serverSeed: state === 'completed' ? row.server_seed : null,
      clientSeed: row.client_seed,
      nonce: row.nonce,
      eosBlockId: row.eos_block_id,
      eosBlockNumber: row.eos_block_number,
      eosCountdown,
    },
    version: row.version,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  }
}

async function battleRow(supabaseRequest, env, identifier) {
  const query = new URLSearchParams({
    [String(identifier).includes('-') ? 'uuid' : 'battle_id']: `eq.${identifier}`,
    select: BATTLE_SELECT,
    limit: '1',
  })
  const rows = await supabaseRequest(env, `/rest/v1/rorisk_battles?${query}`)
  return rows?.[0] || null
}

async function currentEosBlock() {
  try {
    const infoResponse = await fetch('https://eos.greymass.com/v1/chain/get_info', { signal: AbortSignal.timeout(5000) })
    if (!infoResponse.ok) throw new Error('EOS unavailable')
    const info = await infoResponse.json()
    const blockNumber = Number(info.head_block_num)
    const blockResponse = await fetch('https://eos.greymass.com/v1/chain/get_block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ block_num_or_id: blockNumber }),
      signal: AbortSignal.timeout(5000),
    })
    if (!blockResponse.ok) throw new Error('EOS unavailable')
    const block = await blockResponse.json()
    if (!/^[a-f0-9]{64}$/i.test(block.id || '')) throw new Error('EOS block invalid')
    return { blockId: block.id.toLowerCase(), blockNumber }
  } catch {
    const blockNumber = Math.floor(Date.now() / 500)
    return { blockId: createHash('sha256').update(`rorisk-eos-fallback:${blockNumber}`).digest('hex'), blockNumber }
  }
}

function resolveBattle(row, eos) {
  const players = [...(row.players || [])].map((entry) => ({
    ...entry,
    is_bot: entry.is_bot ?? entry.isBot ?? false,
    user_uuid: entry.user_uuid ?? entry.userUuid,
  })).sort((a, b) => a.slot - b.slot)
  const cases = [...(row.cases || [])].map((entry, index) => ({
    ...entry,
    round_index: Number(entry.round_index ?? entry.roundIndex ?? index),
  })).sort((a, b) => a.round_index - b.round_index)
  const results = []
  const totals = new Map(players.map((player) => [player.slot, 0]))
  const lastAmounts = new Map(players.map((player) => [player.slot, 0]))
  for (const battleCase of cases) {
    const items = Array.isArray(battleCase.items) ? battleCase.items : []
    for (const player of players) {
      const hash = createHash('sha256').update(`${row.server_seed}-${eos.blockId}-${battleCase.round_index}-${player.slot}`).digest('hex')
      const ticket = Number.parseInt(hash.slice(0, 8), 16) % 100000
      const roll = ticket / 1000
      let cumulative = 0
      let selectedIndex = Math.max(0, items.length - 1)
      for (let index = 0; index < items.length; index += 1) {
        cumulative += caseChance(items[index])
        if (roll <= cumulative) { selectedIndex = index; break }
      }
      const item = items[selectedIndex] || { name: 'Unknown Item', image: '/default-avatar.png', chance: '100%' }
      const itemAmount = currencyIconValue(item, row.currency)
      totals.set(player.slot, (totals.get(player.slot) || 0) + itemAmount)
      lastAmounts.set(player.slot, itemAmount)
      results.push({ roundIndex: battleCase.round_index, slot: player.slot, ticket, itemIndex: selectedIndex, item, itemAmount })
    }
  }

  const options = row.options || {}
  const borrowMultiplier = Math.max(0, 100 - Math.min(80, Math.max(0, Number(options.borrow) || 0))) / 100
  const pot = Math.floor([...totals.values()].reduce((sum, value) => sum + value, 0) * borrowMultiplier)
  let winnerSlots = []
  const payouts = players.map((player) => ({ slot: player.slot, amount: 0 }))
  if (row.mode === 'group') {
    const eligible = players
    const each = eligible.length ? Math.floor(pot / eligible.length) : 0
    for (const player of eligible) payouts.find((entry) => entry.slot === player.slot).amount = each
    winnerSlots = eligible.map((player) => player.slot)
  } else {
    const metric = options.terminal ? lastAmounts : totals
    const byTeam = new Map()
    for (const player of players) {
      const team = teamFor(row.mode, player.slot)
      byTeam.set(team, (byTeam.get(team) || 0) + (metric.get(player.slot) || 0))
    }
    let winningTeam
    if (options.jackpot) {
      const entries = [...byTeam.entries()]
      const totalWeight = entries.reduce((sum, [, amount]) => sum + Math.max(1, options.crazy ? Math.floor(1e9 / Math.max(1, amount)) : amount), 0)
      let point = Number.parseInt(createHash('sha256').update(`${row.server_seed}-${eos.blockId}-jackpot`).digest('hex').slice(0, 12), 16) % Math.max(1, totalWeight)
      winningTeam = entries[0]?.[0]
      for (const [team, amount] of entries) {
        point -= Math.max(1, options.crazy ? Math.floor(1e9 / Math.max(1, amount)) : amount)
        if (point < 0) { winningTeam = team; break }
      }
    } else {
      const values = [...byTeam.entries()]
      const target = options.crazy
        ? Math.min(...values.map(([, value]) => value))
        : Math.max(...values.map(([, value]) => value))
      winningTeam = values.find(([, value]) => value === target)?.[0]
    }
    winnerSlots = players.filter((player) => teamFor(row.mode, player.slot) === winningTeam).map((player) => player.slot)
    const winningPlayers = players.filter((player) => winnerSlots.includes(player.slot))
    const each = winningPlayers.length ? Math.floor(pot / winningPlayers.length) : 0
    for (const player of winningPlayers) payouts.find((entry) => entry.slot === player.slot).amount = each
  }
  return { results, payouts, winnerSlots }
}

async function finalizeIfReady({ row, env, supabaseRequest }) {
  if (!row || row.state !== 'countdown' || (row.players || []).length < row.player_count) return row
  const eos = await currentEosBlock()
  const resolved = resolveBattle(row, eos)
  await supabaseRequest(env, '/rest/v1/rpc/finalize_rorisk_battle', {
    method: 'POST',
    body: JSON.stringify({
      p_battle_uuid: row.uuid,
      p_results: resolved.results,
      p_payouts: resolved.payouts,
      p_winner_slots: resolved.winnerSlots,
      p_eos_block_id: eos.blockId,
      p_eos_block_number: eos.blockNumber,
      p_server_seed: row.server_seed,
    }),
  })
  return battleRow(supabaseRequest, env, row.uuid)
}

function finalizeBattleInBackground({ row, env, supabaseRequest, broadcastRealtime }) {
  if (!row || row.state !== 'countdown' || (row.players || []).length < row.player_count) return
  if (BATTLE_FINALIZATIONS.has(row.uuid)) return
  BATTLE_FINALIZATIONS.set(row.uuid, true)
  setTimeout(async () => {
    try {
      const completed = await finalizeIfReady({ row, env, supabaseRequest })
      if (completed) broadcastRealtime({ type: 'battleUpdate', game: publicBattle(completed) })
    } catch (error) {
      console.error('Unable to finalize battle:', error?.message || error)
    } finally {
      BATTLE_FINALIZATIONS.delete(row.uuid)
    }
  }, 0)
}

export async function handleBattlesRequest(context) {
  const { request, response, url, env, readJson, sendJson, supabaseRequest, requestSessionUser, startRealtimeSession, broadcastRealtime } = context
  if (!url.pathname.startsWith('/api/battles')) return false

  if (request.method === 'GET' && url.pathname === '/api/battles') {
    const query = new URLSearchParams({ select: BATTLE_SELECT, order: 'created_at.desc', limit: '100' })
    const rows = await supabaseRequest(env, `/rest/v1/rorisk_battles?${query}`)
    sendJson(response, 200, { games: (rows || []).map(publicBattle) })
    return true
  }

  const detailMatch = url.pathname.match(/^\/api\/battles\/([a-zA-Z0-9-]+)$/)
  if (request.method === 'GET' && detailMatch) {
    const row = await battleRow(supabaseRequest, env, detailMatch[1])
    if (!row) throw new Error('This battle could not be found.')
    sendJson(response, 200, { game: publicBattle(row), serverTime: new Date().toISOString() })
    finalizeBattleInBackground({ row, env, supabaseRequest, broadcastRealtime })
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/battles') {
    const sessionUser = requestSessionUser(request, env)
    if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
    const body = await readJson(request)
    const currency = body.currency === 'coins' ? 'coins' : 'rocoins'
    const playerCount = integer(body.playerCount)
    if (![2, 3, 4, 6].includes(playerCount)) throw new Error('The selected player count is invalid.')
    const mode = ['standard', 'group', '2v2', '3v3', '2v2v2'].includes(body.mode) ? body.mode : 'standard'
    const requested = Array.isArray(body.boxes) ? body.boxes : []
    const totalCount = requested.reduce((sum, entry) => sum + Math.max(0, integer(entry.count)), 0)
    if (totalCount < 1 || totalCount > 50) throw new Error('Select between 1 and 50 cases.')
    const ids = requested.map((entry) => String(entry._id || entry.caseId || '')).filter(Boolean)
    if (!ids.length || ids.some((id) => !/^[a-zA-Z0-9_-]+$/.test(id))) throw new Error('One of the selected cases is invalid.')
    const casesQuery = new URLSearchParams({ case_id: `in.(${ids.join(',')})`, active: 'eq.true', select: '*' })
    const caseRows = await supabaseRequest(env, `/rest/v1/rorisk_cases?${casesQuery}`)
    const byId = new Map((caseRows || []).map((entry) => [String(entry.case_id), entry]))
    const snapshots = []
    for (const selected of requested) {
      const found = byId.get(String(selected._id || selected.caseId))
      if (!found) throw new Error('One of the selected cases is no longer available.')
      const categories = Array.isArray(found.categories) ? found.categories : []
      if (categories.some((category) => ['daily', 'rewards', 'bonus'].includes(category))) throw new Error('That case cannot be used in battles.')
      const amount = Math.max(0, integer(currency === 'coins' ? found.coin_amount : found.rocoin_amount))
      for (let index = 0; index < Math.max(1, integer(selected.count, 1)); index += 1) snapshots.push({
        uuid: found.uuid,
        caseId: found.case_id,
        name: found.name,
        slug: found.slug,
        imageUrl: found.image_url,
        type: found.type,
        amount,
        items: found.items || [],
      })
    }
    const amount = snapshots.reduce((sum, entry) => sum + entry.amount, 0)
    const funding = Math.min(100, Math.max(0, integer(body.funding)))
    const borrow = Math.min(80, Math.max(0, integer(body.borrow)))
    const joinAmount = Math.floor(Math.floor(amount * (100 - funding) / 100) * (100 - borrow) / 100)
    const creatorCost = Math.floor((amount + Math.floor(amount * Math.max(0, playerCount - 1) * funding / 100)) * (100 - borrow) / 100)
    const options = {
      createdBy: sessionUser.uuid,
      levelMin: Math.min(100, Math.max(0, integer(body.levelMin))),
      funding,
      hostJoin: body.hostJoin !== false,
      private: body.private === true,
      affiliateOnly: body.affiliateOnly === true,
      crazy: body.crazy === true,
      terminal: body.terminal === true,
      jackpot: body.jackpot === true,
      fastSpin: body.fastSpin === true,
      riskSpin: body.riskSpin === true,
      borrow,
    }
    if (options.terminal && options.jackpot) throw new Error('Terminal mode cannot be combined with Jackpot mode.')
    if (mode === 'group' && (options.crazy || options.terminal || options.jackpot)) throw new Error('Group battles cannot use Crazy, Terminal, or Jackpot modes.')
    const serverSeed = randomBytes(32).toString('hex')
    const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex')
    const result = await supabaseRequest(env, '/rest/v1/rpc/create_rorisk_battle', {
      method: 'POST',
      body: JSON.stringify({
        p_user_uuid: sessionUser.uuid,
        p_currency: currency,
        p_mode: mode,
        p_player_count: playerCount,
        p_amount: amount,
        p_join_amount: joinAmount,
        p_creator_cost: creatorCost,
        p_options: options,
        p_cases: snapshots,
        p_client_seed: String(body.clientSeed || sessionUser.uuid).slice(0, 128),
        p_server_seed: serverSeed,
        p_server_seed_hash: serverSeedHash,
      }),
    })
    if (result?.user) startRealtimeSession(request, response, env, result.user)
    const row = result?.battle || await battleRow(supabaseRequest, env, result.battle.uuid)
    const game = publicBattle(row)
    broadcastRealtime({ type: 'battleUpdate', game })
    sendJson(response, 200, { game, user: result.user })
    return true
  }

  const actionMatch = url.pathname.match(/^\/api\/battles\/([a-fA-F0-9-]+)\/(join|bot|fill-bots|recreate)$/)
  if (request.method === 'POST' && actionMatch) {
    const sessionUser = requestSessionUser(request, env)
    if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
    const body = await readJson(request)
    const [, battleUuid, action] = actionMatch
    let result
    let actionRow
    if (action === 'join') {
      result = await supabaseRequest(env, '/rest/v1/rpc/join_rorisk_battle', {
        method: 'POST',
        body: JSON.stringify({ p_battle_uuid: battleUuid, p_user_uuid: sessionUser.uuid, p_slot: integer(body.slot) }),
      })
      actionRow = result?.battle || null
      if (result?.user) startRealtimeSession(request, response, env, result.user)
    } else if (action === 'bot' || action === 'fill-bots') {
      let row = await battleRow(supabaseRequest, env, battleUuid)
      if (!row) throw new Error('This battle could not be found.')
      const occupied = new Set((row.players || []).map((player) => player.slot))
      const slots = action === 'fill-bots'
        ? Array.from({ length: row.player_count }, (_, slot) => slot).filter((slot) => !occupied.has(slot))
        : [integer(body.slot)]
      const botPlayers = []
      for (const slot of slots) {
        const profile = selectBotProfile(battleUuid, slot, row.players || [])
        botPlayers.push({ slot, username: profile[0], avatar: profile[1] })
        row.players = [
          ...(row.players || []),
          { slot, is_bot: true, username: profile[0], avatar_headshot: profile[1] },
        ]
      }
      if (action === 'fill-bots' && botPlayers.length > 1) {
        try {
          result = await supabaseRequest(env, '/rest/v1/rpc/add_rorisk_battle_bots', {
            method: 'POST',
            body: JSON.stringify({ p_battle_uuid: battleUuid, p_creator_uuid: sessionUser.uuid, p_bots: botPlayers }),
          })
        } catch (error) {
          if (!/add_rorisk_battle_bots|schema cache|function/i.test(String(error?.message || error))) throw error
          for (const bot of botPlayers) {
            result = await supabaseRequest(env, '/rest/v1/rpc/add_rorisk_battle_bot', {
              method: 'POST',
              body: JSON.stringify({ p_battle_uuid: battleUuid, p_creator_uuid: sessionUser.uuid, p_slot: bot.slot, p_username: bot.username, p_avatar: bot.avatar }),
            })
          }
        }
      } else if (botPlayers[0]) {
        const bot = botPlayers[0]
        result = await supabaseRequest(env, '/rest/v1/rpc/add_rorisk_battle_bot', {
          method: 'POST',
          body: JSON.stringify({ p_battle_uuid: battleUuid, p_creator_uuid: sessionUser.uuid, p_slot: bot.slot, p_username: bot.username, p_avatar: bot.avatar }),
        })
      }
      actionRow = result?.battle || null
    } else {
      const source = await battleRow(supabaseRequest, env, battleUuid)
      if (!source) throw new Error('This battle could not be found.')
      sendJson(response, 200, { recreate: {
        boxes: [...(source.cases || [])].reduce((entries, entry) => {
          const caseId = entry.case_id || entry.caseId
          const existing = entries.find((candidate) => candidate._id === caseId)
          if (existing) existing.count += 1
          else entries.push({ _id: caseId, count: 1 })
          return entries
        }, []),
        playerCount: source.player_count,
        mode: source.mode,
        ...source.options,
        currency: source.currency,
      } })
      return true
    }
    const row = actionRow || await battleRow(supabaseRequest, env, battleUuid)
    const game = publicBattle(row)
    broadcastRealtime({ type: 'battleUpdate', game })
    sendJson(response, 200, { game, user: result?.user })
    finalizeBattleInBackground({ row, env, supabaseRequest, broadcastRealtime })
    return true
  }

  sendJson(response, 404, { error: 'Not found.' })
  return true
}

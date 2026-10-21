import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { attachRealtimeServer, broadcastRealtime, clearRealtimeSessionCookie, createRealtimeSession, readRealtimeSession, setRealtimeSessionCookie } from './chat.js'
import { handleBattlesRequest } from './battles.js'
import { handleAffiliatesRequest } from './affiliates.js'
import { handleAssetsRequest } from './assets.js'
import { handleAuthRequest } from './auth.js'
import { handleBlackjackRequest } from './blackjack.js'
import { handleCasesRequest } from './cases.js'
import { handleCoinflipRequest } from './coinflip.js'
import { handleDiceRequest } from './dice.js'
import { handleMinesRequest } from './mines.js'
import { handlePaymentsRequest } from './payments.js'
import { handleRouletteRequest } from './roulette.js'
import { handleUpgraderRequest } from './upgrader.js'

const CHALLENGE_LIFETIME_MS = 15 * 60 * 1000
const MAX_BODY_BYTES = 64 * 1024
const VERIFICATION_WORDS = [
  'apple', 'beach', 'book', 'cloud', 'coast', 'dream', 'field', 'flower', 'forest', 'giant',
  'honey', 'island', 'light', 'moon', 'mountain', 'ocean', 'river', 'smile', 'star', 'summer',
  'sun', 'tree', 'valley', 'water', 'winter',
]

function sendJson(response, status, payload) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('Request body is too large.')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function hmac(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function isSecureRequest(request) {
  return request.headers['x-forwarded-proto'] === 'https' || Boolean(request.socket?.encrypted)
}

function startRealtimeSession(request, response, env, user) {
  if (!user || !env.RORISK_USER_SECRET) return
  const token = createRealtimeSession(user, (value) => hmac(value, env.RORISK_USER_SECRET))
  setRealtimeSessionCookie(response, token, isSecureRequest(request))
}

function createChallenge(profile, secret) {
  const words = Array.from({ length: 10 }, () => VERIFICATION_WORDS[randomInt(VERIFICATION_WORDS.length)])
  const payload = Buffer.from(JSON.stringify({
    robloxId: profile.id,
    robloxUsername: profile.name,
    verificationCode: `Risk Verification | ${words.join(' ')}`,
    expiresAt: Date.now() + CHALLENGE_LIFETIME_MS,
  })).toString('base64url')
  return `${payload}.${hmac(payload, secret)}`
}

function verifyChallenge(challenge, secret) {
  const [payload, signature] = String(challenge || '').split('.')
  if (!payload || !signature) throw new Error('The verification request is invalid.')
  const expected = hmac(payload, secret)
  const suppliedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    throw new Error('The verification request is invalid.')
  }
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  if (Date.now() > parsed.expiresAt) throw new Error('The verification phrase has expired. Please start again.')
  return parsed
}

async function verifyCaptcha(token, secret, remoteIp) {
  if (!secret) throw new Error('hCaptcha is not configured on this server.')
  const form = new URLSearchParams({ secret, response: token || '' })
  if (remoteIp) form.set('remoteip', remoteIp)
  const response = await fetch('https://api.hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const result = await response.json()
  if (!result.success) throw new Error('Captcha verification failed. Please try again.')
}

async function findRobloxUser(username) {
  const response = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
  })
  if (!response.ok) throw new Error('Roblox is currently unavailable. Please try again.')
  const result = await response.json()
  if (!result.data?.[0]) throw new Error('That Roblox username could not be found.')
  return result.data[0]
}

async function getRobloxProfile(robloxId) {
  const response = await fetch(`https://users.roblox.com/v1/users/${robloxId}`)
  if (!response.ok) throw new Error('Unable to read the Roblox profile.')
  return response.json()
}

function normalizeVerificationText(value) {
  return String(value || '')
    .replace(/\\u([0-9a-f]{4})/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/&#([0-9]+);/g, (_, value) => String.fromCodePoint(Number.parseInt(value, 10)))
    .replace(/&(nbsp|NonBreakingSpace);/gi, ' ')
    .replace(/&(vert|VerticalLine);/gi, '|')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
}

async function publicProfileContainsVerificationCode(robloxId, verificationCode) {
  const url = new URL(`https://www.roblox.com/users/${robloxId}/profile`)
  url.searchParams.set('_verification_check', String(Date.now()))
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
      },
    })
    if (!response.ok) return false
    const html = await response.text()
    return normalizeVerificationText(html).includes(normalizeVerificationText(verificationCode))
  } catch {
    return false
  }
}

async function getRobloxHeadshot(robloxId) {
  const url = new URL('https://thumbnails.roblox.com/v1/users/avatar-headshot')
  url.searchParams.set('userIds', String(robloxId))
  url.searchParams.set('size', '150x150')
  url.searchParams.set('format', 'Png')
  url.searchParams.set('isCircular', 'false')
  const response = await fetch(url)
  if (!response.ok) return '/assets/users/default-avatar.png'
  const result = await response.json()
  return result.data?.[0]?.imageUrl || '/assets/users/default-avatar.png'
}

async function supabaseRequest(env, path, options = {}) {
  const serverKeys = [...new Set([env.SUPABASE_SECRET_KEY, env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean))]
  if (!env.SUPABASE_URL || !serverKeys.length) {
    throw new Error('Supabase server credentials are not configured.')
  }
  let lastError
  for (const [index, serverKey] of serverKeys.entries()) {
    const legacyJwtKey = serverKey.startsWith('eyJ')
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}${path}`, {
      ...options,
      headers: {
        apikey: serverKey,
        ...(legacyJwtKey ? { Authorization: `Bearer ${serverKey}` } : {}),
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    const text = await response.text()
    let body
    try { body = text ? JSON.parse(text) : null } catch { body = null }
    if (response.ok) return body
    lastError = new Error(body?.message || body?.error_description || body?.hint || 'Supabase request failed.')
    if (![401, 403].includes(response.status) || index === serverKeys.length - 1) throw lastError
  }
  throw lastError || new Error('Supabase request failed.')
}

const COINS_PER_USD = 100
const OXAPAY_API_URL = 'https://api.oxapay.com/v1'

async function oxaPayRequest(path, apiKeyName, apiKey, options = {}) {
  if (!apiKey) throw new Error('Crypto payments are not configured on this server.')
  const upstream = await fetch(`${OXAPAY_API_URL}${path}`, {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: {
      [apiKeyName]: apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const payload = await upstream.json().catch(() => null)
  if (!upstream.ok || Number(payload?.status) >= 400 || payload?.error?.message) {
    throw new Error(payload?.error?.message || payload?.message || 'The payment provider rejected this request.')
  }
  return payload?.data || payload
}

function paymentCallbackUrl(request, env, kind) {
  const configured = String(env.OXAPAY_CALLBACK_BASE_URL || '').trim().replace(/\/$/, '')
  const forwardedProtocol = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const inferred = forwardedProtocol === 'https' && request.headers.host ? `https://${request.headers.host}` : ''
  const base = configured || inferred
  if (!base || !/^https:\/\//i.test(base) || /https:\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/i.test(base)) {
    throw new Error('Set OXAPAY_CALLBACK_BASE_URL to the public HTTPS URL of this site.')
  }
  return `${base}/api/payments/oxapay/${kind}-webhook`
}

function validOxaSignature(rawBody, suppliedSignature, secret) {
  if (!secret || !suppliedSignature) return false
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex')
  const supplied = String(suppliedSignature).trim().toLowerCase()
  const expectedBuffer = Buffer.from(expected)
  const suppliedBuffer = Buffer.from(supplied)
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer)
}

async function currentCryptoQuote(currency, network) {
  const symbol = String(currency || '').trim().toUpperCase()
  if (!/^[A-Z0-9]{2,12}$/.test(symbol)) throw new Error('The selected cryptocurrency is invalid.')
  const [pricesResponse, currenciesResponse] = await Promise.all([
    fetch(`${OXAPAY_API_URL}/common/prices`, { signal: AbortSignal.timeout(10000) }),
    fetch(`${OXAPAY_API_URL}/common/currencies`, { signal: AbortSignal.timeout(10000) }),
  ])
  if (!pricesResponse.ok || !currenciesResponse.ok) throw new Error('Unable to retrieve the current cryptocurrency quote.')
  const prices = await pricesResponse.json()
  const currencies = await currenciesResponse.json()
  const price = Number(prices?.data?.[symbol])
  const currencyData = currencies?.data?.[symbol]
  if (!currencyData?.status || !Number.isFinite(price) || price <= 0) throw new Error('The selected cryptocurrency is currently unavailable.')
  const networks = Object.values(currencyData.networks || {})
  const requestedNetwork = String(network || '').trim().toLowerCase()
  const networkData = networks.find((entry) => [entry.network, entry.name, ...(entry.keys || [])].some((key) => String(key).toLowerCase() === requestedNetwork)) || (networks.length === 1 ? networks[0] : null)
  if (!networkData) throw new Error('Select a valid network for this cryptocurrency.')
  return { symbol, price, network: networkData.network, networkData }
}

async function readRawBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('Request body is too large.')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function sendText(response, status, value) {
  response.statusCode = status
  response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(value)
}

function requestSessionUser(request, env) {
  if (!env.RORISK_USER_SECRET) return null
  const cookies = Object.fromEntries(String(request.headers.cookie || '').split(';').map((part) => {
    const separator = part.indexOf('=')
    if (separator < 0) return [part.trim(), '']
    return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())]
  }).filter(([name]) => name))
  return readRealtimeSession(cookies.rorisk_session, (value) => hmac(value, env.RORISK_USER_SECRET))
}

async function sendStoredImage(response, env, bucket, objectPath, label) {
  const serverKeys = [...new Set([env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_SECRET_KEY].filter(Boolean))]
    .sort((left, right) => Number(right.startsWith('eyJ')) - Number(left.startsWith('eyJ')))
  if (!env.SUPABASE_URL || !serverKeys.length) throw new Error(`${label} image storage is unavailable.`)

  let lastStatus = 503
  for (const [index, serverKey] of serverKeys.entries()) {
    const legacyJwtKey = serverKey.startsWith('eyJ')
    const upstream = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/authenticated/${bucket}/${objectPath}`, {
      headers: {
        apikey: serverKey,
        ...(legacyJwtKey ? { Authorization: `Bearer ${serverKey}` } : {}),
      },
    })
    if (upstream.ok) {
      response.statusCode = 200
      response.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/png')
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      response.end(Buffer.from(await upstream.arrayBuffer()))
      return
    }
    lastStatus = upstream.status
    if (![400, 401, 403].includes(upstream.status) || index === serverKeys.length - 1) break
  }

  sendJson(response, lastStatus === 404 ? 404 : 503, { error: `${label} image unavailable.` })
}

function selectedCurrency(value) {
  return String(value || '').toLowerCase() === 'coins' ? 'coins' : 'rocoins'
}

function baseCoinPair(source, fallback = 0) {
  const explicitCoins = Number(source?.coin_price ?? source?.coinPrice ?? source?.coin_value ?? source?.coinValue)
  const explicitRocoins = Number(source?.rocoin_price ?? source?.rocoinPrice ?? source?.rocoin_value ?? source?.rocoinValue)
  const coins = Math.max(0, Math.trunc(Number.isFinite(explicitCoins) ? explicitCoins : fallback))
  const rocoins = Math.max(0, Math.trunc(Number.isFinite(explicitRocoins) ? explicitRocoins : coins * 5))
  return { coins, rocoins }
}

function calculatedCaseRiskLevel(row) {
  const items = Array.isArray(row?.items) ? row.items : []
  const casePrice = Math.max(0, Number(row?.coin_amount ?? row?.rocoin_amount ?? row?.amount) || 0)
  let totalChance = 0
  let losingChance = 0

  for (const item of items) {
    const explicitChance = Number.parseFloat(String(item?.chance ?? ''))
    const chance = Number.isFinite(explicitChance) ? explicitChance : Math.max(0, Number(item?.tickets) || 0) / 1000
    const value = Math.max(0, Number(item?.coinPrice ?? item?.coin_price ?? item?.price ?? item?.amount) || 0)
    totalChance += chance
    if (value < casePrice) losingChance += chance
  }

  return totalChance > 0 ? Math.round(Math.min(100, Math.max(0, losingChance / totalChance * 100)) * 100) / 100 : 50
}

function publicCase(row, includeItems = false, currency = 'rocoins') {
  const requestedCurrency = selectedCurrency(currency)
  const legacyBaseAmount = Number(row.rocoin_amount ?? row.amount) || 0
  const amounts = row.coin_amount == null
    ? baseCoinPair({}, legacyBaseAmount)
    : baseCoinPair({ coin_price: row.coin_amount, rocoin_price: row.rocoin_amount }, legacyBaseAmount)
  const storedRiskLevel = row.risk_level == null ? Number.NaN : Number(row.risk_level)
  const riskLevel = Number.isFinite(storedRiskLevel)
    ? Math.max(0, Math.min(100, storedRiskLevel))
    : calculatedCaseRiskLevel(row)
  const data = {
    caseId: row.case_id,
    name: row.name,
    slug: row.slug,
    amount: amounts[requestedCurrency],
    coinAmount: amounts.coins,
    rocoinAmount: amounts.rocoins,
    currency: requestedCurrency,
    type: row.type,
    categories: row.categories,
    levelMin: row.level_min,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    riskLevel,
    rarityBar: {
      marker: riskLevel,
      tone: riskLevel < 25 ? 'green' : riskLevel < 50 ? 'blue' : riskLevel < 75 ? 'yellow' : 'orange',
    },
  }
  if (includeItems) {
    data.items = (Array.isArray(row.items) ? row.items : []).map((item, index) => {
      const prices = baseCoinPair(item, item.price ?? item.amount)
      return {
        ...item,
        index: Number(item.index) || index + 1,
        price: prices[requestedCurrency],
        coinPrice: prices.coins,
        rocoinPrice: prices.rocoins,
        chance: String(item.chance ?? `${Number(item.tickets || 0) / 1000}%`),
        rarity: item.rarity == null || String(item.rarity).trim() === '' ? null : String(item.rarity).toLowerCase(),
      }
    })
  }
  return data
}

function publicCasinoGame(row) {
  return {
    code: row.game_code,
    name: row.game_name,
    provider: row.provider,
    providerCode: row.provider_code,
    image: row.image_url,
    launchCount: Number(row.launch_count) || 0,
    popularRank: Number(row.popular_rank) || 0,
    newestRank: row.newest_rank == null ? null : Number(row.newest_rank),
    demoSupport: row.demo_support === true,
  }
}

function publicMinesGame(row) {
  const completed = row.state === 'completed'
  return {
    uuid: row.uuid,
    user_uuid: row.user_uuid,
    roblox_id: row.roblox_id,
    username: row.username,
    avatar_headshot: row.avatar_headshot,
    currency: row.currency,
    bet_amount: Number(row.bet_amount) || 0,
    mines_count: Number(row.mines_count) || 1,
    revealed: Array.isArray(row.revealed) ? row.revealed.map((entry) => ({ tile: Number(entry.tile), value: entry.value })) : [],
    revealed_tiles: Array.isArray(row.revealed) ? row.revealed.map((entry) => Number(entry.tile)) : [],
    state: row.state,
    multiplier: Number(row.multiplier) || 0.9,
    won: row.won === true,
    payout_amount: Number(row.payout_amount) || 0,
    client_seed: row.client_seed,
    server_seed_hash: row.server_seed_hash,
    server_seed: completed ? row.server_seed : null,
    nonce: Number(row.nonce) || 0,
    deck: completed && Array.isArray(row.deck) ? row.deck.map(String) : null,
    created_at: row.created_at,
    completed_at: row.completed_at,
    updated_at: row.updated_at,
    level: Number(row.profile?.level) || Number(row.level) || 0,
    rank: row.profile?.rank || row.rank || 'user',
    method: 'mines',
  }
}

function blackjackCardValue(cards) {
  let value = 0
  let aces = 0
  for (const card of Array.isArray(cards) ? cards : []) {
    if (card?.rank === 'A') { value += 11; aces += 1 }
    else if (['K', 'Q', 'J'].includes(card?.rank)) value += 10
    else value += Math.max(0, Math.trunc(Number(card?.rank) || 0))
  }
  while (value > 21 && aces > 0) { value -= 10; aces -= 1 }
  return value
}

function blackjackNatural(cards) {
  return Array.isArray(cards) && cards.length === 2 && blackjackCardValue(cards) === 21
}

function createBlackjackDeck(serverSeed, clientSeed, nonce) {
  const suits = ['club', 'diamond', 'heart', 'spade']
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
  return suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit }))).map((card, index) => ({
    ...card,
    order: createHash('sha256').update(`${serverSeed}:${clientSeed}:${nonce}:${index}`).digest('hex'),
  })).sort((first, second) => first.order.localeCompare(second.order)).map(({ rank, suit }) => ({ rank, suit }))
}

function publicBlackjackGame(row) {
  const completed = row.state === 'completed'
  const dealerCards = Array.isArray(row.dealer_cards) ? row.dealer_cards.map((card, index) => (!completed && index === 1 ? { rank: 'hidden', suit: card.suit } : card)) : []
  return {
    uuid: row.uuid,
    user_uuid: row.user_uuid,
    roblox_id: row.roblox_id,
    username: row.username,
    avatar_headshot: row.avatar_headshot,
    currency: row.currency,
    bet_amount: Number(row.wager_amount ?? row.bet_amount) || 0,
    main_bet_amount: Number(row.bet_amount) || 0,
    wager_amount: Number(row.wager_amount ?? row.bet_amount) || 0,
    insurance_amount: Number(row.insurance_amount) || 0,
    payout_amount: Number(row.payout_amount) || 0,
    multiplier: Number(row.multiplier) || 0,
    state: row.state,
    active_hand: row.active_hand,
    dealer_cards: dealerCards,
    player_cards: Array.isArray(row.player_cards) ? row.player_cards : [],
    cards_left: Array.isArray(row.cards_left) ? row.cards_left : [],
    cards_right: Array.isArray(row.cards_right) ? row.cards_right : [],
    actions: Array.isArray(row.actions) ? row.actions : [],
    outcomes: row.outcomes && typeof row.outcomes === 'object' ? row.outcomes : {},
    won: row.won === true,
    client_seed: row.client_seed,
    server_seed_hash: row.server_seed_hash,
    server_seed: completed ? row.server_seed : null,
    nonce: Number(row.nonce) || 0,
    deck: completed && Array.isArray(row.deck) ? row.deck : null,
    created_at: row.created_at,
    completed_at: row.completed_at,
    updated_at: row.updated_at,
    level: Number(row.profile?.level) || Number(row.level) || 0,
    rank: row.profile?.rank || row.rank || 'user',
    method: 'blackjack',
  }
}

function settleBlackjack({ dealerCards, playerCards, cardsLeft, cardsRight, deck, deckPosition, betAmount, insuranceAmount = 0 }) {
  const split = cardsLeft.length > 0 && cardsRight.length > 0
  const playerHands = split ? [['left', cardsLeft], ['right', cardsRight]] : [['main', playerCards]]
  const dealerNatural = blackjackNatural(dealerCards)
  const hasLiveHand = playerHands.some(([, cards]) => blackjackCardValue(cards) <= 21)
  while (hasLiveHand && !dealerNatural && blackjackCardValue(dealerCards) < 17 && deckPosition < deck.length) {
    dealerCards.push(deck[deckPosition])
    deckPosition += 1
  }
  const dealerValue = blackjackCardValue(dealerCards)
  let payout = dealerNatural && insuranceAmount > 0 ? insuranceAmount * 3 : 0
  const outcomes = {}
  for (const [name, cards] of playerHands) {
    const value = blackjackCardValue(cards)
    const natural = !split && blackjackNatural(cards)
    let result = 'lose'
    if (value > 21) result = 'lose'
    else if (natural && !dealerNatural) { result = 'won'; payout += Math.floor(betAmount * 2.5) }
    else if (dealerNatural && natural) { result = 'push'; payout += betAmount }
    else if (dealerNatural) result = 'lose'
    else if (dealerValue > 21 || value > dealerValue) { result = 'won'; payout += betAmount * 2 }
    else if (value === dealerValue) { result = 'push'; payout += betAmount }
    outcomes[name] = result
  }
  const results = Object.values(outcomes)
  outcomes.dealer = results.every((result) => result === 'push') ? 'push' : results.some((result) => result === 'won') ? 'lose' : 'won'
  outcomes.dealerValue = dealerValue
  return { dealerCards, deckPosition, outcomes, payout }
}

function publicUpgraderGame(row) {
  return {
    uuid: row.uuid,
    user_uuid: row.user_uuid,
    roblox_id: row.roblox_id,
    username: row.username,
    avatar_headshot: row.avatar_headshot,
    currency: row.currency,
    bet_amount: Number(row.bet_amount) || 0,
    target_asset_id: Number(row.target_asset_id) || 0,
    target_name: row.target_name,
    target_image: row.target_image,
    target_value: Number(row.target_value) || 0,
    multiplier_bps: Number(row.multiplier_bps) || 0,
    multiplier: (Number(row.multiplier_bps) || 0) / 100,
    mode: row.mode,
    range_start: Number(row.range_start) || 0,
    win_threshold: Number(row.win_threshold) || 0,
    outcome: Number(row.outcome) || 0,
    won: row.won === true,
    isWin: row.won === true,
    payout_amount: Number(row.payout_amount) || 0,
    client_seed: row.client_seed,
    server_seed_hash: row.server_seed_hash,
    server_seed: row.server_seed,
    nonce: Number(row.nonce) || 0,
    created_at: row.created_at,
    completed_at: row.completed_at,
    level: Number(row.profile?.level) || Number(row.level) || 0,
    rank: row.profile?.rank || row.rank || 'user',
    method: 'upgrader',
  }
}

const MAX_UPGRADER_ITEM_VALUE = 40000000

function limitedItemValue(item, currency = 'rocoins') {
  const marketValue = Math.trunc(Number(item?.value) || 0)
  const defaultValue = Math.trunc(Number(item?.default_value) || 0)
  const rap = Math.trunc(Number(item?.rap) || 0)
  const rawAmount = Math.max(0, marketValue > 0 ? marketValue : defaultValue > 0 ? defaultValue : rap)
  const exactProductionValues = item?.catalog_source === 'rorisk-production'
  const productionValue = Math.min(MAX_UPGRADER_ITEM_VALUE, Math.floor(rawAmount))
  const storedValue = exactProductionValues
    ? Math.max(0, Math.trunc(Number(item?.coin_value ?? item?.rocoin_value) || productionValue))
    : productionValue
  const values = { coins: storedValue, rocoins: storedValue }
  return values[selectedCurrency(currency)]
}

function publicUpgraderItem(item, currency = 'rocoins') {
  const requestedCurrency = selectedCurrency(currency)
  const value = limitedItemValue(item, requestedCurrency)
  const coinValue = limitedItemValue(item, 'coins')
  const rocoinValue = limitedItemValue(item, 'rocoins')
  const assetId = Number(item.asset_id)
  return {
    id: String(assetId),
    _id: String(assetId),
    assetId,
    targetId: assetId,
    name: String(item.name || item.acronym || `Limited ${assetId}`),
    acronym: String(item.acronym || ''),
    image: `/api/limited-items/${assetId}/image`,
    imageUrl: `/api/limited-items/${assetId}/image`,
    currency: requestedCurrency,
    coinValue,
    rocoinValue,
    value,
    amount: value * 1000,
    amountFixed: value * 1000,
  }
}

function createMinesDeck(serverSeed, clientSeed, nonce, minesCount) {
  const rankedTiles = Array.from({ length: 25 }, (_, tile) => ({
    tile,
    value: createHash('sha256').update(`${serverSeed}-${nonce}-${clientSeed}-${tile}`).digest('hex'),
  })).sort((first, second) => first.value.localeCompare(second.value))
  const mineTiles = new Set(rankedTiles.slice(0, minesCount).map(({ tile }) => tile))
  return Array.from({ length: 25 }, (_, tile) => mineTiles.has(tile) ? 'mine' : 'coin')
}

const LIMITED_CATALOG_TTL_MS = 60 * 60 * 1000
const LIMITED_IMAGE_DATA_CACHE_MAX = 300
let limitedCatalogCache = null
let limitedCatalogPromise = null
const limitedImageCache = new Map()
const limitedImageDataCache = new Map()
const limitedImageRequests = new Map()
const limitedImageUrlRequests = new Map()

async function readLimitedCatalog(env) {
  const rows = []
  const pageSize = 1000
  const readPage = (offset) => supabaseRequest(env, `/rest/v1/rorisk_limited_items?${new URLSearchParams({ active: 'eq.true', select: '*', order: 'asset_id.asc' })}`, {
      headers: { Range: `${offset}-${offset + pageSize - 1}` },
    })
  const initialPages = await Promise.all([0, pageSize, pageSize * 2].map(readPage))
  for (const page of initialPages) rows.push(...(page || []))
  if ((initialPages[2] || []).length === pageSize) {
    for (let offset = pageSize * 3; ; offset += pageSize) {
      const page = await readPage(offset)
      rows.push(...(page || []))
      if (!page || page.length < pageSize) break
    }
  }
  return rows
}

async function fetchLimitedCatalog() {
  const response = await fetch('https://www.rolimons.com/itemapi/itemdetails', {
    signal: AbortSignal.timeout(20000),
    headers: { Accept: 'application/json', 'User-Agent': 'RoRisk/2.0' },
  })
  if (!response.ok) throw new Error('The limited item catalogue is currently unavailable.')
  const payload = await response.json()
  const updatedAt = new Date().toISOString()
  return Object.entries(payload.items || {}).map(([assetId, item]) => {
    const rawAmount = Math.max(0, Number(item?.[3]) || Number(item?.[4]) || Number(item?.[2]) || 0)
    return {
      asset_id: Number(assetId),
      name: String(item?.[0] || `Limited ${assetId}`).slice(0, 200),
      acronym: String(item?.[1] || '').slice(0, 50),
      rap: Math.max(0, Number(item?.[2]) || 0),
      value: Math.max(0, Number(item?.[3]) || 0),
      default_value: Math.max(0, Number(item?.[4]) || 0),
      demand: Number(item?.[5]) >= 0 ? Number(item[5]) : null,
      trend: Number(item?.[6]) >= 0 ? Number(item[6]) : null,
      projected: Number(item?.[7]) === 1,
      hyped: Number(item?.[8]) === 1,
      rare: Number(item?.[9]) === 1,
      image_url: `/api/limited-items/${assetId}/image`,
      coin_value: Math.min(MAX_UPGRADER_ITEM_VALUE, Math.floor(rawAmount)),
      rocoin_value: Math.min(MAX_UPGRADER_ITEM_VALUE, Math.floor(rawAmount)),
      active: true,
      catalog_source: 'rolimons',
      updated_at: updatedAt,
    }
  }).filter((item) => Number.isSafeInteger(item.asset_id) && item.asset_id > 0)
}

async function refreshLimitedCatalog(env) {
  const items = await fetchLimitedCatalog()
  for (let offset = 0; offset < items.length; offset += 250) {
    await supabaseRequest(env, '/rest/v1/rorisk_limited_items?on_conflict=asset_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(items.slice(offset, offset + 250)),
    })
  }
  return items
}

async function getLimitedCatalog(env) {
  if (limitedCatalogCache && Date.now() - limitedCatalogCache.loadedAt < LIMITED_CATALOG_TTL_MS) return limitedCatalogCache.items
  if (!limitedCatalogPromise) {
    limitedCatalogPromise = (async () => {
      let items = await readLimitedCatalog(env)
      if (items.length < 2400) items = await refreshLimitedCatalog(env)
      limitedCatalogCache = { items, loadedAt: Date.now() }
      return items
    })().finally(() => { limitedCatalogPromise = null })
  }
  return limitedCatalogPromise
}

function rememberLimitedImageData(assetId, data) {
  if (limitedImageDataCache.has(assetId)) limitedImageDataCache.delete(assetId)
  limitedImageDataCache.set(assetId, data)
  while (limitedImageDataCache.size > LIMITED_IMAGE_DATA_CACHE_MAX) {
    limitedImageDataCache.delete(limitedImageDataCache.keys().next().value)
  }
}

async function limitedImageData(assetId) {
  const cached = limitedImageDataCache.get(assetId)
  if (cached) {
    limitedImageDataCache.delete(assetId)
    limitedImageDataCache.set(assetId, cached)
    return cached
  }
  if (limitedImageRequests.has(assetId)) return limitedImageRequests.get(assetId)
  const request = (async () => {
    let imageUrl = limitedImageCache.get(assetId)
    if (!imageUrl && limitedImageUrlRequests.has(assetId)) imageUrl = await limitedImageUrlRequests.get(assetId)
    if (!imageUrl) {
      const query = new URLSearchParams({ assetIds: String(assetId), returnPolicy: 'PlaceHolder', size: '420x420', format: 'Png', isCircular: 'false' })
      const thumbnailResponse = await fetch(`https://thumbnails.roblox.com/v1/assets?${query}`, { signal: AbortSignal.timeout(10000) })
      if (!thumbnailResponse.ok) throw new Error('Limited item image unavailable.')
      const thumbnail = await thumbnailResponse.json()
      imageUrl = thumbnail.data?.[0]?.imageUrl
      if (!imageUrl) throw new Error('Limited item image unavailable.')
      limitedImageCache.set(assetId, imageUrl)
    }
    const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
    if (!imageResponse.ok) throw new Error('Limited item image unavailable.')
    const data = { body: Buffer.from(await imageResponse.arrayBuffer()), contentType: imageResponse.headers.get('content-type') || 'image/png' }
    rememberLimitedImageData(assetId, data)
    return data
  })().finally(() => limitedImageRequests.delete(assetId))
  limitedImageRequests.set(assetId, request)
  return request
}

async function sendLimitedImage(response, assetId) {
  const image = await limitedImageData(assetId)
  response.statusCode = 200
  response.setHeader('Content-Type', image.contentType)
  response.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
  response.end(image.body)
}

async function primeLimitedImages(cards, waitForData = false) {
  const allAssetIds = [...new Set((cards || []).map((card) => Number(card.assetId || card.itemId)).filter((assetId) => Number.isSafeInteger(assetId) && assetId > 0))]
  const assetIds = [...new Set((cards || []).map((card) => Number(card.assetId || card.itemId)).filter((assetId) => Number.isSafeInteger(assetId) && assetId > 0 && !limitedImageCache.has(assetId)))]
  if (assetIds.length) {
    const query = new URLSearchParams({ assetIds: assetIds.join(','), returnPolicy: 'PlaceHolder', size: '420x420', format: 'Png', isCircular: 'false' })
    const batchRequest = (async () => {
      const response = await fetch(`https://thumbnails.roblox.com/v1/assets?${query}`, { signal: AbortSignal.timeout(10000) })
      if (response.ok) {
        const payload = await response.json()
        for (const item of payload.data || []) {
          if (item?.imageUrl && Number.isSafeInteger(Number(item.targetId))) limitedImageCache.set(Number(item.targetId), item.imageUrl)
        }
      }
    })()
    for (const assetId of assetIds) limitedImageUrlRequests.set(assetId, batchRequest.then(() => limitedImageCache.get(assetId)))
    try { await batchRequest } finally {
      for (const assetId of assetIds) limitedImageUrlRequests.delete(assetId)
    }
  }
  const warming = allAssetIds.map((assetId) => limitedImageData(assetId).catch(() => null))
  if (waitForData) await Promise.all(warming)
}

function rouletteMultiplier(ticket) {
  const value = Math.max(0, Math.min(999999, Number(ticket) || 0)) / 1_000_000
  return Math.max(100, Math.min(10000, Math.floor(99 / Math.max(0.0099, 1 - value))))
}

const ROULETTE_TICKET_SPACE = 2 ** 52

function eosRouletteOutcome(serverSeed, eosBlockId) {
  const hash = createHash('sha256').update(`${serverSeed}-${eosBlockId}`).digest('hex')
  const ticket = Number.parseInt(hash.slice(0, 13), 16)
  const normalized = ticket / ROULETTE_TICKET_SPACE
  const rawMultiplier = Math.floor((0.9 / (1 - normalized)) * 100)
  const multiplierBps = Number.isFinite(rawMultiplier)
    ? Math.max(100, Math.min(2_147_483_647, rawMultiplier))
    : 2_147_483_647
  return { ticket, multiplierBps }
}

function rouletteCard(multiplierBps, limitedItems, entropy) {
  const tier = multiplierBps < 150 ? 0 : multiplierBps < 250 ? 1 : multiplierBps < 500 ? 2 : multiplierBps < 2000 ? 3 : 4
  const ranges = [[0, 50000], [50000, 250000], [250000, 1000000], [1000000, 10000000], [10000000, Number.POSITIVE_INFINITY]]
  const [minimum, maximum] = ranges[tier]
  let candidates = limitedItems.filter((item) => {
    const value = Number(item.value) || Number(item.default_value) || Number(item.rap) || 0
    return value >= minimum && value < maximum
  })
  if (!candidates.length) candidates = limitedItems
  const index = Number.parseInt(createHash('sha256').update(String(entropy)).digest('hex').slice(0, 12), 16) % candidates.length
  const item = candidates[index]
  return { assetId: Number(item.asset_id), itemId: Number(item.asset_id), name: item.name, image: item.image_url, multiplierBps }
}

function createRouletteCandidate(limitedItems) {
  const serverSeed = randomBytes(32).toString('hex')
  const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex')
  const digest = createHash('sha512').update(`xroulette:${serverSeed}`).digest('hex')
  const ticket = Number.parseInt(digest.slice(0, 12), 16) % 1_000_000
  const result = rouletteCard(rouletteMultiplier(ticket), limitedItems, `${serverSeed}:winner`)
  const winningIndex = 32
  const reel = Array.from({ length: 40 }, (_, index) => {
    const reelTicket = Number.parseInt(createHash('sha256').update(`${serverSeed}:${index}`).digest('hex').slice(0, 12), 16) % 1_000_000
    return rouletteCard(rouletteMultiplier(reelTicket), limitedItems, `${serverSeed}:${index}:item`)
  })
  reel[winningIndex] = { ...result, isWinner: true }
  return { reel, winningIndex, result, serverSeed, serverSeedHash, ticket }
}

function finalizeRouletteCandidate(row, limitedItems, eosBlockId) {
  const serverSeed = String(row.server_seed)
  const { ticket, multiplierBps } = eosRouletteOutcome(serverSeed, eosBlockId)
  const result = rouletteCard(multiplierBps, limitedItems, `${serverSeed}:${eosBlockId}:winner`)
  const winningIndex = Number(row.winning_index) || 32
  const reel = Array.isArray(row.reel) ? row.reel.map((card) => ({ ...card, isWinner: undefined })) : []
  reel[winningIndex] = { ...result, isWinner: true, fairTicket: ticket }
  return { reel, winningIndex, result, ticket }
}

function publicRouletteGame(row) {
  const complete = row.state === 'COMPLETE'
  const revealResult = ['ROLLING', 'SETTLING', 'COMPLETE'].includes(row.state)
  const winningCard = Array.isArray(row.reel) ? row.reel[Number(row.winning_index) || 0] : null
  const resultAssetId = Number(row.result_asset_id) || Number(winningCard?.assetId) || Number(winningCard?.itemId) || null
  return {
    _id: row.uuid,
    uuid: row.uuid,
    state: row.state,
    reel: Array.isArray(row.reel) ? row.reel.map((card) => revealResult ? card : ({ ...card, isWinner: undefined })) : [],
    result: revealResult ? {
      name: row.result_name,
      image: row.result_image,
      assetId: resultAssetId,
      itemId: resultAssetId,
      multiplierBps: Number(row.result_multiplier_bps) || 100,
      winningIndex: Number(row.winning_index) || 0,
    } : null,
    totals: {
      betCount: Number(row.bet_count) || 0,
      wagered: Number(row.wagered_amount) || 0,
      paid: Number(row.paid_amount) || 0,
    },
    fair: {
      serverSeedHash: row.server_seed_hash,
      serverSeed: complete ? row.server_seed : null,
      ticket: complete ? Number(winningCard?.fairTicket ?? row.ticket) : null,
      eosBlockId: row.eos_block_id,
      eosBlockNumber: row.eos_block_number == null ? null : Number(row.eos_block_number),
    },
    bettingOpensAt: row.betting_opens_at,
    bettingClosesAt: row.betting_closes_at,
    rollingStartedAt: row.rolling_started_at,
    rollingEndsAt: row.rolling_ends_at,
    settlingEndsAt: row.settling_ends_at,
    createdAt: row.betting_opens_at || row.created_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  }
}

function publicRouletteBets(row) {
  return (Array.isArray(row?.bets) ? [...row.bets] : []).sort((first, second) => new Date(second.placed_at).getTime() - new Date(first.placed_at).getTime())
}

const rouletteFinalizations = new Map()
const rouletteTransitionTimers = new Map()

function scheduleRouletteTransition(env, row) {
  if (!row?.uuid || row.state !== 'BETTING_OPEN' || rouletteTransitionTimers.has(row.uuid)) return
  const delay = Math.max(0, new Date(row.betting_closes_at).getTime() - Date.now())
  const timer = setTimeout(() => {
    rouletteTransitionTimers.delete(row.uuid)
    const lockedAt = new Date().toISOString()
    broadcastRealtime({
      type: 'rouletteState',
      game: publicRouletteGame({ ...row, state: 'BETTING_LOCKED', updated_at: lockedAt }),
      serverTime: lockedAt,
    })
    let publishedState = 'BETTING_LOCKED'
    const publishAuthoritativeState = async () => {
      try {
        const current = await syncRouletteRound(env)
        if (current.state !== publishedState) {
          publishedState = current.state
          const serverTime = new Date().toISOString()
          broadcastRealtime({ type: 'rouletteState', game: publicRouletteGame(current), serverTime })
        }
        if (current.state === 'BETTING_LOCKED') {
          const followup = setTimeout(publishAuthoritativeState, 120)
          followup.unref?.()
        }
      } catch {
        const followup = setTimeout(publishAuthoritativeState, 250)
        followup.unref?.()
      }
    }
    void publishAuthoritativeState()
  }, delay)
  timer.unref?.()
  rouletteTransitionTimers.set(row.uuid, timer)
}

async function beginRouletteFinalization(env, row, limitedItems) {
  let heldRow = row
  if (!rouletteFinalizations.has(row.uuid)) {
    const holdStartedAt = Date.now()
    const holdQuery = new URLSearchParams({ uuid: `eq.${row.uuid}`, eos_block_id: 'is.null', state: 'neq.COMPLETE', select: '*' })
    const held = await supabaseRequest(env, `/rest/v1/rorisk_roulette_games?${holdQuery}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        state: 'BETTING_LOCKED',
        rolling_started_at: new Date(holdStartedAt + 30_000).toISOString(),
        rolling_ends_at: new Date(holdStartedAt + 35_000).toISOString(),
        settling_ends_at: new Date(holdStartedAt + 37_000).toISOString(),
        updated_at: new Date(holdStartedAt).toISOString(),
      }),
    })
    if (held?.[0]) heldRow = held[0]
    if (rouletteFinalizations.has(row.uuid)) return { ...heldRow, state: 'BETTING_LOCKED' }
    const finalization = (async () => {
      const reservedBlockNumber = Number(heldRow.eos_block_number)
      const eos = Number.isSafeInteger(reservedBlockNumber) && reservedBlockNumber > 0
        ? await eosBlockByNumber(env, reservedBlockNumber, true)
        : await latestEosBlock(env)
      const selectedQuery = new URLSearchParams({ uuid: `eq.${heldRow.uuid}`, eos_block_id: 'is.null', state: 'eq.BETTING_LOCKED', select: '*' })
      const selected = await supabaseRequest(env, `/rest/v1/rorisk_roulette_games?${selectedQuery}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ eos_block_id: eos.blockId, eos_block_number: eos.blockNumber, updated_at: new Date().toISOString() }),
      })
      if (selected?.[0]) heldRow = selected[0]
      const eosSelectedAt = new Date().toISOString()
      broadcastRealtime({
        type: 'rouletteState',
        game: publicRouletteGame({ ...heldRow, state: 'BETTING_LOCKED', eos_block_id: eos.blockId, eos_block_number: eos.blockNumber, updated_at: eosSelectedAt }),
        serverTime: eosSelectedAt,
      })
      const finalized = finalizeRouletteCandidate(heldRow, limitedItems, eos.blockId)
      await primeLimitedImages([finalized.result], true)
      const rollingStartedAt = Date.now()
      const updateQuery = new URLSearchParams({ uuid: `eq.${heldRow.uuid}`, eos_block_id: `eq.${eos.blockId}`, state: 'eq.BETTING_LOCKED', select: '*' })
      return supabaseRequest(env, `/rest/v1/rorisk_roulette_games?${updateQuery}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          state: 'ROLLING',
          reel: finalized.reel,
          winning_index: finalized.winningIndex,
          result_name: finalized.result.name,
          result_image: finalized.result.image,
          result_multiplier_bps: finalized.result.multiplierBps,
          ticket: finalized.ticket % 1_000_000,
          eos_block_id: eos.blockId,
          eos_block_number: eos.blockNumber,
          rolling_started_at: new Date(rollingStartedAt).toISOString(),
          rolling_ends_at: new Date(rollingStartedAt + 5_000).toISOString(),
          settling_ends_at: new Date(rollingStartedAt + 7_000).toISOString(),
          updated_at: new Date(rollingStartedAt).toISOString(),
        }),
      })
    })().catch(() => null).finally(() => rouletteFinalizations.delete(row.uuid))
    rouletteFinalizations.set(row.uuid, finalization)
  }
  return { ...heldRow, state: 'BETTING_LOCKED' }
}

async function syncRouletteRound(env) {
  const limitedItems = await getLimitedCatalog(env)
  if (!limitedItems.length) throw new Error('The limited item catalogue is empty.')
  const candidate = createRouletteCandidate(limitedItems)
  let row = await supabaseRequest(env, '/rest/v1/rpc/sync_rorisk_roulette', {
    method: 'POST',
    body: JSON.stringify({
      p_reel: candidate.reel,
      p_winning_index: candidate.winningIndex,
      p_result_name: candidate.result.name,
      p_result_image: candidate.result.image,
      p_result_multiplier_bps: candidate.result.multiplierBps,
      p_server_seed: candidate.serverSeed,
      p_server_seed_hash: candidate.serverSeedHash,
      p_ticket: candidate.ticket,
    }),
  })
  if (row.state === 'BETTING_OPEN' && row.eos_block_number == null) {
    try {
      row = await reserveRouletteEosBlock(env, row)
    } catch {
      // A transient EOS request can fall back to selection during the lock phase.
    }
  }
  if (!row.eos_block_id && ['BETTING_LOCKED', 'ROLLING', 'SETTLING'].includes(row.state)) {
    row = await beginRouletteFinalization(env, row, limitedItems)
  }
  void primeLimitedImages(row.reel).catch(() => {})
  return row
}

const COINFLIP_GAME_SELECT = '*,creator_profile:rorisk_users!rorisk_coinflip_games_creator_uuid_fkey(rank,level),opponent_profile:rorisk_users!rorisk_coinflip_games_opponent_uuid_fkey(rank,level),winner_profile:rorisk_users!rorisk_coinflip_games_winner_uuid_fkey(rank,level)'

function publicCoinflipGame(row) {
  const player = (prefix) => {
    const uuid = row[`${prefix}_uuid`]
    if (!uuid) return null
    const profile = row[`${prefix}_profile`] || {}
    return {
      _id: uuid,
      uuid,
      roblox_id: row[`${prefix}_roblox_id`],
      username: row[`${prefix}_username`],
      avatar: row[`${prefix}_avatar_headshot`],
      avatar_headshot: row[`${prefix}_avatar_headshot`],
      rank: profile.rank || 'user',
      level: Number(profile.level) || 0,
    }
  }
  const creatorUser = player('creator')
  const opponentUser = player('opponent')
  const creator = { coin: row.creator_coin, bot: false, joinedAt: row.created_at, user: creatorUser }
  const opponent = row.opponent_is_bot || opponentUser
    ? { coin: row.opponent_coin, bot: row.opponent_is_bot === true, joinedAt: row.opponent_joined_at, ...(opponentUser ? { user: opponentUser } : {}) }
    : null
  const startedAt = row.started_at ? new Date(row.started_at).getTime() : null
  const elapsed = startedAt == null ? null : Date.now() - startedAt
  const state = row.state === 'created'
    ? 'created'
    : row.state === 'completed' && elapsed != null && elapsed < 3000
      ? 'countdown'
      : row.state === 'completed' && elapsed != null && elapsed < 5500
        ? 'in_progress'
        : row.state
  const winner = row.winner_is_bot ? { bot: true } : player('winner')
  return {
    _id: row.uuid,
    uuid: row.uuid,
    gameId: row.game_id,
    creatorUuid: row.creator_uuid,
    currency: row.currency,
    amount: Number(row.amount) || 0,
    creator,
    opponent,
    state,
    winningCoin: row.winning_coin,
    winner,
    payoutAmount: Number(row.payout_amount) || 0,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    fair: {
      clientSeed: row.client_seed,
      serverSeedHash: row.server_seed_hash,
      serverSeed: state === 'completed' ? row.server_seed : null,
      nonce: Number(row.nonce) || 0,
      eosBlockId: row.eos_block_id,
      eosBlockNumber: row.eos_block_number == null ? null : Number(row.eos_block_number),
      ticket: row.ticket == null ? null : Number(row.ticket),
    },
  }
}

async function eosPost(env, path, body) {
  const endpoint = String(env.EOS_API_URL || 'https://eos.greymass.com').replace(/\/$/, '')
  const response = await fetch(`${endpoint}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error('The EOS fairness service is temporarily unavailable.')
  return response.json()
}

async function eosBlockByNumber(env, blockNumber, waitForBlock = false) {
  const deadline = Date.now() + (waitForBlock ? 30000 : 0)
  while (true) {
    try {
      let block
      try {
        block = await eosPost(env, '/v1/chain/get_block_info', { block_num: blockNumber })
      } catch {
        block = await eosPost(env, '/v1/chain/get_block', { block_num_or_id: blockNumber })
      }
      const blockId = String(block.id || '').toLowerCase()
      if (!/^[a-f0-9]{64}$/.test(blockId)) throw new Error('The EOS fairness service returned an invalid block.')
      return { blockId, blockNumber }
    } catch (error) {
      if (!waitForBlock || Date.now() >= deadline) throw error
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
  }
}

async function reserveRouletteEosBlock(env, row) {
  const info = await eosPost(env, '/v1/chain/get_info', {})
  const headBlockNumber = Number(info.head_block_num)
  const rawHeadTime = String(info.head_block_time || '')
  const headBlockTime = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(rawHeadTime) ? rawHeadTime : `${rawHeadTime}Z`).getTime()
  const closesAt = new Date(row.betting_closes_at).getTime()
  if (!Number.isSafeInteger(headBlockNumber) || !Number.isFinite(headBlockTime) || !Number.isFinite(closesAt)) {
    throw new Error('The EOS fairness service returned an invalid head block.')
  }
  const blocksUntilClose = Math.max(1, Math.ceil((closesAt - headBlockTime) / 500))
  const targetBlockNumber = headBlockNumber + blocksUntilClose + 1
  const query = new URLSearchParams({ uuid: `eq.${row.uuid}`, state: 'eq.BETTING_OPEN', eos_block_number: 'is.null', select: '*' })
  const updated = await supabaseRequest(env, `/rest/v1/rorisk_roulette_games?${query}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ eos_block_number: targetBlockNumber, updated_at: new Date().toISOString() }),
  })
  return updated?.[0] || { ...row, eos_block_number: targetBlockNumber }
}

async function latestEosBlock(env) {
  const info = await eosPost(env, '/v1/chain/get_info', {})
  const blockNumber = Number(info.last_irreversible_block_num)
  if (!Number.isSafeInteger(blockNumber) || blockNumber < 1) throw new Error('The EOS fairness service returned an invalid block.')
  const infoBlockId = String(info.last_irreversible_block_id || '').toLowerCase()
  if (/^[a-f0-9]{64}$/.test(infoBlockId)) return { blockId: infoBlockId, blockNumber }
  return eosBlockByNumber(env, blockNumber)
}

async function coinflipGameByUuid(env, uuid) {
  const query = new URLSearchParams({ uuid: `eq.${uuid}`, select: COINFLIP_GAME_SELECT, limit: '1' })
  const rows = await supabaseRequest(env, `/rest/v1/rorisk_coinflip_games?${query}`)
  if (!rows?.[0]) throw new Error('This coinflip game could not be found.')
  return rows[0]
}

function demoCaseOutcomes(caseData, count) {
  const items = Array.isArray(caseData.items) ? caseData.items : []
  if (!items.length) throw new Error('This case has no available items.')
  return Array.from({ length: count }, () => {
    const roll = randomInt(0, 100_000_000) / 1_000_000
    let cumulative = 0
    let selected = items[items.length - 1]
    for (const item of items) {
      cumulative += Number.parseFloat(String(item.chance || '0').replace('%', '')) || 0
      if (roll <= cumulative) {
        selected = item
        break
      }
    }
    return { outcome: roll, item: selected }
  })
}

async function supabaseAuthRequest(env, path, options = {}) {
  const serverKeys = [...new Set([env.SUPABASE_SECRET_KEY, env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean))]
  if (!env.SUPABASE_URL || !serverKeys.length) throw new Error('Authentication is temporarily unavailable. Please try again later.')
  let lastError
  for (const [index, serverKey] of serverKeys.entries()) {
    const legacyJwtKey = serverKey.startsWith('eyJ')
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1${path}`, {
      ...options,
      headers: {
        apikey: serverKey,
        ...(legacyJwtKey ? { Authorization: `Bearer ${serverKey}` } : {}),
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    const text = await response.text()
    let body
    try { body = text ? JSON.parse(text) : null } catch { body = null }
    if (response.ok) return body
    const invalidKey = response.status === 401 && /invalid api key/i.test(String(body?.message || body?.error || ''))
    lastError = new Error(invalidKey ? 'Authentication is temporarily unavailable. Please try again later.' : body?.msg || body?.message || body?.error_description || body?.error || 'Authentication failed. Please try again.')
    if (![401, 403].includes(response.status) || index === serverKeys.length - 1) {
      throw lastError
    }
  }
  throw lastError || new Error('Authentication failed. Please try again.')
}

async function upsertProfile(env, profile, conflictColumn) {
  const query = new URLSearchParams({ on_conflict: conflictColumn, select: '*' })
  const rows = await supabaseRequest(env, `/rest/v1/rorisk_users?${query}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(profile),
  })
  return rows?.[0]
}

async function completeAuthProfile(env, accessToken) {
  if (!accessToken) throw new Error('The authentication session is missing.')
  const authUser = await supabaseRequest(env, '/auth/v1/user', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const metadata = authUser.user_metadata || {}
  const email = authUser.email || null
  const username = metadata.username || metadata.user_name || metadata.full_name || metadata.name || email?.split('@')[0] || 'Guest'
  return upsertProfile(env, {
    uuid: authUser.id,
    username,
    avatar_headshot: '/assets/users/default-avatar.png',
    email,
  }, 'uuid')
}

async function affiliateRow(env, userUuid) {
  const query = new URLSearchParams({ user_uuid: `eq.${userUuid}`, select: '*', limit: '1' })
  const rows = await supabaseRequest(env, `/rest/v1/rorisk_affiliates?${query}`)
  return rows?.[0] || null
}

async function affiliateReferrer(env, row) {
  if (!row?.referrer_user_uuid) return null
  const query = new URLSearchParams({
    uuid: `eq.${row.referrer_user_uuid}`,
    select: 'uuid,roblox_id,username,avatar_headshot,rank,level',
    limit: '1',
  })
  const rows = await supabaseRequest(env, `/rest/v1/rorisk_users?${query}`)
  return rows?.[0] || null
}

function publicAffiliate(row, referrer = null) {
  return {
    code: row?.affiliate_code || '',
    referrer: row?.referrer_user_uuid || null,
    redeemedCode: referrer?.affiliate_code || '',
    referredAt: row?.referred_at || null,
    referredUsers: Array.isArray(row?.referred_users) ? row.referred_users : [],
    rewardCasesClaimed: Number(row?.reward_cases_claimed) || 0,
    rewardCaseClaims: Array.isArray(row?.reward_case_claims) ? row.reward_case_claims : [],
    deposit: Number(row?.total_deposited) || 0,
    earned: Number(row?.total_earnings) || 0,
    available: Number(row?.available_earnings) || 0,
    claimed: Number(row?.claimed_earnings) || 0,
    referrerUser: referrer?.user ? {
      uuid: referrer.user.uuid,
      username: referrer.user.username,
      avatar: referrer.user.avatar_headshot,
    } : null,
  }
}

async function affiliateState(env, userUuid) {
  const row = await affiliateRow(env, userUuid)
  if (!row?.referrer_user_uuid) return { row, data: publicAffiliate(row) }
  const user = await affiliateReferrer(env, row)
  const referrerRow = await affiliateRow(env, row.referrer_user_uuid)
  return { row, data: publicAffiliate(row, { user, affiliate_code: referrerRow?.affiliate_code || '' }) }
}

const WELCOME_CASE_ROW = Object.freeze({
  case_id: '6abc52a32512db6b65a8f5c9',
  name: 'Welcome Chicken',
  slug: 'welcome-chicken',
  coin_amount: 2,
  rocoin_amount: 12,
  type: 'site',
  categories: ['rewards'],
  level_min: null,
  image_url: '/assets/welcome/welcome-chicken.4c912e1c.png',
  sort_order: 0,
  active: true,
  risk_level: 99.3216,
  items: [
    {
      id: '6abc55f9f1205813968830f2',
      itemId: '685a0c23831c062328d2d390',
      name: "Telamon's Chicken Suit",
      image: '/api/case-images/items/24112667.png',
      index: 1,
      tickets: 1,
      chance: '0.001%',
      color: 'yellow',
      price: 125000,
      coinPrice: 125000,
      rocoinPrice: 625000,
    },
    {
      id: '6abc55f9f1205813968830f3',
      itemId: '685a0c57831c062328d2e34d',
      name: 'Fried Chicken Egg',
      image: '/api/case-images/items/4786883113.png',
      index: 2,
      tickets: 99999,
      chance: '99.999%',
      color: 'blue',
      price: 1,
      coinPrice: 1,
      rocoinPrice: 5,
    },
  ],
})

async function welcomeCase(env, currency) {
  const query = new URLSearchParams({ slug: 'eq.welcome-chicken', active: 'eq.true', select: '*', limit: '1' })
  const rows = await supabaseRequest(env, `/rest/v1/rorisk_cases?${query}`)
  if (rows?.[0]) return publicCase(rows[0], true, currency)
  return publicCase(WELCOME_CASE_ROW, true, currency)
}

function chooseWelcomeOutcome(caseData) {
  return demoCaseOutcomes(caseData, 1)[0]
}

const routeApi = Object.freeze({
  COINS_PER_USD,
  COINFLIP_GAME_SELECT,
  OXAPAY_API_URL,
  affiliateReferrer,
  affiliateState,
  blackjackCardValue,
  blackjackNatural,
  broadcastRealtime,
  chooseWelcomeOutcome,
  clearRealtimeSessionCookie,
  coinflipGameByUuid,
  completeAuthProfile,
  createBlackjackDeck,
  createChallenge,
  createMinesDeck,
  currentCryptoQuote,
  demoCaseOutcomes,
  findRobloxUser,
  getLimitedCatalog,
  getRobloxHeadshot,
  getRobloxProfile,
  hmac,
  isSecureRequest,
  latestEosBlock,
  limitedItemValue,
  normalizeVerificationText,
  oxaPayRequest,
  paymentCallbackUrl,
  primeLimitedImages,
  publicAffiliate,
  publicBlackjackGame,
  publicCase,
  publicCasinoGame,
  publicCoinflipGame,
  publicMinesGame,
  publicProfileContainsVerificationCode,
  publicRouletteBets,
  publicRouletteGame,
  publicUpgraderGame,
  publicUpgraderItem,
  readJson,
  readRawBody,
  requestSessionUser,
  scheduleRouletteTransition,
  selectedCurrency,
  sendJson,
  sendLimitedImage,
  sendStoredImage,
  sendText,
  settleBlackjack,
  startRealtimeSession,
  supabaseAuthRequest,
  supabaseRequest,
  syncRouletteRound,
  upsertProfile,
  validOxaSignature,
  verifyCaptcha,
  verifyChallenge,
  welcomeCase,
})

async function handleRequest(request, response, env) {
  const url = new URL(request.url, 'http://localhost')
  if (!url.pathname.startsWith('/api/')) return false

  try {
    if (url.pathname.startsWith('/api/battles')) {
      return await handleBattlesRequest({ request, response, url, env, readJson, sendJson, supabaseRequest, requestSessionUser, startRealtimeSession, broadcastRealtime })
    }
    const routeContext = { request, response, url, env, api: routeApi }
    const routeHandlers = [
      handleAffiliatesRequest,
      handlePaymentsRequest,
      handleAssetsRequest,
      handleUpgraderRequest,
      handleRouletteRequest,
      handleDiceRequest,
      handleBlackjackRequest,
      handleMinesRequest,
      handleCoinflipRequest,
      handleCasesRequest,
      handleAuthRequest,
    ]
    for (const handler of routeHandlers) {
      if (await handler(routeContext)) return true
    }
    sendJson(response, 404, { error: 'Not found.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed.'
    const containsInternalConfiguration = /supabase|api key|credential|server environment|fetch failed/i.test(message)
    const gameServiceRoute = /^\/api\/(?:battles|cases|welcome|affiliates|dice|blackjack|coinflip|mines|x-roulette|upgrader)(?:\/|$)/.test(url.pathname)
    const insufficientGameBalance = gameServiceRoute && /(?:do not have enough|insufficient balance)/i.test(message)
    sendJson(response, gameServiceRoute && containsInternalConfiguration ? 503 : 400, {
      error: insufficientGameBalance
        ? 'Insufficient balance.'
        : containsInternalConfiguration
        || (gameServiceRoute && /could not find the function|schema cache|database|relation .* does not exist/i.test(message))
        ? 'This service is temporarily unavailable. Please try again later.'
        : message,
    })
  }
  return true
}

export function roriskApi(env) {
  const middleware = (request, response, next) => {
    handleRequest(request, response, env).then((handled) => {
      if (!handled) next()
    }).catch(next)
  }
  return {
    name: 'rorisk-auth-api',
    configureServer(server) {
      server.middlewares.use(middleware)
      attachRealtimeServer(server.httpServer, env.RORISK_USER_SECRET ? (value) => hmac(value, env.RORISK_USER_SECRET) : null, env)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
      attachRealtimeServer(server.httpServer, env.RORISK_USER_SECRET ? (value) => hmac(value, env.RORISK_USER_SECRET) : null, env)
    },
  }
}

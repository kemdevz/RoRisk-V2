import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { attachRealtimeServer, broadcastRealtime, clearRealtimeSessionCookie, createRealtimeSession, readRealtimeSession, setRealtimeSessionCookie } from './Chat.js'

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
  if (!response.ok) return '/default-avatar.png'
  const result = await response.json()
  return result.data?.[0]?.imageUrl || '/default-avatar.png'
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
  const serverKeys = [...new Set([env.SUPABASE_SECRET_KEY, env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean))]
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
    if (![401, 403].includes(upstream.status) || index === serverKeys.length - 1) break
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

function publicCase(row, includeItems = false, currency = 'rocoins') {
  const requestedCurrency = selectedCurrency(currency)
  const legacyBaseAmount = Number(row.rocoin_amount ?? row.amount) || 0
  const amounts = row.coin_amount == null
    ? baseCoinPair({}, legacyBaseAmount)
    : baseCoinPair({ coin_price: row.coin_amount, rocoin_price: row.rocoin_amount }, legacyBaseAmount)
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

function limitedItemValue(item, currency = 'rocoins') {
  const marketValue = Math.trunc(Number(item?.value) || 0)
  const defaultValue = Math.trunc(Number(item?.default_value) || 0)
  const rap = Math.trunc(Number(item?.rap) || 0)
  const rawAmount = Math.max(0, marketValue > 0 ? marketValue : defaultValue > 0 ? defaultValue : rap)
  const exactProductionValues = item?.catalog_source === 'rorisk-production'
  const productionValue = Math.floor(rawAmount / 1000)
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
      coin_value: Math.floor(rawAmount / 1000),
      rocoin_value: Math.floor(rawAmount / 1000),
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
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1${path}`, {
      ...options,
      headers: {
        apikey: serverKey,
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
    avatar_headshot: '/default-avatar.png',
    email,
  }, 'uuid')
}

async function handleRequest(request, response, env) {
  const url = new URL(request.url, 'http://localhost')
  if (!url.pathname.startsWith('/api/')) return false

  try {
    if (request.method === 'GET' && url.pathname === '/api/payments/oxapay/currencies') {
      const [currenciesResponse, pricesResponse] = await Promise.all([
        fetch(`${OXAPAY_API_URL}/common/currencies`, { signal: AbortSignal.timeout(10000) }),
        fetch(`${OXAPAY_API_URL}/common/prices`, { signal: AbortSignal.timeout(10000) }),
      ])
      if (!currenciesResponse.ok || !pricesResponse.ok) throw new Error('Unable to retrieve supported cryptocurrencies.')
      const currencies = await currenciesResponse.json()
      const prices = await pricesResponse.json()
      sendJson(response, 200, { currencies: currencies.data || {}, prices: prices.data || {} })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/payments/oxapay/deposit') {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const body = await readJson(request)
      const coinAmount = Math.trunc(Number(body.coinAmount))
      if (!Number.isSafeInteger(coinAmount) || coinAmount < 100 || coinAmount > 100000000) throw new Error('Enter a deposit amount between 100 and 100,000,000 Coins.')
      const quote = await currentCryptoQuote(body.currency, body.network)
      const orderId = randomUUID()
      const usdAmount = Number((coinAmount / COINS_PER_USD).toFixed(2))
      await supabaseRequest(env, '/rest/v1/rorisk_crypto_deposits', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ uuid: orderId, user_uuid: sessionUser.uuid, coin_amount: coinAmount, usd_amount: usdAmount, pay_currency: quote.symbol, network: quote.network, status: 'creating' }),
      })
      let payment
      try {
        payment = await oxaPayRequest('/payment/white-label', 'merchant_api_key', env.OXAPAY_MERCHANT_API_KEY, {
          method: 'POST',
          body: JSON.stringify({
            pay_currency: quote.symbol,
            amount: usdAmount,
            currency: 'USD',
            network: quote.network,
            lifetime: 60,
            callback_url: paymentCallbackUrl(request, env, 'deposit'),
            order_id: orderId,
            description: `RoRisk Coins deposit ${orderId}`,
          }),
        })
      } catch (error) {
        await supabaseRequest(env, `/rest/v1/rorisk_crypto_deposits?uuid=eq.${orderId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'failed', updated_at: new Date().toISOString() }) }).catch(() => {})
        throw error
      }
      await supabaseRequest(env, `/rest/v1/rorisk_crypto_deposits?uuid=eq.${orderId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ track_id: String(payment.track_id), pay_amount: Number(payment.pay_amount), address: payment.address, memo: payment.memo || null, qr_code: payment.qr_code || null, expires_at: payment.expired_at ? new Date(Number(payment.expired_at) * 1000).toISOString() : null, status: 'pending', provider_payload: payment, updated_at: new Date().toISOString() }),
      })
      sendJson(response, 200, { payment: { orderId, trackId: String(payment.track_id), coinAmount, usdAmount, payAmount: Number(payment.pay_amount), currency: payment.pay_currency || quote.symbol, network: payment.network || quote.network, address: payment.address, memo: payment.memo || null, qrCode: payment.qr_code || null, expiresAt: payment.expired_at || null } })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/payments/oxapay/withdraw') {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const body = await readJson(request)
      const coinAmount = Math.trunc(Number(body.coinAmount))
      const address = String(body.address || '').trim()
      const memo = String(body.memo || '').trim().slice(0, 200) || null
      if (!Number.isSafeInteger(coinAmount) || coinAmount < 1000 || coinAmount > 100000000) throw new Error('Enter a withdrawal amount between 1,000 and 100,000,000 Coins.')
      if (address.length < 8 || address.length > 256) throw new Error('Enter a valid withdrawal address.')
      const quote = await currentCryptoQuote(body.currency, body.network)
      const usdAmount = Number((coinAmount / COINS_PER_USD).toFixed(2))
      const cryptoAmount = Number((usdAmount / quote.price).toPrecision(12))
      if (cryptoAmount < Number(quote.networkData.withdraw_min || 0)) throw new Error(`The minimum ${quote.symbol} withdrawal on this network is ${quote.networkData.withdraw_min}.`)
      const withdrawalId = randomUUID()
      const reserved = await supabaseRequest(env, '/rest/v1/rpc/reserve_rorisk_crypto_withdrawal', {
        method: 'POST',
        body: JSON.stringify({ p_uuid: withdrawalId, p_user_uuid: sessionUser.uuid, p_coin_amount: coinAmount, p_usd_amount: usdAmount, p_crypto_amount: cryptoAmount, p_currency: quote.symbol, p_network: quote.network, p_address: address, p_memo: memo }),
      })
      let payout
      try {
        payout = await oxaPayRequest('/payout', 'payout_api_key', env.OXAPAY_PAYOUT_API_KEY, {
          method: 'POST',
          body: JSON.stringify({ address, currency: quote.symbol, amount: cryptoAmount, network: quote.network, callback_url: paymentCallbackUrl(request, env, 'payout'), ...(memo ? { memo } : {}), description: `RoRisk withdrawal ${withdrawalId}` }),
        })
      } catch (error) {
        await supabaseRequest(env, '/rest/v1/rpc/finalize_rorisk_crypto_withdrawal', { method: 'POST', body: JSON.stringify({ p_uuid: withdrawalId, p_track_id: null, p_status: 'failed', p_payload: { error: 'provider_request_failed' } }) }).catch(() => {})
        throw error
      }
      await supabaseRequest(env, `/rest/v1/rorisk_crypto_withdrawals?uuid=eq.${withdrawalId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ track_id: String(payout.track_id), status: String(payout.status || 'processing').toLowerCase(), provider_payload: payout, updated_at: new Date().toISOString() }) })
      if (reserved?.user) startRealtimeSession(request, response, env, reserved.user)
      sendJson(response, 200, { withdrawal: { id: withdrawalId, trackId: String(payout.track_id), status: payout.status || 'Processing', coinAmount, usdAmount, cryptoAmount, currency: quote.symbol, network: quote.network } })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/payments/oxapay/deposit-webhook') {
      const rawBody = await readRawBody(request)
      if (!validOxaSignature(rawBody, request.headers.hmac, env.OXAPAY_MERCHANT_API_KEY)) throw new Error('Invalid payment callback signature.')
      const payload = JSON.parse(rawBody.toString('utf8'))
      await supabaseRequest(env, '/rest/v1/rpc/finalize_rorisk_crypto_deposit', { method: 'POST', body: JSON.stringify({ p_order_uuid: payload.order_id || null, p_track_id: String(payload.track_id || ''), p_status: String(payload.status || '').toLowerCase(), p_payload: payload }) })
      sendText(response, 200, 'ok')
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/payments/oxapay/payout-webhook') {
      const rawBody = await readRawBody(request)
      if (!validOxaSignature(rawBody, request.headers.hmac, env.OXAPAY_PAYOUT_API_KEY)) throw new Error('Invalid payout callback signature.')
      const payload = JSON.parse(rawBody.toString('utf8'))
      await supabaseRequest(env, '/rest/v1/rpc/finalize_rorisk_crypto_withdrawal', { method: 'POST', body: JSON.stringify({ p_uuid: null, p_track_id: String(payload.track_id || ''), p_status: String(payload.status || '').toLowerCase(), p_payload: payload }) })
      sendText(response, 200, 'ok')
      return true
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/case-images/')) {
      const objectPath = decodeURIComponent(url.pathname.slice('/api/case-images/'.length))
      if (!/^(main|other|items)\/[a-z0-9-]+\.png$/.test(objectPath)) {
        sendJson(response, 404, { error: 'Case image not found.' })
        return true
      }
      await sendStoredImage(response, env, 'case-images', objectPath, 'Case')
      return true
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/casino-images/')) {
      const objectPath = decodeURIComponent(url.pathname.slice('/api/casino-images/'.length))
      if (!/^(slots|live-casino|dice|coinflip|mines|x-roulette)\/[a-zA-Z0-9_.-]+\.(?:avif|jpe?g|png|webp)$/.test(objectPath)) {
        sendJson(response, 404, { error: 'Casino image not found.' })
        return true
      }
      await sendStoredImage(response, env, 'casino-images', objectPath, 'Casino')
      return true
    }

    if (request.method === 'GET' && /^\/api\/limited-items\/\d+\/image$/.test(url.pathname)) {
      const assetId = Number(url.pathname.split('/')[3])
      await sendLimitedImage(response, assetId)
      return true
    }

    if (request.method === 'GET' && url.pathname === '/api/casino-games') {
      const query = new URLSearchParams({
        active: 'eq.true',
        select: 'game_code,game_name,provider,provider_code,image_url,launch_count,popular_rank,newest_rank,demo_support',
        order: 'popular_rank.asc',
      })
      const [slots, live] = await Promise.all([
        supabaseRequest(env, `/rest/v1/rorisk_slots?${query}`),
        supabaseRequest(env, `/rest/v1/rorisk_live_games?${query}`),
      ])
      sendJson(response, 200, {
        slots: (slots || []).map(publicCasinoGame),
        live: (live || []).map(publicCasinoGame),
      })
      return true
    }

    if (request.method === 'GET' && url.pathname === '/api/upgrader/items') {
      const currency = selectedCurrency(url.searchParams.get('currency'))
      const page = Math.max(1, Math.trunc(Number(url.searchParams.get('page')) || 1))
      const pageSize = 105
      const search = String(url.searchParams.get('search') || '').trim().toLowerCase()
      const minimum = url.searchParams.has('amountMin') ? Math.max(0, Number(url.searchParams.get('amountMin')) || 0) : null
      const maximum = url.searchParams.has('amountMax') ? Math.max(0, Number(url.searchParams.get('amountMax')) || 0) : null
      const descending = String(url.searchParams.get('sort') || 'highest').toLowerCase() !== 'lowest'
      const catalog = await getLimitedCatalog(env)
      const filtered = catalog.filter((item) => {
        const value = limitedItemValue(item, currency)
        if (!value || (minimum != null && value < minimum) || (maximum != null && value > maximum)) return false
        return !search || String(item.name || '').toLowerCase().includes(search) || String(item.acronym || '').toLowerCase().includes(search)
      }).sort((first, second) => descending ? limitedItemValue(second, currency) - limitedItemValue(first, currency) : limitedItemValue(first, currency) - limitedItemValue(second, currency))
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
      const selectedPage = Math.min(page, totalPages)
      const offset = (selectedPage - 1) * pageSize
      const items = filtered.slice(offset, offset + pageSize).map((item) => publicUpgraderItem(item, currency))
      primeLimitedImages(items).catch(() => {})
      sendJson(response, 200, { items, count: filtered.length, page: selectedPage, totalPages })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/upgrader/play') {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const body = await readJson(request)
      const amount = Math.trunc(Number(body.amount))
      const assetId = Math.trunc(Number(body.targetAssetId))
      const rangeStart = Math.trunc(Number(body.rangeStart))
      const mode = String(body.mode || '')
      if (!Number.isSafeInteger(amount) || amount < 50 || amount > 500000) throw new Error('Your entered bet amount is invalid.')
      if (!Number.isSafeInteger(assetId) || assetId < 1) throw new Error('Select an item to upgrade.')
      if (!Number.isInteger(rangeStart) || rangeStart < 0 || rangeStart > 99999) throw new Error('The selected ticket range is invalid.')
      if (!['under', 'over'].includes(mode)) throw new Error('The selected game mode is invalid.')
      const catalog = await getLimitedCatalog(env)
      const target = catalog.find((item) => Number(item.asset_id) === assetId)
      if (!target) throw new Error('The selected item is no longer available.')
      const currency = selectedCurrency(body.currency)
      const targetValue = limitedItemValue(target, currency)
      const serverSeed = randomBytes(32).toString('hex')
      const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex')
      const result = await supabaseRequest(env, '/rest/v1/rpc/play_rorisk_upgrader', {
        method: 'POST',
        body: JSON.stringify({
          p_user_uuid: sessionUser.uuid,
          p_amount: amount,
          p_currency: currency,
          p_target_asset_id: assetId,
          p_target_name: String(target.name || target.acronym || `Limited ${assetId}`).slice(0, 200),
          p_target_image: `/api/limited-items/${assetId}/image`,
          p_target_value: targetValue,
          p_mode: mode,
          p_range_start: rangeStart,
          p_client_seed: String(body.clientSeed || sessionUser.uuid).slice(0, 128),
          p_server_seed: serverSeed,
          p_server_seed_hash: serverSeedHash,
        }),
      })
      if (result?.user) startRealtimeSession(request, response, env, result.user)
      const game = publicUpgraderGame({ ...result.game, level: result.user?.level, rank: result.user?.rank })
      broadcastRealtime({ type: 'upgraderBet', game })
      sendJson(response, 200, { ...result, game })
      return true
    }

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
      const [diceResult, casesResult, coinflipResult, minesResult, rouletteResult, upgraderResult] = await Promise.allSettled([
        supabaseRequest(env, `/rest/v1/rorisk_dice_games?${new URLSearchParams({ select: 'uuid,user_uuid,roblox_id,username,avatar_headshot,currency,bet_amount,multiplier,won,payout_amount,created_at,profile:rorisk_users!rorisk_dice_games_user_uuid_fkey(level,rank)', order: 'created_at.desc', limit: String(limit) })}`),
        supabaseRequest(env, `/rest/v1/rorisk_case_openings?${new URLSearchParams({ status: 'eq.completed', select: 'uuid,user_uuid,roblox_id,username,avatar_headshot,currency,wager_amount,payout_amount,created_at,profile:rorisk_users!rorisk_case_openings_user_uuid_fkey(level,rank)', order: 'created_at.desc', limit: String(limit) })}`),
        supabaseRequest(env, `/rest/v1/rorisk_coinflip_games?${new URLSearchParams({ state: 'eq.completed', select: 'uuid,creator_uuid,creator_roblox_id,creator_username,creator_avatar_headshot,opponent_uuid,opponent_roblox_id,opponent_username,opponent_avatar_headshot,currency,amount,winner_uuid,payout_amount,completed_at,created_at,creator_profile:rorisk_users!rorisk_coinflip_games_creator_uuid_fkey(level,rank),opponent_profile:rorisk_users!rorisk_coinflip_games_opponent_uuid_fkey(level,rank)', order: 'created_at.desc', limit: String(limit) })}`),
        supabaseRequest(env, `/rest/v1/rorisk_mines_games?${new URLSearchParams({ state: 'eq.completed', select: 'uuid,user_uuid,roblox_id,username,avatar_headshot,currency,bet_amount,multiplier,won,payout_amount,completed_at,created_at,profile:rorisk_users!rorisk_mines_games_user_uuid_fkey(level,rank)', order: 'completed_at.desc', limit: String(limit) })}`),
        supabaseRequest(env, `/rest/v1/rorisk_roulette_games?${new URLSearchParams({ state: 'eq.COMPLETE', select: 'uuid,bets,result_multiplier_bps,completed_at,created_at', order: 'completed_at.desc', limit: String(limit) })}`),
        supabaseRequest(env, `/rest/v1/rorisk_upgrader_games?${new URLSearchParams({ select: 'uuid,user_uuid,roblox_id,username,avatar_headshot,currency,bet_amount,multiplier_bps,won,payout_amount,created_at,completed_at,profile:rorisk_users!rorisk_upgrader_games_user_uuid_fkey(level,rank)', order: 'created_at.desc', limit: String(limit) })}`),
      ])
      const diceGames = diceResult.status === 'fulfilled' ? diceResult.value : []
      const caseGames = casesResult.status === 'fulfilled' ? casesResult.value : []
      const coinflipGames = coinflipResult.status === 'fulfilled' ? coinflipResult.value : []
      const minesGames = minesResult.status === 'fulfilled' ? minesResult.value : []
      const rouletteGames = rouletteResult.status === 'fulfilled' ? rouletteResult.value : []
      const upgraderGames = upgraderResult.status === 'fulfilled' ? upgraderResult.value : []
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
      const [diceResult, casesResult, minesResult, upgraderResult] = await Promise.allSettled([
        supabaseRequest(env, `/rest/v1/rorisk_dice_games?${new URLSearchParams({ user_uuid: userFilter, select: 'uuid,client_seed,server_seed_hash,server_seed,nonce,created_at', order: 'created_at.desc', limit: '1000' })}`),
        supabaseRequest(env, `/rest/v1/rorisk_case_openings?${new URLSearchParams({ user_uuid: userFilter, status: 'eq.completed', select: 'uuid,client_seed,server_seed_hash,server_seed,nonce,created_at,completed_at', order: 'created_at.desc', limit: '1000' })}`),
        supabaseRequest(env, `/rest/v1/rorisk_mines_games?${new URLSearchParams({ user_uuid: userFilter, state: 'eq.completed', select: 'uuid,client_seed,server_seed_hash,server_seed,nonce,created_at,completed_at', order: 'created_at.desc', limit: '1000' })}`),
        supabaseRequest(env, `/rest/v1/rorisk_upgrader_games?${new URLSearchParams({ user_uuid: userFilter, select: 'uuid,client_seed,server_seed_hash,server_seed,nonce,created_at,completed_at', order: 'created_at.desc', limit: '1000' })}`),
      ])
      if (diceResult.status === 'rejected' && casesResult.status === 'rejected' && minesResult.status === 'rejected' && upgraderResult.status === 'rejected') throw diceResult.reason
      const diceSeeds = diceResult.status === 'fulfilled' ? diceResult.value : []
      const caseSeeds = casesResult.status === 'fulfilled' ? casesResult.value : []
      const minesSeeds = minesResult.status === 'fulfilled' ? minesResult.value : []
      const upgraderSeeds = upgraderResult.status === 'fulfilled' ? upgraderResult.value : []
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

    if (request.method === 'GET' && url.pathname === '/api/cases') {
      const currency = selectedCurrency(url.searchParams.get('currency'))
      const query = new URLSearchParams({
        active: 'eq.true',
        select: '*',
        order: 'sort_order.asc',
      })
      const rows = await supabaseRequest(env, `/rest/v1/rorisk_cases?${query}`)
      sendJson(response, 200, {
        cases: (rows || []).map((row) => publicCase(row, false, currency)),
      })
      return true
    }

    const caseRoute = url.pathname.match(/^\/api\/cases\/([a-zA-Z0-9_-]+)$/)
    if (request.method === 'GET' && caseRoute) {
      const currency = selectedCurrency(url.searchParams.get('currency'))
      const query = new URLSearchParams({ case_id: `eq.${caseRoute[1]}`, active: 'eq.true', select: '*' })
      const rows = await supabaseRequest(env, `/rest/v1/rorisk_cases?${query}`)
      if (!rows?.[0]) {
        sendJson(response, 404, { error: 'This case could not be found.' })
        return true
      }
      sendJson(response, 200, { case: publicCase(rows[0], true, currency) })
      return true
    }

    const caseOpenRoute = url.pathname.match(/^\/api\/cases\/([a-zA-Z0-9_-]+)\/open$/)
    if (request.method === 'POST' && caseOpenRoute) {
      const body = await readJson(request)
      const count = Math.trunc(Number(body.count))
      if (![1, 2, 3, 4].includes(count)) throw new Error('Select between 1 and 4 cases.')
      const query = new URLSearchParams({ case_id: `eq.${caseOpenRoute[1]}`, active: 'eq.true', select: '*' })
      const rows = await supabaseRequest(env, `/rest/v1/rorisk_cases?${query}`)
      if (!rows?.[0]) throw new Error('This case could not be found.')
      const currency = selectedCurrency(body.currency)
      const caseData = publicCase(rows[0], true, currency)

      if (body.demo === true) {
        sendJson(response, 200, {
          opening: {
            uuid: `demo-${randomBytes(12).toString('hex')}`,
            caseId: caseData.caseId,
            caseCount: count,
            demo: true,
            outcomes: demoCaseOutcomes(caseData, count),
            updatedAt: new Date().toISOString(),
          },
        })
        return true
      }

      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const clientSeed = String(body.clientSeed || sessionUser.uuid).slice(0, 128)
      const serverSeed = randomBytes(32).toString('hex')
      const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex')
      const result = await supabaseRequest(env, '/rest/v1/rpc/open_rorisk_case', {
        method: 'POST',
        body: JSON.stringify({
          p_user_uuid: sessionUser.uuid,
          p_case_id: caseData.caseId,
          p_case_count: count,
          p_currency: currency,
          p_client_seed: clientSeed,
          p_server_seed: serverSeed,
          p_server_seed_hash: serverSeedHash,
        }),
      })
      if (result?.user) startRealtimeSession(request, response, env, result.user)
      sendJson(response, 200, result)
      return true
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/config') {
      sendJson(response, 200, {
        hcaptchaSiteKey: env.HCAPTCHA_SITE_KEY || '',
      })
      return true
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/google/start') {
      if (!env.SUPABASE_URL) throw new Error('Authentication is temporarily unavailable. Please try again later.')
      const protocol = request.headers['x-forwarded-proto'] || 'http'
      const requestOrigin = `${protocol}://${request.headers.host}`
      const requestedRedirect = url.searchParams.get('redirectTo') || `${requestOrigin}/`
      const redirectUrl = new URL(requestedRedirect)
      if (redirectUrl.origin !== requestOrigin) throw new Error('The authentication redirect is invalid.')
      const authorizeUrl = new URL(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/authorize`)
      authorizeUrl.searchParams.set('provider', 'google')
      authorizeUrl.searchParams.set('redirect_to', redirectUrl.toString())
      response.statusCode = 302
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('Location', authorizeUrl.toString())
      response.end()
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/email/sign-in') {
      const { email, password } = await readJson(request)
      const session = await supabaseAuthRequest(env, '/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email: String(email || '').trim(), password: String(password || '') }),
      })
      const user = await completeAuthProfile(env, session.access_token)
      startRealtimeSession(request, response, env, user)
      sendJson(response, 200, { user })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/email/sign-up') {
      const { username, email, password } = await readJson(request)
      const cleanUsername = String(username || '').trim()
      if (!/^[A-Za-z0-9_]{3,20}$/.test(cleanUsername)) throw new Error('Your entered username is invalid.')
      const result = await supabaseAuthRequest(env, '/signup', {
        method: 'POST',
        body: JSON.stringify({ email: String(email || '').trim(), password: String(password || ''), data: { username: cleanUsername } }),
      })
      const user = result.access_token ? await completeAuthProfile(env, result.access_token) : null
      startRealtimeSession(request, response, env, user)
      sendJson(response, 200, { user, confirmationRequired: !result.access_token })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/email/reset') {
      const { email, redirectTo } = await readJson(request)
      const resetPath = new URL('/recover', `${env.SUPABASE_URL.replace(/\/$/, '')}/`)
      if (redirectTo) resetPath.searchParams.set('redirect_to', String(redirectTo))
      await supabaseAuthRequest(env, `${resetPath.pathname}${resetPath.search}`, {
        method: 'POST',
        body: JSON.stringify({ email: String(email || '').trim() }),
      })
      sendJson(response, 200, { success: true })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/email/update-password') {
      const { accessToken, password } = await readJson(request)
      if (String(password || '').length < 8) throw new Error('Your entered password is invalid.')
      await supabaseAuthRequest(env, '/user', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${String(accessToken || '')}` },
        body: JSON.stringify({ password: String(password) }),
      })
      sendJson(response, 200, { success: true })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/sign-out') {
      clearRealtimeSessionCookie(response, isSecureRequest(request))
      sendJson(response, 200, { success: true })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/roblox/request') {
      const { username, captcha } = await readJson(request)
      if (!String(username || '').trim()) throw new Error('Enter your Roblox username.')
      await verifyCaptcha(captcha, env.HCAPTCHA_SECRET, request.socket?.remoteAddress)
      const profile = await findRobloxUser(String(username).trim())
      const challenge = createChallenge(profile, env.RORISK_USER_SECRET)
      const data = verifyChallenge(challenge, env.RORISK_USER_SECRET)
      sendJson(response, 200, { ...data, challenge })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/roblox/verify') {
      const { challenge } = await readJson(request)
      const data = verifyChallenge(challenge, env.RORISK_USER_SECRET)
      const profile = await getRobloxProfile(data.robloxId)
      const apiDescriptionMatches = normalizeVerificationText(profile.description).includes(normalizeVerificationText(data.verificationCode))
      const publicProfileMatches = apiDescriptionMatches
        ? false
        : await publicProfileContainsVerificationCode(data.robloxId, data.verificationCode)
      if (!apiDescriptionMatches && !publicProfileMatches) {
        throw new Error('The verification phrase was not found in your Roblox description yet.')
      }
      const avatarHeadshot = await getRobloxHeadshot(data.robloxId)
      const user = await upsertProfile(env, {
        roblox_id: data.robloxId,
        username: profile.name,
        avatar_headshot: avatarHeadshot,
      }, 'roblox_id')
      startRealtimeSession(request, response, env, user)
      sendJson(response, 200, { user })
      return true
    }

    if (request.method === 'POST' && ['/api/auth/google/complete', '/api/auth/session/complete'].includes(url.pathname)) {
      const { accessToken } = await readJson(request)
      const user = await completeAuthProfile(env, accessToken)
      startRealtimeSession(request, response, env, user)
      sendJson(response, 200, { user })
      return true
    }

    sendJson(response, 404, { error: 'Not found.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed.'
    const containsInternalConfiguration = /supabase|api key|credential|server environment|fetch failed/i.test(message)
    const gameServiceRoute = /^\/api\/(?:cases|dice|coinflip|mines|x-roulette|upgrader)(?:\/|$)/.test(url.pathname)
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

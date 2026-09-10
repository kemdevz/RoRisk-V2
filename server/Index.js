import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { attachRealtimeServer, clearRealtimeSessionCookie, createRealtimeSession, readRealtimeSession, setRealtimeSessionCookie } from './Chat.js'

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

function publicCase(row, includeItems = false) {
  const data = {
    caseId: row.case_id,
    name: row.name,
    slug: row.slug,
    rocoinAmount: Number(row.rocoin_amount ?? row.amount) || 0,
    type: row.type,
    categories: row.categories,
    levelMin: row.level_min,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
  }
  if (includeItems) {
    data.items = (Array.isArray(row.items) ? row.items : []).map((item, index) => ({
      ...item,
      index: Number(item.index) || index + 1,
      price: Math.max(0, Number(item.price ?? item.amount) || 0),
      chance: String(item.chance ?? `${Number(item.tickets || 0) / 1000}%`),
      rarity: item.rarity == null || String(item.rarity).trim() === '' ? null : String(item.rarity).toLowerCase(),
    }))
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
      if (!/^(slots|live-casino)\/[a-zA-Z0-9_.-]+\.(?:avif|jpe?g|png|webp)$/.test(objectPath)) {
        sendJson(response, 404, { error: 'Casino image not found.' })
        return true
      }
      await sendStoredImage(response, env, 'casino-images', objectPath, 'Casino')
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

    if (request.method === 'GET' && url.pathname === '/api/cases') {
      const query = new URLSearchParams({
        active: 'eq.true',
        select: '*',
        order: 'sort_order.asc',
      })
      const rows = await supabaseRequest(env, `/rest/v1/rorisk_cases?${query}`)
      sendJson(response, 200, {
        cases: (rows || []).map((row) => publicCase(row)),
      })
      return true
    }

    const caseRoute = url.pathname.match(/^\/api\/cases\/([a-zA-Z0-9_-]+)$/)
    if (request.method === 'GET' && caseRoute) {
      const query = new URLSearchParams({ case_id: `eq.${caseRoute[1]}`, active: 'eq.true', select: '*' })
      const rows = await supabaseRequest(env, `/rest/v1/rorisk_cases?${query}`)
      if (!rows?.[0]) {
        sendJson(response, 404, { error: 'This case could not be found.' })
        return true
      }
      sendJson(response, 200, { case: publicCase(rows[0], true) })
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
      const caseData = publicCase(rows[0], true)

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
      const requestId = /^[0-9a-f-]{36}$/i.test(String(body.requestId || '')) ? body.requestId : randomUUID()
      const clientSeed = String(body.clientSeed || sessionUser.uuid).slice(0, 128)
      const serverSeed = randomBytes(32).toString('hex')
      const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex')
      const result = await supabaseRequest(env, '/rest/v1/rpc/open_rorisk_case', {
        method: 'POST',
        body: JSON.stringify({
          p_user_uuid: sessionUser.uuid,
          p_case_id: caseData.caseId,
          p_case_count: count,
          p_request_id: requestId,
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
    const caseServiceRoute = /^\/api\/cases(?:\/|$)/.test(url.pathname)
    sendJson(response, caseServiceRoute && containsInternalConfiguration ? 503 : 400, {
      error: containsInternalConfiguration
        || (caseServiceRoute && /could not find the function|schema cache|database/i.test(message))
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

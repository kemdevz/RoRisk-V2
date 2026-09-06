import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { attachRealtimeServer, clearRealtimeSessionCookie, createRealtimeSession, setRealtimeSessionCookie } from './Chat.js'

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
  const serverKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  if (!env.SUPABASE_URL || !serverKey) {
    throw new Error('Supabase server credentials are not configured.')
  }
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
  const body = text ? JSON.parse(text) : null
  if (!response.ok) {
    if (response.status === 401) throw new Error('Authentication is temporarily unavailable. Please try again later.')
    throw new Error(body?.message || body?.error_description || body?.hint || 'Supabase request failed.')
  }
  return body
}

async function supabaseAuthRequest(env, path, options = {}) {
  const serverKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  if (!env.SUPABASE_URL || !serverKey) throw new Error('Authentication is temporarily unavailable. Please try again later.')
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1${path}`, {
    ...options,
    headers: {
      apikey: serverKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (!response.ok) {
    if (response.status === 401 && /invalid api key/i.test(String(body?.message || body?.error || ''))) {
      throw new Error('Authentication is temporarily unavailable. Please try again later.')
    }
    throw new Error(body?.msg || body?.message || body?.error_description || body?.error || 'Authentication failed. Please try again.')
  }
  return body
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
  if (!url.pathname.startsWith('/api/auth/')) return false

  try {
    if (request.method === 'GET' && url.pathname === '/api/auth/config') {
      sendJson(response, 200, {
        hcaptchaSiteKey: env.VITE_HCAPTCHA_SITE_KEY || '',
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
    sendJson(response, 400, {
      error: containsInternalConfiguration
        ? 'Authentication is temporarily unavailable. Please try again later.'
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

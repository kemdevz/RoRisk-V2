export async function handleAuthRequest({ request, response, url, env, api }) {
  const { sendJson, readJson, isSecureRequest, startRealtimeSession, createChallenge, verifyChallenge, verifyCaptcha, findRobloxUser, getRobloxProfile, normalizeVerificationText, publicProfileContainsVerificationCode, getRobloxHeadshot, supabaseAuthRequest, upsertProfile, completeAuthProfile, clearRealtimeSessionCookie } = api
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
      const cleanEmail = String(email || '').trim().toLowerCase()
      if (!/^[A-Za-z0-9_]{3,20}$/.test(cleanUsername)) throw new Error('Your entered username is invalid.')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error('Your entered email is invalid.')
      if (String(password || '').length < 8) throw new Error('Your entered password is invalid.')
      await supabaseAuthRequest(env, '/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password: String(password), email_confirm: true, user_metadata: { username: cleanUsername } }),
      })
      const session = await supabaseAuthRequest(env, '/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password: String(password) }),
      })
      const user = await completeAuthProfile(env, session.access_token)
      startRealtimeSession(request, response, env, user)
      sendJson(response, 200, { user })
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

  return false
}


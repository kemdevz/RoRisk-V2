let recoveryAccessToken = null

async function authRequest(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Authentication is temporarily unavailable. Please try again later.')
  return result
}

function authHash() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ''))
}

function clearAuthHash() {
  if (!window.location.hash) return
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`)
}

export async function startGoogleSignIn() {
  const redirectTo = `${window.location.origin}/`
  window.location.assign(`/api/auth/google/start?redirectTo=${encodeURIComponent(redirectTo)}`)
}

export async function signInWithPassword(email, password) {
  const result = await authRequest('/api/auth/email/sign-in', { email, password })
  return result.user
}

export async function signUpWithPassword({ username, email, password }) {
  const result = await authRequest('/api/auth/email/sign-up', { username, email, password })
  return result.user || null
}

export async function sendPasswordReset(email) {
  await authRequest('/api/auth/email/reset', { email, redirectTo: `${window.location.origin}/` })
}

export async function updatePassword(password) {
  if (!recoveryAccessToken) throw new Error('The password recovery link is invalid or has expired.')
  await authRequest('/api/auth/email/update-password', { accessToken: recoveryAccessToken, password })
  recoveryAccessToken = null
  clearAuthHash()
}

export function listenForPasswordRecovery(callback) {
  const params = authHash()
  if (params.get('type') === 'recovery' && params.get('access_token')) {
    recoveryAccessToken = params.get('access_token')
    queueMicrotask(callback)
  }
  return () => {}
}

export async function syncGoogleProfile() {
  const params = authHash()
  const accessToken = params.get('access_token')
  if (!accessToken || params.get('type') === 'recovery') return null
  const result = await authRequest('/api/auth/session/complete', { accessToken })
  clearAuthHash()
  return result.user
}

export async function signOut() {
  recoveryAccessToken = null
  await authRequest('/api/auth/sign-out', {})
}

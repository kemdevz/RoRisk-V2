let renderKeepAliveTimer = null

export function handleKeepAliveRequest({ request, response, url, sendJson }) {
  if (request.method !== 'GET' || url.pathname !== '/api/health') return false
  sendJson(response, 200, { ok: true })
  return true
}

export function startRenderKeepAlive() {
  if (renderKeepAliveTimer || process.env.RENDER !== 'true' || process.env.RENDER_SERVICE_TYPE !== 'web') return
  const baseUrl = String(process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/$/, '')
  if (!/^https:\/\//i.test(baseUrl)) return

  const ping = async () => {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        headers: { 'User-Agent': 'rorisk-render-keep-alive/1.0' },
        signal: AbortSignal.timeout(90_000),
      })
      if (!response.ok) console.warn(`Render keep-alive returned HTTP ${response.status}.`)
    } catch (error) {
      console.warn(`Render keep-alive failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const initialPing = setTimeout(() => { void ping() }, 60_000)
  initialPing.unref?.()
  renderKeepAliveTimer = setInterval(() => { void ping() }, 10 * 60_000)
  renderKeepAliveTimer.unref?.()
}

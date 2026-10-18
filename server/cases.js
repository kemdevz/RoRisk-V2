import { createHash, randomBytes } from 'node:crypto'

export async function handleCasesRequest({ request, response, url, env, api }) {
  const { sendJson, readJson, startRealtimeSession, supabaseRequest, requestSessionUser, selectedCurrency, publicCase, demoCaseOutcomes } = api
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
      const currency = selectedCurrency(body.currency)

      if (body.demo === true) {
        const query = new URLSearchParams({ case_id: `eq.${caseOpenRoute[1]}`, active: 'eq.true', select: '*' })
        const rows = await supabaseRequest(env, `/rest/v1/rorisk_cases?${query}`)
        if (!rows?.[0]) throw new Error('This case could not be found.')
        const caseData = publicCase(rows[0], true, currency)
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
          p_case_id: caseOpenRoute[1],
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

  return false
}


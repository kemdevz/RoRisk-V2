export async function handleAffiliatesRequest({ request, response, url, env, api }) {
  const { sendJson, readJson, startRealtimeSession, supabaseRequest, requestSessionUser, selectedCurrency, affiliateReferrer, publicAffiliate, affiliateState, welcomeCase, chooseWelcomeOutcome } = api
    if (request.method === 'GET' && url.pathname === '/api/welcome') {
      const sessionUser = requestSessionUser(request, env)
      const currency = selectedCurrency(url.searchParams.get('currency'))
      const caseData = await welcomeCase(env, currency)
      let affiliate = publicAffiliate(null)
      let hasRewardCaseDeposit = false
      if (sessionUser?.uuid) {
        affiliate = (await affiliateState(env, sessionUser.uuid)).data
        const depositQuery = new URLSearchParams({
          user_uuid: `eq.${sessionUser.uuid}`,
          credited: 'eq.true',
          select: 'usd_amount',
        })
        const deposits = await supabaseRequest(env, `/rest/v1/rorisk_crypto_deposits?${depositQuery}`)
        hasRewardCaseDeposit = (deposits || []).reduce((total, deposit) => total + Number(deposit.usd_amount || 0), 0) >= 10
      }
      sendJson(response, 200, { case: caseData, affiliate, hasRewardCaseDeposit, caseTotal: 4 })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/welcome/open') {
      const body = await readJson(request)
      const currency = selectedCurrency(body.currency)
      const caseData = await welcomeCase(env, currency)
      if (!caseData?.items?.length) throw new Error('Reward case is not available yet.')
      const outcome = chooseWelcomeOutcome(caseData)
      const item = outcome.item
      const chance = Number.parseFloat(String(item?.chance || '0').replace('%', '')) || 0
      const itemValue = Number(currency === 'coins' ? item?.coinPrice : item?.rocoinPrice) || 0
      const caseValue = Number(currency === 'coins' ? caseData?.coinAmount : caseData?.rocoinAmount) || 0
      const openingRiskSpin = body.riskSpin === true && chance < 10 && itemValue > caseValue
      if (body.demo === true) {
        sendJson(response, 200, { opening: { demo: true, outcome: outcome.outcome, item, riskSpin: openingRiskSpin, updatedAt: new Date().toISOString() } })
        return true
      }
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const result = await supabaseRequest(env, '/rest/v1/rpc/open_rorisk_welcome_case', {
        method: 'POST',
        body: JSON.stringify({ p_user_uuid: sessionUser.uuid, p_currency: currency, p_item: item }),
      })
      if (result?.user) startRealtimeSession(request, response, env, result.user)
      sendJson(response, 200, { ...result, opening: { demo: false, outcome: outcome.outcome, item, riskSpin: openingRiskSpin, updatedAt: new Date().toISOString() } })
      return true
    }

    if (request.method === 'GET' && url.pathname === '/api/affiliates') {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const page = Math.max(1, Math.trunc(Number(url.searchParams.get('page'))) || 1)
      const limit = Math.min(50, Math.max(1, Math.trunc(Number(url.searchParams.get('limit'))) || 50))
      const state = await affiliateState(env, sessionUser.uuid)
      const rowsQuery = new URLSearchParams({
        referrer_user_uuid: `eq.${sessionUser.uuid}`,
        select: '*',
        order: 'referred_at.desc',
      })
      const referredRows = await supabaseRequest(env, `/rest/v1/rorisk_affiliates?${rowsQuery}`, {
        headers: { Range: `${(page - 1) * limit}-${page * limit - 1}`, Prefer: 'count=exact' },
      })
      const referred = await Promise.all((referredRows || []).map(async (entry) => ({
        user: await affiliateReferrer(env, { referrer_user_uuid: entry.user_uuid }),
        wagered: Number(entry.total_wagered) || 0,
        wageredRocoins: Number(entry.total_wagered_rocoins) || 0,
        deposited: Number(entry.total_deposited) || 0,
        earned: Math.max(0, Math.floor((Number(entry.total_deposited) || 0) * 0.1)),
        referredAt: entry.referred_at,
      })))
      const countQuery = new URLSearchParams({ referrer_user_uuid: `eq.${sessionUser.uuid}`, select: 'user_uuid' })
      const allRows = await supabaseRequest(env, `/rest/v1/rorisk_affiliates?${countQuery}`)
      const totalUsers = allRows?.length || 0
      const totalPages = Math.max(1, Math.ceil(totalUsers / limit))
      const referredDepositTotal = (referredRows || []).reduce((total, entry) => total + Number(entry.total_deposited || 0), 0)
      sendJson(response, 200, {
        data: { ...state.data, deposit: referredDepositTotal },
        referred,
        pagination: { currentPage: page, totalPages, totalUsers, hasPrevPage: page > 1, hasNextPage: page < totalPages },
      })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/affiliates/code') {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const body = await readJson(request)
      await supabaseRequest(env, '/rest/v1/rpc/set_rorisk_affiliate_code', {
        method: 'POST',
        body: JSON.stringify({ p_user_uuid: sessionUser.uuid, p_code: String(body.code || '').trim() }),
      })
      sendJson(response, 200, { success: true, affiliate: (await affiliateState(env, sessionUser.uuid)).data })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/affiliates/redeem') {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const body = await readJson(request)
      await supabaseRequest(env, '/rest/v1/rpc/redeem_rorisk_affiliate_code', {
        method: 'POST',
        body: JSON.stringify({ p_user_uuid: sessionUser.uuid, p_code: String(body.code || '').trim() }),
      })
      sendJson(response, 200, { success: true, affiliate: (await affiliateState(env, sessionUser.uuid)).data })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/affiliates/claim') {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const result = await supabaseRequest(env, '/rest/v1/rpc/claim_rorisk_affiliate_earnings', {
        method: 'POST',
        body: JSON.stringify({ p_user_uuid: sessionUser.uuid }),
      })
      if (result?.user) startRealtimeSession(request, response, env, result.user)
      sendJson(response, 200, result)
      return true
    }

  return false
}


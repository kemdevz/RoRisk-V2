import { randomUUID } from 'node:crypto'

export async function handlePaymentsRequest({ request, response, url, env, api }) {
  const { sendJson, readJson, startRealtimeSession, supabaseRequest, oxaPayRequest, paymentCallbackUrl, validOxaSignature, currentCryptoQuote, readRawBody, sendText, requestSessionUser, OXAPAY_API_URL, COINS_PER_USD } = api
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

  return false
}


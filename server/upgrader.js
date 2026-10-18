import { createHash, randomBytes } from 'node:crypto'

export async function handleUpgraderRequest({ request, response, url, env, api }) {
  const { sendJson, readJson, startRealtimeSession, supabaseRequest, requestSessionUser, selectedCurrency, publicUpgraderGame, limitedItemValue, publicUpgraderItem, getLimitedCatalog, primeLimitedImages, broadcastRealtime } = api
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

  return false
}


export async function handleAssetsRequest({ request, response, url, env, api }) {
  const { sendJson, supabaseRequest, sendStoredImage, publicCasinoGame, sendLimitedImage } = api
    if (request.method === 'GET' && url.pathname.startsWith('/api/case-images/')) {
      const objectPath = decodeURIComponent(url.pathname.slice('/api/case-images/'.length))
      if (!/^(main|other|items)\/[a-z0-9-]+\.png$/.test(objectPath)) {
        sendJson(response, 404, { error: 'Case image not found.' })
        return true
      }
      const itemImage = objectPath.match(/^items\/(\d+)\.png$/)
      if (itemImage) {
        await sendLimitedImage(response, Number(itemImage[1]))
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

  return false
}


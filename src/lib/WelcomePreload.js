const welcomeDataCache = new Map()
const welcomeDataRequests = new Map()
const welcomeImageRequests = new Map()

export function storedWelcomeCurrency() {
  return window.localStorage.getItem('currency') === 'coins' ? 'coins' : 'rocoins'
}

export function getCachedWelcomeData(currency) {
  return welcomeDataCache.get(currency) || null
}

function preloadImage(source) {
  if (!source) return Promise.resolve()
  if (welcomeImageRequests.has(source)) return welcomeImageRequests.get(source)
  const request = new Promise((resolve) => {
    const image = new Image()
    image.onload = resolve
    image.onerror = resolve
    image.decoding = 'async'
    image.src = source
    if (image.complete) resolve()
  })
  welcomeImageRequests.set(source, request)
  return request
}

export async function requestWelcomeData(currency) {
  const response = await fetch(`/api/welcome?currency=${currency}`)
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'Reward case is not available yet.')
  welcomeDataCache.set(currency, payload)
  return payload
}

export function preloadWelcomeData(currency = storedWelcomeCurrency()) {
  if (welcomeDataCache.has(currency)) return Promise.resolve(welcomeDataCache.get(currency))
  if (welcomeDataRequests.has(currency)) return welcomeDataRequests.get(currency)
  const request = requestWelcomeData(currency).then(async (payload) => {
    const itemImages = (payload?.case?.items || []).map((item) => item?.image)
    await Promise.all([
      preloadImage('/assets/welcome/welcome-banner.d9af232d.png'),
      preloadImage('/assets/welcome/welcome-chicken.4c912e1c.png'),
      ...itemImages.map(preloadImage),
    ])
    return payload
  }).finally(() => welcomeDataRequests.delete(currency))
  welcomeDataRequests.set(currency, request)
  return request
}

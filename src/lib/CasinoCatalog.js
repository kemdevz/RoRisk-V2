let catalogPromise

export const slotProviders = [
  { code: 'PRAGMATIC', name: 'Pragmatic Play', count: 642 },
  { code: 'HACKSAW', name: 'Hacksaw', count: 130 },
]

export const liveCasinoProviders = [
  { code: 'PP_LIVE_PRO', name: 'Pragmatic Play Live', count: null, countDisplay: '–' },
]

export function casinoImageUrl(game) {
  if (!game?.image) return null
  if (game.image.startsWith('/api/casino-images/')) return game.image
  const filename = game.image.split('/').pop()
  const directory = game.folder === 'Live Casino' ? 'live-casino' : 'slots'
  return `/api/casino-images/${directory}/${encodeURIComponent(filename)}`
}

export function loadCasinoCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch('/api/casino-games')
      .then((response) => {
        if (!response.ok) throw new Error('Casino catalogue unavailable')
        return response.json()
      })
      .then((catalog) => ({
        slots: Array.isArray(catalog.slots) ? catalog.slots : [],
        live: Array.isArray(catalog.live) ? catalog.live : [],
      }))
      .catch(() => ({ slots: [], live: [] }))
  }
  return catalogPromise
}

export const SOUND_PATHS = Object.freeze({
  balance: '/media/balance.7368a040.mp3', cash: '/media/cash.60edd85f.mp3', countdown: '/media/countdown.dc0b11ea.mp3', dealCard: '/media/deal-card.7844160d.wav', error: '/media/error.37ae9d21.mp3', explosion: '/media/explosion.42327fe8.mp3', flip: '/media/flip.f49581b2.mp3', gem: '/media/gem.48f4ca53.mp3', join: '/media/join.3a378480.mp3', riskSpin: '/media/risk-spin.8490ca69.mp3', roll: '/media/roll.c4142636.mp3', slideStarted: '/media/slide-started.6f3ff8d0.mp3', success: '/media/success.ebf127f7.mp3', tick: '/media/tick.8ab65d5b.mp3', unbox: '/media/unbox.2bbcd64b.mp3', unboxBig: '/media/unbox-big.f3124e2a.mp3', unboxRare: '/media/unbox-rare.71ad0606.mp3', winner: '/media/winner.4fe3f6ee.mp3',
})

const players = new Map()
const lastPlayedAt = new Map()

export function getSoundVolume() {
  const saved = Number(window.localStorage.getItem('rorisk_sound_volume') ?? window.localStorage.getItem('soundVolume') ?? 1)
  return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 1
}

export function setSoundVolume(volume) {
  const next = Math.min(1, Math.max(0, Number(volume) || 0))
  window.localStorage.setItem('rorisk_sound_volume', String(next))
  window.localStorage.setItem('soundVolume', String(next))
  for (const player of players.values()) player.volume = next
}

export function playSound(name, { restart = true, volume = 1, dedupeMs = 0 } = {}) {
  const path = SOUND_PATHS[name]
  const masterVolume = getSoundVolume()
  if (!path || masterVolume <= 0) return null
  let player = players.get(name)
  const now = performance.now()
  if (dedupeMs > 0 && now - (lastPlayedAt.get(name) ?? Number.NEGATIVE_INFINITY) < dedupeMs) return player || null
  lastPlayedAt.set(name, now)
  if (!player) {
    player = new Audio(path)
    player.preload = 'auto'
    players.set(name, player)
  }
  player.volume = Math.min(1, masterVolume * volume)
  if (restart) player.currentTime = 0
  player.play().catch(() => {})
  return player
}

export const SOUND_PATHS = Object.freeze({
  balance: '/assets/audio/balance.7368a040.mp3', cash: '/assets/audio/cash.60edd85f.mp3', countdown: '/assets/audio/countdown.dc0b11ea.mp3', dealCard: '/assets/audio/deal-card.7844160d.wav', error: '/assets/audio/error.37ae9d21.mp3', explosion: '/assets/audio/explosion.42327fe8.mp3', flip: '/assets/audio/flip.f49581b2.mp3', gem: '/assets/audio/gem.48f4ca53.mp3', join: '/assets/audio/join.3a378480.mp3', riskSpin: '/assets/audio/risk-spin.8490ca69.mp3', roll: '/assets/audio/roll.c4142636.mp3', slideStarted: '/assets/audio/slide-started.6f3ff8d0.mp3', success: '/assets/audio/success.ebf127f7.mp3', tick: '/assets/audio/tick.8ab65d5b.mp3', unbox: '/assets/audio/unbox.2bbcd64b.mp3', unboxBig: '/assets/audio/unbox-big.f3124e2a.mp3', unboxRare: '/assets/audio/unbox-rare.71ad0606.mp3', winner: '/assets/audio/winner.4fe3f6ee.mp3',
})

const players = new Map()
const lastPlayedAt = new Map()
const blockedPlayers = new Set()
let unlockListenersInstalled = false

function installUnlockListeners() {
  if (unlockListenersInstalled || typeof window === 'undefined') return
  unlockListenersInstalled = true
  const retryBlocked = () => {
    for (const player of blockedPlayers) {
      player.play().then(() => blockedPlayers.delete(player)).catch(() => {})
    }
  }
  window.addEventListener('pointerdown', retryBlocked, true)
  window.addEventListener('keydown', retryBlocked, true)
}

function soundPlayer(name) {
  const path = SOUND_PATHS[name]
  if (!path) return null
  let player = players.get(name)
  if (!player) {
    player = new Audio(path)
    player.preload = 'auto'
    players.set(name, player)
  }
  return player
}

export function preloadSound(name) {
  const player = soundPlayer(name)
  player?.load()
  return player
}

export function stopSound(name) {
  const player = players.get(name)
  if (!player) return
  blockedPlayers.delete(player)
  player.pause()
  player.currentTime = 0
}

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
  const masterVolume = getSoundVolume()
  if (!SOUND_PATHS[name] || masterVolume <= 0) return null
  installUnlockListeners()
  const player = soundPlayer(name)
  const now = performance.now()
  if (dedupeMs > 0 && now - (lastPlayedAt.get(name) ?? Number.NEGATIVE_INFINITY) < dedupeMs) return player || null
  lastPlayedAt.set(name, now)
  player.volume = Math.min(1, masterVolume * volume)
  if (restart) player.currentTime = 0
  player.play().then(() => blockedPlayers.delete(player)).catch(() => blockedPlayers.add(player))
  return player
}

function randomHex(bytes) {
  const values = new Uint8Array(bytes)
  crypto.getRandomValues(values)
  return [...values].map((value) => value.toString(16).padStart(2, '0')).join('')
}

function userKey(user) {
  return String(user?.uuid || user?.id || 'guest')
}

function storageKey(user) {
  return `rorisk_fair_seed:${userKey(user)}`
}

export function createFairClientSeed() {
  return randomHex(16)
}

export function createFairHash() {
  return randomHex(32)
}

export function getFairSeedState(user) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey(user)) || 'null')
    if (stored?.seed?.seedClient && stored?.seed?.hash && stored?.seedNext?.seedClient && stored?.seedNext?.hash) {
      return {
        seed: { ...stored.seed, nonce: Math.max(0, Number(stored.seed.nonce) || 0) },
        seedNext: stored.seedNext,
      }
    }
  } catch {
    window.localStorage.removeItem(storageKey(user))
  }

  const state = {
    seed: {
      seedClient: window.localStorage.getItem('rorisk_case_client_seed') || createFairClientSeed(),
      hash: createFairHash(),
      nonce: 0,
    },
    seedNext: {
      seedClient: createFairClientSeed(),
      hash: createFairHash(),
    },
  }
  window.localStorage.setItem(storageKey(user), JSON.stringify(state))
  return state
}

export function persistFairSeedState(user, state) {
  window.localStorage.setItem(storageKey(user), JSON.stringify(state))
  window.localStorage.setItem('rorisk_case_client_seed', state.seed.seedClient)
  window.dispatchEvent(new CustomEvent('rorisk:fair-seed-update', { detail: { userId: userKey(user), state } }))
}

export function getFairClientSeed(user) {
  return getFairSeedState(user).seed.seedClient
}

export function incrementFairNonce(user, amount = 1) {
  const current = getFairSeedState(user)
  const next = { ...current, seed: { ...current.seed, nonce: current.seed.nonce + Math.max(0, Number(amount) || 0) } }
  persistFairSeedState(user, next)
  return next
}

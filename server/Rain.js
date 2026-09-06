import { randomUUID } from 'node:crypto'

const CYCLE_MS = 30 * 60 * 1000
const JOIN_WINDOW_MS = 2 * 60 * 1000
const DEFAULT_POOL_AMOUNT = 200

function iso(value) {
  return new Date(value).toISOString()
}

function serverCredentials(env) {
  return {
    key: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '',
    url: String(env.SUPABASE_URL || '').replace(/\/$/, ''),
  }
}

async function databaseRequest(env, path, options = {}) {
  const { key, url } = serverCredentials(env)
  if (!key || !url) throw new Error('Rain persistence is not configured.')
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: key,
      ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(body?.message || body?.hint || 'Rain database request failed.')
  return body
}

function createLocalRain(now = Date.now()) {
  return {
    uuid: randomUUID(),
    status: 'created',
    coin_amount: DEFAULT_POOL_AMOUNT,
    entries: [],
    tips: [],
    starts_at: iso(now + CYCLE_MS - JOIN_WINDOW_MS),
    ends_at: iso(now + CYCLE_MS),
    created_at: iso(now),
    join_ends_at: iso(now + CYCLE_MS),
    updated_at: iso(now),
  }
}

function publicRain(rain) {
  if (!rain) return null
  const entries = Array.isArray(rain.entries) ? rain.entries : []
  return {
    uuid: rain.uuid,
    status: rain.status,
    amount: Number(rain.coin_amount) || 0,
    entries,
    tips: Array.isArray(rain.tips) ? rain.tips : [],
    startsAt: rain.starts_at,
    endsAt: rain.ends_at,
    joinEndsAt: rain.join_ends_at,
    createdAt: rain.created_at,
    updatedAt: rain.updated_at,
    participantsCount: entries.length,
  }
}

export function createRainService(env, { onUpdate, onCompleted } = {}) {
  let current = null
  let persistent = true
  let changing = false

  const emit = () => onUpdate?.(publicRain(current))

  const insertRain = async () => {
    const rain = createLocalRain()
    if (!persistent) return rain
    const rows = await databaseRequest(env, '/rest/v1/rorisk_rains?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(rain),
    })
    return rows?.[0] || rain
  }

  const patchRain = async (uuid, values) => {
    const nextValues = { ...values, updated_at: iso(Date.now()) }
    if (!persistent) return { ...current, ...nextValues }
    const rows = await databaseRequest(env, `/rest/v1/rorisk_rains?uuid=eq.${encodeURIComponent(uuid)}&select=*`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(nextValues),
    })
    return rows?.[0] || current
  }

  const settle = async () => {
    if (!current || current.status === 'completed') return
    if (persistent) {
      const rows = await databaseRequest(env, '/rest/v1/rpc/rorisk_settle_rain', {
        method: 'POST',
        body: JSON.stringify({ p_rain_uuid: current.uuid }),
      })
      current = rows?.[0] || { ...current, status: 'completed', updated_at: iso(Date.now()) }
    } else {
      const entries = Array.isArray(current.entries) ? current.entries : []
      const amount = Number(current.coin_amount) || 0
      const base = entries.length ? Math.floor(amount / entries.length) : 0
      const remainder = entries.length ? amount % entries.length : 0
      current = {
        ...current,
        status: 'completed',
        entries: entries.map((entry, index) => ({ ...entry, payout: base + (index < remainder ? 1 : 0) })),
        updated_at: iso(Date.now()),
      }
    }
    emit()
    onCompleted?.(publicRain(current))
    current = await insertRain()
    emit()
  }

  const tick = async () => {
    if (!current || changing) return
    const now = Date.now()
    const startsAt = new Date(current.starts_at).getTime()
    const endsAt = new Date(current.ends_at).getTime()
    try {
      changing = true
      if (now >= endsAt) await settle()
      else if (now >= startsAt && current.status === 'created') {
        current = await patchRain(current.uuid, { status: 'running' })
        emit()
      }
    } catch (error) {
      console.error('Rain cycle update failed:', error instanceof Error ? error.message : error)
    } finally {
      changing = false
    }
  }

  const initialize = async () => {
    try {
      const rows = await databaseRequest(env, '/rest/v1/rorisk_rains?status=in.(created,running)&order=created_at.desc&limit=1&select=*')
      current = rows?.[0] || await insertRain()
    } catch (error) {
      persistent = false
      current = createLocalRain()
      console.warn('Rain is using in-memory state:', error instanceof Error ? error.message : error)
    }
    emit()
    await tick()
  }

  const join = async (user) => {
    await tick()
    if (!user) throw new Error('Please sign in to perform this action.')
    const now = Date.now()
    const startsAt = new Date(current?.starts_at).getTime()
    const joinEndsAt = new Date(current?.join_ends_at).getTime()
    if (!current || current.status === 'completed' || now < startsAt || now >= joinEndsAt) {
      throw new Error('This rain can no longer be joined.')
    }
    if (current.status !== 'running') {
      current = await patchRain(current.uuid, { status: 'running' })
      emit()
    }
    if (persistent) {
      const rows = await databaseRequest(env, '/rest/v1/rpc/rorisk_join_rain', {
        method: 'POST',
        body: JSON.stringify({ p_rain_uuid: current.uuid, p_user_uuid: user.id }),
      })
      current = rows?.[0] || current
    } else if (!current.entries.some((entry) => entry.uuid === user.id)) {
      current = {
        ...current,
        entries: [...current.entries, {
          uuid: user.id,
          roblox_id: user.robloxId || null,
          username: user.username,
          payout: 0,
          joined_at: iso(Date.now()),
        }],
        updated_at: iso(Date.now()),
      }
    }
    emit()
    return publicRain(current)
  }

  const tip = async (user, amount) => {
    await tick()
    const coinAmount = Math.floor(Number(amount))
    if (!user) throw new Error('Please sign in to perform this action.')
    if (!Number.isSafeInteger(coinAmount) || coinAmount < 100 || coinAmount > 500000) throw new Error('Your entered rain tip amount is invalid.')
    if (Number(user.coins) < coinAmount) throw new Error('You do not have enough Coins.')
    if (!current || current.status === 'completed' || Date.now() >= new Date(current.starts_at).getTime()) throw new Error('This rain can no longer receive tips.')
    if (persistent) {
      const rows = await databaseRequest(env, '/rest/v1/rpc/rorisk_tip_rain', {
        method: 'POST',
        body: JSON.stringify({ p_rain_uuid: current.uuid, p_user_uuid: user.id, p_coin_amount: coinAmount }),
      })
      current = rows?.[0] || current
    } else {
      current = {
        ...current,
        coin_amount: Number(current.coin_amount) + coinAmount,
        tips: [...current.tips, {
          uuid: user.id,
          roblox_id: user.robloxId || null,
          username: user.username,
          coin_amount: coinAmount,
          tipped_at: iso(Date.now()),
        }],
        updated_at: iso(Date.now()),
      }
    }
    emit()
    return publicRain(current)
  }

  void initialize()
  const interval = setInterval(() => { void tick() }, 500)
  interval.unref()

  return {
    getSnapshot: () => publicRain(current),
    join,
    tip,
  }
}

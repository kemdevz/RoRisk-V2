import { randomUUID, timingSafeEqual } from 'node:crypto'
import { WebSocket, WebSocketServer } from 'ws'
import { createRainService } from './Rain.js'

const REALTIME_PATH = '/api/realtime'
const ROOMS = new Set(['en', 'tr', 'es', 'ru', 'de'])
const MAX_MESSAGE_LENGTH = 300
const HISTORY_LIMIT = 50
const SERVER_KEY = Symbol.for('rorisk.realtime.server')

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const separator = part.indexOf('=')
    if (separator < 0) return [part.trim(), '']
    return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())]
  }).filter(([name]) => name))
}

function safeSend(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload))
}

function safeJson(value) {
  try {
    return JSON.parse(String(value))
  } catch {
    return null
  }
}

function normalizeRoom(value) {
  return ROOMS.has(value) ? value : 'en'
}

function publicUser(user) {
  if (!user) return null
  const id = user.uuid || user.id || null
  const robloxId = user.roblox_id || user.robloxId || null
  const avatar = user.avatar_headshot || user.avatar || '/default-avatar.png'
  const joinedAt = user.joined_at || user.joinedAt || null
  return {
    uuid: id,
    id,
    roblox_id: robloxId,
    robloxId,
    username: String(user.username || 'Guest').slice(0, 24),
    avatar_headshot: avatar,
    avatar,
    coins: Math.max(0, Number(user.coins) || 0),
    rocoins: Math.max(0, Number(user.rocoins) || 0),
    level: Math.min(100, Math.max(0, Number(user.level) || 0)),
    rank: String(user.rank || 'user').toLowerCase(),
    email: user.email || null,
    joined_at: joinedAt,
    joinedAt,
  }
}

function chatUser(user) {
  const profile = publicUser(user)
  if (!profile) return null
  return {
    uuid: profile.uuid,
    id: profile.id,
    roblox_id: profile.roblox_id,
    robloxId: profile.robloxId,
    username: profile.username,
    avatar_headshot: profile.avatar_headshot,
    avatar: profile.avatar,
    level: profile.level,
    rank: profile.rank,
  }
}

function serverCredentials(env) {
  return {
    key: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '',
    url: String(env.SUPABASE_URL || '').replace(/\/$/, ''),
  }
}

async function fetchProfiles(env, userIds) {
  const { key, url } = serverCredentials(env)
  if (!key || !url || userIds.length === 0) return []
  const ids = userIds.map((id) => String(id)).join(',')
  const path = `/rest/v1/rorisk_users?uuid=in.(${ids})&select=uuid,roblox_id,username,avatar_headshot,coins,rocoins,rank,level,email,joined_at`
  const response = await fetch(`${url}${path}`, {
    headers: {
      apikey: key,
      ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
    },
  })
  if (!response.ok) throw new Error('Unable to synchronize user profiles.')
  return response.json()
}

export function createRealtimeSession(user, signValue) {
  const payload = Buffer.from(JSON.stringify({
    user: publicUser(user),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  })).toString('base64url')
  return `${payload}.${signValue(payload)}`
}

export function readRealtimeSession(token, signValue) {
  if (typeof signValue !== 'function') return null
  const [payload, signature] = String(token || '').split('.')
  if (!payload || !signature) return null
  const expected = Buffer.from(signValue(payload))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
  const session = safeJson(Buffer.from(payload, 'base64url').toString('utf8'))
  if (!session?.user || Date.now() >= Number(session.expiresAt)) return null
  return publicUser(session.user)
}

export function setRealtimeSessionCookie(response, token, secure = false) {
  response.setHeader('Set-Cookie', `rorisk_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure ? '; Secure' : ''}`)
}

export function clearRealtimeSessionCookie(response, secure = false) {
  response.setHeader('Set-Cookie', `rorisk_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`)
}

export function attachRealtimeServer(httpServer, signValue, env = {}) {
  if (!httpServer || httpServer[SERVER_KEY]) return httpServer?.[SERVER_KEY]

  const socketServer = new WebSocketServer({ noServer: true })
  const clients = new Set()
  const history = Object.fromEntries([...ROOMS].map((room) => [room, []]))

  const presence = () => {
    const counts = Object.fromEntries([...ROOMS].map((room) => [room, new Set()]))
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) counts[client.room].add(client.sessionId)
    }
    return Object.fromEntries([...ROOMS].map((room) => [room, counts[room].size]))
  }

  const broadcast = (payload, room = null) => {
    for (const client of clients) {
      if (!room || client.room === room) safeSend(client, payload)
    }
  }

  const broadcastPresence = () => broadcast({ type: 'presence', counts: presence() })

  const pushRoomMessage = (message, room) => {
    const roomMessage = { ...message, room }
    history[room].push(roomMessage)
    if (history[room].length > HISTORY_LIMIT) history[room].shift()
    broadcast({ type: 'message', message: roomMessage }, room)
  }

  let profileSyncRunning = false
  const syncConnectedProfiles = async () => {
    if (profileSyncRunning) return
    const userIds = [...new Set([...clients].map((client) => client.user?.id).filter(Boolean))]
    if (userIds.length === 0) return
    profileSyncRunning = true
    try {
      const rows = await fetchProfiles(env, userIds)
      const profiles = new Map(rows.map((row) => [row.uuid, publicUser(row)]))
      const changedProfiles = new Map()
      for (const socket of clients) {
        const profile = profiles.get(socket.user?.id)
        if (!profile || JSON.stringify(profile) === JSON.stringify(socket.user)) continue
        socket.user = profile
        safeSend(socket, { type: 'userUpdate', user: profile })
        changedProfiles.set(profile.id, chatUser(profile))
      }
      for (const profile of changedProfiles.values()) {
        for (const room of ROOMS) {
          history[room] = history[room].map((message) => {
            const messageUserId = message.user?.uuid || message.user?.id
            return messageUserId === profile.id ? { ...message, user: { ...message.user, ...profile } } : message
          })
        }
        broadcast({ type: 'userPublicUpdate', user: profile })
      }
    } catch {
      // Keep the signed session usable if profile synchronization is temporarily unavailable.
    } finally {
      profileSyncRunning = false
    }
  }

  const rainService = createRainService(env, {
    onUpdate(rain) {
      broadcast({ type: 'rain', rain, serverTime: Date.now() })
    },
    onCompleted(rain) {
      for (const socket of clients) {
        const payout = rain.entries.find((entry) => entry.uuid === socket.user?.id)?.payout
        if (Number.isFinite(Number(payout)) && Number(payout) > 0) {
          safeSend(socket, { type: 'rainPayout', amount: Number(payout), rainUuid: rain.uuid })
        }
      }
      for (const room of ROOMS) {
        pushRoomMessage({
          id: randomUUID(),
          type: 'rainCompleted',
          claimedCount: rain.participantsCount,
          rain: { amount: rain.amount },
          createdAt: Date.now(),
        }, room)
      }
      void syncConnectedProfiles()
    },
  })

  socketServer.on('connection', (socket, request) => {
    const cookies = parseCookies(request.headers.cookie)
    socket.user = readRealtimeSession(cookies.rorisk_session, signValue)
    socket.room = 'en'
    socket.sessionId = randomUUID()
    socket.isAlive = true
    clients.add(socket)

    socket.on('pong', () => { socket.isAlive = true })
    socket.on('message', (raw) => {
      const event = safeJson(raw)
      if (!event || typeof event.type !== 'string') return

      if (event.type === 'hello' || event.type === 'join') {
        socket.room = normalizeRoom(event.room)
        if (event.type === 'hello' && /^[A-Za-z0-9_-]{8,80}$/.test(String(event.sessionId || ''))) {
          socket.sessionId = String(event.sessionId)
        }
        safeSend(socket, { type: 'history', room: socket.room, messages: history[socket.room] })
        safeSend(socket, { type: 'rain', rain: rainService.getSnapshot(), serverTime: Date.now() })
        broadcastPresence()
        return
      }

      if (event.type === 'rainJoin') {
        rainService.join(socket.user).then((rain) => {
          safeSend(socket, { type: 'rainJoined', rain })
        }).catch((error) => {
          safeSend(socket, { type: 'error', message: error instanceof Error ? error.message : 'Unable to join the rain.' })
        })
        return
      }

      if (event.type === 'rainTip') {
        rainService.tip(socket.user, event.amount).then((rain) => {
          safeSend(socket, { type: 'rainTipped', rain })
          for (const room of ROOMS) {
            pushRoomMessage({
              id: randomUUID(),
              type: 'rainTip',
              transaction: { user: chatUser(socket.user), amount: Math.floor(Number(event.amount)) },
              createdAt: Date.now(),
            }, room)
          }
          void syncConnectedProfiles()
        }).catch((error) => {
          safeSend(socket, { type: 'error', message: error instanceof Error ? error.message : 'Unable to tip the rain.' })
        })
        return
      }

      if (event.type === 'message') {
        if (!socket.user) {
          safeSend(socket, { type: 'error', message: 'Please sign in to perform this action.' })
          return
        }
        const text = String(event.text || '').trim()
        if (text.length < 2 || text.length > MAX_MESSAGE_LENGTH) {
          safeSend(socket, { type: 'error', message: text.length < 2 ? 'Your message must be at least 2 characters long.' : `Your message cannot exceed ${MAX_MESSAGE_LENGTH} characters.` })
          return
        }
        const containsLink = /https?:\/\/\S+|www\.\S+/i.test(text)
        const allowedStreamLink = /^(https?:\/\/)?(www\.)?(twitch\.tv|kick\.com)\/\S+$/i.test(text)
        if (containsLink && !allowedStreamLink) {
          safeSend(socket, { type: 'error', message: 'Only Twitch and Kick links are allowed in chat.' })
          return
        }
        const message = {
          id: randomUUID(),
          room: socket.room,
          text,
          createdAt: Date.now(),
          user: chatUser(socket.user),
        }
        history[socket.room].push(message)
        if (history[socket.room].length > HISTORY_LIMIT) history[socket.room].shift()
        broadcast({ type: 'message', message }, socket.room)
      }
    })

    socket.on('close', () => {
      clients.delete(socket)
      broadcastPresence()
    })

    safeSend(socket, { type: 'ready', authenticated: Boolean(socket.user) })
    void syncConnectedProfiles()
    broadcastPresence()
  })

  httpServer.on('upgrade', (request, networkSocket, head) => {
    const url = new URL(request.url, 'http://localhost')
    if (url.pathname !== REALTIME_PATH) return
    socketServer.handleUpgrade(request, networkSocket, head, (socket) => socketServer.emit('connection', socket, request))
  })

  const heartbeat = setInterval(() => {
    for (const socket of clients) {
      if (!socket.isAlive) {
        socket.terminate()
        continue
      }
      socket.isAlive = false
      socket.ping()
    }
  }, 25000)
  heartbeat.unref()

  const profileSync = setInterval(() => { void syncConnectedProfiles() }, 1000)
  profileSync.unref()

  httpServer[SERVER_KEY] = socketServer
  return socketServer
}

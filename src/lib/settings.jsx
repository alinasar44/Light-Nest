import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { DEFAULT_BROKER, DEFAULT_HOME_ID, configTopic } from '../config.js'
import { useAuth } from './auth.jsx'
import { buildBrokerUrl, mqtt } from './mqtt.js'
import { newId } from './rooms.js'

const STORAGE_KEY = 'lightnest.broker'
const CLIENT_ID_KEY = 'lightnest.clientId'
// Connection fields are per device: set by the admin in Settings, by a user on the Connection page.
export const CONNECTION_FIELDS = ['host', 'port', 'path', 'username', 'password', 'homeId']
const isRealVersion = (v) => v > 1e12 // a Date.now() timestamp, not a placeholder

export const DEFAULT_ROOMS = [
  { id: 'living', name: 'Living Room', icon: 'sofa' },
  { id: 'bed', name: 'Bed Room', icon: 'bed' },
]

export const DEFAULT_SETTINGS = {
  ...DEFAULT_BROKER,
  homeId: DEFAULT_HOME_ID,
  rooms: DEFAULT_ROOMS,
  switches: [
    { id: 'lr1', room: 'living', name: 'Living Light', topic: 'home/livingroom/light1', on: 'ON', off: 'OFF' },
    { id: 'br1', room: 'bed', name: 'Bed Light 1', topic: 'home/bedroom/light1', on: 'ON', off: 'OFF' },
    { id: 'br2', room: 'bed', name: 'Bed Light 2', topic: 'home/bedroom/light2', on: 'ON', off: 'OFF' },
  ],
  // When the admin last changed rooms / devices. The newest version wins on every device.
  // 0 = nothing yet (built-in defaults), 1 = real local setup saved before syncing existed.
  configUpdatedAt: 0,
}

// Each device keeps its own client id: two devices sharing one would keep kicking each other off the broker.
function deviceClientId() {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      id = 'lightnest-' + Math.random().toString(36).slice(2, 10)
      localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return 'lightnest-' + Math.random().toString(36).slice(2, 10)
  }
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function store(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch { /* ignore */ }
}

// Older saves had no rooms list or an empty broker; keep what they have and fill the rest in.
function normalize(stored) {
  const hasRooms = Array.isArray(stored.rooms)
  const merged = {
    ...DEFAULT_SETTINGS,
    ...stored,
    rooms: hasRooms ? stored.rooms : DEFAULT_ROOMS,
    switches: Array.isArray(stored.switches) && (hasRooms || stored.switches.length) ? stored.switches : DEFAULT_SETTINGS.switches,
  }
  if (!(merged.host || '').trim()) Object.assign(merged, DEFAULT_BROKER)
  if (!(merged.homeId || '').trim()) merged.homeId = DEFAULT_HOME_ID
  if (stored.configUpdatedAt === undefined) merged.configUpdatedAt = 1
  delete merged.clientId
  return merged
}

function cleanSwitch(s) {
  return {
    ...s,
    name: (s.name || '').trim(),
    topic: (s.topic || '').trim(),
    stateTopic: (s.stateTopic || '').trim(),
    on: (s.on || 'ON').trim(),
    off: (s.off || 'OFF').trim(),
  }
}

function brokerUrl(s) {
  return buildBrokerUrl(s.host, s.port, s.path)
}

function connectTo(s, clientId) {
  const url = brokerUrl(s)
  if (url) mqtt.connect({ ...s, clientId, url })
  else mqtt.disconnect()
}

// Only rooms and devices are shared. Broker login details never go out over the broker.
function configMessage(s) {
  return JSON.stringify({ v: 1, updatedAt: s.configUpdatedAt, rooms: s.rooms, switches: s.switches })
}

function cleanConnection(c) {
  return {
    host: (c.host || '').trim(),
    port: (c.port || '').trim(),
    path: (c.path || '').trim(),
    username: (c.username || '').trim(),
    password: c.password || '',
    homeId: (c.homeId || '').trim() || DEFAULT_HOME_ID,
  }
}

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const { isAdmin } = useAuth()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [clientId] = useState(deviceClientId)
  const current = useRef(settings)
  const remoteUpdatedAt = useRef(0) // newest config version seen on the broker
  const adminRef = useRef(isAdmin)
  adminRef.current = isAdmin

  const publishConfig = useCallback(() => {
    let s = current.current
    // A setup from before syncing has no real version yet; stamp it so other devices accept it.
    if (!isRealVersion(s.configUpdatedAt)) {
      s = { ...s, configUpdatedAt: Date.now() }
      current.current = s
      setSettings(s)
      store(s)
    }
    if (mqtt.publish(configTopic(s.homeId), configMessage(s), { retain: true })) {
      remoteUpdatedAt.current = Math.max(remoteUpdatedAt.current, s.configUpdatedAt)
    }
  }, [])

  // Local write. Admin changes get a new version and go out to every device.
  const commit = useCallback(
    (next, { share = true } = {}) => {
      if (share && adminRef.current) next = { ...next, configUpdatedAt: Date.now() }
      current.current = next
      setSettings(next)
      store(next)
      if (share && adminRef.current) publishConfig()
    },
    [publishConfig],
  )

  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {})
    const stored = loadStored()
    const initial = stored ? normalize(stored) : DEFAULT_SETTINGS
    current.current = initial
    setSettings(initial)
    setLoading(false)

    // After (re)connecting, the admin pushes anything changed while offline once the retained copy had time to arrive.
    let pushTimer = null
    const offStatus = mqtt.onStatusChange(() => {
      clearTimeout(pushTimer)
      if (mqtt.status !== 'connected') return
      pushTimer = setTimeout(() => {
        if (adminRef.current && current.current.configUpdatedAt > remoteUpdatedAt.current) publishConfig()
      }, 4000)
    })

    connectTo(initial, clientId)
    return () => {
      offStatus()
      clearTimeout(pushTimer)
      mqtt.disconnect() // logged out
    }
  }, [clientId, commit, publishConfig])

  // Config coming from the admin, retained on lightnest/<homeId>/config so it also arrives right after connecting.
  const homeId = settings.homeId
  useEffect(() => {
    if (loading) return
    remoteUpdatedAt.current = 0
    return mqtt.onMessage(configTopic(homeId), (_topic, message) => {
      let data
      try {
        data = JSON.parse(message)
      } catch {
        return
      }
      if (!data || data.v !== 1 || !Array.isArray(data.rooms) || !Array.isArray(data.switches)) return
      const version = Number(data.updatedAt) || 0
      remoteUpdatedAt.current = Math.max(remoteUpdatedAt.current, version)
      const local = current.current
      if (version <= local.configUpdatedAt) return
      commit({ ...local, rooms: data.rooms, switches: data.switches.map(cleanSwitch), configUpdatedAt: version }, { share: false })
    })
  }, [homeId, loading, commit])

  // Full save from the Settings page (admin): stores everything, reconnects, shares rooms / devices.
  const save = useCallback(
    async (draft) => {
      const prev = current.current
      const conn = cleanConnection(draft)
      const moved = CONNECTION_FIELDS.some((k) => conn[k] !== prev[k])
      const next = {
        ...prev,
        ...conn,
        rooms: draft.rooms.map((r) => ({ ...r, name: (r.name || '').trim() || 'Room' })),
        switches: draft.switches.map(cleanSwitch),
      }
      commit(next, { share: !moved })
      // On a new broker / home the push after connecting publishes it there.
      if (moved) {
        current.current = { ...current.current, configUpdatedAt: Date.now() }
        store(current.current)
        remoteUpdatedAt.current = 0
      }
      connectTo(current.current, clientId)
    },
    [commit, clientId],
  )

  // Connection only (any account): broker + home. Rooms / devices then come from the admin.
  const saveConnection = useCallback(
    (fields) => {
      const prev = current.current
      const conn = cleanConnection({ ...prev, ...fields })
      const newHome = conn.homeId !== prev.homeId
      // A user joining another home takes that home's rooms, whatever their version.
      const next = { ...prev, ...conn, configUpdatedAt: newHome && !adminRef.current ? 0 : prev.configUpdatedAt }
      commit(next, { share: false })
      remoteUpdatedAt.current = 0
      connectTo(next, clientId)
    },
    [commit, clientId],
  )

  const update = useCallback((fn) => commit(fn(current.current)), [commit])

  const actions = {
    addRoom: (room) => {
      const id = newId('room')
      update((s) => ({ ...s, rooms: [...s.rooms, { id, name: room.name.trim() || 'Room', icon: room.icon || 'house' }] }))
      return id
    },
    updateRoom: (id, patch) =>
      update((s) => ({ ...s, rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...patch, name: (patch.name ?? r.name).trim() || 'Room' } : r)) })),
    deleteRoom: (id) =>
      update((s) => ({ ...s, rooms: s.rooms.filter((r) => r.id !== id), switches: s.switches.filter((sw) => sw.room !== id) })),
    addSwitch: (roomId, sw) =>
      update((s) => ({ ...s, switches: [...s.switches, cleanSwitch({ ...sw, id: newId('sw'), room: roomId })] })),
    updateSwitch: (id, patch) =>
      update((s) => ({ ...s, switches: s.switches.map((sw) => (sw.id === id ? cleanSwitch({ ...sw, ...patch }) : sw)) })),
    deleteSwitch: (id) => update((s) => ({ ...s, switches: s.switches.filter((sw) => sw.id !== id) })),
  }

  // Only the admin may change anything; for a user these are no-ops even if called.
  const guarded = isAdmin
    ? { save, ...actions }
    : Object.fromEntries(['save', ...Object.keys(actions)].map((k) => [k, () => {}]))

  const reconnect = useCallback(() => connectTo(current.current, clientId), [clientId])

  return (
    <SettingsContext.Provider value={{ settings, loading, clientId, reconnect, saveConnection, ...guarded }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}

export function useMqttStatus() {
  const [status, setStatus] = useState(mqtt.status)
  const [lastError, setLastError] = useState(mqtt.lastError)
  useEffect(() => {
    const update = () => {
      setStatus(mqtt.status)
      setLastError(mqtt.lastError)
    }
    update()
    return mqtt.onStatusChange(update)
  }, [])
  return { status, lastError }
}

// Live payload for each topic, keyed by topic.
export function useTopicPayloads(topics) {
  const key = [...new Set(topics.filter(Boolean))].sort().join('\n')
  const [payloads, setPayloads] = useState({})
  useEffect(() => {
    const list = key ? key.split('\n') : []
    setPayloads(Object.fromEntries(list.map((t) => [t, mqtt.getLast(t)])))
    const offs = list.map((t) => mqtt.onMessage(t, (_topic, message) => setPayloads((p) => ({ ...p, [t]: message }))))
    return () => offs.forEach((off) => off())
  }, [key])
  return payloads
}

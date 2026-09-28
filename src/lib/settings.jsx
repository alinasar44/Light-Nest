import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CONFIG_TOPIC, DEFAULT_BROKER } from '../config.js'
import { useAuth } from './auth.jsx'
import { buildBrokerUrl, mqtt } from './mqtt.js'
import { newId } from './rooms.js'

const STORAGE_KEY = 'lightnest.broker'
const CLIENT_ID_KEY = 'lightnest.clientId'
const BROKER_FIELDS = ['host', 'port', 'path', 'username', 'password']

export const DEFAULT_ROOMS = [
  { id: 'living', name: 'Living Room', icon: 'sofa' },
  { id: 'bed', name: 'Bed Room', icon: 'bed' },
]

export const DEFAULT_SETTINGS = {
  ...DEFAULT_BROKER,
  rooms: DEFAULT_ROOMS,
  switches: [
    { id: 'lr1', room: 'living', name: 'Living Light', topic: 'home/livingroom/light1', on: 'ON', off: 'OFF' },
    { id: 'br1', room: 'bed', name: 'Bed Light 1', topic: 'home/bedroom/light1', on: 'ON', off: 'OFF' },
    { id: 'br2', room: 'bed', name: 'Bed Light 2', topic: 'home/bedroom/light2', on: 'ON', off: 'OFF' },
  ],
  // When the admin last changed rooms / devices / broker. The newest version wins on every device.
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
  delete merged.clientId
  return merged
}

function cleanSwitch(s) {
  return {
    ...s,
    name: (s.name || '').trim(),
    topic: (s.topic || '').trim(),
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

function configMessage(s) {
  const broker = Object.fromEntries(BROKER_FIELDS.map((k) => [k, s[k] || '']))
  return JSON.stringify({ v: 1, updatedAt: s.configUpdatedAt, rooms: s.rooms, switches: s.switches, broker })
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
    const s = current.current
    if (mqtt.publish(CONFIG_TOPIC, configMessage(s), { retain: true })) {
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

    // Config coming from the admin (retained on the broker, so it also arrives right after connecting).
    const offConfig = mqtt.onMessage(CONFIG_TOPIC, (_topic, message) => {
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

      const broker = Object.fromEntries(BROKER_FIELDS.map((k) => [k, String(data.broker?.[k] ?? local[k] ?? '')]))
      const next = { ...local, ...broker, rooms: data.rooms, switches: data.switches.map(cleanSwitch), configUpdatedAt: version }
      const moved = brokerUrl(next) !== brokerUrl(local) || next.username !== local.username || next.password !== local.password
      commit(next, { share: false })
      if (moved) connectTo(next, clientId)
    })

    // After (re)connecting, the admin pushes anything changed while offline once the retained copy had time to arrive.
    let pushTimer = null
    const offStatus = mqtt.onStatusChange(() => {
      clearTimeout(pushTimer)
      if (mqtt.status !== 'connected') return
      pushTimer = setTimeout(() => {
        if (adminRef.current && current.current.configUpdatedAt > remoteUpdatedAt.current) publishConfig()
      }, 2500)
    })

    connectTo(initial, clientId)
    return () => {
      offConfig()
      offStatus()
      clearTimeout(pushTimer)
      mqtt.disconnect() // logged out
    }
  }, [clientId, commit, publishConfig])

  // Full save from the Settings page: stores everything, shares it, then (re)connects to the broker.
  const save = useCallback(
    async (draft) => {
      const prev = current.current
      const next = {
        ...prev,
        host: (draft.host || '').trim(),
        port: (draft.port || '').trim(),
        path: (draft.path || '').trim(),
        username: (draft.username || '').trim(),
        password: draft.password || '',
        rooms: draft.rooms.map((r) => ({ ...r, name: (r.name || '').trim() || 'Room' })),
        switches: draft.switches.map(cleanSwitch),
      }
      // Published on the current broker first, so devices still on it learn about a broker change.
      commit(next)
      connectTo(current.current, clientId)
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
    <SettingsContext.Provider value={{ settings, loading, clientId, reconnect, ...guarded }}>{children}</SettingsContext.Provider>
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

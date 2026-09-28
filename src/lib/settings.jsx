import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { buildBrokerUrl, mqtt } from './mqtt.js'
import { newId } from './rooms.js'

const STORAGE_KEY = 'lightnest.broker'

export const DEFAULT_ROOMS = [
  { id: 'living', name: 'Living Room', icon: 'sofa' },
  { id: 'bed', name: 'Bed Room', icon: 'bed' },
]

export const DEFAULT_SETTINGS = {
  host: '',
  port: '8884',
  path: '',
  username: '',
  password: '',
  clientId: 'lightnest-' + Math.random().toString(36).slice(2, 8),
  rooms: DEFAULT_ROOMS,
  switches: [
    { id: 'lr1', room: 'living', name: 'Living Light', topic: 'home/livingroom/light1', on: 'ON', off: 'OFF' },
    { id: 'br1', room: 'bed', name: 'Bed Light 1', topic: 'home/bedroom/light1', on: 'ON', off: 'OFF' },
    { id: 'br2', room: 'bed', name: 'Bed Light 2', topic: 'home/bedroom/light2', on: 'ON', off: 'OFF' },
  ],
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

// Older saves had no rooms list; keep their switches and give them the two original rooms.
function normalize(stored) {
  const hasRooms = Array.isArray(stored.rooms)
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    rooms: hasRooms ? stored.rooms : DEFAULT_ROOMS,
    switches: Array.isArray(stored.switches) && (hasRooms || stored.switches.length) ? stored.switches : DEFAULT_SETTINGS.switches,
  }
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

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const current = useRef(settings)

  const commit = useCallback((next) => {
    current.current = next
    setSettings(next)
    store(next)
  }, [])

  useEffect(() => {
    // Ask the browser to never evict this site's storage on its own (low disk space, inactivity).
    navigator.storage?.persist?.().catch(() => {})
    const stored = loadStored()
    if (stored) {
      const merged = normalize(stored)
      current.current = merged
      setSettings(merged)
      const url = buildBrokerUrl(merged.host, merged.port, merged.path)
      if (url) mqtt.connect({ ...merged, url })
    }
    setLoading(false)
  }, [])

  // Full save from the Settings page: stores everything and (re)connects to the broker.
  const save = useCallback(
    async (draft) => {
      const next = {
        host: (draft.host || '').trim(),
        port: (draft.port || '').trim(),
        path: (draft.path || '').trim(),
        username: (draft.username || '').trim(),
        password: draft.password || '',
        clientId: (draft.clientId || '').trim() || DEFAULT_SETTINGS.clientId,
        rooms: draft.rooms.map((r) => ({ ...r, name: (r.name || '').trim() || 'Room' })),
        switches: draft.switches.map(cleanSwitch),
      }
      commit(next)
      const url = buildBrokerUrl(next.host, next.port, next.path)
      if (url) mqtt.connect({ ...next, url })
      else mqtt.disconnect()
    },
    [commit],
  )

  // Room / device edits: stored right away, no reconnect needed.
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

  const reconnect = useCallback(() => {
    const s = current.current
    const url = buildBrokerUrl(s.host, s.port, s.path)
    if (url) mqtt.connect({ ...s, url })
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, loading, save, reconnect, ...actions }}>{children}</SettingsContext.Provider>
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

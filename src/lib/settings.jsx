import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { buildBrokerUrl, mqtt } from './mqtt.js'

const STORAGE_KEY = 'lightnest.broker'

export const DEFAULT_SETTINGS = {
  host: '',
  port: '8884',
  path: '',
  username: '',
  password: '',
  clientId: 'lightnest-' + Math.random().toString(36).slice(2, 8),
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

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Ask the browser to never evict this site's storage on its own (low disk space, inactivity).
    navigator.storage?.persist?.().catch(() => {})
    const stored = loadStored()
    if (stored) {
      const merged = {
        ...DEFAULT_SETTINGS,
        ...stored,
        switches: Array.isArray(stored.switches) && stored.switches.length ? stored.switches : DEFAULT_SETTINGS.switches,
      }
      setSettings(merged)
      const url = buildBrokerUrl(merged.host, merged.port, merged.path)
      if (url) mqtt.connect({ ...merged, url })
    }
    setLoading(false)
  }, [])

  const save = useCallback(async (draft) => {
    const next = {
      host: (draft.host || '').trim(),
      port: (draft.port || '').trim(),
      path: (draft.path || '').trim(),
      username: (draft.username || '').trim(),
      password: draft.password || '',
      clientId: (draft.clientId || '').trim() || DEFAULT_SETTINGS.clientId,
      switches: draft.switches.map((s) => ({
        ...s,
        name: (s.name || '').trim(),
        topic: (s.topic || '').trim(),
        on: (s.on || 'ON').trim(),
        off: (s.off || 'OFF').trim(),
      })),
    }
    setSettings(next)
    store(next)
    const url = buildBrokerUrl(next.host, next.port, next.path)
    if (url) mqtt.connect({ ...next, url })
    else mqtt.disconnect()
  }, [])

  const reconnect = useCallback(() => {
    const url = buildBrokerUrl(settings.host, settings.port, settings.path)
    if (url) mqtt.connect({ ...settings, url })
  }, [settings])

  return (
    <SettingsContext.Provider value={{ settings, loading, save, reconnect }}>{children}</SettingsContext.Provider>
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

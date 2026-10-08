// Device presence. The boards publish no heartbeat or last will, so the app asks them: it re-sends a relay's
// current state (which changes nothing) and a live board answers by publishing its state again.

import { useEffect, useState } from 'react'
import { mqtt } from './mqtt.js'
import { stateTopicOf } from './rooms.js'

const PROBE_INTERVAL_MS = 15000
const ANSWER_TIMEOUT_MS = 5000
// A probe sent just after someone's tap could carry the old state and undo it; wait for the board's answer instead.
const QUIET_AFTER_COMMAND_MS = 3000

const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()

// Switches on the same board share everything before /control/.
export function deviceKey(sw) {
  const topic = (sw?.topic || '').trim()
  const i = topic.indexOf('/control/')
  return i > 0 ? topic.slice(0, i) : topic
}

class DeviceWatcher {
  constructor() {
    this.devices = new Map() // key -> { key, switches, online: true | false | null (not known yet), seenAt, waitTimer }
    this.listeners = new Set()
    this.offs = []
    this.timer = null
    this.startTimer = null
    this._onVisible = () => {
      if (!document.hidden) this._tick()
    }
  }

  onChange(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  isOnline(key) {
    return this.devices.get(key)?.online ?? null
  }

  watch(switches) {
    const previous = this.devices
    this.stop()
    this.devices = new Map()
    for (const sw of switches) {
      const key = deviceKey(sw)
      if (!key) continue
      if (!this.devices.has(key)) {
        const old = previous.get(key)
        this.devices.set(key, { key, switches: [], online: old?.online ?? null, seenAt: old?.seenAt || 0, waitTimer: null })
      }
      this.devices.get(key).switches.push(sw)
      const stateTopic = stateTopicOf(sw)
      if (stateTopic) this.offs.push(mqtt.onMessage(stateTopic, () => this._heard(key, stateTopic)))
      // Subscribed only so commands from other phones are seen before probing.
      this.offs.push(mqtt.onMessage(sw.topic, () => {}))
    }
    this.offs.push(mqtt.onStatusChange(() => this._onMqttStatus()))
    this.timer = setInterval(() => this._tick(), PROBE_INTERVAL_MS)
    document.addEventListener('visibilitychange', this._onVisible)
    this._onMqttStatus()
  }

  stop() {
    this.offs.forEach((off) => off())
    this.offs = []
    clearInterval(this.timer)
    clearTimeout(this.startTimer)
    document.removeEventListener('visibilitychange', this._onVisible)
    for (const dev of this.devices.values()) clearTimeout(dev.waitTimer)
  }

  _onMqttStatus() {
    clearTimeout(this.startTimer)
    for (const dev of this.devices.values()) {
      clearTimeout(dev.waitTimer)
      dev.waitTimer = null
      dev.seenAt = 0
    }
    // Give the retained states a moment to arrive: a probe needs to know the current state.
    if (mqtt.status === 'connected') this.startTimer = setTimeout(() => this._tick(), 2000)
  }

  _heard(key, topic) {
    const dev = this.devices.get(key)
    if (!dev || !mqtt.getLastAt(topic)) return // retained copies come from the broker, not from the board
    dev.seenAt = Date.now()
    clearTimeout(dev.waitTimer)
    dev.waitTimer = null
    this._set(dev, true)
  }

  _set(dev, online) {
    if (dev.online === online) return
    const was = dev.online
    dev.online = online
    const event = { key: dev.key, online, was, names: dev.switches.map((sw) => sw.name || 'Light') }
    this.listeners.forEach((fn) => {
      try { fn(event) } catch { /* ignore */ }
    })
  }

  _tick() {
    if (mqtt.status !== 'connected') return
    for (const dev of this.devices.values()) {
      if (dev.waitTimer || Date.now() - dev.seenAt < PROBE_INTERVAL_MS - 1000) continue
      // One lost message should not flag a working board; a board already offline needs no second try.
      this._probe(dev, dev.online === false ? 1 : 2)
    }
  }

  _probe(dev, triesLeft) {
    const now = Date.now()
    if (dev.switches.some((sw) => now - mqtt.getLastAt(sw.topic) < QUIET_AFTER_COMMAND_MS)) return
    for (const sw of dev.switches) {
      const stateTopic = stateTopicOf(sw)
      const state = stateTopic ? mqtt.getLast(stateTopic) : null
      const payload = same(state, sw.on) ? sw.on : same(state, sw.off) ? sw.off : null
      if (payload == null) continue
      if (!mqtt.publish(sw.topic, payload, { echo: false })) return
      dev.waitTimer = setTimeout(() => {
        dev.waitTimer = null
        if (mqtt.status !== 'connected') return
        if (triesLeft > 1) this._probe(dev, triesLeft - 1)
        else this._set(dev, false)
      }, ANSWER_TIMEOUT_MS)
      return
    }
  }
}

export const devices = new DeviceWatcher()

// true / false, or null while it is not known yet (no answer asked for, or no state topic to ask on).
export function useDeviceOnline(sw) {
  const key = deviceKey(sw)
  const [online, setOnline] = useState(() => devices.isOnline(key))
  useEffect(() => {
    const update = () => setOnline(devices.isOnline(key))
    update()
    return devices.onChange(update)
  }, [key])
  return online
}

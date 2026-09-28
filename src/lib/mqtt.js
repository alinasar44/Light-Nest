// Minimal MQTT 3.1.1 client over WebSocket (CONNECT / SUBSCRIBE / PUBLISH / PING).

const MAX_RETRY_MS = 15000
const CONNECT_TIMEOUT_MS = 15000
const STATES_KEY = 'lightnest.states'

// Last payload seen per topic, kept across reloads so each light shows its last known state.
function loadStates() {
  try {
    const raw = localStorage.getItem(STATES_KEY)
    return new Map(raw ? Object.entries(JSON.parse(raw)) : [])
  } catch {
    return new Map()
  }
}

function saveStates(map) {
  try {
    localStorage.setItem(STATES_KEY, JSON.stringify(Object.fromEntries(map)))
  } catch { /* ignore */ }
}

function encodeLength(n) {
  const out = []
  do {
    let byte = n % 128
    n = Math.floor(n / 128)
    if (n > 0) byte |= 128
    out.push(byte)
  } while (n > 0)
  return out
}

function encodeString(s) {
  const bytes = Array.from(new TextEncoder().encode(String(s)))
  return [(bytes.length >> 8) & 255, bytes.length & 255, ...bytes]
}

function packet(type, body) {
  return new Uint8Array([type, ...encodeLength(body.length), ...body])
}

function connectPacket({ clientId, username, password, keepAlive = 60 }) {
  let flags = 2 // clean session
  if (username) flags |= 128
  if (password) flags |= 64
  const header = [...encodeString('MQTT'), 4, flags, (keepAlive >> 8) & 255, keepAlive & 255]
  const payload = [...encodeString(clientId)]
  if (username) payload.push(...encodeString(username))
  if (password) payload.push(...encodeString(password))
  return packet(16, [...header, ...payload])
}

function subscribePacket(id, topic) {
  return packet(130, [(id >> 8) & 255, id & 255, ...encodeString(topic), 0])
}

function publishPacket(topic, message) {
  const bytes = Array.from(new TextEncoder().encode(String(message)))
  return packet(48, [...encodeString(topic), ...bytes])
}

function pubackPacket(id) {
  return new Uint8Array([64, 2, (id >> 8) & 255, id & 255])
}

export function topicMatches(filter, topic) {
  if (filter === topic) return true
  const f = filter.split('/')
  const t = topic.split('/')
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true
    if (f[i] === '+') {
      if (t[i] === undefined) return false
      continue
    }
    if (f[i] !== t[i]) return false
  }
  return f.length === t.length
}

export function buildBrokerUrl(host, port, path) {
  let h = (host || '').trim()
  if (!h) return ''
  h = h.replace(/^wss?:\/\//, '').replace(/\/.*$/, '')
  let url = 'wss://' + h
  const p = (port || '').trim()
  if (p) url += ':' + p
  let pa = (path || '').trim()
  // HiveMQ (public broker and Cloud) only answers WebSocket clients on /mqtt.
  if (!pa && /(^|\.)hivemq\.(com|cloud)$/i.test(h)) pa = '/mqtt'
  if (pa) url += (pa.startsWith('/') ? '' : '/') + pa
  return url
}

const CONNACK_ERRORS = {
  1: 'Broker rejected protocol',
  2: 'Client id rejected',
  3: 'Broker unavailable',
  4: 'Bad username or password',
  5: 'Not authorized',
}

class MqttClient {
  constructor() {
    this.status = 'offline'
    this.lastError = ''
    this.config = null
    this.ws = null
    this.buf = new Uint8Array(0)
    this.subs = new Map()
    this.lastPayload = loadStates()
    this.statusListeners = new Set()
    this.packetId = 1
    this.retryCount = 0
    this.retryTimer = null
    this.pingTimer = null
    this.wantClose = false
  }

  _setStatus(s) {
    if (this.status === s) return
    this.status = s
    this.statusListeners.forEach((fn) => {
      try { fn() } catch { /* ignore */ }
    })
  }

  onStatusChange(fn) {
    this.statusListeners.add(fn)
    return () => this.statusListeners.delete(fn)
  }

  onMessage(topic, fn) {
    if (!this.subs.has(topic)) this.subs.set(topic, new Set())
    this.subs.get(topic).add(fn)
    if (this._isOpen()) {
      try { this.ws.send(subscribePacket(this.packetId++, topic)) } catch { /* ignore */ }
    }
    return () => {
      const set = this.subs.get(topic)
      if (!set) return
      set.delete(fn)
      if (set.size === 0) this.subs.delete(topic)
    }
  }

  getLast(topic) {
    return this.lastPayload.has(topic) ? this.lastPayload.get(topic) : null
  }

  connect(config) {
    this.config = config
    this.wantClose = false
    this.retryCount = 0
    this._clearRetry()
    this._teardown()
    this._open()
  }

  disconnect() {
    this.wantClose = true
    this._clearRetry()
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(new Uint8Array([224, 0]))
    } catch { /* ignore */ }
    this._teardown()
    this.lastError = ''
    this._setStatus('offline')
  }

  publish(topic, message) {
    if (!this._isOpen() || this.status !== 'connected') return false
    try {
      this.ws.send(publishPacket(topic, message))
      this._deliver(topic, String(message))
      return true
    } catch {
      return false
    }
  }

  _isOpen() {
    return this.ws && this.ws.readyState === WebSocket.OPEN
  }

  _clearRetry() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  _teardown() {
    this._stopPing()
    clearTimeout(this.connectTimer)
    if (this.ws) {
      const ws = this.ws
      this.ws = null
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null
      try { ws.close() } catch { /* ignore */ }
    }
    this.buf = new Uint8Array(0)
  }

  _open() {
    const url = (this.config?.url || '').trim()
    if (!url) {
      this.lastError = 'No broker address set'
      this._setStatus('offline')
      return
    }
    this.lastError = ''
    this._setStatus('connecting')
    let ws
    try {
      ws = new WebSocket(url, ['mqtt'])
      ws.binaryType = 'arraybuffer'
    } catch {
      this.lastError = 'Invalid broker address'
      this._setStatus('offline')
      this._scheduleRetry()
      return
    }
    this.ws = ws
    this.buf = new Uint8Array(0)

    // A wrong port or path often leaves the socket hanging instead of failing; give up with a clear error.
    this.connectTimer = setTimeout(() => {
      if (this.ws !== ws || this.status === 'connected') return
      this.lastError = 'Broker did not respond — check host, port and path'
      this._teardown()
      this._setStatus('offline')
      this._scheduleRetry()
    }, CONNECT_TIMEOUT_MS)

    ws.onopen = () => {
      try {
        ws.send(
          connectPacket({
            clientId: (this.config.clientId || 'lightnest-' + Math.random().toString(36).slice(2, 8)).trim(),
            username: (this.config.username || '').trim(),
            password: this.config.password || '',
          }),
        )
      } catch {
        this.lastError = 'Failed to send CONNECT'
      }
    }
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) this._onData(e.data)
    }
    ws.onerror = () => {
      if (this.status !== 'connected' && !this.lastError) this.lastError = 'Cannot reach broker'
    }
    ws.onclose = () => {
      this._stopPing()
      clearTimeout(this.connectTimer)
      if (this.ws === ws) this.ws = null
      if (this.wantClose) {
        this._setStatus('offline')
      } else {
        if (!this.lastError) this.lastError = 'Connection closed'
        this._setStatus('offline')
        this._scheduleRetry()
      }
    }
  }

  _scheduleRetry() {
    if (this.wantClose || this.retryTimer) return
    const delay = Math.min(MAX_RETRY_MS, 1000 * Math.pow(2, this.retryCount))
    this.retryCount += 1
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (!this.wantClose && this.config?.url) this._open()
    }, delay)
  }

  _startPing() {
    this._stopPing()
    this.pingTimer = setInterval(() => {
      try {
        if (this._isOpen()) this.ws.send(new Uint8Array([192, 0]))
      } catch { /* ignore */ }
    }, 30000)
  }

  _stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  _onData(data) {
    const chunk = new Uint8Array(data)
    const merged = new Uint8Array(this.buf.length + chunk.length)
    merged.set(this.buf)
    merged.set(chunk, this.buf.length)
    this.buf = merged

    for (;;) {
      if (this.buf.length < 2) return
      let multiplier = 1
      let length = 0
      let pos = 1
      let complete = false
      for (; pos < this.buf.length; pos++) {
        const byte = this.buf[pos]
        length += (byte & 127) * multiplier
        multiplier *= 128
        if (!(byte & 128)) {
          complete = true
          pos++
          break
        }
        if (pos - 1 > 4) {
          this.buf = new Uint8Array(0)
          return
        }
      }
      if (!complete || this.buf.length < pos + length) return
      const header = this.buf[0]
      const body = this.buf.slice(pos, pos + length)
      this.buf = this.buf.slice(pos + length)
      this._handlePacket(header, body)
    }
  }

  _handlePacket(header, body) {
    const type = header >> 4
    if (type === 2) {
      // CONNACK
      const code = body.length >= 2 ? body[1] : 255
      if (code === 0) {
        clearTimeout(this.connectTimer)
        this.retryCount = 0
        this.lastError = ''
        this._setStatus('connected')
        this._startPing()
        if (this._isOpen()) {
          for (const topic of this.subs.keys()) {
            try { this.ws.send(subscribePacket(this.packetId++, topic)) } catch { /* ignore */ }
          }
        }
      } else {
        this.lastError = CONNACK_ERRORS[code] || 'Broker refused connection (' + code + ')'
        this.wantClose = true
        this._teardown()
        this._setStatus('offline')
      }
    } else if (type === 3) {
      // PUBLISH
      const qos = (header >> 1) & 3
      if (body.length < 2) return
      const topicLen = (body[0] << 8) | body[1]
      if (body.length < 2 + topicLen) return
      const topic = new TextDecoder().decode(body.slice(2, 2 + topicLen))
      let offset = 2 + topicLen
      if (qos > 0) {
        if (body.length < offset + 2) return
        const id = (body[offset] << 8) | body[offset + 1]
        offset += 2
        if (qos === 1) {
          try { this.ws && this.ws.send(pubackPacket(id)) } catch { /* ignore */ }
        }
      }
      this._deliver(topic, new TextDecoder().decode(body.slice(offset)))
    }
  }

  _deliver(topic, message) {
    this.lastPayload.set(topic, message)
    saveStates(this.lastPayload)
    for (const [filter, set] of this.subs) {
      if (!topicMatches(filter, topic)) continue
      set.forEach((fn) => {
        try { fn(topic, message) } catch { /* ignore */ }
      })
    }
  }
}

export const mqtt = new MqttClient()

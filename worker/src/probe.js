// Asks every board whether it is alive, the same way the app does: connect to the broker, re-send a relay's
// current state (which changes nothing) and wait for the board to publish its state again.

const CONNECT_TIMEOUT_MS = 8000
const RETAINED_WAIT_MS = 1500
const ANSWER_TIMEOUT_MS = 5000
const TRIES = 2

const text = new TextEncoder()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()

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
  const bytes = Array.from(text.encode(String(s)))
  return [(bytes.length >> 8) & 255, bytes.length & 255, ...bytes]
}

const packet = (type, body) => new Uint8Array([type, ...encodeLength(body.length), ...body])

function connectPacket({ clientId, username, password }) {
  let flags = 2 // clean session
  if (username) flags |= 128
  if (password) flags |= 64
  const payload = [...encodeString(clientId)]
  if (username) payload.push(...encodeString(username))
  if (password) payload.push(...encodeString(password))
  return packet(16, [...encodeString('MQTT'), 4, flags, 0, 60, ...payload])
}

// Switches on the same board share everything before /control/.
export function deviceKey(topic) {
  const t = (topic || '').trim()
  const i = t.indexOf('/control/')
  return i > 0 ? t.slice(0, i) : t
}

// switches: [{ name, topic, stateTopic, on, off }]
// Resolves to { [deviceKey]: true | false | null } (null = no known state to ask with), or null if the broker was unreachable.
export async function probeHome({ url, username, password }, switches) {
  const boards = new Map()
  for (const sw of switches) {
    if (!sw.topic || !sw.stateTopic) continue
    const key = deviceKey(sw.topic)
    if (!boards.has(key)) boards.set(key, { switches: [], answered: false, asked: false })
    boards.get(key).switches.push(sw)
  }
  if (!boards.size) return {}

  let ws
  try {
    ws = new WebSocket(url, ['mqtt'])
  } catch {
    return null
  }
  ws.binaryType = 'arraybuffer'

  const states = new Map() // state topic -> last payload
  let buf = new Uint8Array(0)
  let onConnack = null
  let closed = false

  const handle = (header, body) => {
    const type = header >> 4
    if (type === 2) return onConnack?.(body.length >= 2 ? body[1] : 255)
    if (type !== 3 || body.length < 2) return
    const topicLen = (body[0] << 8) | body[1]
    const topic = new TextDecoder().decode(body.slice(2, 2 + topicLen))
    const offset = 2 + topicLen + ((header >> 1) & 3 ? 2 : 0)
    states.set(topic, new TextDecoder().decode(body.slice(offset)))
    // Retained copies come from the broker; only a fresh message proves the board is there.
    if (header & 1) return
    for (const board of boards.values()) {
      if (board.asked && board.switches.some((sw) => sw.stateTopic === topic)) board.answered = true
    }
  }

  ws.addEventListener('message', (e) => {
    if (!(e.data instanceof ArrayBuffer)) return
    const chunk = new Uint8Array(e.data)
    const merged = new Uint8Array(buf.length + chunk.length)
    merged.set(buf)
    merged.set(chunk, buf.length)
    buf = merged
    for (;;) {
      if (buf.length < 2) return
      let multiplier = 1
      let length = 0
      let pos = 1
      let complete = false
      for (; pos < buf.length && pos <= 4; pos++) {
        length += (buf[pos] & 127) * multiplier
        multiplier *= 128
        if (!(buf[pos] & 128)) {
          complete = true
          pos++
          break
        }
      }
      if (!complete || buf.length < pos + length) return
      const header = buf[0]
      const body = buf.slice(pos, pos + length)
      buf = buf.slice(pos + length)
      handle(header, body)
    }
  })
  ws.addEventListener('close', () => {
    closed = true
    onConnack?.(255)
  })
  ws.addEventListener('error', () => {
    closed = true
    onConnack?.(255)
  })

  try {
    const code = await new Promise((resolve) => {
      onConnack = resolve
      setTimeout(() => resolve(255), CONNECT_TIMEOUT_MS)
      ws.addEventListener('open', () => {
        ws.send(connectPacket({ clientId: 'lightnest-monitor-' + Math.random().toString(36).slice(2, 10), username, password }))
      })
    })
    onConnack = null
    if (code !== 0 || closed) return null

    let id = 1
    for (const board of boards.values()) {
      for (const sw of board.switches) ws.send(packet(130, [0, id++, ...encodeString(sw.stateTopic), 0]))
    }
    await sleep(RETAINED_WAIT_MS)

    for (let attempt = 0; attempt < TRIES; attempt++) {
      let waiting = false
      for (const board of boards.values()) {
        if (board.answered) continue
        for (const sw of board.switches) {
          const state = states.get(sw.stateTopic)
          const payload = same(state, sw.on) ? sw.on : same(state, sw.off) ? sw.off : null
          if (payload == null) continue
          board.asked = true
          waiting = true
          ws.send(packet(48, [...encodeString(sw.topic), ...text.encode(String(payload))]))
          break
        }
      }
      if (!waiting) break
      const deadline = Date.now() + ANSWER_TIMEOUT_MS
      while (Date.now() < deadline && !closed && [...boards.values()].some((b) => b.asked && !b.answered)) await sleep(100)
    }
    // A dropped broker connection says nothing about the boards.
    if (closed) return null

    const result = {}
    for (const [key, board] of boards) result[key] = board.asked ? board.answered : null
    return result
  } catch {
    return null
  } finally {
    try {
      ws.send(new Uint8Array([224, 0]))
      ws.close()
    } catch { /* ignore */ }
  }
}

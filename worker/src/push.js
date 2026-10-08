// Web Push from a Worker: VAPID (RFC 8292) + aes128gcm payload encryption (RFC 8291), WebCrypto only.

const text = new TextEncoder()

export function b64u(bytes) {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function unb64u(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8))
}

async function vapidAuthorization(endpoint, { publicKey, privateKey, subject }) {
  const pub = unb64u(publicKey) // 0x04 | x | y
  const jwk = { kty: 'EC', crv: 'P-256', d: privateKey, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)) }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const claims = { aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }
  const unsigned = b64u(text.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))) + '.' + b64u(text.encode(JSON.stringify(claims)))
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, text.encode(unsigned))
  return `vapid t=${unsigned}.${b64u(signature)}, k=${publicKey}`
}

export async function encryptPayload(subscription, plaintext) {
  const clientPublic = unb64u(subscription.keys.p256dh)
  const auth = unb64u(subscription.keys.auth)
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const localPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey))
  const clientKey = await crypto.subtle.importKey('raw', clientPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, local.privateKey, 256))

  const ikm = await hkdf(auth, shared, concat(text.encode('WebPush: info\0'), clientPublic, localPublic), 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, text.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, text.encode('Content-Encoding: nonce\0'), 12)

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // 0x02 marks the last (only) record.
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(text.encode(plaintext), new Uint8Array([2]))))
  // Header: salt | record size (4096) | key length | sender public key.
  return concat(salt, new Uint8Array([0, 0, 16, 0, localPublic.length]), localPublic, body)
}

// Returns the push service's HTTP status: 201 = accepted, 404 / 410 = the subscription is gone.
export async function sendPush(subscription, message, vapid) {
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high',
    },
    body: await encryptPayload(subscription, JSON.stringify(message)),
  })
  return res.status
}

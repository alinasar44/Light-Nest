// "Connection code": broker details + home id packed into one string the admin can send to users.
const PREFIX = 'LN1-'

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(code) {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function makeConnectionCode(s) {
  const data = { h: s.host, p: s.port, pa: s.path, u: s.username, pw: s.password, id: s.homeId }
  return PREFIX + toBase64Url(JSON.stringify(data))
}

// Returns the connection fields, or null when the code is not valid.
export function readConnectionCode(code) {
  const text = (code || '').trim().replace(/\s+/g, '')
  if (!text.startsWith(PREFIX)) return null
  try {
    const d = JSON.parse(fromBase64Url(text.slice(PREFIX.length)))
    if (!d || typeof d.h !== 'string' || !d.h.trim() || typeof d.id !== 'string' || !d.id.trim()) return null
    return {
      host: d.h,
      port: String(d.p || ''),
      path: String(d.pa || ''),
      username: String(d.u || ''),
      password: String(d.pw || ''),
      homeId: d.id,
    }
  } catch {
    return null
  }
}

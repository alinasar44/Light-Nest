// LightNest monitor: watches the boards of each home around the clock and sends a push notification
// to the subscribed phones when a board stops answering (or answers again), even with the app closed.

import { DurableObject } from 'cloudflare:workers'
import { deviceKey, probeHome } from './probe.js'
import { sendPush } from './push.js'

const CHECK_EVERY_MS = 60 * 1000
const SUBSCRIPTION_MAX_AGE_MS = 60 * 24 * 3600 * 1000 // phones re-register every time the app opens
const MAX_SUBSCRIPTIONS = 20
const MAX_SWITCHES = 100
// Only real push services, so the endpoint cannot be used to make the Worker call arbitrary URLs.
const PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function cleanSubscription(s) {
  try {
    const url = new URL(s.endpoint)
    if (url.protocol !== 'https:' || !PUSH_HOSTS.test(url.hostname)) return null
    const keys = { p256dh: str(s.keys?.p256dh), auth: str(s.keys?.auth) }
    return keys.p256dh && keys.auth ? { endpoint: url.href, keys } : null
  } catch {
    return null
  }
}

function cleanSwitches(list) {
  if (!Array.isArray(list)) return []
  return list
    .slice(0, MAX_SWITCHES)
    .map((s) => ({ name: str(s?.name, 80) || 'Light', topic: str(s?.topic), stateTopic: str(s?.stateTopic), on: str(s?.on, 40) || 'ON', off: str(s?.off, 40) || 'OFF' }))
    .filter((s) => s.topic && s.stateTopic)
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    const url = new URL(request.url)
    const home = (homeId) => env.HOMES.get(env.HOMES.idFromName(homeId))

    if (request.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'lightnest-monitor' })

    if (request.method === 'GET' && url.pathname === '/status') {
      const homeId = str(url.searchParams.get('homeId'), 100)
      if (!homeId) return json({ error: 'homeId is required' }, 400)
      return json(await home(homeId).status())
    }

    if (request.method !== 'POST') return json({ error: 'Not found' }, 404)
    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }
    const homeId = str(body?.homeId, 100)
    if (!homeId) return json({ error: 'homeId is required' }, 400)

    if (url.pathname === '/subscribe') {
      const subscription = cleanSubscription(body.subscription || {})
      const brokerUrl = str(body.broker?.url)
      if (!subscription) return json({ error: 'Invalid push subscription' }, 400)
      if (!/^wss:\/\//.test(brokerUrl)) return json({ error: 'Broker must be a wss:// address' }, 400)
      const broker = { url: brokerUrl, username: str(body.broker.username), password: str(body.broker.password) }
      return json(await home(homeId).subscribe(broker, cleanSwitches(body.switches), subscription))
    }
    if (url.pathname === '/unsubscribe') return json(await home(homeId).unsubscribe(str(body.endpoint, 1000)))
    return json({ error: 'Not found' }, 404)
  },
}

// One per home. Wakes itself up every minute for as long as a phone is subscribed.
export class HomeMonitor extends DurableObject {
  async subscribe(broker, switches, subscription) {
    const subs = (await this.ctx.storage.get('subs')) || {}
    if (!subs[subscription.endpoint] && Object.keys(subs).length >= MAX_SUBSCRIPTIONS) return { error: 'Too many subscriptions for this home' }
    subs[subscription.endpoint] = { ...subscription, seenAt: Date.now() }
    await this.ctx.storage.put({ subs, broker, switches })
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + 1000)
    return { ok: true, devices: [...new Set(switches.map((s) => deviceKey(s.topic)))] }
  }

  async unsubscribe(endpoint) {
    const subs = (await this.ctx.storage.get('subs')) || {}
    delete subs[endpoint]
    await this.ctx.storage.put('subs', subs)
    return { ok: true }
  }

  async status() {
    const s = await this.ctx.storage.get(['status', 'checkedAt', 'brokerOk', 'subs'])
    return {
      devices: s.get('status') || {},
      checkedAt: s.get('checkedAt') || null,
      brokerOk: s.get('brokerOk') ?? null,
      subscribers: Object.keys(s.get('subs') || {}).length,
    }
  }

  async alarm() {
    let active = false
    try {
      active = await this.check()
    } finally {
      // Nobody left to notify: stop until a phone subscribes again.
      if (active) await this.ctx.storage.setAlarm(Date.now() + CHECK_EVERY_MS)
    }
  }

  // Returns whether anyone is still subscribed.
  async check() {
    const stored = await this.ctx.storage.get(['subs', 'broker', 'switches', 'status'])
    const subs = stored.get('subs') || {}
    const now = Date.now()
    let subsChanged = false
    for (const [endpoint, sub] of Object.entries(subs)) {
      if (now - (sub.seenAt || 0) > SUBSCRIPTION_MAX_AGE_MS) {
        delete subs[endpoint]
        subsChanged = true
      }
    }
    if (!Object.keys(subs).length) {
      await this.ctx.storage.deleteAll()
      return false
    }

    const switches = stored.get('switches') || []
    const result = await probeHome(stored.get('broker'), switches)
    const status = { ...(stored.get('status') || {}) }
    const messages = []
    for (const [key, online] of Object.entries(result || {})) {
      if (online == null) continue
      // The first answer for a board is only recorded: there is no change to report yet.
      if (status[key] !== undefined && status[key] !== online) {
        const names = switches.filter((s) => deviceKey(s.topic) === key).map((s) => s.name).join(', ')
        messages.push(
          online
            ? { title: 'LightNest: device back online', body: `${names} is answering again.`, tag: 'lightnest-device-' + key }
            : { title: 'LightNest: device offline', body: `${names} stopped answering. Check its power and internet.`, tag: 'lightnest-device-' + key },
        )
      }
      status[key] = online
    }

    const vapid = { publicKey: this.env.VAPID_PUBLIC_KEY, privateKey: this.env.VAPID_PRIVATE_KEY, subject: this.env.VAPID_SUBJECT }
    for (const message of messages) {
      for (const [endpoint, sub] of Object.entries(subs)) {
        try {
          const code = await sendPush(sub, message, vapid)
          if (code === 404 || code === 410) {
            delete subs[endpoint]
            subsChanged = true
          }
        } catch { /* try again on the next change */ }
      }
    }

    const update = { status, checkedAt: now, brokerOk: result !== null }
    if (subsChanged) update.subs = subs
    await this.ctx.storage.put(update)
    return Object.keys(subs).length > 0
  }
}

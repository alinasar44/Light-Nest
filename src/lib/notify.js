// System notifications, shown through the service worker where there is one (Android Chrome needs it),
// and the push subscription that lets the monitor (worker/) reach this phone while the app is closed.

import { PUSH_SERVER, VAPID_PUBLIC_KEY } from '../config.js'
import { buildBrokerUrl } from './mqtt.js'
import { stateTopicOf } from './rooms.js'

const ICON = './icon-192.png'
const supported = () => typeof Notification !== 'undefined'

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}

export function needsNotifyPermission() {
  return supported() && Notification.permission === 'default'
}

// Must be called from a tap: browsers refuse to ask otherwise. Resolves to whether it was granted.
export async function askNotifyPermission() {
  try {
    return (await Notification.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

export async function notify(title, options) {
  if (!supported() || Notification.permission !== 'granted') return false
  options = { icon: ICON, badge: ICON, ...options }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg?.active) {
      await reg.showNotification(title, options)
      return true
    }
  } catch { /* fall through to a page notification */ }
  try {
    new Notification(title, options)
    return true
  } catch {
    return false
  }
}

function keyBytes(base64url) {
  const raw = atob(base64url.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// Tells the monitor which boards to watch for this phone. Safe to call often: it only refreshes the registration.
export async function syncPush(settings) {
  if (!PUSH_SERVER || !supported() || Notification.permission !== 'granted' || !('PushManager' in window)) return false
  const url = buildBrokerUrl(settings.host, settings.port, settings.path)
  if (!url) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const options = { userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }
    let subscription = await reg.pushManager.getSubscription()
    if (!subscription) {
      subscription = await reg.pushManager.subscribe(options)
    }
    const res = await fetch(PUSH_SERVER + '/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        homeId: settings.homeId,
        broker: { url, username: settings.username, password: settings.password },
        switches: (settings.switches || []).map((sw) => ({ name: sw.name, topic: sw.topic, stateTopic: stateTopicOf(sw), on: sw.on, off: sw.off })),
        subscription: subscription.toJSON(),
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

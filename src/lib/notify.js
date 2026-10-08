// System notifications, shown through the service worker where there is one (Android Chrome needs it).

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

// Must be called from a tap: browsers refuse to ask otherwise.
export function askNotifyPermission() {
  try {
    Notification.requestPermission()?.catch?.(() => {})
  } catch { /* ignore */ }
}

export async function notify(title, options) {
  if (!supported() || Notification.permission !== 'granted') return false
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

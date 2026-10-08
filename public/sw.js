// Service worker: shows system notifications (Android Chrome requires one) and receives the pushes the
// monitor (worker/) sends while the app is closed. It caches nothing, so the app always loads fresh.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let data = {}
  try {
    data = e.data.json()
  } catch { /* a push without a readable payload still has to show something */ }
  const options = { body: data.body || 'Open the app to check your devices.', icon: './icon-192.png', badge: './icon-192.png' }
  // Same tag as the app's own alert, so a device shows one notification that is replaced, not a pile.
  if (data.tag) Object.assign(options, { tag: data.tag, renotify: true })
  e.waitUntil(self.registration.showNotification(data.title || 'LightNest', options))
})

// Tapping the notification brings the app back to the front.
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope))
      return open ? open.focus() : self.clients.openWindow(self.registration.scope)
    }),
  )
})

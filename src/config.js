// App-wide constants shared by every device that opens the site.

// Broker every device connects to out of the box. Each device can change it
// (the admin from Settings, a user from the Connection page or with a connection code).
export const DEFAULT_BROKER = {
  host: 'broker.hivemq.com',
  port: '8884',
  path: '/mqtt',
  username: '',
  password: '',
}

// The "home" whose rooms / devices this device follows. The admin publishes them retained on
// lightnest/<homeId>/config; the random default keeps others on the public broker from stumbling onto it.
export const DEFAULT_HOME_ID = import.meta.env.VITE_HOME_ID || 'af34509527d5f924d9'

export function configTopic(homeId) {
  return `lightnest/${(homeId || DEFAULT_HOME_ID).trim()}/config`
}

// Background monitor (worker/): pushes a notification when a device goes offline, even with the app closed.
// Leave the address empty to turn it off. The key is the public half of the monitor's push key pair.
export const PUSH_SERVER = (import.meta.env.VITE_PUSH_SERVER || '').replace(/\/+$/, '')
export const VAPID_PUBLIC_KEY = 'BGlIJqMZknspWbAKRuzKLo_xUa780eQMCL5ThNOWZa6a4DtM6tYh5Ex6-ckxQMi4pyDec0ih4ozl1iHaXjwrQhk'

// Accounts. Passwords are stored as sha256('lightnest:' + password), never in plain text.
export const ACCOUNTS = [
  { username: 'admin', role: 'admin', hash: '4817b05137effca3270646a0461f8a90dfb413d769441f45bf938761525fe02e' },
  { username: 'user', role: 'user', hash: '249704265991b977d3f8fc673f29f6b26c8d57cec8ad7de0a27abe7f3e84cfa8' },
]

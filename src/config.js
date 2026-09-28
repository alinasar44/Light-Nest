// App-wide constants shared by every device that opens the site.

// Broker every device connects to out of the box. The admin can change it from Settings;
// the change is synced to the other devices over the current broker.
export const DEFAULT_BROKER = {
  host: 'broker.hivemq.com',
  port: '8884',
  path: '/mqtt',
  username: '',
  password: '',
}

// Retained topic that carries the rooms / devices / broker config from the admin to every device.
// The random part keeps other people on the public broker from stumbling onto it.
export const CONFIG_TOPIC = import.meta.env.VITE_CONFIG_TOPIC || 'lightnest/af34509527d5f924d9/config'

// Accounts. Passwords are stored as sha256('lightnest:' + password), never in plain text.
export const ACCOUNTS = [
  { username: 'admin', role: 'admin', hash: '4817b05137effca3270646a0461f8a90dfb413d769441f45bf938761525fe02e' },
  { username: 'user', role: 'user', hash: '249704265991b977d3f8fc673f29f6b26c8d57cec8ad7de0a27abe7f3e84cfa8' },
]

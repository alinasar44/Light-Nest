import { useEffect, useRef, useState } from 'react'
import { Wifi, WifiOff, X } from 'lucide-react'
import { mqtt } from '../lib/mqtt.js'
import { askNotifyPermission, needsNotifyPermission, notify } from '../lib/notify.js'
import { useMqttStatus } from '../lib/settings.jsx'

const ALERTS = {
  lost: {
    Icon: WifiOff,
    title: 'Disconnected',
    body: 'Lost connection to the broker. Trying to reconnect…',
    box: 'border-rose-400/30 bg-[#1a0d14]/95',
    text: 'text-rose-200',
    hideAfter: 8000,
  },
  restored: {
    Icon: Wifi,
    title: 'Back online',
    body: 'Connection to the broker restored.',
    box: 'border-emerald-400/30 bg-[#0b1a16]/95',
    text: 'text-emerald-200',
    hideAfter: 3000,
  },
}

// Warns once each time a live connection drops on its own (not when the user taps Disconnect).
export default function ConnectionAlert() {
  const { status } = useMqttStatus()
  const prev = useRef(status)
  const [alert, setAlert] = useState(null)

  // Browsers only allow asking for notification permission from a tap.
  useEffect(() => {
    if (!needsNotifyPermission()) return
    document.addEventListener('pointerdown', askNotifyPermission, { once: true })
    return () => document.removeEventListener('pointerdown', askNotifyPermission)
  }, [])

  useEffect(() => {
    const was = prev.current
    prev.current = status
    if (status === 'connected') return setAlert((a) => (a === 'lost' ? 'restored' : a))
    if (was !== 'connected' || status !== 'offline' || mqtt.wantClose) return
    setAlert('lost')
    notify('LightNest disconnected', { body: ALERTS.lost.body, tag: 'lightnest-connection', icon: './favicon.svg' })
  }, [status])

  useEffect(() => {
    if (!alert) return
    const timer = setTimeout(() => setAlert(null), ALERTS[alert].hideAfter)
    return () => clearTimeout(timer)
  }, [alert])

  if (!alert) return null
  const { Icon, title, body, box, text } = ALERTS[alert]
  return (
    <div className="fixed z-50 left-4 right-4 top-[calc(env(safe-area-inset-top,0px)+4rem)] md:left-auto md:right-8 md:w-80" role="alert">
      <div className={`flex items-start gap-3 rounded-2xl border backdrop-blur px-4 py-3 shadow-xl ${box} ${text}`}>
        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[12px] opacity-70">{body}</div>
        </div>
        <button
          type="button"
          onClick={() => setAlert(null)}
          aria-label="Dismiss"
          className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-white/5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Wifi, WifiOff, X } from 'lucide-react'
import { devices } from '../lib/devices.js'
import { mqtt } from '../lib/mqtt.js'
import { askNotifyPermission, needsNotifyPermission, notify, syncPush } from '../lib/notify.js'
import { useMqttStatus, useSettings } from '../lib/settings.jsx'

const TONES = {
  bad: { Icon: WifiOff, box: 'border-rose-400/30 bg-[#1a0d14]/95', text: 'text-rose-200', hideAfter: 8000 },
  good: { Icon: Wifi, box: 'border-emerald-400/30 bg-[#0b1a16]/95', text: 'text-emerald-200', hideAfter: 3000 },
}

const BROKER_LOST = { id: 'broker', tone: 'bad', title: 'Disconnected', body: 'Lost connection to the broker. Trying to reconnect…' }
const BROKER_BACK = { id: 'broker', tone: 'good', title: 'Back online', body: 'Connection to the broker restored.' }

// Warns when the broker connection drops on its own (not when the user taps Disconnect)
// and when a device stops answering.
export default function ConnectionAlert() {
  const { status } = useMqttStatus()
  const prev = useRef(status)
  const [alert, setAlert] = useState(null)

  const { settings, loading } = useSettings()
  const [permission, setPermission] = useState(0)

  // Browsers only allow asking for notification permission from a tap.
  useEffect(() => {
    if (!needsNotifyPermission()) return
    const ask = () => askNotifyPermission().then(() => setPermission((n) => n + 1))
    document.addEventListener('pointerdown', ask, { once: true })
    return () => document.removeEventListener('pointerdown', ask)
  }, [])

  // Keep the background monitor watching the current boards for this phone.
  useEffect(() => {
    if (loading) return
    const timer = setTimeout(() => syncPush(settings), 1500)
    return () => clearTimeout(timer)
  }, [loading, permission, settings.host, settings.port, settings.path, settings.username, settings.password, settings.homeId, settings.switches])

  useEffect(() => {
    const was = prev.current
    prev.current = status
    if (status === 'connected') return setAlert((a) => (a === BROKER_LOST ? BROKER_BACK : a))
    if (was !== 'connected' || status !== 'offline' || mqtt.wantClose) return
    setAlert(BROKER_LOST)
    notify('LightNest disconnected', { body: BROKER_LOST.body, tag: 'lightnest-connection' })
  }, [status])

  useEffect(
    () =>
      devices.onChange(({ key, online, was, names }) => {
        const list = names.join(', ')
        if (online === false) {
          const body = `${list} stopped answering. Check its power and internet.`
          setAlert({ id: key, tone: 'bad', title: 'Device offline', body })
          notify('LightNest: device offline', { body, tag: 'lightnest-device-' + key })
        } else if (online && was === false) {
          setAlert({ id: key, tone: 'good', title: 'Device back online', body: `${list} is answering again.` })
        }
      }),
    [],
  )

  useEffect(() => {
    if (!alert) return
    const timer = setTimeout(() => setAlert(null), TONES[alert.tone].hideAfter)
    return () => clearTimeout(timer)
  }, [alert])

  if (!alert) return null
  const { Icon, box, text } = TONES[alert.tone]
  return (
    <div className="fixed z-50 left-4 right-4 top-[calc(env(safe-area-inset-top,0px)+4rem)] md:left-auto md:right-8 md:w-80" role="alert">
      <div className={`flex items-start gap-3 rounded-2xl border backdrop-blur px-4 py-3 shadow-xl ${box} ${text}`}>
        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{alert.title}</div>
          <div className="text-[12px] opacity-70">{alert.body}</div>
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

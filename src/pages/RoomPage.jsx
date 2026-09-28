import { Link } from 'react-router-dom'
import { AlertCircle, Settings } from 'lucide-react'
import LightSwitch from '../components/LightSwitch.jsx'
import { useMqttStatus, useSettings } from '../lib/settings.jsx'

export default function RoomPage({ room, title, subtitle, Icon }) {
  const { settings, loading } = useSettings()
  const { status } = useMqttStatus()
  const connected = status === 'connected'
  const switches = (settings.switches || []).filter((s) => s.room === room)
  const message = settings.host
    ? 'Connecting to broker… switches unlock when connected'
    : 'Broker not configured — open Settings'

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-4 md:px-8 py-6 md:py-10 pb-28 md:pb-10">
        <div className="flex items-center gap-4 mb-6 md:mb-8">
          <div className="w-14 h-14 rounded-2xl bg-sky-400/10 border border-sky-400/25 flex items-center justify-center">
            <Icon className="w-7 h-7 text-sky-300" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl md:text-3xl text-gray-50">{title}</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {!connected && !loading && (
          <Link
            to="/settings"
            className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-400/25 bg-rose-400/[0.07] px-4 py-3.5 hover:bg-rose-400/[0.12] transition-colors"
          >
            <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-rose-200">{message}</div>
              <div className="text-[11px] text-rose-300/60 mt-0.5 flex items-center gap-1">
                Tap to open broker settings <Settings className="w-3 h-3" />
              </div>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {loading
            ? [0, 1].map((i) => (
                <div key={i} className="rounded-3xl border border-white/5 bg-white/[0.03] p-6 h-[150px] animate-pulse" />
              ))
            : switches.map((sw) => <LightSwitch key={sw.id} sw={sw} connected={connected} />)}
        </div>

        <p className="mt-8 text-[11px] text-gray-600 leading-relaxed">
          Tapping a switch publishes the configured ON/OFF payload to its MQTT topic. Incoming messages on the same topic
          update the switch state live.
        </p>
      </div>
    </div>
  )
}

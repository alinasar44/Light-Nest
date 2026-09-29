import { RotateCw } from 'lucide-react'
import { useMqttStatus, useSettings } from '../lib/settings.jsx'

const VARIANTS = {
  connected: {
    label: 'Connected',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    ring: 'border-emerald-400/30 bg-emerald-400/10',
  },
  connecting: {
    label: 'Connecting…',
    dot: 'bg-amber-400 animate-pulse',
    text: 'text-amber-300',
    ring: 'border-amber-400/30 bg-amber-400/10',
  },
  offline: {
    label: 'Offline',
    dot: 'bg-rose-400',
    text: 'text-rose-300',
    ring: 'border-rose-400/30 bg-rose-400/10',
  },
}

export default function StatusBadge() {
  const { status, lastError } = useMqttStatus()
  const { reconnect } = useSettings()
  const v = VARIANTS[status] || VARIANTS.offline
  const busy = status === 'connecting'
  return (
    <div className="flex items-center gap-2">
      {status === 'offline' && lastError && (
        <span className="hidden sm:inline text-[11px] text-rose-300/70 max-w-[180px] truncate">{lastError}</span>
      )}
      <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full border ${v.ring} ${v.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
        {v.label}
      </span>
      <button
        type="button"
        onClick={reconnect}
        disabled={busy}
        title="Reconnect"
        aria-label="Reconnect to broker"
        className="w-8 h-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-100 flex items-center justify-center transition-colors active:scale-95 disabled:cursor-not-allowed"
      >
        <RotateCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
}

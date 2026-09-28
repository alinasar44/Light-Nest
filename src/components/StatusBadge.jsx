import { useMqttStatus } from '../lib/settings.jsx'

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
  const v = VARIANTS[status] || VARIANTS.offline
  return (
    <div className="flex items-center gap-2">
      {status === 'offline' && lastError && (
        <span className="hidden sm:inline text-[11px] text-rose-300/70 max-w-[180px] truncate">{lastError}</span>
      )}
      <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full border ${v.ring} ${v.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
        {v.label}
      </span>
    </div>
  )
}

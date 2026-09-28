// Indicator LED: green when the light is ON, red when OFF, gray when no state has been received yet.
const STATES = {
  on: { dot: 'bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)]', ring: 'bg-emerald-400/40 animate-ping', label: 'ON' },
  off: { dot: 'bg-rose-500 shadow-[0_0_6px_1px_rgba(244,63,94,0.5)]', ring: '', label: 'OFF' },
  unknown: { dot: 'bg-gray-600', ring: '', label: 'No data' },
}

export default function StatusLed({ state = 'unknown', stale = false }) {
  const s = STATES[state] || STATES.unknown
  const title = stale && state !== 'unknown' ? `${s.label} (last known)` : s.label
  return (
    <span className={`relative inline-flex w-2.5 h-2.5 shrink-0 ${stale ? 'opacity-50' : ''}`} title={title} aria-label={`Status: ${title}`}>
      {s.ring && !stale && <span className={`absolute inset-0 rounded-full ${s.ring}`} />}
      <span className={`relative w-2.5 h-2.5 rounded-full border border-black/30 ${s.dot}`} />
    </span>
  )
}

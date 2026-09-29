import { Power, PowerOff } from 'lucide-react'
import { mqtt } from '../lib/mqtt.js'

// Sticky bar at the top of every room: shows how many lights are on and switches all of them at once.
export default function RoomControls({ switches, onCount, connected }) {
  const total = switches.length
  const disabled = !connected || total === 0
  const setAll = (value) => {
    if (disabled) return
    switches.forEach((sw) => sw.topic && mqtt.publish(sw.topic, value ? sw.on : sw.off))
  }

  return (
    <div className="sticky top-0 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-3 mb-5 bg-[rgb(var(--color-bg))]/85 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500">All lights</div>
          <div className="text-sm font-semibold text-gray-200 mt-0.5">
            <span className={onCount ? 'text-amber-300' : ''}>{onCount}</span>
            <span className="text-gray-500"> / {total} on</span>
          </div>
        </div>
        <button
          onClick={() => setAll(false)}
          disabled={disabled}
          className="flex items-center justify-center gap-2 min-h-[44px] px-3.5 sm:px-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-[0.97] transition-all text-gray-200 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PowerOff className="w-4 h-4" />
          <span>All OFF</span>
        </button>
        <button
          onClick={() => setAll(true)}
          disabled={disabled}
          className="flex items-center justify-center gap-2 min-h-[44px] px-3.5 sm:px-5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.97] transition-all text-black font-bold text-sm shadow-[0_0_20px_-6px_rgba(251,191,36,0.6)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <Power className="w-4 h-4" />
          <span>All ON</span>
        </button>
      </div>
    </div>
  )
}

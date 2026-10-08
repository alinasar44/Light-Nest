import { useEffect, useState } from 'react'
import { Lightbulb, Pencil } from 'lucide-react'
import { useDeviceOnline } from '../lib/devices.js'
import { mqtt } from '../lib/mqtt.js'
import { isOn } from '../lib/rooms.js'
import StatusLed from './StatusLed.jsx'

export default function LightSwitch({ sw, payload, connected, onEdit }) {
  const [bump, setBump] = useState(false)
  const deviceOffline = useDeviceOnline(sw) === false && connected
  const usable = connected && !deviceOffline
  const on = isOn(payload, sw)
  const ledState = payload == null ? 'unknown' : on ? 'on' : 'off'

  useEffect(() => {
    setBump(true)
    const t = setTimeout(() => setBump(false), 350)
    return () => clearTimeout(t)
  }, [on])

  const toggle = () => {
    if (usable) mqtt.publish(sw.topic, on ? sw.off : sw.on)
  }

  return (
    <div
      className={`group relative rounded-3xl border p-5 sm:p-6 transition-all duration-300 overflow-hidden ${
        on
          ? 'border-amber-400/40 bg-gradient-to-br from-amber-400/[0.12] via-[#101627] to-[#0c1120] shadow-[0_0_40px_-8px_rgba(251,191,36,0.35)]'
          : 'border-white/8 bg-gradient-to-br from-white/[0.04] to-[#0c1120]'
      }`}
    >
      {on && <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />}
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
                on ? 'bg-amber-400/20 border-amber-400/40' : 'bg-white/5 border-white/10'
              }`}
            >
              <Lightbulb
                className={`w-6 h-6 transition-all duration-300 ${
                  on ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'text-gray-500'
                }`}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <StatusLed state={ledState} stale={!usable} />
                <div className="font-display font-semibold text-base text-gray-100 truncate">{sw.name || 'Light'}</div>
              </div>
              {deviceOffline ? (
                <div className="text-xs font-semibold mt-0.5 text-rose-300">Device offline</div>
              ) : (
                <div className={`text-xs font-semibold mt-0.5 ${on ? 'text-amber-300' : 'text-gray-500'}`}>{on ? 'ON' : 'OFF'}</div>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 min-w-0">
            <div className="text-[11px] font-mono text-gray-500 truncate" title={sw.topic}>
              {sw.topic || 'no topic set'}
            </div>
            {onEdit && (
              <button
                onClick={onEdit}
                aria-label={`Edit ${sw.name}`}
                className="shrink-0 w-8 h-8 -my-1 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={!usable}
          aria-label={`Toggle ${sw.name}`}
          className={`relative shrink-0 w-[72px] h-[38px] rounded-full border transition-all duration-300 ${
            on ? 'bg-amber-400 border-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.5)]' : 'bg-white/8 border-white/15'
          } ${usable ? 'active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
        >
          <span
            className={`absolute top-[3px] w-[30px] h-[30px] rounded-full bg-white shadow-md transition-all duration-300 ${
              on ? 'left-[38px]' : 'left-[3px]'
            } ${bump ? 'scale-110' : 'scale-100'}`}
          />
        </button>
      </div>
    </div>
  )
}

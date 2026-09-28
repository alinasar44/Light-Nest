import { useEffect, useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { mqtt } from '../lib/mqtt.js'
import StatusLed from './StatusLed.jsx'

const OFF_WORDS = ['0', 'off', 'false']

function isOn(payload, sw) {
  if (payload == null) return false
  const value = String(payload).trim().toLowerCase()
  const onValue = String(sw.on || 'ON').trim().toLowerCase()
  if (value === onValue) return true
  return ['1', 'on', 'true'].includes(value) && !OFF_WORDS.includes(onValue)
}

export default function LightSwitch({ sw, connected }) {
  const [payload, setPayload] = useState(() => mqtt.getLast(sw.topic))
  const [bump, setBump] = useState(false)
  const on = isOn(payload, sw)
  const ledState = payload == null ? 'unknown' : on ? 'on' : 'off'

  useEffect(() => {
    setPayload(mqtt.getLast(sw.topic))
    return mqtt.onMessage(sw.topic, (_topic, message) => setPayload(message))
  }, [sw.topic])

  useEffect(() => {
    setBump(true)
    const t = setTimeout(() => setBump(false), 350)
    return () => clearTimeout(t)
  }, [on])

  const toggle = () => {
    if (connected) mqtt.publish(sw.topic, on ? sw.off : sw.on)
  }

  return (
    <div
      className={`relative rounded-3xl border p-5 sm:p-6 transition-all duration-300 overflow-hidden ${
        on
          ? 'border-amber-400/40 bg-gradient-to-br from-amber-400/[0.12] via-[#101627] to-[#0c1120] shadow-[0_0_40px_-8px_rgba(251,191,36,0.35)]'
          : 'border-white/8 bg-gradient-to-br from-white/[0.04] to-[#0c1120]'
      }`}
    >
      {on && <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
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
                <StatusLed state={ledState} stale={!connected} />
                <div className="font-display font-semibold text-base text-gray-100 truncate">{sw.name || 'Light'}</div>
              </div>
              <div className={`text-xs font-semibold mt-0.5 ${on ? 'text-amber-300' : 'text-gray-500'}`}>{on ? 'ON' : 'OFF'}</div>
            </div>
          </div>
          <div className="mt-4 text-[11px] font-mono text-gray-500 truncate" title={sw.topic}>
            {sw.topic || 'no topic set'}
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={!connected}
          aria-label={`Toggle ${sw.name}`}
          className={`relative shrink-0 w-[72px] h-[38px] rounded-full border transition-all duration-300 ${
            on ? 'bg-amber-400 border-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.5)]' : 'bg-white/8 border-white/15'
          } ${connected ? 'active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
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

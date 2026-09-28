import { useEffect, useState } from 'react'
import { Info, RefreshCw, Save, Server, ToggleLeft, Unplug } from 'lucide-react'
import { buildBrokerUrl, mqtt } from '../lib/mqtt.js'
import { useMqttStatus, useSettings } from '../lib/settings.jsx'

const ROOM_NAMES = { living: 'Living Room', bed: 'Bed Room' }

const inputClass =
  'w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-3 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-sky-400/60 focus:bg-white/[0.06] transition-colors font-mono'

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-gray-600 mt-1">{hint}</div>}
    </label>
  )
}

const noAuto = { autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false }

export default function SettingsPage() {
  const { settings, loading, save } = useSettings()
  const { status, lastError } = useMqttStatus()
  const [draft, setDraft] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!loading && !draft) setDraft(JSON.parse(JSON.stringify(settings)))
  }, [loading, settings, draft])

  if (loading || !draft) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 md:px-8 py-8">
          <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-6 h-64 animate-pulse" />
        </div>
      </div>
    )
  }

  const setField = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setSaved(false)
  }

  const setSwitchField = (index, key, value) => {
    setDraft((d) => ({ ...d, switches: d.switches.map((s, i) => (i === index ? { ...s, [key]: value } : s)) }))
    setSaved(false)
  }

  const onSave = async () => {
    await save(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const connected = status === 'connected'
  const hasHost = !!(draft.host && draft.host.trim())

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-4 md:px-8 py-6 md:py-10 pb-28 md:pb-10">
        <h1 className="font-display font-bold text-2xl md:text-3xl text-gray-50 mb-1">Settings</h1>
        <p className="text-xs md:text-sm text-gray-500 mb-6 md:mb-8">Broker connection &amp; switch topics</p>

        <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 md:p-6 mb-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-sky-400/10 border border-sky-400/25 flex items-center justify-center">
              <Server className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-gray-100">MQTT Broker</h2>
              <p className="text-[11px] text-gray-500">WebSocket connection details</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Broker host">
                <input className={inputClass} value={draft.host} onChange={(e) => setField('host', e.target.value)} placeholder="broker.hivemq.com" {...noAuto} />
              </Field>
              <Field label="Port">
                <input className={inputClass} value={draft.port} onChange={(e) => setField('port', e.target.value)} placeholder="8884" inputMode="numeric" {...noAuto} />
              </Field>
            </div>
            <Field label="Path (optional)">
              <input className={inputClass} value={draft.path} onChange={(e) => setField('path', e.target.value)} placeholder="/mqtt" {...noAuto} />
            </Field>

            <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/15 bg-sky-400/[0.05] px-3.5 py-3">
              <Info className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
              <p className="text-[11px] text-sky-200/80 leading-relaxed">
                The app runs over HTTPS, so use the broker's <span className="font-semibold">secure WebSocket (wss://)</span> port — for
                HiveMQ that's <span className="font-mono">8884</span> (not 1883, which is raw TCP and blocked by the browser). HiveMQ
                Cloud needs the path <span className="font-mono">/mqtt</span>; the public broker can leave it blank.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Username (optional)">
                <input className={inputClass} value={draft.username} onChange={(e) => setField('username', e.target.value)} placeholder="broker user" {...noAuto} />
              </Field>
              <Field label="Password (optional)">
                <input className={inputClass} type="password" value={draft.password} onChange={(e) => setField('password', e.target.value)} placeholder="broker password" />
              </Field>
            </div>
            <Field label="Client ID">
              <input className={inputClass} value={draft.clientId} onChange={(e) => setField('clientId', e.target.value)} placeholder="lightnest-01" {...noAuto} />
            </Field>
          </div>

          {status === 'offline' && lastError && (
            <div className="mt-4 text-[12px] text-rose-300 bg-rose-400/[0.07] border border-rose-400/20 rounded-xl px-3.5 py-2.5">{lastError}</div>
          )}
        </section>

        <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 md:p-6 mb-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center">
              <ToggleLeft className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-gray-100">Switch Topics</h2>
              <p className="text-[11px] text-gray-500">Topic and payloads for each light</p>
            </div>
          </div>

          <div className="space-y-5">
            {draft.switches.map((sw, i) => (
              <div key={sw.id || i} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-sky-400/80 mb-3">
                  {ROOM_NAMES[sw.room] || sw.room} · Switch {draft.switches.slice(0, i + 1).filter((s) => s.room === sw.room).length}
                </div>
                <div className="space-y-3">
                  <Field label="Name">
                    <input className={`${inputClass} font-sans`} value={sw.name} onChange={(e) => setSwitchField(i, 'name', e.target.value)} placeholder="Light name" />
                  </Field>
                  <Field label="Topic">
                    <input className={inputClass} value={sw.topic} onChange={(e) => setSwitchField(i, 'topic', e.target.value)} placeholder="home/livingroom/light1" {...noAuto} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="ON payload">
                      <input className={inputClass} value={sw.on} onChange={(e) => setSwitchField(i, 'on', e.target.value)} placeholder="ON" autoCapitalize="off" spellCheck={false} />
                    </Field>
                    <Field label="OFF payload">
                      <input className={inputClass} value={sw.off} onChange={(e) => setSwitchField(i, 'off', e.target.value)} placeholder="OFF" autoCapitalize="off" spellCheck={false} />
                    </Field>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onSave}
            className="flex-1 flex items-center justify-center gap-2 min-h-[50px] rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] transition-all text-black font-bold text-sm shadow-[0_0_24px_-6px_rgba(251,191,36,0.6)]"
          >
            <Save className="w-4 h-4" />
            {saved ? 'Saved ✓' : 'Save & Connect'}
          </button>
          {connected ? (
            <button
              onClick={() => mqtt.disconnect()}
              className="flex items-center justify-center gap-2 min-h-[50px] px-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-gray-200 font-semibold text-sm"
            >
              <Unplug className="w-4 h-4" />
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => hasHost && mqtt.connect({ ...draft, url: buildBrokerUrl(draft.host, draft.port, draft.path) })}
              disabled={!hasHost}
              className="flex items-center justify-center gap-2 min-h-[50px] px-6 rounded-2xl border border-sky-400/30 bg-sky-400/10 hover:bg-sky-400/15 active:scale-[0.98] transition-all text-sky-200 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-4 h-4" />
              Reconnect
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Info, Plus, RefreshCw, Save, Server, ToggleLeft, Trash2, Unplug } from 'lucide-react'
import Field, { inputClass, noAuto } from '../components/Field.jsx'
import ConfirmButton from '../components/ConfirmButton.jsx'
import { buildBrokerUrl, mqtt } from '../lib/mqtt.js'
import { ROOM_ICONS, newId, roomIcon, topicSlug } from '../lib/rooms.js'
import { useMqttStatus, useSettings } from '../lib/settings.jsx'

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

  const change = (fn) => {
    setDraft(fn)
    setSaved(false)
  }
  const setSwitchField = (id, key, value) =>
    change((d) => ({ ...d, switches: d.switches.map((s) => (s.id === id ? { ...s, [key]: value } : s)) }))
  const setRoomField = (id, key, value) =>
    change((d) => ({ ...d, rooms: d.rooms.map((r) => (r.id === id ? { ...r, [key]: value } : r)) }))
  const addDevice = (room) =>
    change((d) => {
      const n = d.switches.filter((s) => s.room === room.id).length + 1
      const sw = { id: newId('sw'), room: room.id, name: `Light ${n}`, topic: `home/${topicSlug(room.name)}/light${n}`, on: 'ON', off: 'OFF' }
      return { ...d, switches: [...d.switches, sw] }
    })
  const removeDevice = (id) => change((d) => ({ ...d, switches: d.switches.filter((s) => s.id !== id) }))
  const addRoomDraft = () =>
    change((d) => ({ ...d, rooms: [...d.rooms, { id: newId('room'), name: `Room ${d.rooms.length + 1}`, icon: 'house' }] }))
  const removeRoom = (id) =>
    change((d) => ({ ...d, rooms: d.rooms.filter((r) => r.id !== id), switches: d.switches.filter((s) => s.room !== id) }))

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
                (public broker and Cloud) needs the path <span className="font-mono">/mqtt</span> — it's added automatically if you
                leave it blank.
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
              <h2 className="font-display font-semibold text-gray-100">Rooms &amp; Devices</h2>
              <p className="text-[11px] text-gray-500">Rooms, lights, topics and payloads</p>
            </div>
          </div>

          <div className="space-y-5">
            {draft.rooms.map((room) => {
              const RoomIcon = roomIcon(room.icon)
              const devices = draft.switches.filter((sw) => sw.room === room.id)
              return (
                <div key={room.id} className="rounded-2xl border border-white/8 bg-black/20 p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-sky-400/10 border border-sky-400/25 flex items-center justify-center">
                      <RoomIcon className="w-5 h-5 text-sky-300" />
                    </div>
                    <input
                      className={`${inputClass} font-sans font-semibold py-2.5 min-w-0`}
                      value={room.name}
                      onChange={(e) => setRoomField(room.id, 'name', e.target.value)}
                      placeholder="Room name"
                      aria-label="Room name"
                    />
                    <select
                      className={`${inputClass} font-sans !w-auto shrink-0 py-2.5 px-2`}
                      value={room.icon}
                      onChange={(e) => setRoomField(room.id, 'icon', e.target.value)}
                      aria-label="Room icon"
                    >
                      {Object.keys(ROOM_ICONS).map((k) => (
                        <option key={k} value={k} className="bg-[#0c1120]">
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    {devices.map((sw, i) => (
                      <div key={sw.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:p-4">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-sky-400/80">Switch {i + 1}</div>
                          <button
                            type="button"
                            onClick={() => removeDevice(sw.id)}
                            aria-label={`Remove ${sw.name}`}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-rose-300 hover:bg-rose-400/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Name">
                              <input className={`${inputClass} font-sans`} value={sw.name} onChange={(e) => setSwitchField(sw.id, 'name', e.target.value)} placeholder="Light name" />
                            </Field>
                            <Field label="Topic">
                              <input className={inputClass} value={sw.topic} onChange={(e) => setSwitchField(sw.id, 'topic', e.target.value)} placeholder="home/livingroom/light1" {...noAuto} />
                            </Field>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="ON payload">
                              <input className={inputClass} value={sw.on} onChange={(e) => setSwitchField(sw.id, 'on', e.target.value)} placeholder="ON" {...noAuto} />
                            </Field>
                            <Field label="OFF payload">
                              <input className={inputClass} value={sw.off} onChange={(e) => setSwitchField(sw.id, 'off', e.target.value)} placeholder="OFF" {...noAuto} />
                            </Field>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => addDevice(room)}
                      className="flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-dashed border-white/15 text-gray-400 hover:text-amber-300 hover:border-amber-400/40 text-sm font-semibold transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add device
                    </button>
                    <ConfirmButton
                      label="Delete room"
                      confirmLabel={devices.length ? `Delete room + ${devices.length} device${devices.length > 1 ? 's' : ''}?` : 'Tap again to delete'}
                      onConfirm={() => removeRoom(room.id)}
                    />
                  </div>
                </div>
              )
            })}

            <button
              type="button"
              onClick={addRoomDraft}
              className="w-full flex items-center justify-center gap-2 min-h-[50px] rounded-2xl border border-dashed border-sky-400/25 bg-sky-400/[0.04] text-sky-200 hover:bg-sky-400/[0.08] text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add room
            </button>
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

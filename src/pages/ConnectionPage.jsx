import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardPaste, Home, Info, KeyRound, PlugZap, Server } from 'lucide-react'
import Field, { inputClass, noAuto } from '../components/Field.jsx'
import { readConnectionCode } from '../lib/connectionCode.js'
import { CONNECTION_FIELDS, useMqttStatus, useSettings } from '../lib/settings.jsx'

// Lets any account point this device at the admin's broker + home. Rooms and devices then sync on their own.
export default function ConnectionPage() {
  const { settings, loading, saveConnection } = useSettings()
  const { status, lastError } = useMqttStatus()
  const [form, setForm] = useState(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    if (!loading && !form) setForm(Object.fromEntries(CONNECTION_FIELDS.map((k) => [k, settings[k] || ''])))
  }, [loading, settings, form])

  if (loading || !form) return null

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setJustSaved(false)
  }

  const connect = (fields) => {
    saveConnection(fields)
    setJustSaved(true)
  }

  const useCode = () => {
    const parsed = readConnectionCode(code)
    if (!parsed) {
      setCodeError('This code is not valid. Copy it again from the admin’s Settings page.')
      return
    }
    setCodeError('')
    setForm(parsed)
    setCode('')
    connect(parsed)
  }

  const pasteFromClipboard = async () => {
    try {
      setCode(await navigator.clipboard.readText())
      setCodeError('')
    } catch {
      setCodeError('Could not read the clipboard — paste the code into the box instead.')
    }
  }

  const connected = status === 'connected'
  const canConnect = form.host.trim() && form.homeId.trim()

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-4 md:px-8 py-6 md:py-10 pb-28 md:pb-10">
        <h1 className="font-display font-bold text-2xl md:text-3xl text-gray-50 mb-1">Connection</h1>
        <p className="text-xs md:text-sm text-gray-500 mb-6 md:mb-8">Connect this device to the same broker and home as the admin</p>

        {connected && justSaved && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] px-4 py-3.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-100">
              <div className="font-semibold">Connected</div>
              <div className="text-[12px] text-emerald-200/70 mt-0.5">Rooms and lights from the admin load automatically — open a room from the menu.</div>
            </div>
          </div>
        )}
        {status === 'offline' && lastError && (
          <div className="mb-5 text-[12px] text-rose-300 bg-rose-400/[0.07] border border-rose-400/20 rounded-xl px-3.5 py-2.5">{lastError}</div>
        )}

        {/* Quick way: code from the admin */}
        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.04] p-5 md:p-6 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-gray-100">Connection code</h2>
              <p className="text-[11px] text-gray-500">Fastest way — ask the admin to send you the code</p>
            </div>
          </div>
          <textarea
            className={`${inputClass} min-h-[88px] resize-y break-all`}
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setCodeError('')
            }}
            placeholder="LN1-…"
            {...noAuto}
          />
          {codeError && <div className="mt-2 text-[12px] text-rose-300">{codeError}</div>}
          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <button
              type="button"
              onClick={pasteFromClipboard}
              className="flex items-center justify-center gap-2 min-h-[46px] px-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-200 font-semibold text-sm"
            >
              <ClipboardPaste className="w-4 h-4" />
              Paste
            </button>
            <button
              type="button"
              onClick={useCode}
              disabled={!code.trim()}
              className="flex-1 flex items-center justify-center gap-2 min-h-[46px] rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] transition-all text-black font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PlugZap className="w-4 h-4" />
              Connect with code
            </button>
          </div>
        </section>

        {/* Manual */}
        <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 md:p-6 mb-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-sky-400/10 border border-sky-400/25 flex items-center justify-center">
              <Server className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-gray-100">Enter manually</h2>
              <p className="text-[11px] text-gray-500">Use exactly the same values as the admin</p>
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (canConnect) connect(form)
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Broker host">
                <input className={inputClass} value={form.host} onChange={set('host')} placeholder="broker.hivemq.com" {...noAuto} />
              </Field>
              <Field label="Port">
                <input className={inputClass} value={form.port} onChange={set('port')} placeholder="8884" inputMode="numeric" {...noAuto} />
              </Field>
            </div>
            <Field label="Path">
              <input className={inputClass} value={form.path} onChange={set('path')} placeholder="/mqtt" {...noAuto} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Username (optional)">
                <input className={inputClass} value={form.username} onChange={set('username')} placeholder="broker user" {...noAuto} />
              </Field>
              <Field label="Password (optional)">
                <input className={inputClass} type="password" value={form.password} onChange={set('password')} placeholder="broker password" />
              </Field>
            </div>
            <Field label="Home ID" hint="Shown on the admin’s Settings page. Rooms and lights are shared under this ID.">
              <div className="relative">
                <Home className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input className={`${inputClass} pl-10`} value={form.homeId} onChange={set('homeId')} placeholder="af34509527d5f924d9" {...noAuto} />
              </div>
            </Field>

            <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/15 bg-sky-400/[0.05] px-3.5 py-3">
              <Info className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
              <p className="text-[11px] text-sky-200/80 leading-relaxed">
                You only connect here. Rooms, lights and their topics are managed by the admin and appear on this device by
                themselves once you are connected.
              </p>
            </div>

            <button
              type="submit"
              disabled={!canConnect}
              className="w-full flex items-center justify-center gap-2 min-h-[50px] rounded-2xl border border-sky-400/30 bg-sky-400/10 hover:bg-sky-400/15 active:scale-[0.98] transition-all text-sky-200 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PlugZap className="w-4 h-4" />
              {status === 'connecting' ? 'Connecting…' : 'Save & Connect'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

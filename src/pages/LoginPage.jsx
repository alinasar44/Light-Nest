import { useState } from 'react'
import { Eye, EyeOff, LogIn, Zap } from 'lucide-react'
import Field, { inputClass, noAuto } from '../components/Field.jsx'
import { useAuth } from '../lib/auth.jsx'

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!login(username, password)) setError('Wrong username or password')
  }

  return (
    <div className="h-full overflow-y-auto bg-[rgb(var(--color-bg))] text-gray-100">
      <div className="min-h-full flex items-center justify-center px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <div className="relative w-full max-w-sm">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center mb-4 shadow-[0_0_40px_-8px_rgba(251,191,36,0.5)]">
              <Zap className="w-7 h-7 text-amber-400" />
            </div>
            <h1 className="font-display font-bold text-3xl text-gray-50">LightNest</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-sky-400/70 mt-1.5">MQTT Panel</p>
          </div>

          <form onSubmit={submit} className="relative rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-display font-semibold text-lg text-gray-100">Sign in</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">This device stays signed in until you log out.</p>
            </div>

            <Field label="Username">
              <input
                className={`${inputClass} font-sans`}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setError('')
                }}
                placeholder="Username"
                autoComplete="username"
                autoFocus
                {...noAuto}
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input
                  className={`${inputClass} font-sans pr-12`}
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-200"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>

            {error && (
              <div className="text-[12px] text-rose-300 bg-rose-400/[0.07] border border-rose-400/20 rounded-xl px-3.5 py-2.5">{error}</div>
            )}

            <button
              type="submit"
              disabled={!username.trim() || !password}
              className="w-full flex items-center justify-center gap-2 min-h-[50px] rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] transition-all text-black font-bold text-sm shadow-[0_0_24px_-6px_rgba(251,191,36,0.6)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <LogIn className="w-4 h-4" />
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

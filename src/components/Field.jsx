export const inputClass =
  'w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-3 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-sky-400/60 focus:bg-white/[0.06] transition-colors font-mono'

export const noAuto = { autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false }

export default function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-gray-600 mt-1">{hint}</div>}
    </label>
  )
}

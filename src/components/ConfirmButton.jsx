import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

// Delete button that needs a second tap within 3 seconds.
export default function ConfirmButton({ onConfirm, label = 'Delete', confirmLabel = 'Tap again to delete', className = '' }) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={`flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl border text-sm font-semibold transition-colors ${
        armed ? 'border-rose-400/60 bg-rose-500/20 text-rose-200' : 'border-rose-400/25 bg-rose-400/[0.07] text-rose-300 hover:bg-rose-400/[0.12]'
      } ${className}`}
    >
      <Trash2 className="w-4 h-4" />
      {armed ? confirmLabel : label}
    </button>
  )
}

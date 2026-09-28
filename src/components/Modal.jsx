import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// Bottom sheet on phones, centered dialog from sm: up.
export default function Modal({ open, title, subtitle, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full sm:max-w-md max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0c1120] shadow-2xl text-gray-100"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-white/5">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-lg text-gray-50">{title}</h2>
            {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 shrink-0 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-white/5">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}

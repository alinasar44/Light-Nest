import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import Modal from './Modal.jsx'
import Field, { inputClass } from './Field.jsx'
import ConfirmButton from './ConfirmButton.jsx'
import { ROOM_ICONS } from '../lib/rooms.js'

// Add a room (room = null) or rename / change icon / delete an existing one.
export default function RoomDialog({ open, room, deviceCount = 0, onClose, onSave, onDelete }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('house')

  useEffect(() => {
    if (!open) return
    setName(room?.name || '')
    setIcon(room?.icon || 'house')
  }, [open, room])

  if (!open) return null

  const valid = name.trim().length > 0
  const submit = (e) => {
    e.preventDefault()
    if (!valid) return
    onSave({ name, icon })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={room ? 'Edit room' : 'Add room'}
      subtitle={room ? 'Rename it or pick another icon' : 'Give it a name and an icon'}
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          {room && (
            <ConfirmButton
              label="Delete room"
              confirmLabel={deviceCount ? `Delete room + ${deviceCount} device${deviceCount > 1 ? 's' : ''}?` : 'Tap again to delete'}
              onConfirm={() => {
                onDelete()
                onClose()
              }}
            />
          )}
          <button
            type="submit"
            form="room-form"
            disabled={!valid}
            className="flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] transition-all text-black font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {room ? 'Save changes' : 'Add room'}
          </button>
        </div>
      }
    >
      <form id="room-form" onSubmit={submit} className="space-y-5">
        <Field label="Room name">
          <input className={`${inputClass} font-sans`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kitchen" autoFocus />
        </Field>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Icon</div>
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
            {Object.entries(ROOM_ICONS).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                aria-label={key}
                aria-pressed={icon === key}
                className={`aspect-square rounded-xl border flex items-center justify-center transition-colors ${
                  icon === key
                    ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                    : 'border-white/10 bg-white/[0.03] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06]'
                }`}
              >
                <Icon className="w-5 h-5" />
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}

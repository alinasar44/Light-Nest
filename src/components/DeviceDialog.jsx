import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import Modal from './Modal.jsx'
import Field, { inputClass, noAuto } from './Field.jsx'
import ConfirmButton from './ConfirmButton.jsx'
import { topicSlug } from '../lib/rooms.js'

// Add a device to a room (device = null) or edit / delete an existing one.
export default function DeviceDialog({ open, room, device, existingCount, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(null)

  useEffect(() => {
    if (!open) return
    setForm(
      device
        ? { name: device.name, topic: device.topic, stateTopic: device.stateTopic || '', on: device.on, off: device.off }
        : {
            name: '',
            topic: `home/${topicSlug(room?.name)}/light${existingCount + 1}`,
            stateTopic: '',
            on: 'ON',
            off: 'OFF',
          },
    )
  }, [open, device, room, existingCount])

  if (!open || !form) return null

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const valid = form.name.trim() && form.topic.trim()
  const submit = (e) => {
    e.preventDefault()
    if (!valid) return
    onSave(form)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={device ? 'Edit device' : 'Add device'}
      subtitle={room ? `${room.name} · MQTT switch` : undefined}
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          {device && (
            <ConfirmButton
              onConfirm={() => {
                onDelete()
                onClose()
              }}
            />
          )}
          <button
            type="submit"
            form="device-form"
            disabled={!valid}
            className="flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] transition-all text-black font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {device ? 'Save changes' : 'Add device'}
          </button>
        </div>
      }
    >
      <form id="device-form" onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <input className={`${inputClass} font-sans`} value={form.name} onChange={set('name')} placeholder="Ceiling light" autoFocus />
        </Field>
        <Field label="Command topic" hint="ON/OFF commands are published here (retained).">
          <input className={inputClass} value={form.topic} onChange={set('topic')} placeholder="home/livingroom/light1" {...noAuto} />
        </Field>
        <Field label="State topic (optional)" hint="Where the device reports its real state. Leave empty if it only listens on the command topic.">
          <input className={inputClass} value={form.stateTopic} onChange={set('stateTopic')} placeholder="home/livingroom/light1/status" {...noAuto} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ON payload">
            <input className={inputClass} value={form.on} onChange={set('on')} placeholder="ON" {...noAuto} />
          </Field>
          <Field label="OFF payload">
            <input className={inputClass} value={form.off} onChange={set('off')} placeholder="OFF" {...noAuto} />
          </Field>
        </div>
      </form>
    </Modal>
  )
}

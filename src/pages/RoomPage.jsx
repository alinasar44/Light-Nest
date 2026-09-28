import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, Pencil, Plus, Settings } from 'lucide-react'
import LightSwitch from '../components/LightSwitch.jsx'
import RoomControls from '../components/RoomControls.jsx'
import DeviceDialog from '../components/DeviceDialog.jsx'
import RoomDialog from '../components/RoomDialog.jsx'
import { isOn, lightCountLabel, roomIcon } from '../lib/rooms.js'
import { useMqttStatus, useSettings, useTopicPayloads } from '../lib/settings.jsx'
import { useAuth } from '../lib/auth.jsx'

export default function RoomPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { settings, loading, addSwitch, updateSwitch, deleteSwitch, updateRoom, deleteRoom } = useSettings()
  const { status } = useMqttStatus()
  const { isAdmin } = useAuth()
  const [deviceDialog, setDeviceDialog] = useState(null) // { device } | null
  const [editRoom, setEditRoom] = useState(false)

  const rooms = settings.rooms || []
  const room = roomId ? rooms.find((r) => r.id === roomId) : rooms[0]
  const switches = (settings.switches || []).filter((s) => room && s.room === room.id)
  const payloads = useTopicPayloads(switches.map((s) => s.topic))

  if (loading) return <Skeleton />
  if (!room) return rooms.length ? <Navigate to={`/room/${rooms[0].id}`} replace /> : <NoRooms />
  if (!roomId) return <Navigate to={`/room/${room.id}`} replace />

  const connected = status === 'connected'
  const onCount = switches.filter((s) => isOn(payloads[s.topic], s)).length
  const Icon = roomIcon(room.icon)
  const message = settings.host ? 'Connecting to broker… switches unlock when connected' : 'Broker not configured — open Settings'

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-4 md:px-8 pt-6 md:pt-10 pb-28 md:pb-10">
        <div className="flex items-center gap-4 mb-5 md:mb-6">
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-sky-400/10 border border-sky-400/25 flex items-center justify-center">
            <Icon className="w-7 h-7 text-sky-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold text-2xl md:text-3xl text-gray-50 truncate">{room.name}</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5">{lightCountLabel(switches.length)} · MQTT controlled</p>
          </div>
          {isAdmin && (
          <button
            onClick={() => setEditRoom(true)}
            aria-label="Edit room"
            className="w-10 h-10 shrink-0 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          )}
        </div>

        <RoomControls switches={switches} onCount={onCount} connected={connected} />

        {!connected && isAdmin && (
          <Link
            to="/settings"
            className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-400/25 bg-rose-400/[0.07] px-4 py-3.5 hover:bg-rose-400/[0.12] transition-colors"
          >
            <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-rose-200">{message}</div>
              <div className="text-[11px] text-rose-300/60 mt-0.5 flex items-center gap-1">
                Tap to open broker settings <Settings className="w-3 h-3" />
              </div>
            </div>
          </Link>
        )}
        {!connected && !isAdmin && (
          <Link
            to="/connection"
            className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-400/25 bg-rose-400/[0.07] px-4 py-3.5 hover:bg-rose-400/[0.12] transition-colors"
          >
            <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-rose-200">Not connected — switches unlock when connected</div>
              <div className="text-[11px] text-rose-300/60 mt-0.5 flex items-center gap-1">
                Tap to enter the connection details or code <Settings className="w-3 h-3" />
              </div>
            </div>
          </Link>
        )}

        {!isAdmin && switches.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-500">No lights in this room yet.</div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
          {switches.map((sw) => (
            <LightSwitch
              key={sw.id}
              sw={sw}
              payload={payloads[sw.topic]}
              connected={connected}
              onEdit={isAdmin ? () => setDeviceDialog({ device: sw }) : undefined}
            />
          ))}
          {isAdmin && (
          <button
            onClick={() => setDeviceDialog({ device: null })}
            className="min-h-[150px] rounded-3xl border-2 border-dashed border-white/10 hover:border-amber-400/40 hover:bg-amber-400/[0.04] text-gray-500 hover:text-amber-300 transition-colors flex flex-col items-center justify-center gap-2"
          >
            <span className="w-11 h-11 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </span>
            <span className="text-sm font-semibold">Add device</span>
          </button>
          )}
        </div>

        <p className="mt-8 text-[11px] text-gray-600 leading-relaxed">
          Tapping a switch publishes the configured ON/OFF payload to its MQTT topic. Incoming messages on the same topic
          update the switch state live.
        </p>
      </div>

      <DeviceDialog
        open={isAdmin && !!deviceDialog}
        room={room}
        device={deviceDialog?.device}
        existingCount={switches.length}
        onClose={() => setDeviceDialog(null)}
        onSave={(form) => (deviceDialog?.device ? updateSwitch(deviceDialog.device.id, form) : addSwitch(room.id, form))}
        onDelete={() => deviceDialog?.device && deleteSwitch(deviceDialog.device.id)}
      />
      <RoomDialog
        open={isAdmin && editRoom}
        room={room}
        deviceCount={switches.length}
        onClose={() => setEditRoom(false)}
        onSave={(patch) => updateRoom(room.id, patch)}
        onDelete={() => {
          const next = rooms.find((r) => r.id !== room.id)
          deleteRoom(room.id)
          navigate(next ? `/room/${next.id}` : '/', { replace: true })
        }}
      />
    </div>
  )
}

function Skeleton() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-4 md:px-8 py-6 md:py-10 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-3xl border border-white/5 bg-white/[0.03] p-6 h-[150px] animate-pulse" />
        ))}
      </div>
    </div>
  )
}

function NoRooms() {
  const { addRoom } = useSettings()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <div className="h-full flex items-center justify-center px-6 pb-20 md:pb-0">
      <div className="text-center max-w-xs">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-sky-400/10 border border-sky-400/25 flex items-center justify-center mb-4">
          <Plus className="w-7 h-7 text-sky-300" />
        </div>
        <h1 className="font-display font-bold text-xl text-gray-50">No rooms yet</h1>
        <p className="text-sm text-gray-500 mt-1 mb-5">
          {isAdmin ? 'Add your first room, then add its lights.' : 'The admin has not added any rooms yet.'}
        </p>
        {isAdmin && (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm"
        >
          <Plus className="w-4 h-4" />
          Add room
        </button>
        )}
      </div>
      <RoomDialog open={open} onClose={() => setOpen(false)} onSave={(r) => navigate(`/room/${addRoom(r)}`)} />
    </div>
  )
}

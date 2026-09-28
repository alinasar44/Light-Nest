import { useState } from 'react'
import { HashRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { Plus, Settings, Zap } from 'lucide-react'
import StatusBadge from './components/StatusBadge.jsx'
import RoomDialog from './components/RoomDialog.jsx'
import RoomPage from './pages/RoomPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import { roomIcon } from './lib/rooms.js'
import { SettingsProvider, useSettings } from './lib/settings.jsx'

const sideLink = (isActive) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-w-0 ${
    isActive
      ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'
  }`

function Layout() {
  const { settings, addRoom } = useSettings()
  const navigate = useNavigate()
  const [addingRoom, setAddingRoom] = useState(false)
  const rooms = settings.rooms || []

  return (
    <div className="h-full flex bg-[rgb(var(--color-bg))] text-gray-100">
      {/* Sidebar: tablets and up */}
      <aside className="hidden md:flex md:w-56 lg:w-60 shrink-0 flex-col border-r border-white/5 bg-white/[0.02] pt-[env(safe-area-inset-top)]">
        <div className="px-5 py-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-none">LightNest</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-sky-400/70 mt-1">MQTT Panel</div>
          </div>
        </div>

        <div className="px-5 mt-1 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-600">Rooms</div>
        <nav className="px-3 flex flex-col gap-1 min-h-0 overflow-y-auto">
          {rooms.map((room) => {
            const Icon = roomIcon(room.icon)
            return (
              <NavLink key={room.id} to={`/room/${room.id}`} className={({ isActive }) => sideLink(isActive)}>
                <Icon className="w-5 h-5 shrink-0" />
                <span className="truncate">{room.name}</span>
              </NavLink>
            )
          })}
          <button
            onClick={() => setAddingRoom(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium border border-dashed border-white/10 text-gray-500 hover:text-amber-300 hover:border-amber-400/30 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add room
          </button>
        </nav>

        <div className="px-3 mt-4 pt-4 border-t border-white/5">
          <NavLink to="/settings" className={({ isActive }) => sideLink(isActive)}>
            <Settings className="w-5 h-5" />
            Settings
          </NavLink>
        </div>
        <div className="mt-auto px-5 py-4">
          <StatusBadge />
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="shrink-0 border-b border-white/5 bg-[rgb(var(--color-bg))]/90 backdrop-blur pt-[env(safe-area-inset-top)]">
          <div className="max-w-4xl mx-auto w-full px-4 md:px-8 h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:hidden">
              <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <span className="font-display font-bold text-base">LightNest</span>
            </div>
            <div className="hidden md:block text-sm text-gray-400 font-display font-semibold tracking-wide">Smart Light Control</div>
            <div className="flex items-center gap-2">
              <StatusBadge />
              <NavLink
                to="/settings"
                aria-label="Settings"
                className={({ isActive }) =>
                  `md:hidden w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                    isActive ? 'border-amber-400/40 bg-amber-400/10 text-amber-300' : 'border-white/10 bg-white/5 text-gray-300'
                  }`
                }
              >
                <Settings className="w-4 h-4" />
              </NavLink>
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0">
          <Routes>
            <Route path="/" element={<RoomPage />} />
            <Route path="/room/:roomId" element={<RoomPage />} />
            <Route path="/bedroom" element={<Navigate to="/room/bed" replace />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Bottom bar: phones. Scrolls sideways when there are many rooms. */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-[#0a0f1c]/95 backdrop-blur border-t border-white/5 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex overflow-x-auto snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {rooms.map((room) => {
            const Icon = roomIcon(room.icon)
            return (
              <NavLink
                key={room.id}
                to={`/room/${room.id}`}
                className={({ isActive }) =>
                  `flex-1 min-w-[76px] max-w-[140px] snap-start flex flex-col items-center gap-1 py-2.5 min-h-[56px] px-1 transition-colors ${
                    isActive ? 'text-amber-300' : 'text-gray-500'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`w-10 h-1 rounded-full transition-all ${isActive ? 'bg-amber-400' : 'bg-transparent'}`} />
                    <Icon className="w-5 h-5 mt-0.5" />
                    <span className="text-[10px] font-semibold truncate max-w-full">{room.name}</span>
                  </>
                )}
              </NavLink>
            )
          })}
          <button
            onClick={() => setAddingRoom(true)}
            className="flex-1 min-w-[76px] max-w-[140px] snap-start flex flex-col items-center gap-1 py-2.5 min-h-[56px] px-1 text-gray-500"
          >
            <span className="w-10 h-1" />
            <Plus className="w-5 h-5 mt-0.5" />
            <span className="text-[10px] font-semibold">Add room</span>
          </button>
        </div>
      </nav>

      <RoomDialog open={addingRoom} onClose={() => setAddingRoom(false)} onSave={(room) => navigate(`/room/${addRoom(room)}`)} />
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <HashRouter>
        <Layout />
      </HashRouter>
    </SettingsProvider>
  )
}

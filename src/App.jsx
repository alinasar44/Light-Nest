import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { BedDouble, Settings, Sofa, Zap } from 'lucide-react'
import StatusBadge from './components/StatusBadge.jsx'
import RoomPage from './pages/RoomPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import { SettingsProvider } from './lib/settings.jsx'

const ROOMS = [
  { to: '/', icon: Sofa, label: 'Living Room', end: true },
  { to: '/bedroom', icon: BedDouble, label: 'Bed Room' },
]

function Layout() {
  return (
    <div className="h-full flex bg-[rgb(var(--color-bg))] text-gray-100">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 shrink-0 flex-col border-r border-white/5 bg-white/[0.02] pt-[env(safe-area-inset-top)]">
        <div className="px-5 py-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-none">LightNest</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-sky-400/70 mt-1">MQTT Panel</div>
          </div>
        </div>
        <nav className="px-3 flex flex-col gap-1 mt-2">
          {[...ROOMS, { to: '/settings', icon: Settings, label: 'Settings' }].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
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
            <Route path="/" element={<RoomPage room="living" title="Living Room" subtitle="One light · MQTT controlled" Icon={Sofa} />} />
            <Route path="/bedroom" element={<RoomPage room="bed" title="Bed Room" subtitle="Two lights · MQTT controlled" Icon={BedDouble} />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-[#0a0f1c]/95 backdrop-blur border-t border-white/5 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex">
          {ROOMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-2.5 min-h-[56px] transition-colors ${isActive ? 'text-amber-300' : 'text-gray-500'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`w-10 h-1 rounded-full transition-all ${isActive ? 'bg-amber-400' : 'bg-transparent'}`} />
                  <item.icon className="w-5 h-5 mt-0.5" />
                  <span className="text-[10px] font-semibold">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
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

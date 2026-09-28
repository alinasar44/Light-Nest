import { createContext, useCallback, useContext, useState } from 'react'
import { ACCOUNTS } from '../config.js'
import { sha256 } from './sha256.js'

const SESSION_KEY = 'lightnest.session'

export function hashPassword(password) {
  return sha256('lightnest:' + password)
}

function findAccount(username, hash) {
  const name = (username || '').trim().toLowerCase()
  return ACCOUNTS.find((a) => a.username === name && a.hash === hash) || null
}

// The role always comes from ACCOUNTS, so editing the saved session can't turn a user into an admin.
function restoreSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    const account = saved && findAccount(saved.username, saved.hash)
    return account ? { username: account.username, role: account.role } : null
  } catch {
    return null
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(restoreSession)

  const login = useCallback((username, password) => {
    const hash = hashPassword(password)
    const account = findAccount(username, hash)
    if (!account) return false
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ username: account.username, hash }))
    } catch { /* ignore */ }
    navigator.storage?.persist?.().catch(() => {})
    setUser({ username: account.username, role: account.role })
    return true
  }, [])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch { /* ignore */ }
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, isAdmin: user?.role === 'admin', login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

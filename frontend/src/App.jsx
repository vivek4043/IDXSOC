import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import Dashboard from './pages/Dashboard'
import Investigation from './pages/Investigation'
import LogExplorer from './pages/LogExplorer'
import Analytics from './pages/Analytics'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import { TopbarProvider, useTopbar } from './components/TopbarContext'
import AdminRoute from './components/AdminRoute'
import UserManagement from './pages/admin/UserManagement'
import DetectionRules from './pages/admin/DetectionRules'
import Whitelists from './pages/admin/Whitelists'
import SystemSettings from './pages/admin/SystemSettings'
import AuditLog from './pages/admin/AuditLog'

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const u = sessionStorage.getItem('idxsoc_user')
      const t = sessionStorage.getItem('idxsoc_token')
      // Only consider logged in if BOTH user profile AND token exist
      if (u && t && t !== 'undefined' && t !== 'null') {
        return JSON.parse(u)
      }
      return null
    } catch {
      return null
    }
  })

  const handleLogin = (userData) => {
    sessionStorage.setItem('idxsoc_user', JSON.stringify(userData))
    setUser(userData)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('idxsoc_user')
    sessionStorage.removeItem('idxsoc_token')
    setUser(null)
  }

  // ── Not logged in → show Login ──────────────────────────────────────────────
  if (!user) return <Login onLogin={handleLogin} />

  // ── Must change password → show forced change-password page ────────────────
  if (user.must_change_password) {
    return (
      <ChangePassword
        user={user}
        onDone={() => {
          // Clear the flag so they don't get redirected again
          const updated = { ...user, must_change_password: false }
          sessionStorage.setItem('idxsoc_user', JSON.stringify(updated))
          setUser(updated)
        }}
        onLogout={handleLogout}
      />
    )
  }

  // ── Normal app ──────────────────────────────────────────────────────────────
  return (
    <TopbarProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Sidebar user={user} onLogout={handleLogout} />
          <div className="main-content">
            <AppContent user={user} onLogout={handleLogout} />
          </div>
        </div>
      </BrowserRouter>
    </TopbarProvider>
  )
}

function AppContent({ user, onLogout }) {
  const { actions } = useTopbar()

  return (
    <>
      <Topbar user={user} actions={actions} onLogout={onLogout} />
      <Routes>
        {/* ── Main routes ── */}
        <Route path="/"             element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"    element={<Dashboard user={user} />} />
        <Route path="/investigation" element={<Investigation user={user} />} />
        <Route path="/logs"         element={<LogExplorer user={user} />} />
        <Route path="/analytics"    element={<Analytics user={user} />} />

        {/* ── Admin routes (RBAC-protected) ── */}
        <Route path="/admin/users"
          element={<AdminRoute user={user}><UserManagement user={user} /></AdminRoute>} />
        <Route path="/admin/rules"
          element={<AdminRoute user={user}><DetectionRules user={user} /></AdminRoute>} />
        <Route path="/admin/whitelists"
          element={<AdminRoute user={user}><Whitelists user={user} /></AdminRoute>} />
        <Route path="/admin/settings"
          element={<AdminRoute user={user}><SystemSettings user={user} /></AdminRoute>} />
        <Route path="/admin/audit"
          element={<AdminRoute user={user}><AuditLog user={user} /></AdminRoute>} />

        {/* ── Catch-all for /admin/* (also hits AdminRoute guard) ── */}
        <Route path="/admin/*"
          element={<AdminRoute user={user}><Navigate to="/admin/users" replace /></AdminRoute>} />

        {/* ── Fallback ── */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}

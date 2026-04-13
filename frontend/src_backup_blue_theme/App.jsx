import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Investigation from './pages/Investigation'
import LogExplorer from './pages/LogExplorer'
import Analytics from './pages/Analytics'
import Sidebar from './components/Sidebar'

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('idxsoc_user')) } catch { return null }
  })

  const handleLogin = (userData) => {
    sessionStorage.setItem('idxsoc_user', JSON.stringify(userData))
    setUser(userData)
  }
  const handleLogout = () => {
    sessionStorage.removeItem('idxsoc_user')
    setUser(null)
  }

  if (!user) return <Login onLogin={handleLogin} />

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar user={user} onLogout={handleLogout} />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"    element={<Dashboard user={user} />} />
            <Route path="/investigation" element={<Investigation user={user} />} />
            <Route path="/logs"         element={<LogExplorer user={user} />} />
            <Route path="/analytics"    element={<Analytics user={user} />} />
            <Route path="*"             element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

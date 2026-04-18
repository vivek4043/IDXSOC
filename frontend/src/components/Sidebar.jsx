import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Shield, FileText, BarChart2, LogOut, Radio,
         Settings, Users, ShieldCheck, ListFilter, SlidersHorizontal, ScrollText } from 'lucide-react'
import { useState, useEffect } from 'react'

const NAV = [
  { path: '/dashboard',     label: 'Dashboard',    icon: LayoutDashboard },
  { path: '/investigation', label: 'Investigation', icon: Shield, alertKey: true },
  { path: '/logs',          label: 'Log Explorer',  icon: FileText },
  { path: '/analytics',     label: 'Analytics',     icon: BarChart2 },
]

const ADMIN_NAV = [
  { path: '/admin/users',     label: 'User Management',   icon: Users },
  { path: '/admin/rules',     label: 'Detection Rules',   icon: ShieldCheck },
  { path: '/admin/whitelists',label: 'Whitelists',        icon: ListFilter },
  { path: '/admin/settings',  label: 'System Settings',   icon: SlidersHorizontal },
  { path: '/admin/audit',     label: 'Audit Log',         icon: ScrollText },
]

export default function Sidebar({ user, onLogout }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [pendingCount, setPendingCount] = useState(0)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/stats')
        const data = await res.json()
        setPendingCount(data.pending_investigation || 0)
      } catch { /* noop */ }
    }
    fetchAlerts()
    const id = setInterval(fetchAlerts, 8000)
    return () => clearInterval(id)
  }, [])

  const initials = (user?.full_name || user?.username || 'U')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🛡️</div>
        <div>
          <div className="sidebar-logo-text">IDXSOC</div>
          <div className="sidebar-logo-sub">Security Operations</div>
        </div>
      </div>

      {/* Nav */}
      <div className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>
        {NAV.map(({ path, label, icon: Icon, alertKey }) => (
          <div
            key={path}
            id={`nav-${label.toLowerCase().replace(' ', '-')}`}
            className={`nav-item${pathname === path ? ' active' : ''}`}
            onClick={() => navigate(path)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && navigate(path)}
          >
            <Icon size={16} />
            {label}
            {alertKey && pendingCount > 0 && (
              <span className="nav-badge">{pendingCount > 99 ? '99+' : pendingCount}</span>
            )}
          </div>
        ))}

        <div className="nav-section-label" style={{ marginTop: 16 }}>System</div>
        <div className="nav-item" style={{ color: 'var(--online)', fontSize: 12 }}>
          <Radio size={14} />
          Live Monitoring
          <span style={{
            marginLeft: 'auto', width: 7, height: 7,
            borderRadius: '50%', background: 'var(--online)',
            animation: 'blink 1.2s infinite',
          }} />
        </div>

        {/* ── Admin Panel section — only for role=admin ── */}
        {isAdmin && (
          <>
            <div className="nav-admin-separator" />
            <div className="nav-section-label admin-label">
              <Settings size={11} />
              Admin Panel
            </div>
            {ADMIN_NAV.map(({ path, label, icon: Icon }) => (
              <div
                key={path}
                id={`nav-admin-${label.toLowerCase().replace(/\s+/g, '-')}`}
                className={`nav-item admin-item${pathname === path || pathname.startsWith(path) ? ' active' : ''}`}
                onClick={() => navigate(path)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigate(path)}
              >
                <Icon size={15} />
                {label}
              </div>
            ))}
          </>
        )}
      </div>

      {/* User */}
      <div className="sidebar-user">
        <div className="user-avatar">{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
            {user?.full_name || user?.username || 'User'}
          <div className="user-role">{user?.role || 'analyst'}</div>
        </div>
        <button
          id="logout-btn"
          onClick={onLogout}
          title="Logout"
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6 }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </nav>
  )
}

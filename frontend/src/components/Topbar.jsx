import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { LogOut, Key, ChevronDown, User } from 'lucide-react'
import Clock from './Clock'
import { apiFetch } from '../api'

/* ── Inline Change-Password Modal ───────────────────────────────────────────── */
function ChangePasswordModal({ onClose }) {
  const [form, setForm]       = useState({ current_password: '', new_password: '', confirm: '' })
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [strength, setStrength] = useState(0)

  useEffect(() => {
    let s = 0
    const p = form.new_password
    if (p.length >= 8)                                  s++
    if (p.length >= 12)                                 s++
    if (/[A-Z]/.test(p) && /[a-z]/.test(p))            s++
    if (/[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p))    s++
    setStrength(s)
  }, [form.new_password])

  const strengthColor = ['', '#ff4757', '#ffa502', '#2ed573', '#4ade80'][strength]
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.new_password.length < 8) { setError('New password must be at least 8 characters'); return }
    if (form.new_password !== form.confirm) { setError('Passwords do not match'); return }

    setLoading(true)
    try {
      const res  = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body:   JSON.stringify({
          current_password: form.current_password,
          new_password:     form.new_password,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to change password')
      setSuccess(true)
      setTimeout(onClose, 1800)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card" style={{ width: 400, padding: 28, animation: 'fadeIn 0.2s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            🔐 Change Password
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '2px 8px' }}>✕</button>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#4ade80' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Password updated successfully!</div>
          </div>
        ) : (
          <>
            {error && (
              <div style={{
                background: 'rgba(255,71,87,.12)', border: '1px solid rgba(255,71,87,.3)',
                borderRadius: 8, padding: '9px 13px', marginBottom: 14,
                color: '#ff4757', fontSize: 12,
              }}>✗ {error}</div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                  Current Password
                </label>
                <input
                  id="current-password-field"
                  className="input" type="password" required
                  value={form.current_password}
                  onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))}
                  placeholder="Your current password"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                  New Password
                </label>
                <input
                  id="new-password-field"
                  className="input" type="password" required
                  value={form.new_password}
                  onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
                  placeholder="Minimum 8 characters"
                  style={{ width: '100%' }}
                />
                {form.new_password.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,.07)' }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        width: `${(strength / 4) * 100}%`,
                        background: strengthColor,
                        transition: 'width .3s, background .3s',
                      }} />
                    </div>
                    <div style={{ fontSize: 10, color: strengthColor, marginTop: 3 }}>{strengthLabel}</div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                  Confirm New Password
                </label>
                <input
                  id="confirm-password-field"
                  className="input" type="password" required
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Repeat new password"
                  style={{ width: '100%' }}
                />
                {form.confirm && form.new_password !== form.confirm && (
                  <div style={{ fontSize: 10, color: '#ff4757', marginTop: 3 }}>Passwords do not match</div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
                <button id="save-new-password-btn" type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                  {loading ? 'Saving…' : '🔒 Update Password'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Topbar ─────────────────────────────────────────────────────────────────── */
export default function Topbar({ user, actions, onLogout }) {
  const location = useLocation()
  const path = location.pathname.substring(1) || 'dashboard'

  const [menuOpen, setMenuOpen]   = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)
  const menuRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = (user?.full_name || user?.username || 'U')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-user">idxsoc@soc:~$</span>{' '}
          <span className="topbar-path">{path}</span>
        </div>

        <div className="topbar-center">
          <Clock />
        </div>

        <div className="topbar-right">
          {actions}
          <div className="live-badge">
            <div className="live-dot" /> LIVE
          </div>

          {/* ── User avatar + dropdown ── */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              id="user-menu-btn"
              onClick={() => setMenuOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'rgba(74,222,128,.08)',
                border: '1px solid rgba(74,222,128,.2)',
                borderRadius: 8, padding: '5px 10px',
                cursor: 'pointer', transition: 'background .2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,222,128,.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(74,222,128,.08)'}
            >
              {/* Avatar circle */}
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'linear-gradient(135deg,#4ade80,#22c55e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#060a14',
              }}>
                {initials}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                {user?.username || 'User'}
              </span>
              <ChevronDown size={12} style={{
                color: 'var(--text-muted)',
                transform: menuOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform .2s',
              }} />
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 6, minWidth: 200,
                boxShadow: '0 8px 32px rgba(0,0,0,.5)',
                zIndex: 1500, animation: 'fadeIn .15s ease-out',
              }}>
                {/* User info */}
                <div style={{
                  padding: '8px 12px 10px', borderBottom: '1px solid var(--border)',
                  marginBottom: 4,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {user?.full_name || user?.username}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    <span style={{
                      fontSize: 10, background: 'rgba(74,222,128,.12)',
                      color: '#4ade80', borderRadius: 4, padding: '1px 6px',
                    }}>
                      {user?.role}
                    </span>
                  </div>
                </div>

                {/* Change Password */}
                <button
                  id="topbar-change-password-btn"
                  className="btn btn-ghost"
                  onClick={() => { setMenuOpen(false); setShowChangePw(true) }}
                  style={{
                    width: '100%', justifyContent: 'flex-start', gap: 10,
                    padding: '8px 12px', borderRadius: 7, fontSize: 13,
                  }}
                >
                  <Key size={14} style={{ color: 'var(--text-muted)' }} />
                  Change Password
                </button>

                {/* Sign Out */}
                {onLogout && (
                  <button
                    id="topbar-signout-btn"
                    className="btn btn-ghost"
                    onClick={() => { setMenuOpen(false); onLogout() }}
                    style={{
                      width: '100%', justifyContent: 'flex-start', gap: 10,
                      padding: '8px 12px', borderRadius: 7, fontSize: 13,
                      color: '#ff4757',
                    }}
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Change password modal (portal-like, outside topbar flow) */}
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </>
  )
}

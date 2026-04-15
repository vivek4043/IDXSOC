import { useState, useEffect } from 'react'
import { Users, UserPlus, Search, CheckCircle, XCircle, Shield, Copy, Check } from 'lucide-react'
import { apiFetch } from '../../api'

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}

/** One-time temp-password modal shown after create / reset. */
function TempPasswordModal({ username, tempPassword, onClose }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* clipboard not available */ }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="card" style={{ width: 420, padding: 28, animation: 'fadeIn 0.2s ease-out' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
          <h2 style={{ fontSize: 16, color: 'var(--text-primary)', margin: 0 }}>
            Temporary Password Generated
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            This password is shown <strong>once only</strong>.<br />
            Share it securely with <span style={{ color: 'var(--accent)' }}>{username}</span>.
          </p>
        </div>

        {/* Password display */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '14px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <code style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.05em', flex: 1 }}>
            {tempPassword}
          </code>
          <button
            id="copy-temp-password-btn"
            className="btn btn-ghost btn-sm"
            onClick={copy}
            style={{ flexShrink: 0 }}
          >
            {copied
              ? <><Check size={13} style={{ color: '#4ade80' }} /> Copied</>
              : <><Copy size={13} /> Copy</>
            }
          </button>
        </div>

        <div style={{
          fontSize: 11, color: 'var(--text-muted)',
          background: 'rgba(255,165,0,.08)',
          border: '1px solid rgba(255,165,0,.2)',
          borderRadius: 6, padding: '8px 12px', marginBottom: 18,
        }}>
          ⚠️ The user will be required to change this password on first login.
        </div>

        <button
          id="close-temp-password-modal"
          className="btn btn-primary"
          onClick={onClose}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Done — I've noted the password
        </button>
      </div>
    </div>
  )
}

export default function UserManagement() {
  const [search, setSearch]   = useState('')
  const [users, setUsers]     = useState([])

  // Modals
  const [showAddModal,  setShowAddModal]  = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [tempPwModal,   setTempPwModal]   = useState(null)  // { username, tempPassword }

  // Form state
  const [form, setForm]                 = useState({ name: '', username: '', role: 'analyst' })
  const [editingId, setEditingId]       = useState(null)
  const [formError, setFormError]       = useState('')
  const [formLoading, setFormLoading]   = useState(false)

  const fetchUsers = async () => {
    try {
      const res  = await apiFetch('/api/users')
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch users', err)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const filtered = users.filter(u =>
    (u.full_name || u.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.username  || '').toLowerCase().includes(search.toLowerCase())
  )

  // ── Toggle active / inactive ──────────────────────────────────────────────
  const toggleStatus = async (userId) => {
    try {
      const res = await apiFetch(`/api/users/${userId}/status`, { method: 'PUT' })
      if (res.ok) fetchUsers()
    } catch (err) { console.error('Failed to toggle status', err) }
  }

  // ── Open Add modal ─────────────────────────────────────────────────────────
  const openAddModal = () => {
    setForm({ name: '', username: '', role: 'analyst' })
    setFormError('')
    setShowAddModal(true)
  }

  // ── Open Edit modal ────────────────────────────────────────────────────────
  const openEditModal = (u) => {
    setForm({ name: u.full_name || u.name || '', username: u.username, role: u.role })
    setEditingId(u.id)
    setFormError('')
    setShowEditModal(true)
  }

  // ── Add user ───────────────────────────────────────────────────────────────
  const handleAddSubmit = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const res  = await apiFetch('/api/users', {
        method: 'POST',
        body:   JSON.stringify({ username: form.username, name: form.name, role: form.role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to create user')
      setShowAddModal(false)
      fetchUsers()
      // Show one-time temp password modal
      setTempPwModal({ username: form.username, tempPassword: data.temp_password })
    } catch (err) {
      setFormError(err.message)
    } finally { setFormLoading(false) }
  }

  // ── Edit user ──────────────────────────────────────────────────────────────
  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const res = await apiFetch(`/api/users/${editingId}`, {
        method: 'PUT',
        body:   JSON.stringify({ name: form.name, role: form.role }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.detail || 'Failed to update user')
      }
      setShowEditModal(false)
      fetchUsers()
    } catch (err) {
      setFormError(err.message)
    } finally { setFormLoading(false) }
  }

  // ── Reset password ─────────────────────────────────────────────────────────
  const handleResetPassword = async (u) => {
    if (!window.confirm(`Reset password for ${u.username}? They will receive a new temporary password.`)) return
    try {
      const res  = await apiFetch(`/api/admin/users/${u.id}/reset-password`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Reset failed')
      setTempPwModal({ username: u.username, tempPassword: data.temp_password })
    } catch (err) {
      alert(`Reset failed: ${err.message}`)
    }
  }

  return (
    <div className="page-container fade-in">

      {/* ── One-time temp password modal ── */}
      {tempPwModal && (
        <TempPasswordModal
          username={tempPwModal.username}
          tempPassword={tempPwModal.tempPassword}
          onClose={() => setTempPwModal(null)}
        />
      )}

      {/* ── Page Header ── */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <div className="admin-icon-wrap"><Users size={18} /></div>
          <div>
            <h1>User Management</h1>
            <div className="admin-page-sub">Manage platform users, roles, and access permissions</div>
          </div>
        </div>
        <button id="add-user-btn" className="btn btn-primary" onClick={openAddModal}
          style={{ borderColor: 'var(--admin-border)', color: 'var(--admin)', background: 'var(--admin-bg)' }}>
          <UserPlus size={14} />
          ＋ Add New User
        </button>
      </div>

      {/* ── Stats Row ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 20 }}>
        {[
          { label: 'Total Users',       value: users.length,                                          cls: 'info' },
          { label: 'Active',            value: users.filter(u => u.status === 'active').length,       cls: 'online' },
          { label: 'Inactive',          value: users.filter(u => u.status === 'inactive').length,     cls: 'medium' },
          { label: 'Must Change PW',    value: users.filter(u => u.must_change_password).length,     cls: 'high' },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`stat-card ${cls}`}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="toolbar">
        <div className="input-group" style={{ flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            id="user-search"
            className="input"
            style={{ flex: 1 }}
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Users size={14} /> Platform Users</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} of {users.length}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>PW Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                        {(u.full_name || u.username).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {u.full_name || u.username}
                      </span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-code)' }}>{u.username}</td>
                  <td>
                    <span className={`admin-badge role-${u.role}`}>
                      {u.role === 'admin' && <Shield size={10} />}
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge status-${u.status}`}>
                      {u.status === 'active' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                      {u.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(u.last_login)}</td>
                  <td>
                    {u.must_change_password
                      ? <span style={{ fontSize: 11, color: '#ffa502' }}>⚠ Temp PW</span>
                      : <span style={{ fontSize: 11, color: '#4ade80' }}>✓ Set</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(u)}>
                        Edit
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleResetPassword(u)}
                        title="Generate new temp password">
                        🔑 Reset PW
                      </button>
                      <button
                        className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => toggleStatus(u.id)}
                      >
                        {u.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No users found
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {(showAddModal || showEditModal) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: 400, padding: 24, animation: 'fadeIn 0.2s ease-out' }}>
            <h2 style={{ fontSize: 16, marginBottom: 16, color: 'var(--text-primary)' }}>
              {showAddModal ? '＋ Add New User' : '✏ Edit User'}
            </h2>
            {formError && (
              <div style={{
                background: 'rgba(255,71,87,.1)', border: '1px solid rgba(255,71,87,.3)',
                borderRadius: 6, padding: '8px 12px', marginBottom: 12,
                color: '#ff4757', fontSize: 12,
              }}>✗ {formError}</div>
            )}
            <form onSubmit={showAddModal ? handleAddSubmit : handleEditSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="text-muted mb-4" style={{ fontSize: 11 }}>Full Name</label>
                <input required className="input" value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="text-muted mb-4" style={{ fontSize: 11 }}>Username</label>
                <input required className="input" disabled={showEditModal}
                  value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
                {showAddModal && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    A temporary password will be generated automatically.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="text-muted mb-4" style={{ fontSize: 11 }}>Role</label>
                <select className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="analyst">Analyst</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-ghost"
                  onClick={() => { setShowAddModal(false); setShowEditModal(false); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

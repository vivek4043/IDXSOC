import { useState, useEffect } from 'react'
import { Users, UserPlus, Search, CheckCircle, XCircle, Shield } from 'lucide-react'

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function UserManagement() {
  const [search, setSearch]   = useState('')
  const [users, setUsers]     = useState([])
  
  // Modals state
  const [showAddModal, setShowAddModal]   = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  
  // Form state
  const [form, setForm] = useState({ name: '', username: '', role: 'analyst' })
  const [editingUsername, setEditingUsername] = useState(null)

  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/users')
      const data = await res.json()
      setUsers(data)
    } catch (err) {
      console.error('Failed to fetch users', err)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const filtered = users.filter(u =>
    (u.name && u.name.toLowerCase().includes(search.toLowerCase())) ||
    (u.username && u.username.toLowerCase().includes(search.toLowerCase()))
  )

  const toggleStatus = async (username) => {
    try {
      const res = await fetch(`http://localhost:8000/api/users/${username}/status`, { method: 'PUT' })
      if (res.ok) {
        fetchUsers()
      }
    } catch (err) {
      console.error('Failed to toggle status', err)
    }
  }

  const openAddModal = () => {
    setForm({ name: '', username: '', role: 'analyst' })
    setShowAddModal(true)
  }

  const openEditModal = (u) => {
    setForm({ name: u.name, username: u.username, role: u.role })
    setEditingUsername(u.username)
    setShowEditModal(true)
  }

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('http://localhost:8000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        setShowAddModal(false)
        fetchUsers()
      }
    } catch (err) {
      console.error('Failed to add user', err)
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`http://localhost:8000/api/users/${editingUsername}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, role: form.role })
      })
      if (res.ok) {
        setShowEditModal(false)
        fetchUsers()
      }
    } catch (err) {
      console.error('Failed to edit user', err)
    }
  }

  return (
    <div className="page-container fade-in">
      {/* ── Page Header ── */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <div className="admin-icon-wrap"><Users size={18} /></div>
          <div>
            <h1>User Management</h1>
            <div className="admin-page-sub">Manage platform users, roles, and access permissions</div>
          </div>
        </div>
        <button id="add-user-btn" className="btn btn-primary" onClick={openAddModal} style={{ borderColor: 'var(--admin-border)', color: 'var(--admin)', background: 'var(--admin-bg)' }}>
          <UserPlus size={14} />
          ＋ Add New User
        </button>
      </div>

      {/* ── Stats Row ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 20 }}>
        {[
          { label: 'Total Users',   value: users.length,                                       cls: 'info' },
          { label: 'Active',        value: users.filter(u => u.status === 'active').length,    cls: 'online' },
          { label: 'Inactive',      value: users.filter(u => u.status === 'inactive').length,  cls: 'medium' },
          { label: 'Admins',        value: users.filter(u => u.role === 'admin').length,       cls: 'high' },
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
                <th>Email (Username)</th>
                <th>Role</th>
                <th>Status (Active/Inactive)</th>
                <th>Last Login</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                        {(u.name || u.username).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{u.name || (u.username)}</span>
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
                      {u.status === 'active'
                        ? <CheckCircle size={10} />
                        : <XCircle size={10} />}
                      {u.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(u.lastLogin)}</td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(u)}>
                         Edit
                      </button>
                      <button className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleStatus(u.username)}>
                        {u.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ── */}
      {(showAddModal || showEditModal) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, 
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: 400, padding: 24, animation: 'fadeIn 0.2s ease-out' }}>
            <h2 style={{ fontSize: 16, marginBottom: 16, color: 'var(--text-primary)' }}>
              {showAddModal ? 'Add New User' : 'Edit User'}
            </h2>
            <form onSubmit={showAddModal ? handleAddSubmit : handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="text-muted mb-4" style={{ fontSize: 11 }}>Full Name</label>
                <input 
                  required className="input" 
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="text-muted mb-4" style={{ fontSize: 11 }}>Email (Username)</label>
                <input 
                  required className="input" disabled={showEditModal} 
                  value={form.username} onChange={e => setForm({...form, username: e.target.value})} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="text-muted mb-4" style={{ fontSize: 11 }}>Role</label>
                <select className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="analyst">Analyst</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => { setShowAddModal(false); setShowEditModal(false); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

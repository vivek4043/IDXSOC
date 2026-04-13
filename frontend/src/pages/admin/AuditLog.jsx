import { useState } from 'react'
import { ScrollText, Search, Filter } from 'lucide-react'

const AUDIT_ENTRIES = [
  { id: 'a1',  actor: 'admin',    action: 'User deactivated',         detail: 'Account m.rivera set to inactive',              type: 'admin', ts: '2026-04-13T01:58:11Z' },
  { id: 'a2',  actor: 'admin',    action: 'Detection rule toggled',   detail: 'Rule "Privilege Escalation" disabled',          type: 'warn',  ts: '2026-04-13T01:44:03Z' },
  { id: 'a3',  actor: 'analyst',  action: 'Alert resolved',           detail: 'Alert ID #A-2041 marked as resolved',          type: 'info',  ts: '2026-04-13T01:30:55Z' },
  { id: 'a4',  actor: 'admin',    action: 'Whitelist entry added',    detail: 'IP 185.220.101.0/24 added to whitelist',        type: 'admin', ts: '2026-04-13T00:22:30Z' },
  { id: 'a5',  actor: 'admin',    action: 'System settings saved',    detail: 'Log retention changed from 60 → 90 days',      type: 'admin', ts: '2026-04-12T23:55:12Z' },
  { id: 'a6',  actor: 'j.chen',   action: 'Alert escalated',          detail: 'Alert ID #A-2039 escalated to CRITICAL',       type: 'danger',ts: '2026-04-12T22:41:00Z' },
  { id: 'a7',  actor: 'admin',    action: 'User created',             detail: 'New user j.chen (analyst) created',            type: 'info',  ts: '2026-04-12T22:01:44Z' },
  { id: 'a8',  actor: 's.patel',  action: 'Log file uploaded',        detail: 'apache_access.log — 384 entries, 14 threats',  type: 'info',  ts: '2026-04-12T21:14:09Z' },
  { id: 'a9',  actor: 'analyst',  action: 'Alert resolved',           detail: 'Alert ID #A-2035 marked as resolved',          type: 'info',  ts: '2026-04-12T20:50:00Z' },
  { id: 'a10', actor: 'admin',    action: 'Detection rule added',     detail: 'New rule "ICMP Flood" created (HIGH)',         type: 'admin', ts: '2026-04-12T19:33:21Z' },
  { id: 'a11', actor: 'admin',    action: 'Whitelist entry removed',  detail: 'Domain scanner.example.com removed',          type: 'warn',  ts: '2026-04-12T18:10:00Z' },
  { id: 'a12', actor: 'm.rivera', action: 'Login',                    detail: 'Successful login from 10.0.1.88',             type: 'info',  ts: '2026-04-12T09:30:00Z' },
  { id: 'a13', actor: 'unknown',  action: 'Failed login attempt',     detail: 'Invalid credentials for username root',       type: 'danger',ts: '2026-04-12T07:11:44Z' },
  { id: 'a14', actor: 'admin',    action: 'AI analysis toggled',      detail: 'AI threat analysis feature disabled',         type: 'warn',  ts: '2026-04-11T16:02:55Z' },
  { id: 'a15', actor: 'admin',    action: 'System startup',           detail: 'IDXSOC SOC v2.4.1 started on idxsoc-soc-01', type: 'info', ts: '2026-04-11T08:00:00Z' },
]

const TYPE_LABELS = { All: 'All', info: 'Info', warn: 'Warning', danger: 'Critical', admin: 'Admin' }
const ACTOR_COLORS = { admin: 'var(--admin)', analyst: 'var(--accent-2)', unknown: 'var(--critical)' }

function fmtTs(iso) {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}

function relativeTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)   return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function AuditLog() {
  const [search, setSearch]   = useState('')
  const [typeFilter, setType] = useState('All')

  const filtered = AUDIT_ENTRIES.filter(e => {
    const matchType  = typeFilter === 'All' || e.type === typeFilter
    const matchSearch = !search || (
      e.action.toLowerCase().includes(search.toLowerCase()) ||
      e.detail.toLowerCase().includes(search.toLowerCase()) ||
      e.actor.toLowerCase().includes(search.toLowerCase())
    )
    return matchType && matchSearch
  })

  return (
    <div className="page-container fade-in">
      {/* ── Header ── */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <div className="admin-icon-wrap"><ScrollText size={18} /></div>
          <div>
            <h1>Audit Log</h1>
            <div className="admin-page-sub">Immutable record of all admin and analyst actions</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)', animation: 'blink 1.2s infinite', display: 'inline-block' }} />
          Live audit stream
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: 18 }}>
        {[
          { label: 'Total Events', value: AUDIT_ENTRIES.length,                                    cls: 'info' },
          { label: 'Admin Actions',value: AUDIT_ENTRIES.filter(e => e.type === 'admin').length,    cls: 'high' },
          { label: 'Warnings',     value: AUDIT_ENTRIES.filter(e => e.type === 'warn').length,     cls: 'medium' },
          { label: 'Critical',     value: AUDIT_ENTRIES.filter(e => e.type === 'danger').length,   cls: 'critical' },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`stat-card ${cls}`}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="toolbar">
        <div className="input-group" style={{ flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            id="audit-search"
            className="input"
            style={{ flex: 1 }}
            placeholder="Search actions, actors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Filter size={13} style={{ color: 'var(--text-muted)' }} />
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={`filter-chip${typeFilter === key ? ' active' : ''}`}
            onClick={() => setType(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Log Entries ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><ScrollText size={14} /> Event Timeline</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} events</span>
        </div>
        <div style={{ padding: '8px 18px' }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <p>No events match your filter</p>
            </div>
          ) : filtered.map(e => (
            <div key={e.id} className="audit-log-entry">
              <div className={`audit-log-dot ${e.type}`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="audit-log-action">{e.action}</div>
                <div className="audit-log-actor">
                  <span style={{ color: ACTOR_COLORS[e.actor] || 'var(--accent-2)' }}>@{e.actor}</span>
                </div>
                <div className="audit-log-detail">{e.detail}</div>
                <div className="audit-log-time" title={fmtTs(e.ts)}>
                  {fmtTs(e.ts)} · <span style={{ color: 'var(--accent)', opacity: 0.7 }}>{relativeTime(e.ts)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

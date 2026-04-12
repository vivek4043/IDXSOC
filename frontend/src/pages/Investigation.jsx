import { useEffect, useState, useCallback } from 'react'
import ThreatCard from '../components/ThreatCard'
import { Shield, RefreshCw } from 'lucide-react'
import { useTopbar } from '../components/TopbarContext'

const API = 'http://localhost:8000'
const SEV = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export default function Investigation() {
  const [alerts, setAlerts]     = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [filter, setFilter]     = useState('ALL')
  const [showResolved, setShowResolved] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (p = page, sev = filter, res = showResolved) => {
    setRefreshing(true)
    try {
      let url = `${API}/api/alerts?page=${p}&limit=20`
      if (sev !== 'ALL') url += `&severity=${sev}`
      if (res) url += `&resolved=true`
      const r   = await fetch(url)
      const data = await r.json()
      setAlerts(data.data || [])
      setTotal(data.total || 0)
    } catch { /* noop */ } finally { setLoading(false); setRefreshing(false) }
  }, [page, filter, showResolved])

  useEffect(() => { load() }, [load])

  // Poll every 15s
  useEffect(() => {
    const id = setInterval(() => load(), 15000)
    return () => clearInterval(id)
  }, [load])

  const handleResolve = (id) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a))
  }
  const handleEscalate = (id) => {
    setAlerts(prev => prev.map(a =>
      a.id === id ? { ...a, threat: { ...a.threat, severity: 'CRITICAL', escalated: true } } : a
    ))
  }

  const critCount = alerts.filter(a => a.threat?.severity === 'CRITICAL').length
  const highCount = alerts.filter(a => a.threat?.severity === 'HIGH').length

  const { setActions } = useTopbar()
  useEffect(() => {
    setActions(
      <>
        {critCount > 0 && (
          <span className="badge badge-critical" style={{ animation: 'pulse-badge 1s infinite', marginRight: 8 }}>
            {critCount} CRITICAL
          </span>
        )}
        <button
          id="refresh-alerts-btn"
          className="btn btn-ghost btn-sm"
          onClick={() => load()}
          disabled={refreshing}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin .7s linear infinite' : 'none', marginRight: 5 }} />
          Refresh
        </button>
      </>
    )
    return () => setActions(null)
  }, [critCount, refreshing, load, setActions])

  return (
    <div>

      <div className="page-container fade-in">
        <div className="page-header">
          <h1>🔍 Investigation Queue</h1>
          <p>
            AI-flagged suspicious activities requiring security team review.
            {' '}<strong style={{ color: 'var(--critical)' }}>{total}</strong> entries total.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="toolbar">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Filter by severity:</span>
          {SEV.map(s => (
            <button
              key={s}
              id={`filter-${s.toLowerCase()}`}
              className={`filter-chip ${filter === s ? (s !== 'ALL' ? s.toLowerCase() : 'active') : ''}`}
              onClick={() => { setFilter(s); setPage(1) }}
            >
              {s}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showResolved}
                onChange={e => { setShowResolved(e.target.checked); setPage(1) }}
              />
              Show Resolved
            </label>
          </div>
        </div>

        {/* Summary badges */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <SummaryPill label="Critical" count={alerts.filter(a => a.threat?.severity === 'CRITICAL').length} color="var(--critical)" bg="var(--critical-bg)" />
          <SummaryPill label="High"     count={alerts.filter(a => a.threat?.severity === 'HIGH').length}     color="var(--high)"     bg="var(--high-bg)" />
          <SummaryPill label="Medium"   count={alerts.filter(a => a.threat?.severity === 'MEDIUM').length}   color="var(--medium)"   bg="var(--medium-bg)" />
          <SummaryPill label="Resolved" count={alerts.filter(a => a.resolved).length}                        color="var(--low)"      bg="var(--low-bg)" />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex-center" style={{ height: 200 }}><div className="spinner" /></div>
        ) : alerts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛡️</div>
            <p>No threats matching current filters</p>
          </div>
        ) : (
          alerts.map(alert => (
            <ThreatCard
              key={alert.id}
              alert={alert}
              onResolve={handleResolve}
              onEscalate={handleEscalate}
            />
          ))
        )}

        {/* Pagination */}
        {total > 20 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0 12px' }}>
              Page {page} / {Math.ceil(total / 20)}
            </span>
            <button className="btn btn-ghost btn-sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryPill({ label, count, color, bg }) {
  return (
    <div style={{
      background: bg, border: `1px solid ${color}44`,
      borderRadius: 99, padding: '4px 12px',
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
    }}>
      <span style={{ color, fontWeight: 700 }}>{count}</span>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  )
}

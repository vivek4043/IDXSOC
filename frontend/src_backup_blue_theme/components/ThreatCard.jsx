import SeverityBadge from './SeverityBadge'
import { useState } from 'react'

const API = 'http://localhost:8000'

export default function ThreatCard({ alert, onResolve, onEscalate }) {
  const [loading, setLoading] = useState(null)
  const t   = alert.threat || {}
  const sev = (t.severity || 'LOW').toLowerCase()

  const handleAction = async (action) => {
    setLoading(action)
    try {
      await fetch(`${API}/api/alerts/${alert.id}/${action}`, { method: 'POST' })
      if (action === 'resolve' && onResolve) onResolve(alert.id)
      if (action === 'escalate' && onEscalate) onEscalate(alert.id)
    } catch { /* noop */ }
    finally { setLoading(null) }
  }

  const confidence = Math.round((t.confidence || 0) * 100)
  const confColor = confidence > 80 ? 'var(--critical)' : confidence > 55 ? 'var(--medium)' : 'var(--low)'

  return (
    <div
      id={`threat-${alert.id}`}
      className={`threat-card ${sev}-card ${alert.resolved ? 'resolved' : ''} fade-in`}
    >
      {/* Header */}
      <div className="threat-header">
        <span className="threat-icon">{t.icon || '🚨'}</span>
        <span className="threat-name">{t.threat_name || 'Unknown Threat'}</span>
        <SeverityBadge severity={t.severity} />
        {alert.resolved && <span className="badge badge-low">✓ Resolved</span>}
        {t.escalated && <span className="badge badge-critical">🔺 Escalated</span>}
      </div>

      {/* Meta row */}
      <div className="threat-meta">
        <span>🌐 {alert.ip}</span>
        <span>📁 {alert.request?.slice(0, 50)}{(alert.request?.length || 0) > 50 ? '…' : ''}</span>
        <span>📋 {t.category}</span>
        <span>🕒 {fmtTime(alert.timestamp)}</span>
        <span>🔗 {alert.source || 'web_server'}</span>
      </div>

      {/* Confidence */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 6px' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>AI Confidence</span>
        <div className="confidence-bar">
          <div className="confidence-fill" style={{ width: `${confidence}%`, background: confColor }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: confColor, whiteSpace: 'nowrap' }}>
          {confidence}%
        </span>
      </div>

      {/* Evidence */}
      {t.evidence && (
        <div className="threat-evidence">
          <span style={{ color: 'var(--text-muted)', fontSize: 10, display: 'block', marginBottom: 3 }}>EVIDENCE</span>
          {t.evidence}
        </div>
      )}

      {/* Recommendation */}
      {t.recommendation && (
        <div className="threat-rec">
          💡 <strong>Recommended Action:</strong> {t.recommendation}
        </div>
      )}

      {/* HTTP info */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {alert.method} → <span style={{ color: statusColor(alert.status) }}>{alert.status}</span>
        </span>
        <span>{alert.bytes !== '-' ? `${alert.bytes} bytes` : ''}</span>
      </div>

      {/* Actions */}
      {!alert.resolved && (
        <div className="threat-actions">
          <button
            id={`resolve-${alert.id}`}
            className="btn btn-success btn-sm"
            onClick={() => handleAction('resolve')}
            disabled={!!loading}
          >
            {loading === 'resolve' ? '…' : '✓ Mark Resolved'}
          </button>
          <button
            id={`escalate-${alert.id}`}
            className="btn btn-danger btn-sm"
            onClick={() => handleAction('escalate')}
            disabled={!!loading}
          >
            {loading === 'escalate' ? '…' : '🔺 Escalate'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigator.clipboard?.writeText(alert.ip)}
            title="Copy IP"
          >
            📋 Copy IP
          </button>
        </div>
      )}
    </div>
  )
}

function fmtTime(ts) {
  try { return new Date(ts).toLocaleString('en-IN', { hour12: false }) }
  catch { return ts || '' }
}

function statusColor(s) {
  if (s >= 500) return 'var(--critical)'
  if (s >= 400) return 'var(--medium)'
  if (s >= 300) return 'var(--accent)'
  return 'var(--low)'
}

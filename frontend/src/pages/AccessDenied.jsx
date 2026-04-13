import { useNavigate } from 'react-router-dom'
import { ShieldX, ArrowLeft, Lock } from 'lucide-react'

/**
 * AccessDenied — 403 page shown when a non-admin user attempts
 * to access a route inside /admin/*
 */
export default function AccessDenied({ user }) {
  const navigate = useNavigate()
  const timestamp = new Date().toISOString()

  return (
    <div className="access-denied-page">
      <div className="access-denied-card fade-in">

        {/* ── Header bar ── */}
        <div className="access-denied-header">
          <ShieldX size={14} style={{ color: 'var(--critical)' }} />
          <span className="access-denied-status">
            403 · Authorization Required
          </span>
          <div style={{ marginLeft: 'auto', width: 52, display: 'flex', gap: 6 }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
              <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="access-denied-body">
          <span className="access-denied-icon">
            <Lock size={52} style={{ color: 'var(--critical)', filter: 'drop-shadow(0 0 20px rgba(255,71,87,.5))' }} />
          </span>

          <div className="access-denied-code">403</div>
          <div className="access-denied-title">Access Denied</div>

          <p className="access-denied-desc">
            You do not have the required <strong style={{ color: 'var(--admin)' }}>Admin</strong> privileges
            to access this resource. This incident has been logged.
          </p>

          {/* Meta info block */}
          <div className="access-denied-meta">
            <div className="access-denied-meta-item">
              <div className="access-denied-meta-label">User</div>
              <div className="access-denied-meta-val">{user?.username || 'unknown'}</div>
            </div>
            <div className="access-denied-meta-item">
              <div className="access-denied-meta-label">Role</div>
              <div className="access-denied-meta-val">{user?.role || 'none'}</div>
            </div>
            <div className="access-denied-meta-item">
              <div className="access-denied-meta-label">Required</div>
              <div className="access-denied-meta-val">admin</div>
            </div>
          </div>

          {/* Terminal log line */}
          <div style={{
            background: 'rgba(0,0,0,.4)',
            border: '1px solid rgba(255,71,87,.15)',
            borderRadius: 6,
            padding: '10px 14px',
            marginBottom: 24,
            textAlign: 'left',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'rgba(255,71,87,.7)',
            lineHeight: 1.6,
          }}>
            <span style={{ color: 'var(--critical)' }}>✗</span>{' '}
            [idxsoc-soc] AUTH_FAIL: unauthorized access attempt<br />
            <span style={{ color: 'var(--text-muted)' }}>├─ timestamp: </span>
            <span style={{ color: '#a0d9b4' }}>{timestamp}</span><br />
            <span style={{ color: 'var(--text-muted)' }}>└─ status: </span>
            <span style={{ color: 'var(--critical)' }}>BLOCKED</span>
          </div>

          <button
            id="access-denied-back-btn"
            className="btn btn-ghost"
            onClick={() => navigate('/dashboard')}
            style={{ gap: 8 }}
          >
            <ArrowLeft size={14} />
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}

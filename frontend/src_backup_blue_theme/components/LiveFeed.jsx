import { useEffect, useRef, useState } from 'react'
import SeverityBadge from './SeverityBadge'

export default function LiveFeed() {
  const [lines, setLines] = useState([])
  const feedRef = useRef(null)
  const esRef   = useRef(null)

  useEffect(() => {
    const es = new EventSource('http://localhost:8000/api/live-feed')
    esRef.current = es
    es.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data)
        setLines(prev => {
          const next = [entry, ...prev].slice(0, 120)
          return next
        })
      } catch { /* noop */ }
    }
    return () => es.close()
  }, [])

  const fmt = (ts) => {
    try { return new Date(ts).toLocaleTimeString('en-IN', { hour12: false }) }
    catch { return '' }
  }

  const lineClass = (entry) => {
    if (!entry.flagged) return 'feed-line'
    const sev = entry.threat?.severity || ''
    if (sev === 'CRITICAL' || sev === 'HIGH') return 'feed-line danger'
    return 'feed-line warning'
  }

  return (
    <div className="live-feed" ref={feedRef} id="live-feed-container">
      {lines.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: 12 }}>
          Connecting to live stream…
        </div>
      )}
      {lines.map((entry, i) => (
        <div key={entry.id + i} className={lineClass(entry)}>
          <span className="feed-ts">{fmt(entry.timestamp)}</span>
          <span className="feed-ip">{entry.ip?.padEnd(15)}</span>
          <span className="feed-req">
            <span style={{ color: methodColor(entry.method), marginRight: 6 }}>{entry.method}</span>
            {entry.request}
          </span>
          {entry.flagged && (
            <span className="feed-tag">
              <SeverityBadge severity={entry.threat?.severity} />
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function methodColor(m) {
  const c = { GET: '#63b3ed', POST: '#68d391', PUT: '#f6ad55', DELETE: '#fc8181', PATCH: '#b794f4' }
  return c[m] || 'var(--text-secondary)'
}

import { useState, useEffect } from 'react'
import { ShieldCheck, AlertTriangle, Edit3, Trash2 } from 'lucide-react'

const SEV_CLR = { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' }

export default function DetectionRules() {
  const [rules, setRules]       = useState([])
  const [filter, setFilter]     = useState('All')
  const [selected, setSelected] = useState(null)

  // Pattern Modal State
  const [editingRule, setEditingRule] = useState(null)
  const [patterns, setPatterns] = useState([])
  const [newPattern, setNewPattern] = useState('')

  const fetchRules = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/rules')
      const data = await res.json()
      setRules(data)
    } catch (err) {
      console.error('Failed to fetch rules', err)
    }
  }

  useEffect(() => {
    fetchRules()
  }, [])

  const categories = ['All', ...new Set(rules.map(r => r.category))]
  const filtered = filter === 'All' ? rules : rules.filter(r => r.category === filter)

  const toggle = async (id) => {
    try {
      const res = await fetch(`http://localhost:8000/api/rules/${id}/toggle`, { method: 'PUT' })
      if (res.ok) fetchRules()
    } catch (err) {
      console.error('Failed to toggle rule', err)
    }
  }

  const updateSeverity = async (id, severity) => {
    try {
      const res = await fetch(`http://localhost:8000/api/rules/${id}/severity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severity })
      })
      if (res.ok) fetchRules()
    } catch (err) {
      console.error('Failed to update severity', err)
    }
  }

  const handleSavePatterns = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/rules/${editingRule.id}/patterns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patterns })
      })
      if (res.ok) {
        setEditingRule(null)
        setNewPattern('')
        fetchRules()
      }
    } catch (err) {
      console.error('Failed to save patterns', err)
    }
  }

  return (
    <div className="page-container fade-in">
      {/* ── Header ── */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <div className="admin-icon-wrap"><ShieldCheck size={18} /></div>
          <div>
            <h1>Detection Rules</h1>
            <div className="admin-page-sub">Enable, disable, and monitor active threat detection signatures</div>
          </div>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 20 }}>
        {[
          { label: 'Total Rules',   value: rules.length,                              cls: 'info' },
          { label: 'Active',        value: rules.filter(r => r.enabled).length,       cls: 'online' },
          { label: 'Disabled',      value: rules.filter(r => !r.enabled).length,      cls: 'medium' },
          { label: 'Total Hits',    value: rules.reduce((a, r) => a + (r.hits || 0), 0), cls: 'critical' },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`stat-card ${cls}`}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{typeof value === 'number' && value > 999 ? value.toLocaleString() : value}</div>
          </div>
        ))}
      </div>

      {/* ── Category filter ── */}
      <div className="toolbar">
        {categories.map(cat => (
          <button
            key={cat}
            className={`filter-chip${filter === cat ? ' active' : ''}`}
            onClick={() => setFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Rules list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(rule => (
          <div
            key={rule.id}
            id={`rule-${rule.id}`}
            className="card"
            style={{
              padding: '14px 18px',
              cursor: 'pointer',
              borderColor: selected === rule.id ? 'var(--admin-border)' : '',
              opacity: rule.enabled ? 1 : 0.55,
              transition: 'all var(--transition)',
            }}
            onClick={() => setSelected(selected === rule.id ? null : rule.id)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Toggle */}
              <label className="toggle-switch" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => toggle(rule.id)}
                  aria-label={`Toggle ${rule.name}`}
                />
                <span className="toggle-slider" />
              </label>

              {/* Name & category */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{rule.icon || '🛡️'} {rule.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>[{rule.id}]</span>
                  
                  <select 
                    className={`badge badge-${SEV_CLR[rule.severity]}`}
                    style={{ WebkitAppearance: 'none', appearance: 'none', cursor: 'pointer', border: '1px solid transparent', outline: 'none' }}
                    value={rule.severity}
                    onClick={e => e.stopPropagation()}
                    onChange={e => updateSeverity(rule.id, e.target.value)}
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>

                  {!rule.enabled && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255,255,255,.05)', padding: '1px 6px', borderRadius: 3 }}>
                      DISABLED
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{rule.category}</div>
              </div>

              {/* Edit Patterns Button */}
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setEditingRule(rule); 
                  setPatterns(rule.patterns ? [...rule.patterns] : []); 
                }}
              >
                <Edit3 size={14} /> Edit Patterns
              </button>

              {/* Hits */}
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: rule.enabled ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {rule.hits ? rule.hits.toLocaleString() : '0'}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>HITS</div>
              </div>
            </div>

            {/* Expanded detail */}
            {selected === rule.id && (
              <div style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid rgba(74,222,128,.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertTriangle size={13} style={{ color: 'var(--medium)', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <strong>Recommendation/Action:</strong> {rule.recommendation || rule.description || 'No action defined.'}
                  </span>
                </div>
                {rule.patterns && rule.patterns.length > 0 && (
                  <div className="terminal-container" style={{ marginTop: 8, fontSize: 11 }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Active Regex Patterns:</div>
                    {rule.patterns.map((p, i) => (
                      <div key={i} style={{ color: 'var(--text-code)', padding: '2px 0' }}>{p}</div>
                    ))}
                  </div>
                )}
                {(!rule.patterns || rule.patterns.length === 0) && (
                   <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 22 }}>
                     No specific regex patterns (Rule logic is algorithm-based or heuristic).
                   </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Pattern Edit Modal ── */}
      {editingRule && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, 
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 24, animation: 'fadeIn 0.2s ease-out' }}>
            <h2 style={{ fontSize: 18, marginBottom: 16, color: 'var(--text-primary)' }}>
              Edit Patterns - {editingRule.name}
            </h2>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
               {patterns.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     <input className="input" style={{ flex: 1, fontFamily: 'monospace', fontSize: 13, background: 'rgba(0,0,0,.2)' }} value={p} onChange={e => {
                        const newP = [...patterns];
                        newP[i] = e.target.value;
                        setPatterns(newP);
                     }} />
                     <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPatterns(patterns.filter((_, idx) => idx !== i))}>
                        <Trash2 size={16} style={{ color: 'var(--critical)' }}/>
                     </button>
                  </div>
               ))}
               <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                  <input className="input" style={{ fontFamily: 'monospace', fontSize: 13 }} placeholder="New regex pattern..." value={newPattern} onChange={e => setNewPattern(e.target.value)} />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { if (newPattern) { setPatterns([...patterns, newPattern]); setNewPattern(''); } }}>
                     Add Pattern
                  </button>
               </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <button type="button" className="btn btn-ghost" onClick={() => { setEditingRule(null); setNewPattern(''); }}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSavePatterns}>Save Patterns</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { Activity, Shield, AlertTriangle, Zap, Wifi, Server, Target } from 'lucide-react'
import SeverityBadge from '../components/SeverityBadge'
import LiveFeed from '../components/LiveFeed'

const API = 'http://localhost:8000'

const SEVERITY_COLORS = {
  CRITICAL: '#ff4757', HIGH: '#ff6b35', MEDIUM: '#ffa502', LOW: '#2ed573', UNKNOWN: '#5352ed'
}

function useCounter(target, duration = 900) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) { setVal(0); return }
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setVal(Math.floor(p * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return val
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function Dashboard() {
  const [stats, setStats]   = useState(null)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [sRes, aRes] = await Promise.all([
        fetch(`${API}/api/stats`),
        fetch(`${API}/api/alerts?limit=5`),
      ])
      const [s, a] = await Promise.all([sRes.json(), aRes.json()])
      setStats(s)
      setAlerts(a.data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(); const id = setInterval(load, 10000); return () => clearInterval(id) }, [load])

  const total    = useCounter(stats?.total_events || 0)
  const threats  = useCounter(stats?.total_alerts || 0)
  const resolved = useCounter(stats?.resolved || 0)
  const pending  = useCounter(stats?.pending_investigation || 0)

  if (loading) return <LoadingState />

  const sev = stats?.severity_breakdown || {}
  const pieData = Object.entries(SEVERITY_COLORS)
    .map(([k]) => ({ name: k, value: sev[k] || 0 }))
    .filter(d => d.value > 0)

  const trend         = stats?.hourly_trend?.slice(-12) || []
  const topIPs        = stats?.top_attacking_ips || []
  const subnetData    = stats?.subnet_breakdown  || []
  const maxSubnetEvts = Math.max(...subnetData.map(s => s.events), 1)

  return (
    <div>
      <div className="page-container fade-in">

        {/* ── Stat Cards ── */}
        <div className="stats-grid">
          <StatCard icon="📡" label="Total Events"         value={total.toLocaleString()}
            sub="Since monitoring began"       variant="info"     iconBg="rgba(34,211,238,.1)"  iconColor="#22d3ee" />
          <StatCard icon="🚨" label="Threats Detected"    value={threats.toLocaleString()}
            sub={`${sev.CRITICAL || 0} critical`}              variant="critical" iconBg="rgba(255,71,87,.1)"  iconColor="#ff4757" />
          <StatCard icon="⏳" label="Pending Investigation" value={pending.toLocaleString()}
            sub="Require immediate attention"  variant="medium"   iconBg="rgba(234,179,8,.1)"   iconColor="#eab308" />
          <StatCard icon="✅" label="Resolved"             value={resolved.toLocaleString()}
            sub="Threats neutralized"          variant="online"   iconBg="rgba(74,222,128,.1)"  iconColor="#4ade80" />
        </div>

        {/* ── Row 2: Top Attackers + Campus Subnet Breakdown ── */}
        <div className="grid-60-40 mb-24">

          {/* Top Attackers Panel */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Target size={15} /> Top Attacking IPs</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>By threat count · live</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}>#</th>
                    <th>IP Address</th>
                    <th>Subnet Zone</th>
                    <th>Threats</th>
                    <th>Events</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {topIPs.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      No threat data yet
                    </td></tr>
                  )}
                  {topIPs.map((row, i) => {
                    const isExternal = row.subnet === 'External'
                    return (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{i + 1}</td>
                        <td>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 12,
                            color: isExternal ? '#ff4757' : 'var(--accent)',
                          }}>
                            {isExternal && '⚠ '}{row.ip}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 5,
                            background: 'rgba(255,255,255,.05)',
                            color: isExternal ? '#ff4757' : 'var(--text-secondary)',
                          }}>
                            {row.subnet}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: '#ff4757', fontWeight: 700, fontSize: 13 }}>
                            {row.threat_count ?? row.count}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{row.count}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                          {fmtTime(row.last_seen)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Campus Subnet Breakdown */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Wifi size={15} /> Campus Network Zones</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Events vs threats</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {subnetData.length === 0 && (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24, fontSize: 13 }}>
                  No subnet data yet
                </div>
              )}
              {subnetData.map((s) => {
                const evtPct     = Math.round((s.events  / maxSubnetEvts) * 100)
                const threatPct  = s.events > 0 ? Math.round((s.threats / s.events) * 100) : 0
                return (
                  <div key={s.label}>
                    {/* Label row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{s.events.toLocaleString()} events</span>
                        <span style={{ color: s.threats > 0 ? '#ff4757' : 'var(--text-muted)', fontWeight: s.threats > 0 ? 700 : 400 }}>
                          {s.threats} threats
                        </span>
                      </div>
                    </div>
                    {/* Event bar */}
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.06)', overflow: 'hidden', marginBottom: 3 }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${evtPct}%`,
                        background: s.color,
                        opacity: 0.4,
                        transition: 'width .6s ease',
                      }} />
                    </div>
                    {/* Threat overlay bar */}
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.04)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        width: `${evtPct > 0 ? Math.round((s.threats / maxSubnetEvts) * 100) : 0}%`,
                        background: '#ff4757',
                        transition: 'width .6s ease',
                      }} />
                    </div>
                    {/* Threat % badge */}
                    {s.events > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textAlign: 'right' }}>
                        {threatPct}% threat rate
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Legend */}
              {subnetData.length > 0 && (
                <div style={{ display: 'flex', gap: 16, marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 12, height: 6, borderRadius: 2, background: 'rgba(74,222,128,.4)', display: 'inline-block' }} />
                    Events
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 12, height: 4, borderRadius: 2, background: '#ff4757', display: 'inline-block' }} />
                    Threats
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Row 3: Live Event Stream ── */}
        <div className="mb-24">
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Activity size={15} /> Live Event Stream</div>
              <div className="live-badge" style={{ fontSize: 11, padding: '3px 8px' }}>
                <div className="live-dot" />STREAMING
              </div>
            </div>
            <LiveFeed />
          </div>
        </div>

        {/* ── Row 4: Trend + Severity Pie ── */}
        <div className="grid-3 mb-24">
          {/* Trend Chart */}
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-header">
              <div className="card-title"><Zap size={13} /> Activity Trend (Last 12h)</div>
            </div>
            <div className="card-body chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradNormal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradAlert" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ff4757" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ff4757" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#3a5245', fontFamily: 'JetBrains Mono' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#3a5245', fontFamily: 'JetBrains Mono' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 6, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    labelStyle={{ color: 'var(--accent)' }}
                  />
                  <Area type="monotone" dataKey="normal" stroke="#4ade80" fill="url(#gradNormal)" strokeWidth={1.5} name="Normal" />
                  <Area type="monotone" dataKey="alerts" stroke="#ff4757" fill="url(#gradAlert)"  strokeWidth={1.5} name="Threats" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Severity Pie */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><AlertTriangle size={15} /> Severity Split</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                    dataKey="value" paddingAngle={3}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={SEVERITY_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 }}>
                {pieData.map(d => (
                  <span key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEVERITY_COLORS[d.name], display: 'inline-block' }} />
                    {d.name} ({d.value})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 5: Recent Threats + Attack Categories ── */}
        <div className="grid-2">
          {/* Recent Threats */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Shield size={15} /> Recent Threats</div>
            </div>
            <div style={{ padding: '8px 12px' }}>
              {alerts.length === 0
                ? <div className="empty-state" style={{ padding: 30 }}><div>No threats flagged yet</div></div>
                : alerts.map((a, i) => (
                    <div key={a.id || i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 8px', borderBottom: '1px solid var(--border)',
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.threat?.icon} {a.threat?.threat_name || 'Unknown'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.ip} → {a.request?.slice(0, 40)}
                        </div>
                      </div>
                      <SeverityBadge severity={a.threat?.severity} />
                    </div>
                  ))
              }
            </div>
          </div>

          {/* Attack Categories */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Server size={15} /> Attack Categories</div>
            </div>
            <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.entries(stats?.category_breakdown || {})
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <div key={cat} style={{
                    background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 16px',
                    border: '1px solid var(--border)', textAlign: 'center', minWidth: 100,
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{count}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{cat}</div>
                  </div>
                ))
              }
              {!Object.keys(stats?.category_breakdown || {}).length && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>No data yet</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, variant, iconBg, iconColor }) {
  return (
    <div className={`stat-card ${variant}`}>
      <div className="stat-icon" style={{ background: iconBg }}>
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: 16, color: 'var(--text-muted)' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
      <div>Loading dashboard…</div>
    </div>
  )
}

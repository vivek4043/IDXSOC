import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Cell,
} from 'recharts'
import { useTopbar } from '../components/TopbarContext'

const API = 'http://localhost:8000'

const COLORS = ['#ff4757', '#ff6b35', '#ffa502', '#2ed573', '#5352ed', '#3b82f6', '#8b5cf6', '#06b6d4']

export default function Analytics() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/stats`)
      const data = await res.json()
      setStats(data)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id) }, [load])

  const { setActions } = useTopbar()
  useEffect(() => {
    setActions(
      <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
    )
    return () => setActions(null)
  }, [load, setActions])

  if (loading) return (
    <div className="flex-center" style={{ height: '80vh' }}><div className="spinner" style={{ width: 36, height: 36 }} /></div>
  )

  const catData = Object.entries(stats?.category_breakdown || {})
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  const sevData = Object.entries(stats?.severity_breakdown || {})
    .map(([name, value]) => ({ name, value }))

  const trend = stats?.hourly_trend || []
  const topIPs = (stats?.top_attacking_ips || []).slice(0, 8)

  const radarData = catData.map(d => ({ subject: d.name, A: d.value }))

  const totalEvents  = stats?.total_events || 0
  const totalAlerts  = stats?.total_alerts || 0
  const threatRate   = totalEvents > 0 ? ((totalAlerts / totalEvents) * 100).toFixed(1) : 0
  const resolvedRate = totalAlerts > 0 ? (((stats?.resolved || 0) / totalAlerts) * 100).toFixed(1) : 0

  return (
    <div>

      <div className="page-container fade-in">
        <div className="page-header">
          <h1>📊 Threat Analytics</h1>
          <p>Deep-dive into attack patterns, trends, and source distribution.</p>
        </div>

        {/* KPI Row */}
        <div className="stats-grid mb-24">
          <KPICard label="Threat Detection Rate" value={`${threatRate}%`} note="Of all traffic" color="var(--critical)" />
          <KPICard label="Resolution Rate"        value={`${resolvedRate}%`} note="Threats resolved" color="var(--low)" />
          <KPICard label="Unique Attack Sources"  value={(topIPs.length).toLocaleString()} note="Top attacker IPs" color="var(--accent)" />
          <KPICard label="Attack Categories"      value={(catData.length).toLocaleString()} note="Distinct types" color="var(--medium)" />
        </div>

        {/* Full trend */}
        <div className="card mb-24">
          <div className="card-header">
            <div className="card-title">📈 Full 24-Hour Traffic + Threat Timeline</div>
          </div>
          <div className="card-body" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="gN" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ff4757" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#ff4757" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#3a5245', fontFamily: 'JetBrains Mono' }} />
                <YAxis tick={{ fontSize: 10, fill: '#3a5245', fontFamily: 'JetBrains Mono' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 6, fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                <Area type="monotone" dataKey="normal" stroke="#4ade80" fill="url(#gN)" strokeWidth={1.5} name="Normal Traffic" />
                <Area type="monotone" dataKey="alerts" stroke="#ff4757" fill="url(#gA)" strokeWidth={1.5} name="Threats" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid-2 mb-24">
          {/* Attack Category Bar */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🗂️ Attack Categories</div>
            </div>
            <div className="card-body" style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#4a5568' }} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11, fill: '#8b9ab8' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Severity Bar */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">⚠️ Severity Distribution</div>
            </div>
            <div className="card-body" style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sevData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8b9ab8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#4a5568' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {sevData.map((d, i) => (
                      <Cell key={i} fill={
                        d.name === 'CRITICAL' ? '#ff4757' :
                        d.name === 'HIGH'     ? '#ff6b35' :
                        d.name === 'MEDIUM'   ? '#ffa502' : '#2ed573'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid-2">
          {/* Radar */}
          {radarData.length > 2 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">🕸️ Attack Vector Radar</div>
              </div>
              <div className="card-body" style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                    <Radar name="Attacks" dataKey="A" stroke="#ff4757" fill="#ff4757" fillOpacity={0.25} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top IPs Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🌍 Top Attack Sources</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th>Rank</th><th>IP</th><th>Country</th><th>Attacks</th></tr>
                </thead>
                <tbody>
                  {topIPs.map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: i < 3 ? 'var(--critical)' : 'var(--text-muted)' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </td>
                      <td style={{ color: 'var(--accent)' }}>{r.ip}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{r.geo?.country || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, (r.count / (topIPs[0]?.count || 1)) * 100)}%`, background: 'var(--critical)', borderRadius: 2 }} />
                          </div>
                          <span style={{ fontWeight: 700, color: 'var(--critical)', minWidth: 30 }}>{r.count}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, note, color }) {
  return (
    <div className="stat-card" style={{ borderTop: `2px solid ${color}` }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color, fontSize: 28 }}>{value}</div>
      <div className="stat-sub">{note}</div>
    </div>
  )
}

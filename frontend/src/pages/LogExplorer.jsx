import { useEffect, useState, useRef, useCallback } from 'react'
import SeverityBadge from '../components/SeverityBadge'
import { Upload, Search, Download, RefreshCw } from 'lucide-react'
import { useTopbar } from '../components/TopbarContext'

const API = 'http://localhost:8000'

export default function LogExplorer() {
  const [logs, setLogs]       = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [ipFilter, setIpFilter] = useState('')
  const [sevFilter, setSevFilter] = useState('')
  const [flagged, setFlagged]   = useState(false)
  const [loading, setLoading]   = useState(true)
  const [uploadStatus, setUploadStatus] = useState(null)  // { message, threats }
  const [uploading, setUploading] = useState(false)
  const [dragover, setDragover] = useState(false)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let url = `${API}/api/logs?page=${page}&limit=50`
      if (search)    url += `&search=${encodeURIComponent(search)}`
      if (ipFilter)  url += `&ip=${encodeURIComponent(ipFilter)}`
      if (sevFilter) url += `&severity=${sevFilter}`
      if (flagged)   url += `&flagged_only=true`
      const res  = await fetch(url)
      const data = await res.json()
      setLogs(data.data || [])
      setTotal(data.total || 0)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [page, search, ipFilter, sevFilter, flagged])

  useEffect(() => { load() }, [load])

  const handleUpload = async (file) => {
    if (!file) return
    setUploading(true)
    setUploadStatus(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res  = await fetch(`${API}/api/upload-log`, { method: 'POST', body: form })
      const data = await res.json()
      setUploadStatus(data)
      load()
    } catch {
      setUploadStatus({ message: 'Upload failed. Check backend connection.' })
    } finally { setUploading(false) }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragover(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  const fmt = (ts) => {
    try { return new Date(ts).toLocaleString('en-IN', { hour12: false }) }
    catch { return ts || '' }
  }

  const exportCSV = () => {
    const rows = [
      ['ID','IP','Timestamp','Method','Request','Status','Flagged','Threat'],
      ...logs.map(l => [l.id, l.ip, l.timestamp, l.method, l.request, l.status, l.flagged ? 'YES' : 'NO', l.threat?.threat_name || '-'])
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'idxsoc_logs.csv'; a.click()
  }

  const { setActions } = useTopbar()
  useEffect(() => {
    setActions(
      <>
        <button id="export-csv-btn" className="btn btn-ghost btn-sm" onClick={exportCSV} style={{ marginRight: 8 }}>
          <Download size={13} style={{ marginRight: 5 }} /> Export CSV
        </button>
        <button id="refresh-logs-btn" className="btn btn-ghost btn-sm" onClick={load}>
          <RefreshCw size={13} style={{ marginRight: 5 }} /> Refresh
        </button>
      </>
    )
    return () => setActions(null)
  }, [load, setActions])

  return (
    <div>

      <div className="page-container fade-in">
        <div className="page-header">
          <h1>📁 Log Explorer</h1>
          <p>Browse, search, and upload log files for AI analysis.</p>
        </div>

        {/* Upload Zone */}
        <div
          className={`upload-zone mb-24 ${dragover ? 'dragover' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragover(true) }}
          onDragLeave={() => setDragover(false)}
          onDrop={onDrop}
        >
          <input
            ref={fileRef}
            type="file"
            id="log-file-input"
            accept=".log,.txt,.json,.csv"
            style={{ display: 'none' }}
            onChange={e => handleUpload(e.target.files[0])}
          />
          {uploading ? (
            <div>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <div className="upload-text">Analyzing with AI…</div>
              <div style={{ marginTop: 16 }}>
                <div className="progress-bar" style={{ width: 200, margin: '0 auto' }}>
                  <div className="progress-fill" style={{ width: '70%' }} />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="upload-icon">📂</div>
              <div className="upload-text">Drop log file here or click to browse</div>
              <div className="upload-sub">Supports Apache, Nginx, Syslog, Suricata EVE JSON, CSV</div>
            </>
          )}
        </div>

        {/* Upload result */}
        {uploadStatus && (
          <div className={`card mb-24`} style={{ padding: '14px 18px', borderColor: uploadStatus.threats_found > 0 ? 'rgba(255,71,87,.4)' : 'rgba(46,213,115,.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{uploadStatus.threats_found > 0 ? '🚨' : '✅'}</span>
              <div>
                <div style={{ fontWeight: 600 }}>{uploadStatus.message}</div>
                {uploadStatus.threats_found > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--critical)', marginTop: 2 }}>
                    {uploadStatus.threats_found} suspicious entries flagged for investigation
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="toolbar">
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              id="search-logs-input"
              className="input"
              type="text"
              placeholder="Search IP or request…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              style={{ paddingLeft: 32, width: '100%' }}
            />
          </div>
          <input
            id="ip-filter-input"
            className="input"
            style={{ width: 140 }}
            placeholder="Filter IP prefix"
            value={ipFilter}
            onChange={e => { setIpFilter(e.target.value); setPage(1) }}
          />
          <select
            id="severity-filter-select"
            className="input"
            value={sevFilter}
            onChange={e => { setSevFilter(e.target.value); setPage(1) }}
            style={{ width: 130 }}
          >
            <option value="">All Severity</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={flagged} onChange={e => { setFlagged(e.target.checked); setPage(1) }} />
            Threats only
          </label>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {total.toLocaleString()} entries
          </span>
        </div>

        {/* Table */}
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div className="flex-center" style={{ height: 200 }}><div className="spinner" /></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>IP</th>
                    <th>Method</th>
                    <th>Request</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>AI Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log.id || i} className={log.flagged ? 'flagged' : ''}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{fmt(log.timestamp)}</td>
                      <td style={{ color: 'var(--accent)' }}>{log.ip}</td>
                      <td style={{ color: methodColor(log.method) }}>{log.method}</td>
                      <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                        {log.request}
                      </td>
                      <td style={{ color: statusColor(log.status) }}>{log.status || '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{log.source}</td>
                      <td>
                        {log.flagged
                          ? <SeverityBadge severity={log.threat?.severity} />
                          : <span style={{ color: 'var(--low)', fontSize: 11 }}>✓ Clean</span>
                        }
                      </td>
                    </tr>
                  ))}
                  {!logs.length && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No logs found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Pagination */}
        {total > 50 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0 12px' }}>
              Page {page} / {Math.ceil(total / 50)}
            </span>
            <button className="btn btn-ghost btn-sm" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}

const methodColor = m => ({ GET: '#63b3ed', POST: '#68d391', PUT: '#f6ad55', DELETE: '#fc8181' }[m] || 'var(--text-secondary)')
const statusColor = s => s >= 500 ? 'var(--critical)' : s >= 400 ? 'var(--medium)' : s >= 300 ? 'var(--accent)' : 'var(--low)'

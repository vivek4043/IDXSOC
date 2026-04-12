import { useState, useEffect } from 'react'
import { ListFilter, Save, CheckCircle } from 'lucide-react'

export default function Whitelists() {
  const [ips, setIps] = useState('')
  const [urls, setUrls] = useState('')
  const [savedIp, setSavedIp] = useState(false)
  const [savedUrl, setSavedUrl] = useState(false)

  useEffect(() => {
    fetch('http://localhost:8000/api/whitelists')
      .then(r => r.json())
      .then(data => {
        if (data.ips) setIps(data.ips.join('\n'))
        if (data.urls) setUrls(data.urls.join('\n'))
      })
      .catch(err => console.error('Failed to load whitelists', err))
  }, [])

  const saveIps = async () => {
    const arr = ips.split('\n').map(l => l.trim()).filter(Boolean)
    try {
      const res = await fetch('http://localhost:8000/api/whitelists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ips: arr })
      })
      if (res.ok) {
        setSavedIp(true)
        setTimeout(() => setSavedIp(false), 2000)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const saveUrls = async () => {
    const arr = urls.split('\n').map(l => l.trim()).filter(Boolean)
    try {
      const res = await fetch('http://localhost:8000/api/whitelists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: arr })
      })
      if (res.ok) {
        setSavedUrl(true)
        setTimeout(() => setSavedUrl(false), 2000)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="page-container fade-in">
      <div className="admin-page-header">
        <div className="admin-page-title">
          <div className="admin-icon-wrap"><ListFilter size={18} /></div>
          <div>
            <h1>Whitelists</h1>
            <div className="admin-page-sub">Configure threat exclusion rules for trusted sources and internal endpoints</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        
        {/* IP Whitelist */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 14, marginBottom: 8, color: 'var(--text-primary)' }}>IP Whitelist</h2>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Traffic matching these exact IPs or CIDR subnets will be entirely skipped by the detection engine. Enter one per line.
          </div>
          <textarea
            className="input"
            style={{ width: '100%', height: 200, fontFamily: 'monospace', resize: 'vertical' }}
            placeholder="192.168.1.0/24&#10;10.0.0.1"
            value={ips}
            onChange={e => setIps(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={saveIps} style={{ width: 100 }}>
              {savedIp ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> Save IPs</>}
            </button>
          </div>
        </div>

        {/* URL Whitelist */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 14, marginBottom: 8, color: 'var(--text-primary)' }}>URL Path Whitelist</h2>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Requests where the URL path contains any of these strings will be ignored (e.g. internal health probes). Enter one per line.
          </div>
          <textarea
            className="input"
            style={{ width: '100%', height: 200, fontFamily: 'monospace', resize: 'vertical' }}
            placeholder="/ping&#10;/healthz"
            value={urls}
            onChange={e => setUrls(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={saveUrls} style={{ width: 100 }}>
              {savedUrl ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> Save URLs</>}
            </button>
          </div>
        </div>
        
      </div>
    </div>
  )
}

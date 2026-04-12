import { useState, useEffect } from 'react'
import { SlidersHorizontal, Save, CheckCircle } from 'lucide-react'

export default function SystemSettings() {
  const [retentionDays, setRetentionDays] = useState(90)
  const [emailAlert, setEmailAlert] = useState('')
  const [slackWebhook, setSlackWebhook] = useState('')

  const [savedRetention, setSavedRetention] = useState(false)
  const [savedEmail, setSavedEmail] = useState(false)
  const [savedSlack, setSavedSlack] = useState(false)

  useEffect(() => {
    fetch('http://localhost:8000/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.retentionDays !== undefined) setRetentionDays(data.retentionDays)
        if (data.emailAlert !== undefined) setEmailAlert(data.emailAlert)
        if (data.slackWebhook !== undefined) setSlackWebhook(data.slackWebhook)
      })
      .catch(err => console.error('Failed to load settings', err))
  }, [])

  const saveSetting = async (key, value, setSavedState) => {
    try {
      const res = await fetch('http://localhost:8000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      })
      if (res.ok) {
        setSavedState(true)
        setTimeout(() => setSavedState(false), 2000)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="page-container fade-in">
      <div className="admin-page-header">
        <div className="admin-page-title">
          <div className="admin-icon-wrap"><SlidersHorizontal size={18} /></div>
          <div>
            <h1>System Settings</h1>
            <div className="admin-page-sub">Global variables and external notification hooks</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 600 }}>
        
        {/* Data Retention */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 14, marginBottom: 8, color: 'var(--text-primary)' }}>Data Retention</h2>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Control how long logs and alerts are stored in the active system memory before being flushed.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Purge data older than (days):</label>
              <input
                type="number"
                className="input"
                style={{ width: '100%', maxWidth: 200 }}
                value={retentionDays}
                onChange={e => setRetentionDays(Number(e.target.value))}
                min={1}
              />
            </div>
            <button className="btn btn-primary" onClick={() => saveSetting('retentionDays', retentionDays, setSavedRetention)} style={{ marginTop: 22, width: 90 }}>
              {savedRetention ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> Save</>}
            </button>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 14, marginBottom: 8, color: 'var(--text-primary)' }}>Notification Settings</h2>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Configure where automated system alerts target when High and Critical threats trigger.
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Email Alert Address:</label>
              <input
                type="email"
                className="input"
                style={{ width: '100%' }}
                placeholder="secops@company.com"
                value={emailAlert}
                onChange={e => setEmailAlert(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={() => saveSetting('emailAlert', emailAlert, setSavedEmail)} style={{ marginTop: 22, width: 90 }}>
              {savedEmail ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> Save</>}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Slack Webhook URL:</label>
              <input
                type="url"
                className="input"
                style={{ width: '100%' }}
                placeholder="https://hooks.slack.com/services/..."
                value={slackWebhook}
                onChange={e => setSlackWebhook(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={() => saveSetting('slackWebhook', slackWebhook, setSavedSlack)} style={{ marginTop: 22, width: 90 }}>
              {savedSlack ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> Save</>}
            </button>
          </div>

        </div>

      </div>
    </div>
  )
}

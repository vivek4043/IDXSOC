import { useState, useEffect, useRef } from 'react'
import { loginRequest } from '../api'

const API = 'http://localhost:8000'


/* ── Binary Rain Canvas ──────────────────────────────────────── */
function BinaryRain() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const fontSize  = 14
    const chars     = '01'
    let columns     = Math.floor(canvas.width / fontSize)
    let drops       = Array.from({ length: columns }, () => Math.random() * -100)

    // speed tiers so some columns fall faster
    let speeds = drops.map(() => 0.3 + Math.random() * 0.7)
    // brightness layers
    let brightnessPhase = drops.map(() => Math.random() * Math.PI * 2)

    const draw = () => {
      // fading trail
      ctx.fillStyle = 'rgba(7, 11, 21, 0.06)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      columns = Math.floor(canvas.width / fontSize)
      while (drops.length < columns) { drops.push(0); speeds.push(0.3 + Math.random() * 0.7); brightnessPhase.push(Math.random() * Math.PI * 2) }

      for (let i = 0; i < columns; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)]
        const x    = i * fontSize
        const y    = drops[i] * fontSize

        brightnessPhase[i] += 0.04
        const bright = 0.4 + 0.6 * Math.abs(Math.sin(brightnessPhase[i]))

        // head glyph — bright green
        ctx.fillStyle = `rgba(0, 255, 100, ${bright})`
        ctx.shadowColor = 'rgba(0, 255, 80, 0.9)'
        ctx.shadowBlur  = 8
        ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`
        ctx.fillText(char, x, y)
        ctx.shadowBlur = 0

        // occasional brighter "glitch" column
        if (Math.random() > 0.995) {
          ctx.fillStyle = 'rgba(180, 255, 200, 0.9)'
          ctx.fillText(char, x, y)
        }

        drops[i] += speeds[i]

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i]          = 0
          speeds[i]          = 0.3 + Math.random() * 0.7
          brightnessPhase[i] = Math.random() * Math.PI * 2
        }
      }
    }

    const id = setInterval(draw, 40)
    return () => {
      clearInterval(id)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        opacity: 0.65,
      }}
    />
  )
}

/* ── Typing Cursor ────────────────────────────────────────────── */
function TypedLine({ text, delay = 0, color = '#a0d9b4', speed = 40 }) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone]           = useState(false)

  useEffect(() => {
    let t0 = setTimeout(() => {
      let i = 0
      const id = setInterval(() => {
        i++
        setDisplayed(text.slice(0, i))
        if (i >= text.length) { clearInterval(id); setDone(true) }
      }, speed)
      return () => clearInterval(id)
    }, delay)
    return () => clearTimeout(t0)
  }, [text, delay, speed])

  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color, lineHeight: 1.7 }}>
      {displayed}
      {!done && <span style={{ animation: 'term-blink 1s step-end infinite', borderRight: '1.5px solid currentColor', marginLeft: 1 }} />}
    </div>
  )
}

/* ── Main Login ───────────────────────────────────────────────── */
export default function Login({ onLogin }) {
  const [form, setForm]     = useState({ username: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [bootDone, setBootDone] = useState(false)

  useEffect(() => { setTimeout(() => setBootDone(true), 2400) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res  = await loginRequest(form.username, form.password)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed')
      // Store token separately so apiFetch() can read it
      if (data.token) {
        sessionStorage.setItem('idxsoc_token', data.token)
      }
      onLogin(data.user)   // user includes must_change_password flag
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="login-page">
      {/* ── Binary Rain ── */}
      <BinaryRain />

      {/* ── Dark overlay to keep card readable ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(7,11,21,0.45) 0%, rgba(7,11,21,0.82) 100%)',
      }} />

      {/* ── Terminal Window Card ── */}
      <div className="term-window fade-in">
        {/* Title bar */}
        <div className="term-titlebar">
          <div className="term-dots">
            <span className="term-dot term-dot-red" />
            <span className="term-dot term-dot-yellow" />
            <span className="term-dot term-dot-green" />
          </div>
          <span className="term-title-text">idxsoc@soc:~$ — bash</span>
          <div style={{ width: 52 }} />
        </div>

        {/* Terminal body */}
        <div className="term-body">
          {/* Boot sequence */}
          <TypedLine text="[  0.00] IDXSOC SOC v2.4.1 initializing..." delay={0}   color="#4ade80" />
          <TypedLine text="[  0.12] Threat detection engine........  [ OK ]"     delay={400}  color="#a0d9b4" />
          <TypedLine text="[  0.31] Network monitor daemon..........  [ OK ]"    delay={900}  color="#a0d9b4" />
          <TypedLine text="[  0.55] Connecting to campus IDS........  [ OK ]"    delay={1400} color="#a0d9b4" />
          <TypedLine text="[  0.72] Authentication module loaded.....  [ OK ]"   delay={1900} color="#a0d9b4" />

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(74,222,128,0.18)', margin: '14px 0' }} />

          {/* System info row */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'HOST',    val: 'idxsoc-soc-01' },
              { label: 'OS',      val: 'Linux 6.8.0-amd64' },
              { label: 'UPTIME',  val: '14d 06h 22m' },
              { label: 'THREATS', val: '🔴 3 ACTIVE', danger: true },
            ].map(({ label, val, danger }) => (
              <div key={label}>
                <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: danger ? '#ff4757' : '#a0d9b4', marginTop: 2 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Separator */}
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(74,222,128,0.35)', marginBottom: 14 }}>
            ─────────────────────────────────────────────────
          </div>

          {/* Auth prompt */}
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#4ade80', marginBottom: 12 }}>
            idxsoc@soc:~$ <span style={{ color: '#e8edf7' }}>sudo authenticate --session=ops</span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Error */}
            {error && (
              <div className="term-error">
                <span style={{ color: '#ff4757' }}>✗ ERROR:</span>&nbsp;{error}
              </div>
            )}

            {/* Username */}
            <div className="term-field">
              <label htmlFor="username" className="term-label">
                <span className="term-prompt">❯</span> username<span style={{ color: 'rgba(74,222,128,0.5)' }}>:</span>
              </label>
              <input
                id="username"
                className="term-input"
                type="text"
                autoComplete="username"
                placeholder="type here..."
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
              />
            </div>

            {/* Password */}
            <div className="term-field">
              <label htmlFor="password" className="term-label">
                <span className="term-prompt">❯</span> password<span style={{ color: 'rgba(74,222,128,0.5)' }}>:</span>
              </label>
              <input
                id="password"
                className="term-input"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="term-btn"
              disabled={loading}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(74,222,128,0.3)', borderTopColor: '#4ade80' }} />
                  <span>authenticating...</span>
                </span>
              ) : (
                <span>
                  <span style={{ color: '#4ade80' }}>$</span>
                  &nbsp;./authenticate --exec
                </span>
              )}
            </button>
          </form>


        </div>
      </div>
    </div>
  )
}

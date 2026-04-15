import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

const MIN_PW = 8

/**
 * Forced change-password page.
 * Shown when user.must_change_password === true after login.
 *
 * Props:
 *   user     — current user object from sessionStorage
 *   onDone   — callback fired after successful password change
 *   onLogout — lets user bail out and log in as someone else
 */
export default function ChangePassword({ user, onDone, onLogout }) {
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [strength,  setStrength]  = useState(0)  // 0-4

  // Password strength meter
  useEffect(() => {
    let s = 0
    if (newPw.length >= 8)                              s++
    if (newPw.length >= 12)                             s++
    if (/[A-Z]/.test(newPw) && /[a-z]/.test(newPw))    s++
    if (/[0-9]/.test(newPw) && /[^A-Za-z0-9]/.test(newPw)) s++
    setStrength(s)
  }, [newPw])

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength]
  const strengthColor = ['', '#ff4757', '#ffa502', '#2ed573', '#4ade80'][strength]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPw.length < MIN_PW) {
      setError(`Password must be at least ${MIN_PW} characters`)
      return
    }
    if (newPw !== confirmPw) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res  = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body:   JSON.stringify({
          // must_change_password users skip current_password validation on backend
          current_password: '',
          new_password:     newPw,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Password change failed')
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 440, padding: 36 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔐</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Change Your Password
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
            Welcome, <strong style={{ color: 'var(--accent)' }}>{user?.full_name || user?.username}</strong>.
            Your account requires a password change before continuing.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(255,71,87,.12)', border: '1px solid rgba(255,71,87,.3)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 18,
            color: '#ff4757', fontSize: 13,
          }}>
            ✗ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* New Password */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              New Password
            </label>
            <input
              id="new-password"
              className="input"
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              required
              style={{ width: '100%' }}
            />
            {/* Strength bar */}
            {newPw.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{
                  height: 4, borderRadius: 2,
                  background: 'rgba(255,255,255,.07)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${(strength / 4) * 100}%`,
                    background: strengthColor,
                    borderRadius: 2,
                    transition: 'width .3s, background .3s',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: strengthColor, marginTop: 4 }}>
                  {strengthLabel}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Confirm Password
            </label>
            <input
              id="confirm-password"
              className="input"
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              placeholder="Repeat new password"
              required
              style={{ width: '100%' }}
            />
            {confirmPw && newPw !== confirmPw && (
              <div style={{ fontSize: 11, color: '#ff4757', marginTop: 4 }}>
                Passwords do not match
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            id="change-password-btn"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Updating…
              </span>
            ) : '🔒 Set New Password'}
          </button>

          {/* Bail out */}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onLogout}
            style={{ alignSelf: 'center', fontSize: 12 }}
          >
            ← Back to Login
          </button>
        </form>
      </div>
    </div>
  )
}

/**
 * IDXSOC — Central API helper
 * ----------------------------
 * All fetch calls go through apiFetch() so the JWT Bearer token
 * is automatically attached to every request.
 *
 * Usage:
 *   import { apiFetch, getToken } from '../api'
 *   const data = await apiFetch('/api/logs').then(r => r.json())
 */

export const API = 'http://localhost:8000'

/** Read the stored JWT from sessionStorage. */
export const getToken = () => {
  const t = sessionStorage.getItem('idxsoc_token')
  if (!t || t === 'undefined' || t === 'null') return ''
  return t
}

/**
 * Wrapper around fetch() that:
 *  - Prepends the API base URL
 *  - Injects Authorization: Bearer <token>
 *  - Merges caller-supplied headers / options
 */
export const apiFetch = (path, opts = {}) => {
  const token = getToken()
  return fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
}

/** POST /api/auth/login — no token needed */
export const loginRequest = (username, password) =>
  fetch(`${API}/api/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, password }),
  })

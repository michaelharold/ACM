// Shared client for calling our own /api routes as the signed-in user.
import { auth } from './firebase'

export async function idToken() {
  const u = auth?.currentUser
  if (!u) throw new Error('Please sign in first.')
  return u.getIdToken()
}

export async function post(path, payload, token) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let data = {}
  try { data = text ? JSON.parse(text) : {} } catch { /* non-JSON (crash/HTML) */ }
  if (!res.ok) {
    // Surface the status so a server misconfig (500) vs missing route (404) vs
    // auth (401) is obvious from the message during setup.
    throw new Error(data.error || `Request failed (HTTP ${res.status}).`)
  }
  return data
}

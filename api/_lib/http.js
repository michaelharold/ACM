// Small shared helpers for the serverless endpoints.
import { adminAuth } from './firebaseAdmin.js'

export function send(res, status, obj) {
  res.status(status).json(obj)
}

// Read a JSON body whether or not the platform pre-parsed it.
export async function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

// Authenticate the caller from the Firebase ID token in the Authorization
// header (falling back to the body), and return their uid. Every endpoint that
// touches a user's record goes through this so a request can only ever act as
// the signed-in user it proves it is.
export async function requireUser(req, body) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : body?.idToken
  if (!token) throw Object.assign(new Error('Please sign in.'), { status: 401 })
  const decoded = await adminAuth().verifyIdToken(token)
  return decoded.uid
}

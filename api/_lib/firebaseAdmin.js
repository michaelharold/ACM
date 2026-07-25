// Firebase Admin SDK, initialised from a service-account key held ONLY in the
// server environment (never in the repo or the browser). The Admin SDK runs
// with full privileges and bypasses Firestore security rules, so it can mark a
// registration/membership 'paid' after — and only after — a payment has been
// cryptographically verified server-side.
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

function init() {
  if (getApps().length) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set')
  const creds = JSON.parse(raw)
  // Keys pasted into a dashboard env field often arrive with literal "\n"
  // instead of real newlines — normalise so the PEM parses.
  if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n')
  initializeApp({ credential: cert(creds) })
}

export function adminDb() {
  init()
  return getFirestore()
}

export function adminAuth() {
  init()
  return getAuth()
}

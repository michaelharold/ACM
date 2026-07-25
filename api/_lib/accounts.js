// Resolves which Razorpay key pair to use for a payment, keeping every SECRET
// in the server environment only.
//
// Account profiles (label + keyId) live in Firestore; the matching secrets live
// in env vars:
//   RAZORPAY_KEYS            = {"<keyId>":"<keySecret>", ...}   (per account)
//   RAZORPAY_WEBHOOK_SECRETS = {"<keyId>":"<webhookSecret>", ...}
// A single default account is also supported for the simple one-account case:
//   RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET
import { adminDb } from './firebaseAdmin.js'

function json(name) {
  try { return JSON.parse(process.env[name] || '{}') } catch { return {} }
}

// Given a payment-account document id (or none), return the { keyId, secret } to
// transact with. Falls back to the default single-account env keys.
export async function keysForAccount(accountId) {
  let keyId = process.env.RAZORPAY_KEY_ID || ''
  if (accountId) {
    const snap = await adminDb().collection('paymentAccounts').doc(accountId).get()
    if (snap.exists && snap.get('keyId')) keyId = snap.get('keyId')
  }
  const map = json('RAZORPAY_KEYS')
  let secret = map[keyId]
  if (!secret && keyId && keyId === process.env.RAZORPAY_KEY_ID) secret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !secret) {
    throw Object.assign(new Error('This payment account is not configured on the server.'), { status: 500 })
  }
  return { keyId, secret }
}

// Every webhook secret we know about, tried in turn against an incoming webhook.
export function allWebhookSecrets() {
  const secrets = Object.values(json('RAZORPAY_WEBHOOK_SECRETS'))
  if (process.env.RAZORPAY_WEBHOOK_SECRET) secrets.push(process.env.RAZORPAY_WEBHOOK_SECRET)
  return secrets.filter(Boolean)
}

// The account id that a given record pays into: an event's own choice, or the
// membership-wide setting in siteContent. Returns null → default account.
export async function accountIdFor(type, { event } = {}) {
  const db = adminDb()
  if (type === 'event') return event?.get('paymentAccountId') || null
  const sc = await db.collection('siteContent').doc('main').get()
  return sc.get('membershipPaymentAccountId') || null
}

// POST /api/webhook  — Razorpay server-to-server confirmation.
//
// This is the resilient path: even if the user closes the tab the instant after
// paying (so /api/verify-payment never runs), Razorpay still calls this and the
// record gets marked paid. Configure it in each Razorpay dashboard → Webhooks,
// pointing at https://<your-domain>/api/webhook for the `payment.captured`
// (and/or `order.paid`) events, with a webhook secret added to the server env.
//
// Signature is HMAC_SHA256(RAW body, webhookSecret), so we must read the raw
// bytes and NOT let anything parse req.body first. bodyParser is disabled below.
import { adminDb } from './_lib/firebaseAdmin.js'
import { webhookSignatureMatches } from './_lib/razorpay.js'
import { allWebhookSecrets } from './_lib/accounts.js'
import { FieldValue } from 'firebase-admin/firestore'

// Ask the platform not to parse the body — we need the exact bytes.
export const config = { api: { bodyParser: false } }

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const raw = await readRaw(req)
    const signature = req.headers['x-razorpay-signature']
    if (!webhookSignatureMatches(raw, signature, allWebhookSecrets())) {
      return res.status(400).json({ error: 'Invalid webhook signature' })
    }

    const evt = JSON.parse(raw || '{}')
    const payment = evt?.payload?.payment?.entity
    const notes = payment?.notes || {}
    const { type, refId } = notes

    // We only need to act on a successful payment for one of our records.
    const paidEvent = evt?.event === 'payment.captured' || evt?.event === 'order.paid'
    if (paidEvent && refId && (type === 'event' || type === 'membership')) {
      const col = type === 'event' ? 'registrations' : 'memberships'
      const ref = adminDb().collection(col).doc(refId)
      const snap = await ref.get()
      // Idempotent: only write if it isn't already marked paid.
      if (snap.exists && snap.get('paymentStatus') !== 'paid') {
        await ref.update({
          paymentStatus: 'paid',
          razorpayPaymentId: payment?.id || '',
          razorpayOrderId: payment?.order_id || '',
          paidAt: FieldValue.serverTimestamp(),
        })
      }
    }

    // Always 200 quickly so Razorpay doesn't retry a handled event.
    return res.status(200).json({ received: true })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' })
  }
}

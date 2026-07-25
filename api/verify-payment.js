// POST /api/verify-payment  →  { ok: true }
//
// Called from the Razorpay checkout success handler. Re-checks the payment
// signature with the correct account's server-side secret and, ONLY on a valid
// signature, marks the record 'paid' (via the Admin SDK, which bypasses rules)
// and stores the Razorpay payment id + time for the record. A client can never
// mark itself paid — it must present a signature Razorpay produced.
import { adminDb } from './_lib/firebaseAdmin.js'
import { isValidPaymentSignature } from './_lib/razorpay.js'
import { keysForAccount, accountIdFor } from './_lib/accounts.js'
import { getBody, requireUser, send } from './_lib/http.js'
import { FieldValue } from 'firebase-admin/firestore'

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })
  try {
    const body = await getBody(req)
    const uid = await requireUser(req, body)
    const { type, refId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body
    if (!refId || !['event', 'membership'].includes(type)) return send(res, 400, { error: 'Bad request' })

    const db = adminDb()
    const col = type === 'event' ? 'registrations' : 'memberships'
    const ref = db.collection(col).doc(refId)
    const snap = await ref.get()
    if (!snap.exists) return send(res, 404, { error: 'Record not found' })
    if (refId !== uid && snap.get('userId') !== uid) return send(res, 403, { error: 'Not yours' })

    // Resolve the same account the order was created against, and verify with
    // that account's secret.
    let accountId = null
    if (type === 'event') {
      const ev = await db.collection('events').doc(snap.get('eventId')).get()
      accountId = await accountIdFor('event', { event: ev })
    } else {
      accountId = await accountIdFor('membership')
    }
    const { secret } = await keysForAccount(accountId)

    if (!isValidPaymentSignature({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature, secret }))
      return send(res, 400, { error: 'Payment could not be verified.' })

    await ref.update({
      paymentStatus: 'paid',
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      paidAt: FieldValue.serverTimestamp(),
    })
    return send(res, 200, { ok: true })
  } catch (err) {
    return send(res, err.status || 500, { error: err.message || 'Server error' })
  }
}

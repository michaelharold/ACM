// POST /api/create-order  →  { orderId, amount, currency, keyId, description }
//
// Creates a Razorpay order for an event registration or a membership. The
// amount is ALWAYS derived server-side from authoritative Firestore data (the
// event's fee, or the configured membership fee) — never taken from the request
// body — so a tampered client cannot change what it is charged.
import { adminDb } from './_lib/firebaseAdmin.js'
import { razorpay } from './_lib/razorpay.js'
import { getBody, requireUser, send } from './_lib/http.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })
  try {
    const body = await getBody(req)
    const uid = await requireUser(req, body)
    const { type, refId } = body
    if (!refId || !['event', 'membership'].includes(type)) return send(res, 400, { error: 'Bad request' })

    const db = adminDb()
    let amount = 0 // rupees
    let description = ''

    if (type === 'event') {
      const reg = await db.collection('registrations').doc(refId).get()
      if (!reg.exists) return send(res, 404, { error: 'Registration not found' })
      if (reg.get('userId') !== uid) return send(res, 403, { error: 'Not your registration' })
      const ev = await db.collection('events').doc(reg.get('eventId')).get()
      amount = Number(ev.get('fee')) || 0
      description = `Registration — ${ev.get('name') || 'Event'}`
    } else {
      const mem = await db.collection('memberships').doc(refId).get()
      if (!mem.exists) return send(res, 404, { error: 'Membership not found' })
      // Membership documents are keyed by uid, so the owner is refId itself.
      if (refId !== uid && mem.get('userId') !== uid) return send(res, 403, { error: 'Not your membership' })
      const sc = await db.collection('siteContent').doc('main').get()
      amount = Number(sc.get('membershipFee')) || 0
      description = 'ACM TKMCE Membership'
    }

    if (!(amount > 0)) return send(res, 400, { error: 'This item has no fee to pay.' })

    const order = await razorpay().orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: `${type}_${refId}`.slice(0, 40),
      notes: { type, refId, uid },
    })

    return send(res, 200, {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      description,
    })
  } catch (err) {
    return send(res, err.status || 500, { error: err.message || 'Server error' })
  }
}

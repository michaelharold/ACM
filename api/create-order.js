// POST /api/create-order  →  { orderId, amount, currency, keyId, description }
//
// Creates a Razorpay order for an event registration or a membership. Two things
// are ALWAYS decided server-side, never trusted from the client:
//   • the amount — read from the event's fee / the configured membership fee
//   • which Razorpay account receives it — the event's or membership's assigned
//     account, resolved to a key pair held only in the server env.
import { adminDb } from './_lib/firebaseAdmin.js'
import { razorpayWith } from './_lib/razorpay.js'
import { keysForAccount, accountIdFor } from './_lib/accounts.js'
import { memberAdjustedAmount } from './_lib/membership.js'
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
    let accountId = null

    if (type === 'event') {
      const reg = await db.collection('registrations').doc(refId).get()
      if (!reg.exists) return send(res, 404, { error: 'Registration not found' })
      if (reg.get('userId') !== uid) return send(res, 403, { error: 'Not your registration' })
      // Idempotency: never open a second charge for something already paid.
      if (reg.get('paymentStatus') === 'paid') return send(res, 200, { alreadyPaid: true })
      const ev = await db.collection('events').doc(reg.get('eventId')).get()
      // Amount = event fee, minus the ACM member discount, but ONLY when the
      // claimed membership id is real AND not already used for this event.
      const adj = await memberAdjustedAmount({
        event: ev,
        membershipId: reg.get('membershipId'),
        selfUid: uid,
        selfRegId: refId,
      })
      amount = adj.amount
      description = `Registration — ${ev.get('name') || 'Event'}`
      accountId = await accountIdFor('event', { event: ev })
    } else {
      const mem = await db.collection('memberships').doc(refId).get()
      if (!mem.exists) return send(res, 404, { error: 'Membership not found' })
      if (refId !== uid && mem.get('userId') !== uid) return send(res, 403, { error: 'Not your membership' })
      if (mem.get('paymentStatus') === 'paid') return send(res, 200, { alreadyPaid: true })
      const sc = await db.collection('siteContent').doc('main').get()
      amount = Number(sc.get('membershipFee')) || 0
      description = 'ACM TKMCE Membership'
      accountId = await accountIdFor('membership')
    }

    if (!(amount > 0)) return send(res, 400, { error: 'This item has no fee to pay.' })
    // Razorpay's minimum order is 100 paise (₹1).
    const paise = Math.round(amount * 100)
    if (paise < 100) return send(res, 400, { error: 'The amount must be at least ₹1.' })

    const { keyId, secret } = await keysForAccount(accountId)
    const order = await razorpayWith(keyId, secret).orders.create({
      amount: paise,
      currency: 'INR',
      receipt: `${type}_${refId}`.slice(0, 40),
      notes: { type, refId, uid, accountId: accountId || 'default' },
    })

    return send(res, 200, {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      description,
    })
  } catch (err) {
    return send(res, err.status || 500, { error: err.message || 'Server error' })
  }
}

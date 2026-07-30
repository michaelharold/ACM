// POST /api/validate-membership  →  { valid, alreadyUsed, memberName, fee, discount, effectiveFee }
//
// Checks a claimed ACM membership id against the database (does it exist?) and,
// for a given event, whether it has already been used — and returns the price
// the member would actually pay. Used by the registration form to show live
// feedback; the real charge is re-derived independently in create-order, so this
// endpoint is safe to trust for UX only.
import { adminDb } from './_lib/firebaseAdmin.js'
import { memberByMembershipId, membershipUsedForEvent } from './_lib/membership.js'
import { getBody, requireUser, send } from './_lib/http.js'
import { isTkmCollege } from './_lib/college.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })
  try {
    const body = await getBody(req)
    const uid = await requireUser(req, body)
    const { eventId, membershipId } = body
    const id = (membershipId || '').trim()
    if (!id) return send(res, 400, { error: 'Enter a membership ID.' })

    // ACM membership only exists for TKM College students — an Inter-College
    // Event can admit anyone, but nobody outside TKM can ever hold (or
    // benefit from) a real membership id, borrowed or not. The UI already
    // hides this option for them; this is the server-side backstop.
    const callerSnap = await adminDb().collection('users').doc(uid).get()
    if (!isTkmCollege(callerSnap.exists ? callerSnap.data().college : '')) {
      return send(res, 200, { valid: false, notTkm: true })
    }

    const member = await memberByMembershipId(id)
    if (!member) return send(res, 200, { valid: false })

    let alreadyUsed = false
    let fee = 0
    let discount = 0
    if (eventId) {
      alreadyUsed = await membershipUsedForEvent(id, eventId, { selfUid: uid })
      const ev = await adminDb().collection('events').doc(eventId).get()
      if (ev.exists) {
        fee = Number(ev.get('fee')) || 0
        discount = Number(ev.get('acmDiscount')) || 0
      }
    }
    const applied = alreadyUsed ? 0 : Math.min(discount, fee)
    return send(res, 200, {
      valid: true,
      alreadyUsed,
      memberName: member.name,
      fee,
      discount: applied,
      effectiveFee: Math.max(0, fee - applied),
    })
  } catch (err) {
    return send(res, err.status || 500, { error: err.message || 'Server error' })
  }
}

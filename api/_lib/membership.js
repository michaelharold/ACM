// Server-side ACM membership checks, shared by /api/validate-membership and
// /api/create-order so the UI preview and the authoritative charge always agree.
// These run with the Admin SDK, which is the only way to look a membership up by
// its admin-assigned id (security rules forbid a member reading anyone else's).
import { adminDb } from './firebaseAdmin.js'

const nameOf = (d) => [d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ')

// Resolve a membershipId to a real, admin-assigned member — or null.
export async function memberByMembershipId(membershipId) {
  const id = (membershipId || '').trim()
  if (!id) return null
  const snap = await adminDb().collection('memberships').where('membershipId', '==', id).limit(1).get()
  if (snap.empty) return null
  const d = snap.docs[0].data()
  return { uid: snap.docs[0].id, name: nameOf(d) || 'ACM Member' }
}

// Has this id already been used to COMPLETE a registration for this event by
// someone else? (Completed = paid or free.) The caller's own registration is
// excluded so it doesn't count against them. This is what stops one member's id
// being shared to claim the discount many times for the same event.
export async function membershipUsedForEvent(membershipId, eventId, { selfUid, selfRegId } = {}) {
  const id = (membershipId || '').trim()
  if (!id || !eventId) return false
  const snap = await adminDb().collection('registrations').where('membershipId', '==', id).get()
  return snap.docs.some((doc) => {
    if (doc.id === selfRegId) return false
    if (doc.get('userId') === selfUid) return false
    if (doc.get('eventId') !== eventId) return false
    return ['paid', 'free'].includes((doc.get('paymentStatus') || '').toLowerCase())
  })
}

// The amount a registration should actually be charged: the member discount is
// applied ONLY when the claimed id is real AND unused for this event. Everything
// is derived from Firestore, so a client can't fake a discount.
export async function memberAdjustedAmount({ event, membershipId, selfUid, selfRegId }) {
  const fee = Number(event.get('fee')) || 0
  const discount = Number(event.get('acmDiscount')) || 0
  const id = (membershipId || '').trim()
  if (!id || fee <= 0 || discount <= 0) return { amount: fee, discountApplied: 0, memberValid: false }
  const member = await memberByMembershipId(id)
  if (!member) return { amount: fee, discountApplied: 0, memberValid: false }
  const used = await membershipUsedForEvent(id, event.id, { selfUid, selfRegId })
  if (used) return { amount: fee, discountApplied: 0, memberValid: true, alreadyUsed: true }
  const applied = Math.min(discount, fee)
  return { amount: Math.max(0, fee - applied), discountApplied: applied, memberValid: true }
}

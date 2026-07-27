// POST /api/register-team  →  { id, paymentStatus }
//
// Registers a TEAM for a group event as a single registration document. Done
// server-side (Admin SDK) because it must do things a member's own client can't:
//   • look teammates up by email in the users collection (rules forbid reading
//     other people's profiles),
//   • verify each teammate is a real, registered site user,
//   • enforce team-size limits, one-registration-per-person, and team capacity,
//   • write the trusted memberUids list that makes the event show as registered
//     on every teammate's dashboard.
import { adminDb } from './_lib/firebaseAdmin.js'
import { getBody, requireUser, send } from './_lib/http.js'
import { FieldValue } from 'firebase-admin/firestore'

// Resolve one email to a registered user (exact match, then a lowercase retry).
async function findUserByEmail(db, email) {
  const e = email.trim()
  let snap = await db.collection('users').where('email', '==', e).limit(1).get()
  if (snap.empty && e !== e.toLowerCase()) {
    snap = await db.collection('users').where('email', '==', e.toLowerCase()).limit(1).get()
  }
  return snap.empty ? null : snap.docs[0]
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })
  try {
    const body = await getBody(req)
    const uid = await requireUser(req, body)
    const { eventId, teamName, teammates } = body
    if (!eventId) return send(res, 400, { error: 'Missing event.' })

    const db = adminDb()
    const evSnap = await db.collection('events').doc(eventId).get()
    if (!evSnap.exists) return send(res, 404, { error: 'Event not found.' })
    const ev = evSnap.data()
    if (!ev.isGroup) return send(res, 400, { error: 'This is not a group event.' })

    const leaderSnap = await db.collection('users').doc(uid).get()
    const leader = leaderSnap.exists ? leaderSnap.data() : {}
    const leaderEmail = (leader.email || '').toLowerCase()

    // Teammate emails: trimmed, de-duped, excluding the leader's own.
    const emails = [...new Set((teammates || []).map((t) => (t?.email || '').trim().toLowerCase()).filter(Boolean))]
      .filter((e) => e !== leaderEmail)

    const size = 1 + emails.length
    const min = Number(ev.minTeamSize) || 1
    const max = Number(ev.maxTeamSize) || 999
    if (size < min) return send(res, 400, { error: `A team needs at least ${min} member${min === 1 ? '' : 's'} (including you).` })
    if (size > max) return send(res, 400, { error: `A team can have at most ${max} member${max === 1 ? '' : 's'} (including you).` })

    // Build the trusted member list from real user records.
    const members = [{ uid, name: leader.name || leader.googleName || '', email: leader.email || '', phone: leader.phone || '', role: 'leader' }]
    const notFound = []
    for (const email of emails) {
      const doc = await findUserByEmail(db, email)
      if (!doc) { notFound.push(email); continue }
      const d = doc.data()
      members.push({ uid: doc.id, name: d.name || d.googleName || '', email: d.email || email, phone: d.phone || '', role: 'member' })
    }
    if (notFound.length) {
      return send(res, 400, { error: `Not registered on the site: ${notFound.join(', ')}. Ask them to sign up first.` })
    }

    const memberUids = members.map((m) => m.uid)

    // One registration per person per event — solo or within any team.
    const existing = await db.collection('registrations').where('eventId', '==', eventId).get()
    for (const r of existing.docs) {
      const d = r.data()
      const uids = d.memberUids || (d.userId ? [d.userId] : [])
      const clash = memberUids.find((u) => uids.includes(u))
      if (clash) {
        const who = members.find((m) => m.uid === clash)
        return send(res, 400, { error: `${who?.email || 'A member'} is already registered for this event.` })
      }
    }

    // Team capacity (maxRegistrations = max teams for a group event).
    const maxTeams = Number(ev.maxRegistrations) || 0
    if (maxTeams > 0 && existing.docs.filter((r) => r.data().isTeam).length >= maxTeams) {
      return send(res, 400, { error: 'Sorry — registration for this event is full.' })
    }

    const fee = Number(ev.fee) || 0
    const reg = {
      userId: uid,
      userName: leader.name || '',
      userEmail: leader.email || '',
      eventId,
      eventName: ev.name || '',
      isTeam: true,
      teamName: (teamName || '').trim() || 'Team',
      members,
      memberUids,
      teamSize: size,
      acmMember: false,
      membershipId: '',
      date: new Date().toISOString().slice(0, 10),
      status: 'Confirmed',
      paymentStatus: fee > 0 ? 'pending' : 'free',
      // When capped, this team occupies a slot the shared registeredCount tracks,
      // so the UI's "Registrations Full" works and a cancelled team frees a slot.
      counted: maxTeams > 0,
      createdAt: FieldValue.serverTimestamp(),
    }
    const ref = await db.collection('registrations').add(reg)
    if (maxTeams > 0) {
      await db.collection('events').doc(eventId).update({ registeredCount: FieldValue.increment(1) }).catch(() => {})
    }
    return send(res, 200, { id: ref.id, paymentStatus: reg.paymentStatus })
  } catch (err) {
    return send(res, err.status || 500, { error: err.message || 'Server error' })
  }
}

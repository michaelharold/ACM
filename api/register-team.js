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
import { findUserByEmail } from './_lib/users.js'
import { isTkmCollege } from './_lib/college.js'
import { FieldValue } from 'firebase-admin/firestore'

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

    // Teammates: trimmed, de-duped by email, excluding the leader's own. Name
    // travels with the email so an unregistered teammate can still be recorded.
    const seen = new Set()
    const teammateInputs = []
    for (const t of (teammates || [])) {
      const email = (t?.email || '').trim().toLowerCase()
      if (!email || email === leaderEmail || seen.has(email)) continue
      seen.add(email)
      teammateInputs.push({ email, name: (t?.name || '').trim() })
    }

    const size = 1 + teammateInputs.length
    const min = Number(ev.minTeamSize) || 1
    const max = Number(ev.maxTeamSize) || 999
    if (size < min) return send(res, 400, { error: `A team needs at least ${min} member${min === 1 ? '' : 's'} (including you).` })
    if (size > max) return send(res, 400, { error: `A team can have at most ${max} member${max === 1 ? '' : 's'} (including you).` })

    // Build the member list. A teammate with a site account is looked up and
    // linked by uid — their registration then syncs to their own dashboard. A
    // teammate with no account is still recorded (name + email as entered by
    // the leader), just without that sync — there's no account to sync to.
    const members = [{
      uid, name: leader.name || leader.googleName || '', email: leader.email || '', phone: leader.phone || '',
      department: leader.department || '', college: leader.college || '', year: leader.year || '', role: 'leader',
    }]
    for (const t of teammateInputs) {
      const doc = await findUserByEmail(db, t.email)
      if (doc) {
        const d = doc.data()
        members.push({
          uid: doc.id, name: d.name || d.googleName || t.name || '', email: d.email || t.email, phone: d.phone || '',
          department: d.department || '', college: d.college || '', year: d.year || '', role: 'member',
        })
      } else {
        if (!t.name) return send(res, 400, { error: `Add a name for ${t.email} — they don't have a website account yet, so we can't look one up.` })
        members.push({ uid: null, name: t.name, email: t.email, phone: '', department: '', college: '', year: '', role: 'member' })
      }
    }

    // TKM-only events (the default) don't accept other colleges — checked for
    // every member who has a linked account; one entered without an account
    // can't be checked, so (as elsewhere) that's trusted to the leader.
    if (!ev.interCollege) {
      const nonTkm = members.find((m) => m.uid && !isTkmCollege(m.college))
      if (nonTkm) {
        return send(res, 400, { error: `${nonTkm.name || nonTkm.email} isn't a TKM College student — this event is limited to TKM College of Engineering students.` })
      }
    }

    const memberUids = members.filter((m) => m.uid).map((m) => m.uid)
    // Emails that had no account at registration time — queried at sign-up so
    // a teammate who joins the site later gets linked to this team automatically.
    const unregisteredEmails = members.filter((m) => !m.uid).map((m) => m.email.toLowerCase())

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
      unregisteredEmails,
      teamSize: size,
      acmMember: false,
      membershipId: '',
      date: new Date().toISOString().slice(0, 10),
      status: 'Confirmed',
      paymentStatus: fee > 0 ? 'pending' : 'free',
      // What the leader owes, and whether this team is holding a capacity slot
      // (released if its payment receipt is rejected).
      amountDue: fee,
      seatHeld: maxTeams > 0,
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

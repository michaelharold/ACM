// POST /api/admin-team  →  { ok: true } | { ok: true, deleted: true }
//
// Admin-only management for a group event's team registrations: remove a
// member, add one, delete a team, run Random Grouping early, or manually form
// a team from ungrouped registrants. Admin SDK, because these edit
// registration docs the caller doesn't own — no grant (not even the
// Registrations Access permission) unlocks this, only role === 'admin'.
import { adminDb } from './_lib/firebaseAdmin.js'
import { getBody, requireAdmin, send } from './_lib/http.js'
import { findUserByEmail } from './_lib/users.js'
import { runGroupingForEvent, formGroupFromRegistrations } from './_lib/grouping.js'
import { FieldValue } from 'firebase-admin/firestore'

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })
  try {
    const body = await getBody(req)
    const db = adminDb()
    await requireAdmin(req, body, db)

    const { action } = body

    // Event-scoped actions — no existing team doc to fetch first.
    if (action === 'runGroupingNow') {
      if (!body.eventId) return send(res, 400, { error: 'Missing event.' })
      const result = await runGroupingForEvent(db, body.eventId)
      if (result.skipped && result.reason === 'already-ran') {
        return send(res, 400, { error: 'Grouping has already run for this event.' })
      }
      if (result.skipped && result.reason === 'not-a-random-grouping-event') {
        return send(res, 400, { error: 'Random Grouping isn’t turned on for this event.' })
      }
      return send(res, 200, { ok: true, ...result })
    }

    if (action === 'formGroup') {
      if (!body.eventId) return send(res, 400, { error: 'Missing event.' })
      if (!Array.isArray(body.registrationIds) || body.registrationIds.length === 0) {
        return send(res, 400, { error: 'Pick at least one person to form a team.' })
      }
      const result = await formGroupFromRegistrations(db, body.eventId, body.registrationIds)
      return send(res, 200, { ok: true, ...result })
    }

    const { registrationId } = body
    if (!registrationId) return send(res, 400, { error: 'Missing team.' })

    const ref = db.collection('registrations').doc(registrationId)
    const snap = await ref.get()
    if (!snap.exists) return send(res, 404, { error: 'Team not found — it may already have been deleted.' })
    const reg = snap.data()
    if (!reg.isTeam) return send(res, 400, { error: 'This registration is not a team.' })

    if (action === 'delete') {
      await ref.delete()
      if (reg.counted) {
        await db.collection('events').doc(reg.eventId).update({ registeredCount: FieldValue.increment(-1) }).catch(() => {})
      }
      return send(res, 200, { ok: true, deleted: true })
    }

    if (action === 'removeMember') {
      const target = (body.email || '').trim().toLowerCase()
      if (!target) return send(res, 400, { error: 'Missing member email.' })
      const member = (reg.members || []).find((m) => (m.email || '').toLowerCase() === target)
      if (!member) return send(res, 400, { error: 'That person is not on this team.' })
      if (member.role === 'leader') {
        return send(res, 400, { error: 'The team leader can’t be removed this way — delete the whole team instead if they’re leaving.' })
      }
      const members = (reg.members || []).filter((m) => (m.email || '').toLowerCase() !== target)
      const memberUids = member.uid ? (reg.memberUids || []).filter((u) => u !== member.uid) : (reg.memberUids || [])
      const unregisteredEmails = (reg.unregisteredEmails || []).filter((e) => e !== target)
      await ref.update({ members, memberUids, unregisteredEmails, teamSize: members.length })
      return send(res, 200, { ok: true })
    }

    if (action === 'addMember') {
      const target = (body.email || '').trim().toLowerCase()
      const name = (body.name || '').trim()
      if (!target) return send(res, 400, { error: 'Enter an email address.' })
      if ((reg.members || []).some((m) => (m.email || '').toLowerCase() === target)) {
        return send(res, 400, { error: `${target} is already on this team.` })
      }

      const evSnap = await db.collection('events').doc(reg.eventId).get()
      const ev = evSnap.exists ? evSnap.data() : {}
      const maxTeamSize = Number(ev.maxTeamSize) || 999
      if ((reg.members || []).length + 1 > maxTeamSize) {
        return send(res, 400, { error: `A team can have at most ${maxTeamSize} member${maxTeamSize === 1 ? '' : 's'}.` })
      }

      const doc = await findUserByEmail(db, target)
      let newMember
      if (doc) {
        const uidCandidate = doc.id
        // One registration per person per event — check every OTHER team/solo entry.
        const existing = await db.collection('registrations').where('eventId', '==', reg.eventId).get()
        for (const r of existing.docs) {
          if (r.id === registrationId) continue
          const d = r.data()
          const uids = d.memberUids || (d.userId ? [d.userId] : [])
          if (uids.includes(uidCandidate)) {
            return send(res, 400, { error: `${target} is already registered for this event.` })
          }
        }
        const d = doc.data()
        newMember = { uid: uidCandidate, name: d.name || d.googleName || name || '', email: d.email || target, phone: d.phone || '', role: 'member' }
      } else {
        if (!name) return send(res, 400, { error: `Add a name for ${target} — they don't have a website account yet, so we can't look one up.` })
        newMember = { uid: null, name, email: target, phone: '', role: 'member' }
      }

      const members = [...(reg.members || []), newMember]
      const memberUids = newMember.uid ? [...new Set([...(reg.memberUids || []), newMember.uid])] : (reg.memberUids || [])
      const unregisteredEmails = newMember.uid
        ? (reg.unregisteredEmails || [])
        : [...new Set([...(reg.unregisteredEmails || []), target])]
      await ref.update({ members, memberUids, unregisteredEmails, teamSize: members.length })
      return send(res, 200, { ok: true })
    }

    return send(res, 400, { error: `Unknown action "${action}".` })
  } catch (err) {
    return send(res, err.status || 500, { error: err.message || 'Server error' })
  }
}

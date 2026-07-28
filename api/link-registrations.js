// POST /api/link-registrations  →  { linked }
//
// Called once after every sign-in. A teammate who was registered for a group
// event before they had a website account is recorded on the team by name +
// email only (see register-team.js's `unregisteredEmails`). Once they sign
// up with that same email, this links their new uid into the team — the
// event then shows as registered on their own dashboard, and a duplicate
// signup for it is blocked, exactly as if they'd had an account from the
// start. Safe to call on every sign-in: a no-op when nothing matches.
import { adminDb } from './_lib/firebaseAdmin.js'
import { getBody, requireUserToken, send } from './_lib/http.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })
  try {
    const body = await getBody(req)
    // The email claim comes straight from the verified token, not a Firestore
    // read — on a brand-new sign-in the /users/{uid} profile doc may not exist
    // yet (the client writes it right after this call resolves), so reading it
    // here would race and silently skip the very first link attempt.
    const { uid, email } = await requireUserToken(req, body)
    const db = adminDb()
    if (!email) return send(res, 200, { linked: 0 })
    const emailLower = email.toLowerCase()

    const snap = await db.collection('registrations').where('unregisteredEmails', 'array-contains', emailLower).get()
    let linked = 0
    for (const docSnap of snap.docs) {
      const reg = docSnap.data()
      const members = (reg.members || []).map((m) =>
        !m.uid && (m.email || '').toLowerCase() === emailLower ? { ...m, uid } : m,
      )
      const memberUids = [...new Set([...(reg.memberUids || []), uid])]
      const unregisteredEmails = (reg.unregisteredEmails || []).filter((e) => e !== emailLower)
      await docSnap.ref.update({ members, memberUids, unregisteredEmails })
      linked++
    }
    return send(res, 200, { linked })
  } catch (err) {
    return send(res, err.status || 500, { error: err.message || 'Server error' })
  }
}

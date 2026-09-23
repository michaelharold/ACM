// Random Grouping: turns a pile of individual (solo) registrations for a
// group event into teams, automatically. Shared by the daily cron sweep
// (api/cron-group-events.js) and the admin's manual "Run grouping now" /
// "Form team" actions (api/admin-team.js) — same logic either way.
import { FieldValue } from 'firebase-admin/firestore'

// Fisher–Yates.
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Orders candidates according to the event's grouping style, so a simple
// sequential chunk-by-maxTeamSize pass afterwards produces the right mix:
//   pureRandom — shuffled, no structure.
//   sameDept   — sorted by department, so a chunk mostly lands within one
//                department (a chunk straddling a department boundary is an
//                accepted simplification, not a bug — perfect bin-packing by
//                department isn't worth the complexity here).
//   noSameDept — round-robin dealt across departments, so adjacent people in
//                the list (and therefore in a chunk) are rarely from the same
//                department. Best-effort: if one department dominates the
//                registrant pool, some repeats are unavoidable and that's
//                accepted rather than failing the whole run.
function orderCandidates(candidates, mode) {
  if (mode === 'sameDept') {
    return [...candidates].sort((a, b) => (a.department || '').localeCompare(b.department || ''))
  }
  if (mode === 'noSameDept') {
    const byDept = new Map()
    for (const c of shuffle(candidates)) {
      const key = c.department || ''
      if (!byDept.has(key)) byDept.set(key, [])
      byDept.get(key).push(c)
    }
    const buckets = [...byDept.values()]
    const out = []
    let remaining = candidates.length
    while (remaining > 0) {
      for (const bucket of buckets) {
        const next = bucket.shift()
        if (next) { out.push(next); remaining-- }
      }
    }
    return out
  }
  return shuffle(candidates) // pureRandom (default)
}

// Chunk into teams of `size`; the final short chunk is returned separately
// (it's the "leftover" the caller applies the min-size rule to).
function chunk(list, size) {
  const teams = []
  let i = 0
  for (; i + size <= list.length; i += size) teams.push(list.slice(i, i + size))
  const leftover = list.slice(i)
  return { teams, leftover }
}

function teamDocFromMembers(ev, members, teamName) {
  const fee = Number(ev.fee) || 0
  const allSettled = members.every((m) => ['paid', 'free'].includes(m.paymentStatus))
  const first = members[0]
  return {
    userId: first.uid,
    userName: first.name || '',
    userEmail: first.email || '',
    eventId: ev.id,
    eventName: ev.name || '',
    isTeam: true,
    teamName,
    members: members.map((m) => ({
      uid: m.uid, name: m.name || '', email: m.email || '', phone: m.phone || '',
      department: m.department || '', college: m.college || '', year: m.year || '',
      role: 'member', paymentStatus: m.paymentStatus || '', paymentId: m.paymentId || '', paidAt: m.paidAt || null,
      receiptId: m.receiptId || '', utr: m.utr || '',
    })),
    memberUids: members.map((m) => m.uid),
    teamSize: members.length,
    acmMember: false,
    membershipId: '',
    date: new Date().toISOString().slice(0, 10),
    status: 'Confirmed',
    paymentStatus: fee <= 0 ? 'free' : (allSettled ? 'paid' : 'pending'),
    // Random-grouping capacity is enforced on individual sign-up (maxRegistrations
    // counts people, not teams — see RegistrationDrawer), so a formed team never
    // occupies its own counted slot.
    counted: false,
    randomlyGrouped: true,
    createdAt: FieldValue.serverTimestamp(),
  }
}

// Look up each candidate's phone from their own profile (registrations don't
// store phone — only the profile does), in parallel.
async function withPhones(db, candidates) {
  const snaps = await Promise.all(candidates.map((c) => db.collection('users').doc(c.uid).get()))
  return candidates.map((c, i) => ({ ...c, phone: snaps[i].exists ? snaps[i].data().phone || '' : '' }))
}

// Runs grouping for one event: fetches every un-grouped solo registration,
// forms as many complete teams as it can, and leaves a short remainder (if
// any) ungrouped for an admin to place — see api/admin-team.js's 'formGroup'.
// No-ops (returns skipped:true) if the event isn't a Random Grouping event,
// grouping already ran, or there's nobody to group yet.
export async function runGroupingForEvent(db, eventId) {
  const evSnap = await db.collection('events').doc(eventId).get()
  if (!evSnap.exists) return { skipped: true, reason: 'event-not-found' }
  const ev = { id: eventId, ...evSnap.data() }
  if (!ev.isGroup || !ev.randomGrouping) return { skipped: true, reason: 'not-a-random-grouping-event' }
  if (ev.groupingRanAt) return { skipped: true, reason: 'already-ran' }

  const regsSnap = await db.collection('registrations').where('eventId', '==', eventId).get()
  // Only verified (or free) registrants are grouped — an unverified or rejected
  // payment stays solo for an admin to place once it's sorted out.
  const soloDocs = regsSnap.docs.filter((d) => !d.data().isTeam && ['paid', 'free'].includes(d.data().paymentStatus))
  if (soloDocs.length === 0) {
    await evSnap.ref.update({ groupingRanAt: new Date().toISOString() })
    return { skipped: false, teamsFormed: 0, grouped: 0, leftover: 0 }
  }

  const candidates = await withPhones(
    db,
    soloDocs.map((d) => {
      const r = d.data()
      return {
        regId: d.id, uid: r.userId, name: r.userName, email: r.userEmail, department: r.department,
        college: r.college || '', year: r.year || '',
        paymentStatus: r.paymentStatus || '', paymentId: r.razorpayPaymentId || r.utr || '', paidAt: r.paidAt || null,
        receiptId: r.receiptId || '', utr: r.utr || '',
      }
    }),
  )

  const maxSize = Math.max(1, Number(ev.maxTeamSize) || 1)
  const minSize = Math.max(1, Number(ev.minTeamSize) || 1)
  const ordered = orderCandidates(candidates, ev.groupingMode || 'pureRandom')
  const { teams, leftover } = chunk(ordered, maxSize)
  if (leftover.length >= minSize) teams.push(leftover) // big enough to stand on its own

  const batch = db.batch()
  let n = 0
  for (const members of teams) {
    n++
    const ref = db.collection('registrations').doc()
    batch.set(ref, teamDocFromMembers(ev, members, `Team ${n}`))
    for (const m of members) batch.delete(db.collection('registrations').doc(m.regId))
  }
  batch.update(evSnap.ref, { groupingRanAt: new Date().toISOString() })
  await batch.commit()

  const stillLeftover = leftover.length < minSize ? leftover.length : 0
  return { skipped: false, teamsFormed: teams.length, grouped: candidates.length - stillLeftover, leftover: stillLeftover }
}

// Admin-initiated: form one team directly from a chosen set of ungrouped solo
// registrations (the leftover queue, or any still-solo registrant for this
// event) — used to top up a too-small leftover group. No min/max enforcement
// beyond maxTeamSize, since an admin doing this deliberately knows what
// they're building; still blocks accidental duplicates and cross-event mixing.
export async function formGroupFromRegistrations(db, eventId, registrationIds) {
  const evSnap = await db.collection('events').doc(eventId).get()
  if (!evSnap.exists) throw Object.assign(new Error('Event not found.'), { status: 404 })
  const ev = { id: eventId, ...evSnap.data() }

  const docs = await Promise.all(registrationIds.map((id) => db.collection('registrations').doc(id).get()))
  const missing = docs.findIndex((d) => !d.exists)
  if (missing !== -1) throw Object.assign(new Error('One of those registrations no longer exists.'), { status: 400 })
  const notThisEvent = docs.find((d) => d.data().eventId !== eventId)
  if (notThisEvent) throw Object.assign(new Error('All members must be registered for this event.'), { status: 400 })
  const alreadyTeam = docs.find((d) => d.data().isTeam)
  if (alreadyTeam) throw Object.assign(new Error('One of those is already part of a team.'), { status: 400 })

  const maxSize = Math.max(1, Number(ev.maxTeamSize) || 1)
  if (docs.length > maxSize) throw Object.assign(new Error(`A team can have at most ${maxSize} members.`), { status: 400 })

  const candidates = await withPhones(
    db,
    docs.map((d) => {
      const r = d.data()
      return {
        regId: d.id, uid: r.userId, name: r.userName, email: r.userEmail, department: r.department,
        college: r.college || '', year: r.year || '',
        paymentStatus: r.paymentStatus || '', paymentId: r.razorpayPaymentId || r.utr || '', paidAt: r.paidAt || null,
        receiptId: r.receiptId || '', utr: r.utr || '',
      }
    }),
  )

  const existingTeams = await db.collection('registrations').where('eventId', '==', eventId).where('isTeam', '==', true).get()
  const teamName = `Team ${existingTeams.size + 1}`

  const batch = db.batch()
  const ref = db.collection('registrations').doc()
  batch.set(ref, teamDocFromMembers(ev, candidates, teamName))
  for (const c of candidates) batch.delete(db.collection('registrations').doc(c.regId))
  await batch.commit()
  return { id: ref.id, teamName }
}

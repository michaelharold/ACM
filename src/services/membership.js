// "Already a member?" — verifying people who joined ACM before this website
// existed. Hybrid, automatic first:
//   1. The member types their membership ID. If the admin-uploaded roster has
//      that ID under the member's own (verified) sign-in email, they become a
//      member on the spot — firestore.rules checks the roster entry itself, so
//      the browser can't fake it.
//   2. Otherwise a request waits in the admin's Member verification tab. An
//      admin approves or denies it — and uploading a roster later approves any
//      waiting request it matches, so those leave the manual queue by
//      themselves.
// Works in mock mode too (localStorage), like the rest of services/.
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, writeBatch, serverTimestamp, getCountFromServer,
} from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../lib/firebase'
import { normalizeMemberId, normalizeEmail, rosterVerdict } from '../lib/memberRoster'
import { findMemberByMembershipId } from './payments'
import { sendAdminMessage } from './firestore'

const nowIso = () => new Date().toISOString()
const readLocal = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
const writeLocal = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota — demo just won't persist */ }
}
const REQ_KEY = 'acm-member-verifications'
const ROSTER_KEY = 'acm-member-roster'
const MEMBER_KEY = (uid) => `acm-membership-${uid}`

// A membership record that a verified existing member ends up with. It mirrors
// what a fee-paying applicant gets (so discounts, the members panel and CSV all
// treat them the same) plus where the verification came from.
function legacyMembership(person, { membershipId, via, by, rosterId = '', className = '' }) {
  return {
    userId: person.userId,
    googleName: person.googleName || '',
    firstName: person.name || '',
    middleName: '',
    lastName: '',
    email: person.email || '',
    phone: person.phone || '',
    department: person.department || '',
    year: person.year || '',
    college: person.college || '',
    gender: person.gender || '',
    className,
    membershipId,
    paymentStatus: 'free',
    amountDue: 0,
    rejectReason: '',
    upiAccountId: '',
    legacy: true,
    rosterId,
    verifiedVia: via, // 'roster' | 'admin'
    verifiedBy: by,
  }
}

// The profile snapshot a request carries, so the admin sees who is asking
// without needing to read user profiles.
function personFrom(user) {
  return {
    userId: user.id,
    name: user.name || '',
    googleName: user.googleName || '',
    email: auth?.currentUser?.email || user.email || '',
    phone: user.phone || '',
    department: user.department || '',
    year: user.year || '',
    college: user.college || '',
    gender: user.gender || '',
  }
}

// Can this person still claim an existing membership? Not once they have an
// ID, a verified payment, or a receipt under review.
export function canClaimExisting(membership) {
  if (!membership) return true
  return !String(membership.membershipId || '').trim() && !membership.receiptId && membership.paymentStatus !== 'paid'
}

// ── Member side ──────────────────────────────────────────────
export async function fetchMyVerification(uid) {
  if (!uid) return null
  if (!isFirebaseConfigured) return readLocal(REQ_KEY, []).find((r) => r.userId === uid) || null
  const snap = await getDoc(doc(db, 'memberVerifications', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Tries the roster first; falls back to a request for an admin. Resolves to
// { status: 'approved', membership } or { status: 'pending', request }.
export async function requestVerification({ user, membershipId, membership, request }) {
  const typed = String(membershipId || '').trim()
  const rosterId = normalizeMemberId(typed)
  if (!rosterId) throw new Error('Enter your ACM membership ID.')
  const person = personFrom(user)

  if (!isFirebaseConfigured) {
    const entry = readLocal(ROSTER_KEY, []).find((e) => e.rosterId === rosterId)
    if (entry && rosterVerdict(entry, person.email) === 'match') {
      const rec = { id: user.id, ...legacyMembership(person, { membershipId: entry.membershipId, via: 'roster', by: 'Auto (roster)', rosterId, className: membership?.className }), verifiedAt: nowIso(), createdAt: membership?.createdAt || nowIso() }
      writeLocal(MEMBER_KEY(user.id), rec)
      writeLocal(REQ_KEY, readLocal(REQ_KEY, []).filter((r) => r.userId !== user.id))
      return { status: 'approved', membership: rec }
    }
    const req = { id: user.id, ...person, membershipId: typed, rosterId, emailVerified: true, status: 'pending', createdAt: nowIso() }
    writeLocal(REQ_KEY, [req, ...readLocal(REQ_KEY, []).filter((r) => r.userId !== user.id)])
    return { status: 'pending', request: req }
  }

  // 1) Automatic: the rules only let you read a roster entry filed under your
  // own verified email, so a successful read IS the match.
  let entry = null
  try {
    const snap = await getDoc(doc(db, 'memberRoster', rosterId))
    if (snap.exists()) entry = snap.data()
  } catch { /* not on the roster under this account's email — fall through */ }
  if (entry) {
    try {
      const rec = legacyMembership(person, { membershipId: entry.membershipId, via: 'roster', by: 'Auto (roster)', rosterId, className: membership?.className || '' })
      const batch = writeBatch(db)
      batch.set(doc(db, 'memberships', user.id), { ...rec, verifiedAt: serverTimestamp(), ...(membership ? {} : { createdAt: serverTimestamp() }) }, { merge: true })
      batch.update(doc(db, 'users', user.id), { acmMember: true })
      if (request && request.status !== 'approved') batch.delete(doc(db, 'memberVerifications', user.id))
      await batch.commit()
      return { status: 'approved', membership: { id: user.id, ...(membership || {}), ...rec, verifiedAt: nowIso() } }
    } catch {
      /* e.g. a receipt went under review meanwhile — let an admin decide */
    }
  }

  // 2) Manual: a fresh request (a denied one is replaced wholesale).
  const req = {
    ...person,
    membershipId: typed,
    rosterId,
    emailVerified: !!auth?.currentUser?.emailVerified,
    status: 'pending',
    createdAt: serverTimestamp(),
  }
  await setDoc(doc(db, 'memberVerifications', user.id), req)
  return { status: 'pending', request: { id: user.id, ...req, createdAt: nowIso() } }
}

export async function cancelVerification(uid) {
  if (!isFirebaseConfigured) {
    writeLocal(REQ_KEY, readLocal(REQ_KEY, []).filter((r) => r.userId !== uid))
    return
  }
  await deleteDoc(doc(db, 'memberVerifications', uid))
}

// ── Admin side ───────────────────────────────────────────────
export async function fetchVerificationRequests() {
  if (!isFirebaseConfigured) return readLocal(REQ_KEY, [])
  const snap = await getDocs(collection(db, 'memberVerifications'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function fetchPendingVerificationCount() {
  if (!isFirebaseConfigured) return readLocal(REQ_KEY, []).filter((r) => r.status === 'pending').length
  const snap = await getCountFromServer(query(collection(db, 'memberVerifications'), where('status', '==', 'pending')))
  return snap.data().count
}

export async function fetchRosterEntry(rosterId) {
  if (!rosterId) return null
  if (!isFirebaseConfigured) return readLocal(ROSTER_KEY, []).find((e) => e.rosterId === rosterId) || null
  const snap = await getDoc(doc(db, 'memberRoster', rosterId))
  return snap.exists() ? { rosterId: snap.id, ...snap.data() } : null
}

export async function fetchRosterCount() {
  if (!isFirebaseConfigured) return readLocal(ROSTER_KEY, []).length
  const snap = await getCountFromServer(collection(db, 'memberRoster'))
  return snap.data().count
}

export async function fetchRoster() {
  if (!isFirebaseConfigured) return readLocal(ROSTER_KEY, [])
  const snap = await getDocs(collection(db, 'memberRoster'))
  return snap.docs.map((d) => ({ rosterId: d.id, ...d.data() }))
}

// Adds or updates roster entries (keyed by ID, so re-uploading is safe).
// Firestore batches hold 500 writes; 400 leaves headroom.
export async function saveRosterEntries(entries, uploadedBy) {
  if (!isFirebaseConfigured) {
    const byId = new Map(readLocal(ROSTER_KEY, []).map((e) => [e.rosterId, e]))
    entries.forEach((e) => byId.set(e.rosterId, { ...e, uploadedBy, uploadedAt: nowIso() }))
    writeLocal(ROSTER_KEY, [...byId.values()])
    return
  }
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db)
    for (const e of entries.slice(i, i + 400)) {
      batch.set(doc(db, 'memberRoster', e.rosterId), {
        membershipId: e.membershipId,
        email: normalizeEmail(e.email),
        name: e.name || '',
        uploadedBy: uploadedBy || 'Admin',
        uploadedAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }
}

export async function clearRoster() {
  if (!isFirebaseConfigured) { writeLocal(ROSTER_KEY, []); return }
  const snap = await getDocs(collection(db, 'memberRoster'))
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db)
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
}

// Approve a request: the person becomes a member with the given ID (the admin
// may correct a typo first). Writes the member record, the profile flag and the
// request's outcome together.
export async function approveVerification({ request, membershipId, reviewer, via = 'admin' }) {
  const id = String(membershipId || request.membershipId || '').trim()
  if (!id) throw new Error('Enter the membership ID to assign.')
  const uid = request.userId || request.id
  const by = via === 'roster' ? 'Auto (roster)' : (reviewer || 'Admin')
  const decision = { status: 'approved', approvedMembershipId: id, verifiedVia: via, reviewedBy: by }
  if (!isFirebaseConfigured) {
    const cur = readLocal(MEMBER_KEY(uid), null)
    writeLocal(MEMBER_KEY(uid), { id: uid, ...(cur || {}), ...legacyMembership(request, { membershipId: id, via, by, rosterId: normalizeMemberId(id), className: cur?.className }), verifiedAt: nowIso(), createdAt: cur?.createdAt || nowIso() })
    writeLocal(REQ_KEY, readLocal(REQ_KEY, []).map((r) => (r.userId === uid ? { ...r, ...decision, reviewedAt: nowIso() } : r)))
    return { ...decision, reviewedAt: nowIso() }
  }
  const memRef = doc(db, 'memberships', uid)
  const existing = await getDoc(memRef)
  const rec = legacyMembership({ ...request, userId: uid }, { membershipId: id, via, by, rosterId: normalizeMemberId(id), className: existing.data()?.className || '' })
  const batch = writeBatch(db)
  batch.set(memRef, { ...rec, verifiedAt: serverTimestamp(), ...(existing.exists() ? {} : { createdAt: serverTimestamp() }) }, { merge: true })
  batch.update(doc(db, 'users', uid), { acmMember: true })
  batch.update(doc(db, 'memberVerifications', uid), { ...decision, reviewedAt: serverTimestamp() })
  await batch.commit()
  return { ...decision, reviewedAt: nowIso() }
}

// Deny a request: the member sees the reason on their membership page (where
// the join / verify options come back) and gets it in their inbox too.
export async function denyVerification({ request, reason, reviewer }) {
  const uid = request.userId || request.id
  const decision = { status: 'denied', denyReason: String(reason || '').trim(), reviewedBy: reviewer || 'Admin' }
  if (!isFirebaseConfigured) {
    writeLocal(REQ_KEY, readLocal(REQ_KEY, []).map((r) => (r.userId === uid ? { ...r, ...decision, reviewedAt: nowIso() } : r)))
  } else {
    await setDoc(doc(db, 'memberVerifications', uid), { ...decision, reviewedAt: serverTimestamp() }, { merge: true })
  }
  sendAdminMessage({
    toUid: uid,
    toName: request.name,
    toEmail: request.email,
    subject: 'Your ACM membership verification',
    body: `We couldn’t verify membership ID ${request.membershipId}.${decision.denyReason ? ` Reason: ${decision.denyReason}` : ''} You can check the ID and try again, or join the chapter from the Membership page.`,
    fromName: reviewer,
  }).catch(() => { /* the on-page notice still tells them */ })
  return { ...decision, reviewedAt: nowIso() }
}

// Everything the admin needs to judge a request: the roster entry for its ID
// (if any), the verdict, and whether another member already holds that ID.
export async function checkRequest(request) {
  const [entry, holder] = await Promise.all([
    fetchRosterEntry(request.rosterId || normalizeMemberId(request.membershipId)).catch(() => null),
    isFirebaseConfigured ? findMemberByMembershipId(request.membershipId).catch(() => null) : null,
  ])
  const takenBy = holder && holder.uid !== (request.userId || request.id) ? holder : null
  return { entry, verdict: rosterVerdict(entry, request.email), takenBy }
}

// Approves every waiting request the roster vouches for: ID and verified email
// both match, and no one else already holds the ID. Returns how many were
// approved; the rest stay for an admin.
export async function autoApproveFromRoster(requests) {
  let approved = 0
  for (const r of requests.filter((x) => x.status === 'pending')) {
    if (isFirebaseConfigured && !r.emailVerified) continue
    const { entry, verdict, takenBy } = await checkRequest(r)
    if (verdict !== 'match' || takenBy) continue
    try {
      await approveVerification({ request: r, membershipId: entry.membershipId, via: 'roster' })
      approved++
    } catch { /* leave it for manual review */ }
  }
  return approved
}

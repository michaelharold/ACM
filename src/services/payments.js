// Firestore I/O for the manual payment flow: UPI/QR accounts, receipt
// submission, and the admin review queue. Security rules enforce every state
// change (firestore.rules); this layer just performs the writes atomically and
// turns rule denials into messages a payer can act on. Works in mock mode too.
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, limit,
  writeBatch, serverTimestamp, getAggregateFromServer, sum,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import { normalizeUtr, holdsSeat } from '../lib/manualPay'
import { membershipRecord, bumpEventCount } from './firestore'

const map = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))
const nowIso = () => new Date().toISOString()
const readLocal = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
const writeLocal = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota — demo just won't persist */ }
}
const fullName = (m) => [m.firstName, m.middleName, m.lastName].filter(Boolean).join(' ') || m.googleName || ''
const colFor = (kind) => (kind === 'membership' ? 'memberships' : 'registrations')

// ── UPI / QR accounts ────────────────────────────────────────
const UPI_KEY = 'acm-upi-accounts'

export async function fetchUpiAccounts() {
  if (!isFirebaseConfigured) return readLocal(UPI_KEY, [])
  return map(await getDocs(collection(db, 'upiAccounts')))
}

export async function createUpiAccount(data) {
  const clean = {
    label: data.label || 'UPI account',
    payeeName: data.payeeName || '',
    upiId: (data.upiId || '').trim(),
    qrImage: data.qrImage || '',
    active: data.active !== false,
  }
  if (!isFirebaseConfigured) {
    const rec = { id: `upi_${Date.now()}`, ...clean }
    writeLocal(UPI_KEY, [rec, ...readLocal(UPI_KEY, [])])
    return rec
  }
  const ref = await addDoc(collection(db, 'upiAccounts'), { ...clean, createdAt: serverTimestamp() })
  return { id: ref.id, ...clean }
}

export async function updateUpiAccount(id, patch) {
  if (!isFirebaseConfigured) {
    writeLocal(UPI_KEY, readLocal(UPI_KEY, []).map((a) => (a.id === id ? { ...a, ...patch } : a)))
    return
  }
  await updateDoc(doc(db, 'upiAccounts', id), patch)
}

export async function deleteUpiAccount(id) {
  if (!isFirebaseConfigured) {
    writeLocal(UPI_KEY, readLocal(UPI_KEY, []).filter((a) => a.id !== id))
    return
  }
  await deleteDoc(doc(db, 'upiAccounts', id))
}

// ── Submitting a receipt ─────────────────────────────────────
const receiptDoc = ({ kind, refId, userId, image, utr, amount }) => ({
  kind, refId, userId, image, utr,
  amount: Number(amount) || 0,
  // Stored so the admin storage meter can sum receipt sizes without reading images.
  bytes: image.length,
  createdAt: serverTimestamp(),
})

// Before writing, check the UTR hasn't been used. The rules let you read your
// own or a nonexistent UTR doc and deny someone else's — so a denial here
// reliably means "another payer already submitted this transaction ID".
async function assertUtrAvailable(utr) {
  let snap
  try {
    snap = await getDoc(doc(db, 'utrs', utr))
  } catch (err) {
    if (err?.code === 'permission-denied') {
      throw new Error('This transaction ID has already been submitted for another payment. Enter the ID of your own payment.')
    }
    throw err
  }
  if (snap.exists()) {
    throw new Error('You’ve already submitted this transaction ID. Enter the ID of this payment — each payment can only be used once.')
  }
}

async function commitReceiptBatch(batch) {
  try {
    await batch.commit()
  } catch (err) {
    if (err?.code === 'permission-denied') {
      throw new Error('We couldn’t save your receipt. If this transaction ID was used before, enter the ID of this payment; otherwise please try again.')
    }
    throw err
  }
}

// New solo registration with its receipt, written atomically — there is never
// a paid-event registration without its receipt, or a receipt without its UTR.
export async function createRegistrationWithReceipt(regDoc, { image, utr, amount }) {
  const u = normalizeUtr(utr)
  const fields = { paymentStatus: 'pending', utr: u, rejectReason: '' }
  if (!isFirebaseConfigured) {
    return { id: `r_${Date.now()}`, ...regDoc, ...fields, receiptId: `rc_${Date.now()}`, receiptSubmittedAt: nowIso() }
  }
  await assertUtrAvailable(u)
  const regRef = doc(collection(db, 'registrations'))
  const rcRef = doc(collection(db, 'receipts'))
  const batch = writeBatch(db)
  batch.set(regRef, { ...regDoc, ...fields, receiptId: rcRef.id, receiptSubmittedAt: serverTimestamp(), createdAt: serverTimestamp() })
  batch.set(rcRef, receiptDoc({ kind: 'event', refId: regRef.id, userId: regDoc.userId, image, utr: u, amount }))
  batch.set(doc(db, 'utrs', u), { userId: regDoc.userId, kind: 'event', refId: regRef.id, receiptId: rcRef.id, createdAt: serverTimestamp() })
  await commitReceiptBatch(batch)
  return { id: regRef.id, ...regDoc, ...fields, receiptId: rcRef.id, receiptSubmittedAt: nowIso() }
}

// New membership application with its receipt, written atomically.
export async function createMembershipWithReceipt(uid, data, { image, utr, amount }) {
  const u = normalizeUtr(utr)
  const rec = { ...membershipRecord(uid, { ...data, paymentStatus: 'pending' }), utr: u, rejectReason: '' }
  if (!isFirebaseConfigured) {
    const local = { id: uid, ...rec, receiptId: `rc_${Date.now()}`, receiptSubmittedAt: nowIso(), createdAt: nowIso() }
    writeLocal(`acm-membership-${uid}`, local)
    return local
  }
  await assertUtrAvailable(u)
  const rcRef = doc(collection(db, 'receipts'))
  const batch = writeBatch(db)
  batch.set(doc(db, 'memberships', uid), { ...rec, receiptId: rcRef.id, receiptSubmittedAt: serverTimestamp(), createdAt: serverTimestamp() })
  batch.set(rcRef, receiptDoc({ kind: 'membership', refId: uid, userId: uid, image, utr: u, amount }))
  batch.set(doc(db, 'utrs', u), { userId: uid, kind: 'membership', refId: uid, receiptId: rcRef.id, createdAt: serverTimestamp() })
  await commitReceiptBatch(batch)
  return { id: uid, ...rec, receiptId: rcRef.id, receiptSubmittedAt: nowIso() }
}

// Attach a receipt to an EXISTING record: a team registration the server just
// created, or a re-upload after a rejection. `patch` carries extra owner-
// writable fields (e.g. { seatHeld: true } when a released seat is re-taken).
// Returns the fields applied, for merging into local state.
export async function attachReceipt({ kind, refId, userId, image, utr, amount, patch = {} }) {
  const u = normalizeUtr(utr)
  const update = { paymentStatus: 'pending', utr: u, rejectReason: '', ...patch }
  if (!isFirebaseConfigured) return { ...update, receiptId: `rc_${Date.now()}`, receiptSubmittedAt: nowIso() }
  await assertUtrAvailable(u)
  const rcRef = doc(collection(db, 'receipts'))
  const batch = writeBatch(db)
  batch.set(rcRef, receiptDoc({ kind, refId, userId, image, utr: u, amount }))
  batch.set(doc(db, 'utrs', u), { userId, kind, refId, receiptId: rcRef.id, createdAt: serverTimestamp() })
  batch.update(doc(db, colFor(kind), refId), { ...update, receiptId: rcRef.id, receiptSubmittedAt: serverTimestamp() })
  await commitReceiptBatch(batch)
  return { ...update, receiptId: rcRef.id, receiptSubmittedAt: nowIso() }
}

// Best-effort cleanup when an unverified registration is cancelled, so its
// transaction ID can be used again and the screenshot doesn't linger.
export async function discardReceipt(rec) {
  if (!isFirebaseConfigured || !rec?.receiptId) return
  await Promise.allSettled([
    deleteDoc(doc(db, 'receipts', rec.receiptId)),
    rec.utr ? deleteDoc(doc(db, 'utrs', rec.utr)) : null,
  ])
}

// ── Reviewing (admins / granted editors) ─────────────────────
export async function fetchReceipt(id) {
  if (!isFirebaseConfigured || !id) return null
  const snap = await getDoc(doc(db, 'receipts', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

const submittedMillis = (rec) => {
  const t = rec?.receiptSubmittedAt
  if (!t) return 0
  if (typeof t.toMillis === 'function') return t.toMillis()
  return Date.parse(t) || 0
}

// Every receipt awaiting a decision, oldest first. `events` / `membership`
// choose which kinds to load (an editor only sees what they may verify).
export async function fetchPendingReviews({ events = true, membership = true } = {}) {
  if (!isFirebaseConfigured) return []
  const [regs, mems] = await Promise.all([
    events ? getDocs(query(collection(db, 'registrations'), where('paymentStatus', '==', 'pending'))) : null,
    membership ? getDocs(query(collection(db, 'memberships'), where('paymentStatus', '==', 'pending'))) : null,
  ])
  const items = []
  if (regs) {
    for (const r of map(regs)) {
      if (!r.receiptId) continue
      items.push({
        kind: 'event',
        record: r,
        eventId: r.eventId,
        title: r.eventName || 'Event',
        personName: r.isTeam ? `${r.teamName || 'Team'} · ${r.userName || ''}` : (r.userName || '—'),
        personEmail: r.userEmail || '',
      })
    }
  }
  if (mems) {
    for (const m of map(mems)) {
      if (!m.receiptId) continue
      items.push({ kind: 'membership', record: m, title: 'ACM Membership', personName: fullName(m) || '—', personEmail: m.email || '' })
    }
  }
  return items.sort((a, b) => submittedMillis(a.record) - submittedMillis(b.record))
}

// Cross-check a membership ID claimed on a registration (admins and
// membership editors only — the rules deny everyone else).
export async function findMemberByMembershipId(membershipId) {
  const id = String(membershipId || '').trim()
  if (!isFirebaseConfigured || !id) return null
  const snap = await getDocs(query(collection(db, 'memberships'), where('membershipId', '==', id), limit(1)))
  if (snap.empty) return null
  const m = snap.docs[0].data()
  return { uid: snap.docs[0].id, name: fullName(m), paymentStatus: m.paymentStatus || '' }
}

// Approve: the record becomes 'paid' (→ ticket / member). A membership also
// flips the member's profile flag so the rest of the site treats them as one.
export async function approvePayment({ kind, record, reviewer }) {
  const patch = { paymentStatus: 'paid', reviewedBy: reviewer || 'Admin' }
  if (!isFirebaseConfigured) return { ...patch, paidAt: nowIso(), reviewedAt: nowIso() }
  const batch = writeBatch(db)
  batch.update(doc(db, colFor(kind), record.id), { ...patch, paidAt: serverTimestamp(), reviewedAt: serverTimestamp() })
  if (kind === 'membership') batch.update(doc(db, 'users', record.userId || record.id), { acmMember: true })
  await batch.commit()
  return { ...patch, paidAt: nowIso(), reviewedAt: nowIso() }
}

// Reject: record the reason, free the transaction ID (so the payer can
// resubmit it with a clearer screenshot), drop the screenshot, and release the
// event seat if this registration was holding one.
export async function rejectPayment({ kind, record, reviewer, reason }) {
  const releaseSeat = kind === 'event' && holdsSeat(record)
  const patch = {
    paymentStatus: 'rejected',
    rejectReason: String(reason || '').trim(),
    reviewedBy: reviewer || 'Admin',
    receiptId: '',
    utr: '',
    ...(kind === 'event' ? { seatHeld: false } : {}),
  }
  if (!isFirebaseConfigured) return { ...patch, reviewedAt: nowIso() }
  // Only delete what still exists — a delete of a missing doc fails the rules
  // (and with it the whole batch).
  const [rc, ut] = await Promise.all([
    record.receiptId ? getDoc(doc(db, 'receipts', record.receiptId)) : null,
    record.utr ? getDoc(doc(db, 'utrs', record.utr)) : null,
  ])
  const batch = writeBatch(db)
  batch.update(doc(db, colFor(kind), record.id), { ...patch, reviewedAt: serverTimestamp() })
  if (rc?.exists()) batch.delete(rc.ref)
  if (ut?.exists()) batch.delete(ut.ref)
  await batch.commit()
  if (releaseSeat && record.eventId) await bumpEventCount(record.eventId, -1)
  return { ...patch, reviewedAt: nowIso() }
}

// ── Storage meter ────────────────────────────────────────────
// Total bytes of every stored receipt, summed server-side from the `bytes`
// field (no images downloaded). Admin-only; 0 when unavailable.
export async function fetchReceiptBytes() {
  if (!isFirebaseConfigured) return 0
  const snap = await getAggregateFromServer(collection(db, 'receipts'), { total: sum('bytes') })
  return Number(snap.data().total) || 0
}

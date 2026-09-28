// Firestore rules tests — run with `npm run test:rules` (starts the emulator).
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, collection, getDocs, query, where } from 'firebase/firestore'

let env
const as = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore()
const anon = () => env.unauthenticatedContext().firestore()
const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()))

const UTR = '412345678901'
const UTR2 = '998877665544'
const IMG = 'data:image/jpeg;base64,AAAA'

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-acm-rules',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  })
})
after(async () => { await env?.cleanup() })

beforeEach(async () => {
  await env.clearFirestore()
  await seed(async (db) => {
    await setDoc(doc(db, 'users/admin'), { role: 'admin' })
    await setDoc(doc(db, 'users/regEditor'), { role: 'user', permissions: { registrations: true } })
    await setDoc(doc(db, 'users/memEditor'), { role: 'user', permissions: { membership: true } })
    await setDoc(doc(db, 'users/eventsEditor'), { role: 'user', permissions: { events: true } })
    await setDoc(doc(db, 'users/alice'), { role: 'user', acmMember: false, name: 'Alice' })
    await setDoc(doc(db, 'users/bob'), { role: 'user', acmMember: false, name: 'Bob' })
    await setDoc(doc(db, 'events/paid'), { name: 'Paid', fee: 200, acmDiscount: 50, registeredCount: 1 })
    await setDoc(doc(db, 'events/free'), { name: 'Free', fee: 0 })
    await setDoc(doc(db, 'siteContent/main'), { membershipFee: 100 })
  })
})

const reg = (over = {}) => ({ userId: 'alice', eventId: 'paid', paymentStatus: 'pending', amountDue: 200, counted: true, seatHeld: true, ...over })

async function seedPending(status = 'pending') {
  await seed(async (db) => {
    await setDoc(doc(db, 'registrations/r1'), reg({ paymentStatus: status, receiptId: 'rc1', utr: UTR }))
    await setDoc(doc(db, 'receipts/rc1'), { kind: 'event', refId: 'r1', userId: 'alice', image: IMG, utr: UTR, amount: 200, bytes: 27 })
    await setDoc(doc(db, `utrs/${UTR}`), { userId: 'alice', kind: 'event', refId: 'r1', receiptId: 'rc1' })
  })
}

// ── users ────────────────────────────────────────────────────
test('a new user cannot create themselves as admin', async () => {
  await assertFails(setDoc(doc(as('carol'), 'users/carol'), { role: 'admin', permissions: {}, acmMember: false }))
  await assertFails(setDoc(doc(as('carol'), 'users/carol'), { role: 'user', permissions: { events: true }, acmMember: false }))
  await assertSucceeds(setDoc(doc(as('carol'), 'users/carol'), { role: 'user', permissions: {}, acmMember: false, name: 'C' }))
})

test('a user cannot set their own acmMember, but can edit their profile', async () => {
  await assertFails(updateDoc(doc(as('alice'), 'users/alice'), { acmMember: true }))
  await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice'), { name: 'Alice B' }))
})

test('a membership editor may set acmMember only', async () => {
  await assertSucceeds(updateDoc(doc(as('memEditor'), 'users/alice'), { acmMember: true }))
  await assertFails(updateDoc(doc(as('memEditor'), 'users/alice'), { name: 'X' }))
  await assertFails(updateDoc(doc(as('regEditor'), 'users/alice'), { acmMember: true }))
})

// ── registrations: create ────────────────────────────────────
test('free registration only for a free event', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'registrations/f1'), reg({ eventId: 'free', paymentStatus: 'free', amountDue: 0 })))
  await assertFails(setDoc(doc(as('alice'), 'registrations/f2'), reg({ paymentStatus: 'free', amountDue: 0 })))
})

test('nobody self-creates a paid registration', async () => {
  await assertFails(setDoc(doc(as('alice'), 'registrations/p1'), reg({ paymentStatus: 'paid' })))
})

test('pending registration must owe at least fee minus discount', async () => {
  await assertFails(setDoc(doc(as('alice'), 'registrations/p2'), reg({ amountDue: 100 })))
  await assertSucceeds(setDoc(doc(as('alice'), 'registrations/p3'), reg({ amountDue: 150 })))
})

test('registration + receipt + utr in one batch succeeds', async () => {
  const db = as('alice')
  const b = writeBatch(db)
  b.set(doc(db, 'registrations/r9'), reg({ receiptId: 'rc9', utr: UTR }))
  b.set(doc(db, 'receipts/rc9'), { kind: 'event', refId: 'r9', userId: 'alice', image: IMG, utr: UTR, amount: 200, bytes: 27 })
  b.set(doc(db, `utrs/${UTR}`), { userId: 'alice', kind: 'event', refId: 'r9', receiptId: 'rc9' })
  await assertSucceeds(b.commit())
})

// ── utrs ─────────────────────────────────────────────────────
test('a UTR can only be used once', async () => {
  await seedPending()
  await assertFails(setDoc(doc(as('bob'), `utrs/${UTR}`), { userId: 'bob', kind: 'event', refId: 'x', receiptId: 'y' }))
  await assertFails(setDoc(doc(as('alice'), `utrs/${UTR}`), { userId: 'alice', kind: 'event', refId: 'x', receiptId: 'y' }))
})

test('utr pre-check: own or unknown readable, someone else\'s denied', async () => {
  await seedPending()
  await assertSucceeds(getDoc(doc(as('alice'), `utrs/${UTR}`)))
  await assertSucceeds(getDoc(doc(as('bob'), `utrs/${UTR2}`)))
  await assertFails(getDoc(doc(as('bob'), `utrs/${UTR}`)))
})

test('utr id must be 12 digits and owned by the writer', async () => {
  await assertFails(setDoc(doc(as('alice'), 'utrs/123'), { userId: 'alice', kind: 'event', refId: 'x', receiptId: 'y' }))
  await assertFails(setDoc(doc(as('alice'), `utrs/${UTR2}`), { userId: 'bob', kind: 'event', refId: 'x', receiptId: 'y' }))
})

// ── receipts ─────────────────────────────────────────────────
test('receipt read: owner and matching verifier only', async () => {
  await seedPending()
  await assertSucceeds(getDoc(doc(as('alice'), 'receipts/rc1')))
  await assertSucceeds(getDoc(doc(as('regEditor'), 'receipts/rc1')))
  await assertSucceeds(getDoc(doc(as('admin'), 'receipts/rc1')))
  await assertFails(getDoc(doc(as('bob'), 'receipts/rc1')))
  await assertFails(getDoc(doc(as('memEditor'), 'receipts/rc1')))
})

test('receipt create validates shape', async () => {
  const base = { kind: 'event', refId: 'r1', userId: 'alice', image: IMG, utr: UTR, amount: 200, bytes: 27 }
  await assertFails(setDoc(doc(as('alice'), 'receipts/x1'), { ...base, userId: 'bob' }))
  await assertFails(setDoc(doc(as('alice'), 'receipts/x2'), { ...base, utr: '12' }))
  await assertFails(setDoc(doc(as('alice'), 'receipts/x3'), { ...base, kind: 'other' }))
  await assertFails(setDoc(doc(as('alice'), 'receipts/x4'), { ...base, image: 'x'.repeat(400001) }))
  await assertSucceeds(setDoc(doc(as('alice'), 'receipts/x5'), base))
})

// ── registrations: review ────────────────────────────────────
test('owner cannot verify their own registration', async () => {
  await seedPending()
  await assertFails(updateDoc(doc(as('alice'), 'registrations/r1'), { paymentStatus: 'paid' }))
})

test('registrations editor approves; events-only editor cannot', async () => {
  await seedPending()
  await assertFails(updateDoc(doc(as('eventsEditor'), 'registrations/r1'), { paymentStatus: 'paid' }))
  await assertSucceeds(updateDoc(doc(as('regEditor'), 'registrations/r1'), { paymentStatus: 'paid', reviewedBy: 'R' }))
})

test('registrations editor cannot touch non-review fields', async () => {
  await seedPending()
  await assertFails(updateDoc(doc(as('regEditor'), 'registrations/r1'), { amountDue: 1 }))
})

test('reject then resubmit; never resubmit over a paid one', async () => {
  await seedPending()
  const ed = as('regEditor')
  const b = writeBatch(ed)
  b.update(doc(ed, 'registrations/r1'), { paymentStatus: 'rejected', rejectReason: 'blurry', receiptId: '', utr: '', seatHeld: false })
  b.delete(doc(ed, 'receipts/rc1'))
  b.delete(doc(ed, `utrs/${UTR}`))
  await assertSucceeds(b.commit())

  const db = as('alice')
  const r = writeBatch(db)
  r.set(doc(db, 'receipts/rc2'), { kind: 'event', refId: 'r1', userId: 'alice', image: IMG, utr: UTR, amount: 200, bytes: 27 })
  r.set(doc(db, `utrs/${UTR}`), { userId: 'alice', kind: 'event', refId: 'r1', receiptId: 'rc2' })
  r.update(doc(db, 'registrations/r1'), { paymentStatus: 'pending', receiptId: 'rc2', utr: UTR, rejectReason: '', seatHeld: true })
  await assertSucceeds(r.commit())
  // …but not smuggling in another field
  await assertFails(updateDoc(doc(db, 'registrations/r1'), { amountDue: 1 }))

  await seed((sdb) => updateDoc(doc(sdb, 'registrations/r1'), { paymentStatus: 'paid' }))
  await assertFails(updateDoc(doc(db, 'registrations/r1'), { paymentStatus: 'pending', receiptId: 'rc3' }))
})

test('owner may discard receipt+utr of an unpaid (or deleted) registration only', async () => {
  await seedPending('paid')
  await assertFails(deleteDoc(doc(as('alice'), `utrs/${UTR}`)))
  await assertFails(deleteDoc(doc(as('alice'), 'receipts/rc1')))
  await seed((sdb) => deleteDoc(doc(sdb, 'registrations/r1')))
  await assertSucceeds(deleteDoc(doc(as('alice'), `utrs/${UTR}`)))
  await assertSucceeds(deleteDoc(doc(as('alice'), 'receipts/rc1')))
})

// ── memberships ──────────────────────────────────────────────
const mem = (over = {}) => ({ userId: 'alice', membershipId: '', paymentStatus: 'pending', amountDue: 100, ...over })

test('membership: free only when the fee is zero; pending ok', async () => {
  await assertFails(setDoc(doc(as('alice'), 'memberships/alice'), mem({ paymentStatus: 'free' })))
  await assertFails(setDoc(doc(as('alice'), 'memberships/alice'), mem({ paymentStatus: 'paid' })))
  await assertSucceeds(setDoc(doc(as('alice'), 'memberships/alice'), mem()))
})

test('membership: owner cannot mark paid or lower amountDue; editor can verify', async () => {
  await seed((sdb) => setDoc(doc(sdb, 'memberships/alice'), mem({ receiptId: 'rc1', utr: UTR })))
  await assertFails(updateDoc(doc(as('alice'), 'memberships/alice'), { paymentStatus: 'paid' }))
  await assertFails(updateDoc(doc(as('alice'), 'memberships/alice'), { amountDue: 1 }))
  await assertFails(updateDoc(doc(as('alice'), 'memberships/alice'), { reviewedBy: 'me' }))
  await assertSucceeds(updateDoc(doc(as('memEditor'), 'memberships/alice'), { paymentStatus: 'paid', reviewedBy: 'M' }))
})

test('membership: owner can resubmit after rejection', async () => {
  await seed((sdb) => setDoc(doc(sdb, 'memberships/alice'), mem({ paymentStatus: 'rejected', rejectReason: 'wrong amount' })))
  await assertSucceeds(updateDoc(doc(as('alice'), 'memberships/alice'), { paymentStatus: 'pending', receiptId: 'rc5', utr: UTR2, rejectReason: '' }))
})

test('membership verifier queries pending memberships; plain user cannot', async () => {
  await seed((sdb) => setDoc(doc(sdb, 'memberships/alice'), mem({ receiptId: 'rc1' })))
  await assertSucceeds(getDocs(query(collection(as('memEditor'), 'memberships'), where('paymentStatus', '==', 'pending'))))
  await assertFails(getDocs(query(collection(as('bob'), 'memberships'), where('paymentStatus', '==', 'pending'))))
})

// ── upiAccounts ──────────────────────────────────────────────
test('upiAccounts: public read, admin/events editors write, admin deletes', async () => {
  await seed((sdb) => setDoc(doc(sdb, 'upiAccounts/u1'), { label: 'Main', upiId: 'a@b', active: true }))
  await assertSucceeds(getDoc(doc(anon(), 'upiAccounts/u1')))
  await assertSucceeds(setDoc(doc(as('eventsEditor'), 'upiAccounts/u2'), { label: 'E', upiId: 'e@b', active: true }))
  await assertFails(setDoc(doc(as('alice'), 'upiAccounts/u3'), { label: 'X', upiId: 'x@b', active: true }))
  await assertFails(deleteDoc(doc(as('eventsEditor'), 'upiAccounts/u1')))
  await assertSucceeds(deleteDoc(doc(as('admin'), 'upiAccounts/u1')))
})

// ── eventPrivate (hidden WhatsApp links) ─────────────────────
test('eventPrivate: event editors only', async () => {
  await seed((sdb) => setDoc(doc(sdb, 'eventPrivate/paid'), { whatsappLink: 'https://chat.whatsapp.com/x' }))
  await assertSucceeds(getDoc(doc(as('eventsEditor'), 'eventPrivate/paid')))
  await assertSucceeds(setDoc(doc(as('admin'), 'eventPrivate/free'), { whatsappLink: 'y' }))
  await assertFails(getDoc(doc(as('alice'), 'eventPrivate/paid')))
  await assertFails(getDoc(doc(anon(), 'eventPrivate/paid')))
  await assertFails(setDoc(doc(as('regEditor'), 'eventPrivate/paid'), { whatsappLink: 'z' }))
})

// ── member roster + "Already a member?" ──────────────────────
// A signed-in user whose token carries a (verified or not) email.
const withEmail = (uid, email, verified = true) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore()
const ALICE_MAIL = 'alice@tkmce.ac.in'
const seedRoster = () => seed(async (db) => {
  await setDoc(doc(db, 'memberRoster/1234567'), { membershipId: '1234567', email: ALICE_MAIL, name: 'Alice' })
  await setDoc(doc(db, 'memberRoster/7654321'), { membershipId: '7654321', email: 'bob@tkmce.ac.in', name: 'Bob' })
})
const legacy = (over = {}) => ({
  userId: 'alice', membershipId: '1234567', rosterId: '1234567', paymentStatus: 'free', amountDue: 0,
  legacy: true, verifiedVia: 'roster', verifiedBy: 'Auto (roster)', ...over,
})

test('roster: a member reads only the entry under their own verified email', async () => {
  await seedRoster()
  await assertSucceeds(getDoc(doc(withEmail('alice', ALICE_MAIL), 'memberRoster/1234567')))
  await assertSucceeds(getDoc(doc(withEmail('alice', 'Alice@TKMCE.ac.in'), 'memberRoster/1234567')))
  await assertFails(getDoc(doc(withEmail('alice', ALICE_MAIL), 'memberRoster/7654321')))
  await assertFails(getDoc(doc(withEmail('alice', ALICE_MAIL), 'memberRoster/0000000'))) // missing reads as denied
  await assertFails(getDoc(doc(withEmail('alice', ALICE_MAIL, false), 'memberRoster/1234567'))) // unverified email
  await assertFails(getDocs(collection(withEmail('alice', ALICE_MAIL), 'memberRoster')))
  await assertSucceeds(getDocs(collection(as('memEditor'), 'memberRoster')))
  await assertFails(setDoc(doc(withEmail('alice', ALICE_MAIL), 'memberRoster/1234567'), { membershipId: '1234567', email: ALICE_MAIL }))
  await assertSucceeds(setDoc(doc(as('memEditor'), 'memberRoster/5555555'), { membershipId: '5555555', email: 'x@y.z' }))
})

test('roster claim: membership + acmMember in one batch, only for your own entry', async () => {
  await seedRoster()
  const db = withEmail('alice', ALICE_MAIL)
  const good = writeBatch(db)
  good.set(doc(db, 'memberships/alice'), legacy())
  good.update(doc(db, 'users/alice'), { acmMember: true })
  await assertSucceeds(good.commit())
})

test('roster claim: someone else\'s ID, a changed ID, an unverified email, or a flag without the record all fail', async () => {
  await seedRoster()
  const db = withEmail('alice', ALICE_MAIL)
  await assertFails(setDoc(doc(db, 'memberships/alice'), legacy({ membershipId: '7654321', rosterId: '7654321' })))
  await assertFails(setDoc(doc(db, 'memberships/alice'), legacy({ membershipId: '9999999' })))
  await assertFails(setDoc(doc(db, 'memberships/alice'), legacy({ paymentStatus: 'paid' })))
  await assertFails(setDoc(doc(withEmail('alice', ALICE_MAIL, false), 'memberships/alice'), legacy()))
  await assertFails(setDoc(doc(withEmail('bob', ALICE_MAIL), 'memberships/alice'), legacy()))
  await assertFails(updateDoc(doc(db, 'users/alice'), { acmMember: true }))
})

test('roster claim over an unpaid application, but not over a receipt under review', async () => {
  await seedRoster()
  const db = withEmail('alice', ALICE_MAIL)
  await seed((sdb) => setDoc(doc(sdb, 'memberships/alice'), mem({ paymentStatus: 'rejected' })))
  await assertSucceeds(setDoc(doc(db, 'memberships/alice'), legacy(), { merge: true }))
  await seed((sdb) => setDoc(doc(sdb, 'memberships/alice'), mem({ receiptId: 'rc1', utr: UTR })))
  await assertFails(setDoc(doc(db, 'memberships/alice'), legacy(), { merge: true }))
})

const vreq = (over = {}) => ({
  userId: 'alice', status: 'pending', membershipId: '42', rosterId: '42', name: 'Alice',
  email: ALICE_MAIL, emailVerified: true, ...over,
})

test('verification request: own, pending, honest email; no self-approval', async () => {
  const db = withEmail('alice', ALICE_MAIL)
  await assertFails(setDoc(doc(db, 'memberVerifications/alice'), vreq({ status: 'approved' })))
  await assertFails(setDoc(doc(db, 'memberVerifications/alice'), vreq({ email: 'someone@else.com' })))
  await assertFails(setDoc(doc(db, 'memberVerifications/alice'), vreq({ emailVerified: false })))
  await assertFails(setDoc(doc(db, 'memberVerifications/bob'), vreq({ userId: 'bob' })))
  await assertFails(setDoc(doc(db, 'memberVerifications/alice'), vreq({ reviewedBy: 'me' })))
  await assertSucceeds(setDoc(doc(db, 'memberVerifications/alice'), vreq()))
  await assertFails(updateDoc(doc(db, 'memberVerifications/alice'), { status: 'approved' }))
  await assertSucceeds(getDoc(doc(db, 'memberVerifications/alice')))
  await assertFails(getDoc(doc(withEmail('bob', 'bob@tkmce.ac.in'), 'memberVerifications/alice')))
})

test('verification request: editor approves (membership, flag, request); member re-files only after a denial', async () => {
  await seed((sdb) => setDoc(doc(sdb, 'memberVerifications/alice'), vreq()))
  const ed = as('memEditor')
  const b = writeBatch(ed)
  b.set(doc(ed, 'memberships/alice'), legacy({ verifiedVia: 'admin', verifiedBy: 'M', membershipId: '42', rosterId: '42' }), { merge: true })
  b.update(doc(ed, 'users/alice'), { acmMember: true })
  b.update(doc(ed, 'memberVerifications/alice'), { status: 'approved', approvedMembershipId: '42', reviewedBy: 'M' })
  await assertSucceeds(b.commit())
  const db = withEmail('alice', ALICE_MAIL)
  await assertFails(setDoc(doc(db, 'memberVerifications/alice'), vreq()))
  await assertFails(deleteDoc(doc(db, 'memberVerifications/alice')))

  await seed((sdb) => setDoc(doc(sdb, 'memberVerifications/alice'), vreq({ status: 'denied', denyReason: 'no' })))
  await assertSucceeds(setDoc(doc(db, 'memberVerifications/alice'), vreq({ membershipId: '43' })))
  await assertSucceeds(deleteDoc(doc(db, 'memberVerifications/alice')))
})

// ── event ratings + registration alerts ──────────────────────
test('ratings: only a ticket holder rates, 1–5, as themselves', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'registrations/tk'), reg({ paymentStatus: 'paid' }))
    await setDoc(doc(db, 'registrations/unpaid'), reg({ userId: 'bob', paymentStatus: 'pending' }))
  })
  const rate = (who, over = {}) => setDoc(doc(as(who), `eventRatings/paid_${who}`), { eventId: 'paid', userId: who, registrationId: 'tk', rating: 4, ...over })
  await assertSucceeds(rate('alice'))
  await assertSucceeds(rate('alice', { rating: 5 })) // change your mind
  await assertFails(rate('alice', { rating: 6 }))
  await assertFails(rate('alice', { rating: 3.5 }))
  await assertFails(rate('bob')) // bob's name on alice's ticket
  await assertFails(rate('bob', { registrationId: 'unpaid' })) // no verified ticket
  await assertFails(setDoc(doc(as('alice'), 'eventRatings/free_alice'), { eventId: 'free', userId: 'alice', registrationId: 'tk', rating: 4 })) // wrong event
  await assertSucceeds(getDocs(collection(as('eventsEditor'), 'eventRatings')))
  await assertFails(getDocs(collection(as('bob'), 'eventRatings')))
})

test('ratings: remarks and suggestions are optional short text', async () => {
  await seed((db) => setDoc(doc(db, 'registrations/tk'), reg({ paymentStatus: 'paid' })))
  const rate = (over = {}) => setDoc(doc(as('alice'), 'eventRatings/paid_alice'), { eventId: 'paid', userId: 'alice', registrationId: 'tk', rating: 4, ...over })
  await assertSucceeds(rate({ userName: 'Alice', remarks: 'Loved the demos', suggestions: 'More snacks' }))
  await assertSucceeds(rate({ remarks: 'x'.repeat(1000), suggestions: '' }))
  await assertFails(rate({ remarks: 'x'.repeat(1001) }))
  await assertFails(rate({ suggestions: 42 }))
  await assertFails(rate({ userName: 'y'.repeat(121) }))
  await assertFails(rate({ approved: true })) // no extra fields
  // A merge that only changes the stars keeps the written feedback.
  await assertSucceeds(setDoc(doc(as('alice'), 'eventRatings/paid_alice'), { eventId: 'paid', userId: 'alice', registrationId: 'tk', rating: 2 }, { merge: true }))
  const saved = await getDoc(doc(as('eventsEditor'), 'eventRatings/paid_alice'))
  assert.equal(saved.data().rating, 2)
  assert.equal(saved.data().remarks.length, 1000)
})

test('alerts: own subscription only; event editors read, message and clear', async () => {
  const mine = (who, over = {}) => setDoc(doc(as(who), `eventAlerts/paid_${who}`), { eventId: 'paid', userId: who, userName: who, userEmail: `${who}@example.com`, ...over })
  await assertSucceeds(mine('alice'))
  await assertFails(setDoc(doc(as('bob'), 'eventAlerts/paid_alice'), { eventId: 'paid', userId: 'alice' }))
  await assertFails(setDoc(doc(as('bob'), 'eventAlerts/ghost_bob'), { eventId: 'ghost', userId: 'bob' }))
  await assertSucceeds(getDocs(query(collection(as('alice'), 'eventAlerts'), where('userId', '==', 'alice'))))
  await assertFails(getDocs(collection(as('bob'), 'eventAlerts')))
  await assertSucceeds(getDocs(collection(as('eventsEditor'), 'eventAlerts')))
  await assertSucceeds(setDoc(doc(as('eventsEditor'), 'messages/m1'), { userId: 'alice', body: 'open!', initiatedBy: 'admin' }))
  await assertSucceeds(deleteDoc(doc(as('eventsEditor'), 'eventAlerts/paid_alice')))
})

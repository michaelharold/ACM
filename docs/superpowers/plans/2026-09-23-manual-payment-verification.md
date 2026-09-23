# Manual Payment Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Razorpay checkout with a manual flow. Users pay to an admin-configured UPI QR, then upload a screenshot and the transaction ID. Admins approve or reject, and only verified registrations get a ticket (shown on a dashboard carousel) and the WhatsApp link.

**Architecture:** Everything runs client-side against Firestore, with the security rules enforcing every payment state change. There's no new server code. A `PAYMENT_MODE` constant keeps the Razorpay path intact but switched off. Receipts are compressed in the browser and stored inline, one per document, which keeps the site on the free Firebase plan. Pure logic lives in `src/lib/manualPay.js`, Firestore I/O in `src/services/payments.js`, and the UI in `src/components/payments/*` and `src/components/tickets/*`.

**Tech Stack:** React 18 + Vite 5, Tailwind 3, framer-motion, Firebase JS SDK 10 (Firestore/Auth), `@firebase/rules-unit-testing` 3 with `node:test`, Firebase emulators, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-manual-payment-verification-design.md`

## Global Constraints

- **Firebase plan:** stay on Spark. No Cloud Storage and no Blaze. Images are inline data URIs, one per document.
- **Receipt size:** a receipt image data URI must be under 400,000 characters, the limit the rules enforce. Target ≤380,000.
- **UTR format:** exactly 12 digits after stripping whitespace (`/^\d{12}$/`).
- **`paymentStatus` values:** `free` | `pending` | `paid` | `rejected`. `pending` with a `receiptId` means under review; `pending` without one means awaiting a receipt.
- **Keep Razorpay:** don't delete any Razorpay code. Gate it behind `isRazorpayMode`.
- **Mock (demo) mode:** every service function falls back to localStorage or a no-op when `!isFirebaseConfigured`.
- **Code style:** match the surrounding code. Comments explain *why*. Tailwind classes follow the existing tokens (`acm-*`, `neutral-*`, dark variants).
- **Commits:** every commit message ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Production rules:** never deploy Firestore rules to production without the user's explicit confirmation.

---

### Task 1: Payment mode switch + pure helpers

**Files:**
- Modify: `src/lib/payments.js:1-9`
- Create: `src/lib/manualPay.js`
- Create: `tests/unit/manualPay.test.mjs`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces (`src/lib/payments.js`): `PAYMENT_MODE`, `isRazorpayMode: boolean`, `isPaymentConfigured` (alias of `isRazorpayMode`), `isApiAvailable: boolean`.
- Produces (`src/lib/manualPay.js`):
  - `normalizeUtr(s) → string`
  - `isValidUtr(s) → boolean`
  - `isValidUpiId(s) → boolean`
  - `upiLink({upiId, payeeName, amount, note}) → string`
  - `ticketCode(id) → string`
  - `paymentState(rec) → 'free'|'verified'|'review'|'awaiting'|'rejected'`
  - `hasTicket(rec)`, `needsReceipt(rec)`, `PAYMENT_STATE_META`
  - `holdsSeat(reg)`
  - `resolveUpiAccount(accounts, preferredId, defaultId) → account|null`
  - `receiptReady({image, utr}) → boolean`

- [ ] **Step 1: Write the failing unit tests**

Create `tests/unit/manualPay.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeUtr, isValidUtr, isValidUpiId, upiLink, ticketCode, paymentState,
  hasTicket, needsReceipt, holdsSeat, resolveUpiAccount, receiptReady,
} from '../../src/lib/manualPay.js'

test('UTR: 12 digits, spaces ignored', () => {
  assert.equal(normalizeUtr(' 4123 4567 8901 '), '412345678901')
  assert.equal(isValidUtr('412345678901'), true)
  assert.equal(isValidUtr('4123 4567 8901'), true)
  assert.equal(isValidUtr('41234567890'), false)
  assert.equal(isValidUtr('4123456789012'), false)
  assert.equal(isValidUtr('41234567890a'), false)
  assert.equal(isValidUtr(undefined), false)
})

test('UPI id shape', () => {
  assert.equal(isValidUpiId('acmtkmce@okicici'), true)
  assert.equal(isValidUpiId('first.last-1@ybl'), true)
  assert.equal(isValidUpiId('no-at-sign'), false)
  assert.equal(isValidUpiId('a@'), false)
  assert.equal(isValidUpiId(''), false)
})

test('upiLink keeps @ raw, encodes the rest, fixes 2dp amount', () => {
  const link = upiLink({ upiId: 'acm@okicici', payeeName: 'ACM TKMCE', amount: 250, note: 'HackTKM & more' })
  assert.equal(link, 'upi://pay?pa=acm@okicici&pn=ACM%20TKMCE&am=250.00&cu=INR&tn=HackTKM%20%26%20more')
  assert.equal(upiLink({ upiId: 'a@b', amount: '99.5' }), 'upi://pay?pa=a@b&pn=&am=99.50&cu=INR')
})

test('ticketCode is short, stable, uppercase', () => {
  assert.equal(ticketCode('aB3dE9xyz'), 'ACM-AB3DE9')
  assert.equal(ticketCode('a-b_c'), 'ACM-ABC')
})

test('paymentState maps every status', () => {
  assert.equal(paymentState({ paymentStatus: 'free' }), 'free')
  assert.equal(paymentState({}), 'free')
  assert.equal(paymentState({ paymentStatus: 'N/A' }), 'free')
  assert.equal(paymentState({ paymentStatus: 'paid' }), 'verified')
  assert.equal(paymentState({ paymentStatus: 'pending', receiptId: 'rc1' }), 'review')
  assert.equal(paymentState({ paymentStatus: 'pending' }), 'awaiting')
  assert.equal(paymentState({ paymentStatus: 'rejected' }), 'rejected')
  assert.equal(hasTicket({ paymentStatus: 'paid' }), true)
  assert.equal(hasTicket({ paymentStatus: 'free' }), true)
  assert.equal(hasTicket({ paymentStatus: 'pending', receiptId: 'x' }), false)
  assert.equal(needsReceipt({ paymentStatus: 'rejected' }), true)
  assert.equal(needsReceipt({ paymentStatus: 'pending' }), true)
  assert.equal(needsReceipt({ paymentStatus: 'pending', receiptId: 'x' }), false)
})

test('holdsSeat: explicit flag wins, legacy falls back to counted', () => {
  assert.equal(holdsSeat({ seatHeld: false, counted: true }), false)
  assert.equal(holdsSeat({ seatHeld: true, counted: false }), true)
  assert.equal(holdsSeat({ counted: true }), true)
  assert.equal(holdsSeat({}), false)
})

test('resolveUpiAccount: explicit active → default → null', () => {
  const accts = [
    { id: 'a', active: true },
    { id: 'b', active: false },
    { id: 'c' },
  ]
  assert.equal(resolveUpiAccount(accts, 'a', 'c').id, 'a')
  assert.equal(resolveUpiAccount(accts, 'b', 'c').id, 'c') // inactive → default
  assert.equal(resolveUpiAccount(accts, 'gone', 'c').id, 'c') // deleted → default
  assert.equal(resolveUpiAccount(accts, '', 'c').id, 'c')
  assert.equal(resolveUpiAccount(accts, '', ''), null)
  assert.equal(resolveUpiAccount([], 'a', 'c'), null)
})

test('receiptReady needs image + valid UTR', () => {
  assert.equal(receiptReady({ image: 'data:x', utr: '412345678901' }), true)
  assert.equal(receiptReady({ image: '', utr: '412345678901' }), false)
  assert.equal(receiptReady({ image: 'data:x', utr: '123' }), false)
})
```

- [ ] **Step 2: Add the test script and run it (expect FAIL)**

In `package.json` `"scripts"`, add after `"verify"`:

```json
    "test": "node --test 'tests/unit/*.test.mjs'",
```

Run: `npm test`
Expected: FAIL with `Cannot find module '.../src/lib/manualPay.js'`.

- [ ] **Step 3: Implement `src/lib/manualPay.js`**

```js
// Pure helpers for the manual payment flow: the payer scans a UPI QR, uploads
// the receipt, and an admin verifies it. No Firebase or browser imports, so
// these run under plain `node --test` (tests/unit/manualPay.test.mjs).

// A UPI transaction reference (UTR / "UPI Ref No.") is 12 digits. Apps often
// show it spaced out ("4123 4567 8901"), so whitespace is ignored.
export const normalizeUtr = (s) => String(s ?? '').replace(/\s+/g, '')
export const isValidUtr = (s) => /^\d{12}$/.test(normalizeUtr(s))

// name@handle — the shape every UPI app accepts.
export const isValidUpiId = (s) => /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/.test(String(s ?? '').trim())

// upi://pay deep link that opens the payer's UPI app with payee and amount
// filled in. `pa` stays unencoded — several apps reject a percent-encoded "@".
export function upiLink({ upiId, payeeName = '', amount = 0, note = '' }) {
  const parts = [
    `pa=${String(upiId).trim()}`,
    `pn=${encodeURIComponent(payeeName)}`,
    `am=${(Number(amount) || 0).toFixed(2)}`,
    'cu=INR',
  ]
  if (note) parts.push(`tn=${encodeURIComponent(String(note).slice(0, 50))}`)
  return `upi://pay?${parts.join('&')}`
}

// Short, human-readable ticket code derived from the registration id — the
// same registration always shows the same code, and organisers can match it.
export const ticketCode = (id) => `ACM-${String(id ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()}`

// Collapses a record's payment fields into one state:
//   'free'     nothing to pay              → ticket
//   'verified' an admin approved it        → ticket
//   'review'   receipt submitted           → waiting on an admin
//   'awaiting' fee due, no receipt yet     → the payer must upload one
//   'rejected' the receipt was rejected    → the payer may upload again
export function paymentState(rec) {
  const s = String(rec?.paymentStatus ?? '').toLowerCase()
  if (s === 'paid') return 'verified'
  if (s === 'rejected') return 'rejected'
  if (s === 'pending') return rec?.receiptId ? 'review' : 'awaiting'
  return 'free'
}

export const hasTicket = (rec) => ['free', 'verified'].includes(paymentState(rec))
export const needsReceipt = (rec) => ['awaiting', 'rejected'].includes(paymentState(rec))

export const PAYMENT_STATE_META = {
  free: { label: 'Free', tone: 'neutral' },
  verified: { label: 'Verified', tone: 'green' },
  review: { label: 'Under review', tone: 'amber' },
  awaiting: { label: 'Awaiting receipt', tone: 'amber' },
  rejected: { label: 'Rejected', tone: 'red' },
}

// Whether a registration currently occupies one of its event's capacity slots.
// Records from before `seatHeld` existed used `counted` for exactly this.
export const holdsSeat = (reg) => (typeof reg?.seatHeld === 'boolean' ? reg.seatHeld : !!reg?.counted)

// The UPI account to show: the explicitly chosen one if it still exists and is
// active, else the site default, else null — the UI then says payment isn't
// set up yet instead of guessing where the money should go.
export function resolveUpiAccount(accounts, preferredId, defaultId) {
  const usable = (id) => (id ? (accounts || []).find((a) => a.id === id && a.active !== false) || null : null)
  return usable(preferredId) || usable(defaultId) || null
}

// A receipt can be submitted once it has an image and a well-formed UTR.
export const receiptReady = (r) => !!r?.image && isValidUtr(r?.utr)
```

- [ ] **Step 4: Add the mode switch to `src/lib/payments.js`**

Replace lines 1–9, from the header comment through `export const isPaymentConfigured = ...`, with:

```js
// Client side of the Razorpay flow. It never sees the secret key: it asks our
// own /api to create an order, opens Razorpay's hosted checkout, and hands the
// result back to /api to verify.
import { idToken, post } from './api'

// Which payment flow the site runs:
//   'manual'   — the payer scans a UPI QR, uploads the receipt, and an admin
//                verifies it (src/lib/manualPay.js, src/services/payments.js).
//   'razorpay' — hosted Razorpay checkout through our /api. Everything in this
//                file is kept intact for when the Razorpay account is approved;
//                flip this constant (and set VITE_RAZORPAY_KEY_ID) to use it.
export const PAYMENT_MODE = 'manual'

const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID
export const isRazorpayMode = PAYMENT_MODE === 'razorpay' && !!razorpayKeyId
// Older name still imported in places: "is Razorpay checkout live".
export const isPaymentConfigured = isRazorpayMode
// Whether our Vercel /api is deployed — membership-ID verification and team
// registration need it in either payment mode. The Razorpay key used to be the
// only signal; VITE_API_ENABLED=1 states it explicitly.
export const isApiAvailable = !!razorpayKeyId || import.meta.env.VITE_API_ENABLED === '1'
```

- [ ] **Step 5: Run the tests (expect PASS), then build**

Run: `npm test` → all tests pass.
Run: `npm run build` → `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/manualPay.js src/lib/payments.js tests/unit/manualPay.test.mjs package.json
git commit -m "feat(payments): add manual payment mode switch and pure helpers"
```

---

### Task 2: Firestore security rules + emulator tests

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules/firestore.rules.test.mjs`
- Modify: `package.json` (devDependency + `test:rules` script)

**Interfaces:**
- Produces: rules for `upiAccounts`, `receipts`, `utrs`, and tightened rules for `users`, `registrations` and `memberships`, exactly as in the spec's "Security rules" section. Later tasks rely on:
  - owner updates limited to `receiptId, utr, receiptSubmittedAt, paymentStatus, rejectReason, seatHeld`
  - verifier (`registrations` grant) updates limited to `paymentStatus, paidAt, reviewedBy, reviewedAt, rejectReason, seatHeld, receiptId, utr`
  - `users.acmMember` writable only by an admin or a `membership` grant holder
  - a `utrs/{utr}` get on your own or a nonexistent doc succeeds; on someone else's it is denied

- [ ] **Step 1: Install the rules test library**

Run: `npm i -D @firebase/rules-unit-testing@^3`
Expected: added to `devDependencies`.

Add to `package.json` `"scripts"`:

```json
    "test:rules": "firebase emulators:exec --only firestore --project demo-acm-rules \"node --test 'tests/rules/*.test.mjs'\"",
```

- [ ] **Step 2: Write the failing rules tests**

Create `tests/rules/firestore.rules.test.mjs`:

```js
// Firestore rules tests — run with `npm run test:rules` (starts the emulator).
import { test, before, after, beforeEach } from 'node:test'
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
```

- [ ] **Step 3: Run the tests (expect FAIL)**

Run: `npm run test:rules`
Expected: several failures. For example, `a new user cannot create themselves as admin` and the `receipts`, `utrs` and `upiAccounts` tests fail because those collections have no rules yet, so they default to deny and `assertSucceeds` fails.

- [ ] **Step 4: Rewrite `firestore.rules`**

Replace the whole file with the following. Unchanged blocks are carried over verbatim; new or changed parts are commented.

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    // An admin is a signed-in user whose profile has role == 'admin'.
    function isAdmin() {
      return isSignedIn()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // An editor holds a specific grant in their profile's permissions map,
    // handed out by an admin from the Access tab.
    function hasPerm(key) {
      return isSignedIn()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('permissions', {}).get(key, false) == true;
    }

    // Who may review a payment receipt of a given kind ('event' | 'membership').
    function isVerifierFor(kind) {
      return isAdmin()
        || (kind == 'event' && hasPerm('registrations'))
        || (kind == 'membership' && hasPerm('membership'));
    }

    function isPaidDoc(path) {
      return exists(path) && get(path).data.get('paymentStatus', '') == 'paid';
    }

    // True when the registration/membership a receipt belongs to is already
    // verified — its receipt and transaction ID must then stay on record, so a
    // single payment can't be freed up and reused.
    function refIsPaid(kind, refId) {
      return (kind == 'membership' && isPaidDoc(/databases/$(database)/documents/memberships/$(refId)))
          || (kind == 'event' && isPaidDoc(/databases/$(database)/documents/registrations/$(refId)));
    }

    // A self-created registration may only be 'free' (the event really costs
    // nothing, or a claimed member discount covers it) or 'pending' owing at
    // least the fee minus the member discount. 'paid' only ever comes from a
    // verifier (or the Razorpay server, which bypasses rules).
    function validNewRegistrationPayment(d) {
      let ev = get(/databases/$(database)/documents/events/$(d.eventId)).data;
      let minDue = ev.get('fee', 0) - ev.get('acmDiscount', 0);
      return (d.paymentStatus == 'free'
               && (ev.get('fee', 0) <= 0 || (d.get('membershipId', '') != '' && minDue <= 0)))
          || (d.paymentStatus == 'pending' && d.get('amountDue', 0) >= minDue);
    }

    function membershipFeeIsZero() {
      return !exists(/databases/$(database)/documents/siteContent/main)
        || get(/databases/$(database)/documents/siteContent/main).data.get('membershipFee', 0) <= 0;
    }

    // User profiles — a user manages their own; only admins set roles/grants.
    // acmMember is now granted on payment verification, so a user can't set it
    // on themselves; membership verifiers may flip only that field.
    match /users/{uid} {
      allow read: if isSignedIn() && (request.auth.uid == uid || isAdmin());
      allow create: if request.auth.uid == uid
        && request.resource.data.get('role', 'user') == 'user'
        && request.resource.data.get('permissions', {}).size() == 0
        && request.resource.data.get('acmMember', false) == false;
      allow update: if isAdmin()
        || (request.auth.uid == uid
            && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'permissions', 'acmMember']))
        || (hasPerm('membership')
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['acmMember']));
      allow delete: if isAdmin();
    }

    // Public content — anyone can read; admins or granted editors write.
    // Exception: any signed-in user may nudge ONLY the registeredCount by
    // exactly ±1 (never any other field), so event capacity can be tracked as
    // members register/cancel without granting them event-edit rights.
    match /events/{id} {
      allow read: if true;
      allow write: if isAdmin() || hasPerm('events');
      allow update: if isSignedIn()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['registeredCount'])
        && request.resource.data.registeredCount >= 0
        && (request.resource.data.registeredCount == resource.data.get('registeredCount', 0) + 1
            || request.resource.data.registeredCount == resource.data.get('registeredCount', 0) - 1);
    }
    match /execomGroups/{id}   { allow read: if true; allow write: if isAdmin() || hasPerm('execom'); }
    match /testimonials/{id}   { allow read: if true; allow write: if isAdmin(); }
    // Gallery: one image per document (inline data URI), so uploads never
    // approach the 1 MB per-document cap.
    match /gallery/{id}        { allow read: if true; allow write: if isAdmin() || hasPerm('content'); }
    // Event guideline images — same one-image-per-document reasoning as
    // gallery, keyed to an event via eventId instead of being global. Managed
    // from the Events tab, so it shares that tab's edit permission.
    match /eventGuidelines/{id} { allow read: if true; allow write: if isAdmin() || hasPerm('events'); }
    match /siteContent/{id}    { allow read: if true; allow write: if isAdmin() || hasPerm('content'); }

    // Contact messages — a signed-in user may send one as themselves and read
    // their own thread; only admins read the whole inbox or reply.
    //
    // The identity checks are the point: userId and userEmail must match the
    // caller's own auth token, so a sender cannot post under someone else's
    // address and cannot make a reply land in a stranger's inbox.
    match /messages/{id} {
      allow read: if isSignedIn() && (resource.data.userId == request.auth.uid || isAdmin() || hasPerm('messages'));
      // A user starts their OWN thread (identity must match their token); an
      // admin (or a granted editor — full inbox via 'messages', or the
      // one-off "message this person" convenience on the Membership /
      // Registrations panels) may start a thread addressed to any member.
      allow create: if (isSignedIn()
          && request.resource.data.userId == request.auth.uid
          && request.resource.data.userEmail == request.auth.token.email
          && request.resource.data.body is string
          && request.resource.data.body.size() > 0
          && request.resource.data.body.size() <= 4000)
        || isAdmin() || hasPerm('messages') || hasPerm('membership') || hasPerm('registrations');
      // Admins and 'messages'-granted editors manage any thread. The thread's
      // owner may only append a reply and toggle the unread flags on their
      // own thread — no other fields may change.
      allow update: if isAdmin() || hasPerm('messages')
        || (isSignedIn() && resource.data.userId == request.auth.uid
            && request.resource.data.diff(resource.data).affectedKeys()
                 .hasOnly(['replies', 'unreadForAdmin', 'unreadForUser', 'status']));
      allow delete: if isAdmin();
    }

    // Outbound mail queue, drained by the Firebase "Trigger Email" extension.
    // Admin-only: anyone able to write here could send mail as the chapter.
    match /mail/{id} {
      allow read, write: if isAdmin();
    }

    // Registrations — a user creates & reads their own; admins read all.
    match /registrations/{id} {
      // A user reads their own registration, any team they're a member of
      // (matched via memberUids), or — for admins — all of them.
      allow read: if isSignedIn() && (
        resource.data.userId == request.auth.uid
        || request.auth.uid in resource.data.get('memberUids', [])
        || isAdmin()
        || hasPerm('registrations')
      );
      allow create: if isSignedIn()
        && request.resource.data.userId == request.auth.uid
        && validNewRegistrationPayment(request.resource.data);
      // Admins edit anything. A 'registrations' verifier may only record a
      // payment review. The owner (team leader for a team) may only attach or
      // re-attach a receipt, moving an unverified record back to 'pending'.
      allow update: if isAdmin()
        || (hasPerm('registrations')
            && request.resource.data.diff(resource.data).affectedKeys()
                 .hasOnly(['paymentStatus', 'paidAt', 'reviewedBy', 'reviewedAt', 'rejectReason', 'seatHeld', 'receiptId', 'utr']))
        || (isSignedIn() && resource.data.userId == request.auth.uid
            && resource.data.get('paymentStatus', '') in ['pending', 'rejected']
            && request.resource.data.paymentStatus == 'pending'
            && request.resource.data.diff(resource.data).affectedKeys()
                 .hasOnly(['receiptId', 'utr', 'receiptSubmittedAt', 'paymentStatus', 'rejectReason', 'seatHeld']));
      // A user may remove their OWN registration only while it's unpaid — this
      // lets the app clean up a registration whose payment was cancelled/failed,
      // without ever letting someone delete a paid record.
      allow delete: if isAdmin()
        || (isSignedIn() && resource.data.userId == request.auth.uid && resource.data.paymentStatus != 'paid');
    }

    // ACM memberships — one document per user (id == uid). The member fills and
    // reads their own application; admins (or holders of the 'membership' grant)
    // read every application, verify payment, and assign the membershipId. A
    // member can NEVER set their own membershipId, mark themselves paid, or edit
    // the review fields / amount owed.
    match /memberships/{uid} {
      allow read: if isSignedIn()
        && (request.auth.uid == uid || isAdmin() || hasPerm('membership'));
      allow create: if isSignedIn()
        && request.auth.uid == uid
        && request.resource.data.userId == request.auth.uid
        && request.resource.data.membershipId == ''
        && (request.resource.data.paymentStatus == 'pending'
            || (request.resource.data.paymentStatus == 'free' && membershipFeeIsZero()));
      allow update: if isAdmin() || hasPerm('membership')
        || (request.auth.uid == uid
            && request.resource.data.membershipId == resource.data.membershipId
            && (request.resource.data.paymentStatus == resource.data.paymentStatus
                || (request.resource.data.paymentStatus == 'pending'
                    && resource.data.get('paymentStatus', '') in ['pending', 'rejected']))
            && !request.resource.data.diff(resource.data).affectedKeys()
                 .hasAny(['reviewedBy', 'reviewedAt', 'paidAt', 'userId', 'amountDue']));
      allow delete: if isAdmin();
    }

    // UPI / QR payment accounts shown to payers — public, since the QR and UPI
    // ID are exactly what a payer needs. Event editors may add one while
    // creating an event; only admins delete.
    match /upiAccounts/{id} {
      allow read: if true;
      allow create, update: if isAdmin() || hasPerm('events');
      allow delete: if isAdmin();
    }

    // Payment receipts — one screenshot per document (inline data URI, capped
    // well under the 1 MB document limit). Readable by the payer and by whoever
    // may verify that kind of payment. Never edited: a new upload is a new doc.
    match /receipts/{id} {
      allow read: if isSignedIn()
        && (resource.data.userId == request.auth.uid || isVerifierFor(resource.data.kind));
      allow create: if isSignedIn()
        && request.resource.data.userId == request.auth.uid
        && request.resource.data.kind in ['event', 'membership']
        && request.resource.data.image is string
        && request.resource.data.image.size() < 400000
        && request.resource.data.utr is string
        && request.resource.data.utr.matches('^[0-9]{12}$');
      allow delete: if isSignedIn()
        && (isVerifierFor(resource.data.kind)
            || (resource.data.userId == request.auth.uid && !refIsPaid(resource.data.kind, resource.data.refId)));
    }

    // One document per UPI transaction ID (the doc id IS the 12-digit UTR).
    // Creating one that already exists is an update, which is never allowed —
    // so each payment can back exactly one registration or membership. A get
    // on your own or a nonexistent UTR succeeds; on someone else's it's denied,
    // which the app turns into a clear "already used" message.
    match /utrs/{utr} {
      allow get: if isSignedIn()
        && (resource == null
            || resource.data.userId == request.auth.uid
            || isAdmin() || hasPerm('registrations') || hasPerm('membership'));
      allow create: if isSignedIn()
        && utr.matches('^[0-9]{12}$')
        && request.resource.data.userId == request.auth.uid;
      allow delete: if isSignedIn()
        && (isAdmin() || hasPerm('registrations') || hasPerm('membership')
            || (resource.data.userId == request.auth.uid && !refIsPaid(resource.data.kind, resource.data.refId)));
    }

    // Payment account profiles — the NON-SECRET half of a Razorpay account
    // (label, keyId, description, active). The key SECRET is never stored here;
    // it lives only in the server environment. Admins manage these; event and
    // membership editors read them to assign an account. keyId is public (it's
    // shipped to the browser by Razorpay checkout anyway), so exposing it is safe.
    match /paymentAccounts/{id} {
      allow read: if isAdmin() || hasPerm('events') || hasPerm('membership');
      allow write: if isAdmin();
    }

    // Throwaway probe docs used only to test that writes succeed before a user
    // begins a registration. A user may only touch their own probe.
    match /probes/{uid} {
      allow read, write: if isSignedIn() && request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 5: Run the rules tests (expect PASS)**

Run: `npm run test:rules`
Expected: every test passes and `emulators:exec` exits 0. If a test fails, fix the rule, not the test, unless the test contradicts the spec.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules tests/rules/firestore.rules.test.mjs package.json package-lock.json
git commit -m "feat(rules): manual payment receipts, UTR uniqueness, verifier roles; close self-admin hole"
```

---

### Task 3: Data layer — image prep + payment services

**Files:**
- Modify: `src/lib/imagePrep.js` (append helpers)
- Create: `src/services/payments.js`
- Modify: `src/services/firestore.js:181-187` (`updateUserProfile`) and `:437-460` (`createMembership`)

**Interfaces:**
- Consumes: `normalizeUtr`, `holdsSeat` (Task 1); `bumpEventCount` from `src/services/firestore.js`.
- Produces (`src/lib/imagePrep.js`): `fitUnderChars(file, {maxEdge, maxChars}) → Promise<dataUri>`, `prepareReceipt(file)`, `prepareQr(file)`.
- Produces (`src/services/firestore.js`): `membershipRecord(uid, data) → object`, used by `createMembership` and by the payments service.
- Produces (`src/services/payments.js`):
  - UPI accounts: `fetchUpiAccounts()`, `createUpiAccount(data)`, `updateUpiAccount(id, patch)`, `deleteUpiAccount(id)`
  - Submitting: `createRegistrationWithReceipt(regDoc, {image, utr, amount}) → reg`, `createMembershipWithReceipt(uid, data, {image, utr, amount}) → membership`, `attachReceipt({kind, refId, userId, image, utr, amount, patch}) → appliedFields`, `discardReceipt(rec)`
  - Reviewing: `fetchReceipt(id)`, `fetchPendingReviews({events, membership}) → [{kind, record, title, personName, personEmail, eventId?}]`, `findMemberByMembershipId(id) → {uid, name, paymentStatus}|null`, `approvePayment({kind, record, reviewer}) → patch`, `rejectPayment({kind, record, reviewer, reason}) → patch`
  - Storage: `fetchReceiptBytes() → number`

- [ ] **Step 1: Append the image helpers to `src/lib/imagePrep.js`** (after `fitPoster`)

```js
// Keep the whole picture (no crop), cap its long edge, and step the JPEG
// quality — then the size — down until the data URI fits `maxChars`. Used where
// every pixel region may matter: a payment screenshot's amount and UTR can sit
// anywhere, and a QR code must survive intact. The canvas is filled white first
// so a transparent PNG doesn't turn black as a JPEG.
export async function fitUnderChars(file, { maxEdge = 1400, maxChars = 380_000 } = {}) {
  if (!file?.type?.startsWith('image/')) throw new Error('Upload an image (a JPG or PNG screenshot).')
  const img = await loadImage(file)
  let scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  for (let attempt = 0; attempt < 5; attempt++) {
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
    for (const q of [0.82, 0.7, 0.58, 0.46]) {
      const url = canvas.toDataURL('image/jpeg', q)
      if (url.length <= maxChars) return url
    }
    scale *= 0.75
  }
  throw new Error('That image is too large to upload — try a cropped screenshot.')
}

// Payment screenshot — kept under the receipts rule's 400,000-character cap.
export const prepareReceipt = (file) => fitUnderChars(file, { maxEdge: 1400, maxChars: 380_000 })

// A UPI account's QR code — small, since every payer loads it.
export const prepareQr = (file) => fitUnderChars(file, { maxEdge: 700, maxChars: 200_000 })
```

- [ ] **Step 2: Refactor `src/services/firestore.js`**

**(a)** Replace `updateUserProfile` (lines 181–187) with the version below. `acmMember` is no longer self-writable, so writing it back from possibly stale local state would get the whole profile save rejected.

```js
// Self-service profile fields only — role, permissions and acmMember are never
// writable here (acmMember is granted when a membership payment is verified).
export async function updateUserProfile(uid, patch) {
  const { name = '', googleName = '', phone = '', phoneVerified = false, department = '', year = '', college = '', gender = '' } = patch
  const clean = { name, googleName, phone, phoneVerified: !!phoneVerified, department, year, college, gender }
  if (isFirebaseConfigured) await updateDoc(doc(db, 'users', uid), clean)
  return clean
}
```

**(b)** Replace `createMembership`'s `clean` object construction (lines 437–452) with a shared, exported builder:

```js
// The fields of a membership application, shared by the plain create below and
// the create-with-receipt flow in services/payments.js.
export function membershipRecord(uid, data) {
  return {
    userId: uid,
    // The verified Google-account name, kept on the member record so the chapter
    // can cross-check it against the typed name.
    googleName: data.googleName || '',
    firstName: data.firstName || '',
    middleName: data.middleName || '',
    lastName: data.lastName || '',
    email: data.email || '',
    phone: data.phone || '',
    department: data.department || '',
    className: data.className || '',
    paymentStatus: data.paymentStatus || 'pending',
    amountDue: Math.max(0, Number(data.amountDue) || 0),
    upiAccountId: data.upiAccountId || '',
    membershipId: '', // admin-assigned only
  }
}

export async function createMembership(uid, data) {
  const clean = membershipRecord(uid, data)
```

Keep the rest of `createMembership` (the mock branch and the `setDoc`) unchanged.

- [ ] **Step 3: Create `src/services/payments.js`**

```js
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
```

- [ ] **Step 4: Verify the build and the unit tests**

Run: `npm run build && npm test`
Expected: both succeed. `AuthContext.saveProfile` keeps working because it merges the returned `clean`, which no longer contains `acmMember`, so the local `user.acmMember` is preserved.

- [ ] **Step 5: Commit**

```bash
git add src/lib/imagePrep.js src/services/payments.js src/services/firestore.js
git commit -m "feat(payments): receipt/QR image prep and manual payment service layer"
```

---

### Task 4: Shared payment UI components

**Files:**
- Create: `src/components/payments/useUpiAccount.js`
- Create: `src/components/payments/PayToCard.jsx`
- Create: `src/components/payments/ReceiptUploader.jsx`
- Create: `src/components/payments/ReceiptUploadModal.jsx`
- Create: `src/components/payments/UpiAccountForm.jsx`

**Interfaces:**
- Consumes: Task 1 helpers; Task 3 `fetchUpiAccounts`, `createUpiAccount`, `updateUpiAccount`, `prepareReceipt`, `prepareQr`; `useData().content.defaultUpiAccountId`.
- Produces:
  - `useUpiAccount(preferredId, enabled) → { account, loading }`
  - `<PayToCard account amount note loading />`
  - `<ReceiptUploader value={{image, utr}} onChange disabled />`
  - `<ReceiptUploadModal open onClose title amount upiAccountId note rejectReason onSubmit(receipt) />`
  - `<UpiAccountForm initial onSaved(account) onCancel />`

- [ ] **Step 1: `src/components/payments/useUpiAccount.js`**

```js
import { useEffect, useState } from 'react'
import { useData } from '../../context/DataContext'
import { fetchUpiAccounts } from '../../services/payments'
import { resolveUpiAccount } from '../../lib/manualPay'

// Loads UPI accounts on demand — they carry QR images, so they're not part of
// the app-wide data load — and resolves the one that applies. `preferredId` is
// an event's upiAccountId or the membership account; '' means the site default.
export function useUpiAccount(preferredId, enabled = true) {
  const { content } = useData()
  const [accounts, setAccounts] = useState(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    fetchUpiAccounts()
      .then((list) => alive && setAccounts(list || []))
      .catch(() => alive && setAccounts([]))
    return () => { alive = false }
  }, [enabled])
  return {
    loading: enabled && accounts === null,
    account: resolveUpiAccount(accounts || [], preferredId, content?.defaultUpiAccountId),
  }
}
```

- [ ] **Step 2: `src/components/payments/PayToCard.jsx`**

```jsx
import { useState } from 'react'
import { Copy, Check, Smartphone, AlertCircle, QrCode } from 'lucide-react'
import { Button } from '../ui/Button'
import { upiLink } from '../../lib/manualPay'

// "Pay here" block for the manual flow: the UPI account's QR, payee, UPI ID and
// the exact amount, plus a deep link that opens the payer's UPI app on phones.
// With no account configured it says so plainly instead of guessing.
export function PayToCard({ account, amount, note, loading = false }) {
  const [copied, setCopied] = useState(false)

  if (loading) return <div className="h-44 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800/60" />

  if (!account) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        Payment details aren’t set up for this yet. Please contact the organisers before paying.
      </p>
    )
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(account.upiId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked — the ID is on screen to copy by hand */ }
  }

  const payee = account.payeeName || account.label
  return (
    <div className="grid gap-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 sm:grid-cols-[160px_1fr] dark:border-neutral-800 dark:bg-neutral-900/50">
      {account.qrImage ? (
        <img
          src={account.qrImage}
          alt={`UPI QR code for ${payee}`}
          className="mx-auto aspect-square w-44 rounded-lg bg-white object-contain p-1.5 sm:w-full"
        />
      ) : (
        <div className="mx-auto grid aspect-square w-44 place-items-center rounded-lg bg-white text-neutral-300 sm:w-full dark:bg-neutral-800">
          <QrCode className="h-10 w-10" />
        </div>
      )}
      <div className="min-w-0 text-sm">
        <div className="text-xs uppercase tracking-wide text-neutral-400">Pay exactly</div>
        <div className="text-2xl font-extrabold tracking-tight">₹{amount}</div>
        <div className="mt-2 text-neutral-500 dark:text-neutral-400">
          to <span className="font-medium text-neutral-800 dark:text-neutral-200">{payee}</span>
        </div>
        <button
          type="button"
          onClick={copyId}
          className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 font-mono text-xs transition-colors hover:border-acm-300 dark:border-neutral-700 dark:bg-neutral-800"
        >
          <span className="truncate">{account.upiId}</span>
          {copied ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 shrink-0 text-neutral-400" />}
        </button>
        <Button
          as="a"
          href={upiLink({ upiId: account.upiId, payeeName: payee, amount, note })}
          size="sm"
          className="mt-3 w-full sm:hidden"
        >
          <Smartphone className="h-4 w-4" /> Pay with UPI app
        </Button>
        <p className="mt-3 text-xs text-neutral-400">
          Scan with any UPI app (GPay, PhonePe, Paytm…), pay ₹{amount}, then upload the payment screenshot below.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `src/components/payments/ReceiptUploader.jsx`**

```jsx
import { useRef, useState } from 'react'
import { ImageUp, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Input } from '../ui/Input'
import { prepareReceipt } from '../../lib/imagePrep'
import { isValidUtr, normalizeUtr } from '../../lib/manualPay'

// Collects the proof of payment: a screenshot (compressed in the browser so it
// fits a Firestore document) and the 12-digit UPI transaction ID. Controlled:
// `value` is { image, utr } and `onChange` receives the next value.
export function ReceiptUploader({ value, onChange, disabled = false }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const utr = value?.utr || ''
  const utrBad = utr.trim().length > 0 && !isValidUtr(utr)

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr('')
    setBusy(true)
    try {
      onChange({ ...value, image: await prepareReceipt(file) })
    } catch (ex) {
      setErr(ex?.message || 'Couldn’t read that image. Try another screenshot.')
    } finally {
      setBusy(false)
    }
  }

  const openPicker = () => fileRef.current?.click()

  return (
    <div className="grid gap-3.5">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Payment screenshot</span>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} disabled={disabled} />
        {value?.image ? (
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 p-2.5 dark:border-neutral-800">
            <img src={value.image} alt="Your payment screenshot" className="h-20 w-16 shrink-0 rounded-lg bg-neutral-100 object-contain dark:bg-neutral-800" />
            <p className="min-w-0 flex-1 text-xs text-neutral-500 dark:text-neutral-400">
              Screenshot attached. Make sure the amount and transaction ID are readable.
            </p>
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled || busy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-acm-300 disabled:opacity-50 dark:border-neutral-700"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Change
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled || busy}
            className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500 transition-colors hover:border-acm-300 hover:text-acm-600 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-400 dark:hover:text-acm-400"
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImageUp className="h-6 w-6" />}
            {busy ? 'Preparing…' : 'Upload payment screenshot'}
          </button>
        )}
        {err && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
          </p>
        )}
      </div>
      <div>
        <Input
          label="UPI transaction ID (UTR)"
          inputMode="numeric"
          autoComplete="off"
          maxLength={16}
          placeholder="12-digit number, e.g. 412345678901"
          value={utr}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, utr: e.target.value.replace(/[^\d\s]/g, '') })}
          hint="In your UPI app, open this payment’s details — it’s called “UPI Ref No.”, “UTR” or “Transaction ID”."
        />
        {utrBad && (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">
            A UPI transaction ID is exactly 12 digits ({normalizeUtr(utr).length} entered).
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `src/components/payments/ReceiptUploadModal.jsx`**

```jsx
import { useState } from 'react'
import { Loader2, Send, AlertCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { PayToCard } from './PayToCard'
import { ReceiptUploader } from './ReceiptUploader'
import { useUpiAccount } from './useUpiAccount'
import { receiptReady } from '../../lib/manualPay'

// Upload — or re-upload — the receipt for an existing registration or
// membership: a team leader whose receipt didn't go through, or anyone whose
// receipt was rejected. `onSubmit(receipt)` performs the write and may throw a
// readable error, which is shown here.
export function ReceiptUploadModal({ open, onClose, title, amount, upiAccountId, note, rejectReason, onSubmit }) {
  const [receipt, setReceipt] = useState({ image: '', utr: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const { account, loading } = useUpiAccount(upiAccountId || '', open)

  function close() {
    if (busy) return
    setReceipt({ image: '', utr: '' })
    setErr('')
    onClose()
  }

  async function submit() {
    setBusy(true)
    setErr('')
    try {
      await onSubmit(receipt)
      setReceipt({ image: '', utr: '' })
      onClose()
    } catch (ex) {
      setErr(ex?.message || 'Couldn’t submit your receipt. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={close} size="md">
      <div className="grid gap-4 p-6 sm:p-8">
        <div className="pr-8">
          <span className="text-xs font-medium uppercase tracking-wide text-acm-600 dark:text-acm-400">Payment receipt</span>
          <h3 className="mt-1 text-lg font-bold tracking-tight">{title}</h3>
        </div>
        {rejectReason && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
            <strong>Previous receipt rejected:</strong> {rejectReason}
          </p>
        )}
        <PayToCard account={account} amount={amount} note={note} loading={loading} />
        <ReceiptUploader value={receipt} onChange={setReceipt} disabled={busy} />
        {err && (
          <p className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
          </p>
        )}
        <Button onClick={submit} disabled={busy || !account || !receiptReady(receipt)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit receipt
        </Button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 5: `src/components/payments/UpiAccountForm.jsx`**

```jsx
import { useRef, useState } from 'react'
import { ImageUp, Loader2, Save, AlertCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { prepareQr } from '../../lib/imagePrep'
import { isValidUpiId } from '../../lib/manualPay'
import { createUpiAccount, updateUpiAccount } from '../../services/payments'

const inputCls =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800'

// Add or edit one UPI/QR account. Shared by the Payments tab and the event
// editor's "+ Add new QR account" shortcut. onSaved(account) gets the saved
// record, id included.
export function UpiAccountForm({ initial, onSaved, onCancel }) {
  const [draft, setDraft] = useState({
    label: initial?.label || '',
    payeeName: initial?.payeeName || '',
    upiId: initial?.upiId || '',
    qrImage: initial?.qrImage || '',
  })
  const [busy, setBusy] = useState(false)
  const [qrBusy, setQrBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }))

  async function pickQr(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setQrBusy(true)
    setErr('')
    try {
      const qrImage = await prepareQr(file)
      setDraft((d) => ({ ...d, qrImage }))
    } catch (ex) {
      setErr(ex?.message || 'Couldn’t read that image.')
    } finally {
      setQrBusy(false)
    }
  }

  async function save() {
    if (!draft.label.trim()) return setErr('Give the account a label, e.g. “ACM Main”.')
    if (!isValidUpiId(draft.upiId)) return setErr('Enter a valid UPI ID, e.g. acmtkmce@okicici.')
    if (!draft.qrImage) return setErr('Upload the account’s UPI QR code.')
    setBusy(true)
    setErr('')
    try {
      const clean = { label: draft.label.trim(), payeeName: draft.payeeName.trim(), upiId: draft.upiId.trim(), qrImage: draft.qrImage }
      let saved
      if (initial?.id) {
        await updateUpiAccount(initial.id, clean)
        saved = { ...initial, ...clean }
      } else {
        saved = await createUpiAccount(clean)
      }
      onSaved(saved)
    } catch (ex) {
      setErr(ex?.message || 'Couldn’t save the account — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[132px_1fr]">
      <div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickQr} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="grid aspect-square w-full place-items-center overflow-hidden rounded-xl border-2 border-dashed border-neutral-200 bg-white text-xs text-neutral-400 transition-colors hover:border-acm-300 dark:border-neutral-700 dark:bg-neutral-800"
        >
          {qrBusy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : draft.qrImage ? (
            <img src={draft.qrImage} alt="QR code preview" className="h-full w-full bg-white object-contain p-1" />
          ) : (
            <span className="flex flex-col items-center gap-1 px-2 text-center"><ImageUp className="h-5 w-5" /> Upload QR</span>
          )}
        </button>
        {draft.qrImage && <p className="mt-1 text-center text-[11px] text-neutral-400">Click to replace</p>}
      </div>
      <div className="grid content-start gap-2.5">
        <input className={inputCls} placeholder="Label (e.g. ACM Main)" value={draft.label} onChange={set('label')} />
        <input className={inputCls} placeholder="Payee name shown to payers (optional)" value={draft.payeeName} onChange={set('payeeName')} />
        <input className={inputCls} placeholder="UPI ID (e.g. acmtkmce@okicici)" value={draft.upiId} onChange={set('upiId')} autoCapitalize="none" spellCheck={false} />
        {err && (
          <p className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
          </p>
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={busy || qrBusy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {initial?.id ? 'Save changes' : 'Add account'}
          </Button>
          {onCancel && <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Build**

Run: `npm run build` → `✓ built`. The components aren't mounted yet, but they must compile.

- [ ] **Step 7: Commit**

```bash
git add src/components/payments
git commit -m "feat(payments): PayToCard, ReceiptUploader, upload modal, UPI account form"
```

---

### Task 5: Admin Payments tab + event editor account picker

**Files:**
- Rewrite: `src/components/admin/PaymentsPanel.jsx`
- Modify: `src/pages/Admin.jsx`, in `EventEditor` (state around line 382, the effect at 393–398, the "Credit payment to" field at 651–658)

**Interfaces:**
- Consumes: `UpiAccountForm`; the Task 3 UPI account services; `useData().content`/`updateContent`; `isRazorpayMode`.
- Produces:
  - `siteContent.defaultUpiAccountId`
  - `siteContent.membershipUpiAccountId`
  - `siteContent.membershipFee` (existing)
  - `events/{id}.upiAccountId`

- [ ] **Step 1: Rewrite `src/components/admin/PaymentsPanel.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Wallet, Plus, Trash2, Loader2, Info, KeyRound, Save, Power, AlertCircle, Star, Pencil, QrCode, ChevronDown } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { UpiAccountForm } from '../payments/UpiAccountForm'
import { useData } from '../../context/DataContext'
import { isRazorpayMode } from '../../lib/payments'
import * as svc from '../../services/firestore'
import * as pay from '../../services/payments'
import { cn } from '../../lib/cn'

const inputCls =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800'

// Admin-only payment setup. Payers scan a UPI QR, upload their receipt, and an
// admin verifies it in "Verify payments". This tab manages the QR accounts
// (one is the default), the membership fee, and — kept for later — Razorpay.
export function PaymentsPanel() {
  const { content, updateContent } = useData()
  const [upi, setUpi] = useState([])
  const [upiLoading, setUpiLoading] = useState(true)

  useEffect(() => {
    let alive = true
    pay.fetchUpiAccounts()
      .then((list) => alive && setUpi(list || []))
      .catch(() => {})
      .finally(() => alive && setUpiLoading(false))
    return () => { alive = false }
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Wallet className="h-5 w-5 text-acm-500" /> Payments
        </h2>
        <p className="mt-1 text-xs text-neutral-400">
          Payers scan a UPI QR, pay, and upload their receipt — you approve or reject it under “Verify payments”.
          Events use the default account unless you pick another one in the event’s settings.
        </p>
      </div>

      <UpiAccountsSection
        accounts={upi}
        setAccounts={setUpi}
        loading={upiLoading}
        defaultId={content.defaultUpiAccountId || ''}
        onSetDefault={(id) => updateContent({ defaultUpiAccountId: id })}
      />
      <MembershipPaymentSection accounts={upi} defaultId={content.defaultUpiAccountId || ''} />
      <RazorpaySection />
    </motion.div>
  )
}

function UpiAccountsSection({ accounts, setAccounts, loading, defaultId, onSetDefault }) {
  const [editing, setEditing] = useState(null) // null | 'new' | account
  const [err, setErr] = useState('')

  async function saved(acc) {
    setAccounts((list) => (list.some((a) => a.id === acc.id) ? list.map((a) => (a.id === acc.id ? acc : a)) : [acc, ...list]))
    setEditing(null)
    // The first account becomes the default automatically — there's nothing
    // else to choose between yet.
    if (!defaultId) {
      try { await onSetDefault(acc.id) } catch { /* can still be set by hand */ }
    }
  }

  async function toggleActive(acc) {
    const next = acc.active === false
    if (!next && acc.id === defaultId) {
      setErr('The default account can’t be switched off — make another account the default first.')
      return
    }
    setErr('')
    setAccounts((list) => list.map((a) => (a.id === acc.id ? { ...a, active: next } : a)))
    try {
      await pay.updateUpiAccount(acc.id, { active: next })
    } catch (ex) {
      setAccounts((list) => list.map((a) => (a.id === acc.id ? { ...a, active: !next } : a)))
      setErr(ex?.message || `Could not update “${acc.label}”.`)
    }
  }

  async function remove(acc) {
    if (acc.id === defaultId) {
      setErr('This is the default account. Make another account the default before deleting it.')
      return
    }
    if (!confirm(`Delete “${acc.label}”? Events using it will fall back to the default account.`)) return
    setErr('')
    const prev = accounts
    setAccounts((list) => list.filter((a) => a.id !== acc.id))
    try {
      await pay.deleteUpiAccount(acc.id)
    } catch (ex) {
      setAccounts(prev)
      setErr(ex?.message || `Could not delete “${acc.label}”.`)
    }
  }

  async function makeDefault(acc) {
    setErr('')
    try {
      await onSetDefault(acc.id)
    } catch (ex) {
      setErr(ex?.message || 'Could not change the default account.')
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 p-4 dark:border-neutral-800">
        <div>
          <h3 className="text-sm font-semibold">UPI / QR accounts</h3>
          <p className="text-xs text-neutral-400">The ★ default receives every payment unless an event picks another account.</p>
        </div>
        {editing !== 'new' && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Add QR account
          </Button>
        )}
      </div>

      {editing === 'new' && (
        <div className="border-b border-neutral-100 p-4 dark:border-neutral-800">
          <UpiAccountForm onSaved={saved} onCancel={() => setEditing(null)} />
        </div>
      )}

      {loading ? (
        <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-acm-500" /></div>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {accounts.length === 0 && editing !== 'new' && (
            <p className="p-4 text-sm text-neutral-500">No QR accounts yet — add one so people can pay.</p>
          )}
          {accounts.map((acc) =>
            editing?.id === acc.id ? (
              <div key={acc.id} className="p-4">
                <UpiAccountForm initial={acc} onSaved={saved} onCancel={() => setEditing(null)} />
              </div>
            ) : (
              <div key={acc.id} className="flex items-center gap-3 p-4">
                {acc.qrImage ? (
                  <img src={acc.qrImage} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain p-0.5" />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-400 dark:bg-neutral-800"><QrCode className="h-5 w-5" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{acc.label}</span>
                    {acc.id === defaultId && <Badge tone="blue"><Star className="h-3 w-3" /> Default</Badge>}
                    <Badge tone={acc.active !== false ? 'green' : 'neutral'} dot={acc.active !== false}>{acc.active !== false ? 'Active' : 'Off'}</Badge>
                  </div>
                  <div className="truncate text-xs text-neutral-400">
                    {acc.payeeName ? `${acc.payeeName} · ` : ''}<code>{acc.upiId}</code>
                  </div>
                </div>
                {acc.id !== defaultId && acc.active !== false && (
                  <button onClick={() => makeDefault(acc)} title="Make default" aria-label="Make default" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-amber-500 dark:hover:bg-neutral-800">
                    <Star className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => setEditing(acc)} title="Edit" aria-label="Edit account" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => toggleActive(acc)} title={acc.active !== false ? 'Switch off' : 'Switch on'} aria-label="Toggle active" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <Power className="h-4 w-4" />
                </button>
                <button onClick={() => remove(acc)} title="Delete" aria-label="Delete account" className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ),
          )}
        </div>
      )}

      {err && (
        <p className="flex items-start gap-1.5 border-t border-neutral-100 p-4 text-xs text-rose-600 dark:border-neutral-800 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
        </p>
      )}
    </div>
  )
}

function MembershipPaymentSection({ accounts, defaultId }) {
  const { content, updateContent } = useData()
  const [fee, setFee] = useState(content.membershipFee ?? 0)
  const [acct, setAcct] = useState(content.membershipUpiAccountId || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const defaultLabel = accounts.find((a) => a.id === defaultId)?.label

  const dirty = (content.membershipFee ?? 0) !== (Number(fee) || 0) || (content.membershipUpiAccountId || '') !== acct

  async function save() {
    setSaving(true)
    setErr('')
    try {
      await updateContent({ membershipFee: Math.max(0, Number(fee) || 0), membershipUpiAccountId: acct })
    } catch (ex) {
      setErr(ex?.message || 'Could not save — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="text-sm font-semibold">Membership payment</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs text-neutral-400">Membership fee (₹) — 0 for free</span>
          <input type="number" min="0" className={inputCls} value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-neutral-400">Collect to</span>
          <select className={inputCls} value={acct} onChange={(e) => setAcct(e.target.value)}>
            <option value="">Default account{defaultLabel ? ` (${defaultLabel})` : ' (not set yet)'}</option>
            {accounts.filter((a) => a.active !== false).map((a) => <option key={a.id} value={a.id}>{a.label} · {a.upiId}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {dirty ? 'Save' : 'Saved'}
        </Button>
        {err && (
          <p className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
          </p>
        )}
      </div>
    </div>
  )
}

// Razorpay account profiles — unchanged from the Razorpay integration, folded
// away while PAYMENT_MODE is 'manual' so it's ready the day Razorpay is approved.
function RazorpaySection() {
  const { content, updateContent } = useData()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ label: '', keyId: '', description: '' })
  const [adding, setAdding] = useState(false)
  const [acctErr, setAcctErr] = useState('')
  const [memAcct, setMemAcct] = useState(content.membershipPaymentAccountId || '')
  const [savingMem, setSavingMem] = useState(false)

  useEffect(() => {
    let alive = true
    svc.fetchPaymentAccounts()
      .then((list) => alive && setAccounts(list || []))
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  async function addAccount() {
    if (!draft.label.trim() || !draft.keyId.trim()) return
    setAdding(true)
    setAcctErr('')
    try {
      const created = await svc.createPaymentAccount(draft)
      setAccounts((a) => [created, ...a])
      setDraft({ label: '', keyId: '', description: '' })
    } catch (err) {
      setAcctErr(err?.message || 'Could not add that account — please try again.')
    } finally {
      setAdding(false)
    }
  }

  async function toggleActive(acc) {
    const next = !acc.active
    setAcctErr('')
    setAccounts((a) => a.map((x) => (x.id === acc.id ? { ...x, active: next } : x)))
    try {
      await svc.updatePaymentAccount(acc.id, { active: next })
    } catch (err) {
      setAccounts((a) => a.map((x) => (x.id === acc.id ? { ...x, active: !next } : x)))
      setAcctErr(err?.message || `Could not ${next ? 'activate' : 'deactivate'} "${acc.label}" — please try again.`)
    }
  }

  async function remove(acc) {
    if (!confirm(`Delete “${acc.label}”? Events using it will fall back to the default account.`)) return
    setAcctErr('')
    const prev = accounts
    setAccounts((a) => a.filter((x) => x.id !== acc.id))
    try {
      await svc.deletePaymentAccount(acc.id)
    } catch (err) {
      setAccounts(prev)
      setAcctErr(err?.message || `Could not delete "${acc.label}" — please try again.`)
    }
  }

  async function saveMemAcct() {
    setSavingMem(true)
    try { await updateContent({ membershipPaymentAccountId: memAcct }) } finally { setSavingMem(false) }
  }

  return (
    <details className="group rounded-2xl border border-neutral-200 dark:border-neutral-800">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold">
            Razorpay {!isRazorpayMode && <Badge tone="neutral">Switched off</Badge>}
          </span>
          <span className="block text-xs text-neutral-400">
            Kept for later — set <code>PAYMENT_MODE</code> to <code>'razorpay'</code> in <code>src/lib/payments.js</code> once the account is approved.
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-4 border-t border-neutral-100 p-4 dark:border-neutral-800">
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-800 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p><strong>Key Secrets are never stored here.</strong> Add each account's <em>Key ID</em> below; put its matching <em>Key Secret</em> in the server env var <code className="rounded bg-blue-100 px-1 dark:bg-blue-500/20">RAZORPAY_KEYS</code> as <code className="rounded bg-blue-100 px-1 dark:bg-blue-500/20">{'{"<keyId>":"<secret>"}'}</code>. See PAYMENTS.md.</p>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800">
          {loading ? (
            <div className="grid h-20 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-acm-500" /></div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {accounts.length === 0 && <p className="p-4 text-sm text-neutral-500">No Razorpay accounts yet.</p>}
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center gap-3 p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-acm-500/10 text-acm-600 dark:text-acm-400">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{acc.label}</span>
                      <Badge tone={acc.active ? 'green' : 'neutral'} dot={acc.active}>{acc.active ? 'Active' : 'Off'}</Badge>
                    </div>
                    <div className="truncate text-xs text-neutral-400">
                      <code>{acc.keyId}</code>{acc.description ? ` · ${acc.description}` : ''}
                    </div>
                  </div>
                  <button onClick={() => toggleActive(acc)} aria-label="Toggle active" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    <Power className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(acc)} aria-label="Delete account" className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-2.5 border-t border-neutral-100 p-4 dark:border-neutral-800 sm:grid-cols-[1fr_1fr_auto]">
            <input className={inputCls} placeholder="Label (e.g. ACM Main)" value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
            <input className={inputCls} placeholder="Razorpay Key ID (rzp_…)" value={draft.keyId} onChange={(e) => setDraft((d) => ({ ...d, keyId: e.target.value }))} />
            <Button onClick={addAccount} disabled={adding || !draft.label.trim() || !draft.keyId.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
            </Button>
            <input className={cn(inputCls, 'sm:col-span-3')} placeholder="Description (optional)" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            {acctErr && (
              <p className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300 sm:col-span-3">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {acctErr}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[220px] flex-1">
            <span className="mb-1.5 block text-xs text-neutral-400">Razorpay account for membership</span>
            <select className={inputCls} value={memAcct} onChange={(e) => setMemAcct(e.target.value)}>
              <option value="">Default account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>
          <Button size="sm" variant="outline" onClick={saveMemAcct} disabled={savingMem || (content.membershipPaymentAccountId || '') === memAcct}>
            {savingMem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </Button>
        </div>
      </div>
    </details>
  )
}
```

- [ ] **Step 2: Event editor — add UPI account state and loading**

In `src/pages/Admin.jsx`:

**(a) Imports.** Add these at the top, next to the other component imports:

```js
import { UpiAccountForm } from '../components/payments/UpiAccountForm'
import * as pay from '../services/payments'
import { isRazorpayMode } from '../lib/payments'
```

**(b) Draft.** In `EventEditor`, add a new draft key after `paymentAccountId: event.paymentAccountId || '',`:

```js
    upiAccountId: event.upiAccountId || '',
```

**(c) State.** After `const [accounts, setAccounts] = useState([])`, add:

```js
  const { content } = useData()
  const [upiAccounts, setUpiAccounts] = useState([])
  const [addingUpi, setAddingUpi] = useState(false)
  const defaultUpi = upiAccounts.find((a) => a.id === content.defaultUpiAccountId)
```

**(d) Effect.** Replace the effect body's `svc.fetchPaymentAccounts()...` line with:

```js
    pay.fetchUpiAccounts().then((l) => alive && setUpiAccounts((l || []).filter((a) => a.active !== false))).catch(() => {})
    if (isRazorpayMode) svc.fetchPaymentAccounts().then((l) => alive && setAccounts((l || []).filter((a) => a.active !== false))).catch(() => {})
```

- [ ] **Step 3: Event editor — replace the "Credit payment to" field**

Replace the `{Number(draft.fee) > 0 && (<Field label="Credit payment to" …>…</Field>)}` block with:

```jsx
          {Number(draft.fee) > 0 && (
            <Field label="Collect payment to" hint="The UPI QR registrants pay to. “Default” follows whichever account is the default in the Payments tab.">
              <select
                className={cn(inputCls, 'mt-1')}
                value={draft.upiAccountId}
                onChange={(e) => (e.target.value === '__new__' ? setAddingUpi(true) : setDraft((d) => ({ ...d, upiAccountId: e.target.value })))}
              >
                <option value="">Default account{defaultUpi ? ` (${defaultUpi.label})` : ' (not set yet)'}</option>
                {upiAccounts.map((a) => <option key={a.id} value={a.id}>{a.label} · {a.upiId}</option>)}
                <option value="__new__">+ Add new QR account…</option>
              </select>
            </Field>
          )}
          {Number(draft.fee) > 0 && isRazorpayMode && (
            <Field label="Razorpay account" hint="Which Razorpay account profile this event's payments are credited to.">
              <select className={cn(inputCls, 'mt-1')} value={draft.paymentAccountId} onChange={set('paymentAccountId')}>
                <option value="">Default account</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </Field>
          )}
```

Then, just before `EventEditor`'s closing `</div>` (the root element returned), add the modal:

```jsx
      <Modal open={addingUpi} onClose={() => setAddingUpi(false)} size="md">
        <div className="p-6 sm:p-8">
          <h3 className="text-lg font-bold tracking-tight">New QR account</h3>
          <p className="mt-1 text-xs text-neutral-400">It’s saved to the Payments tab too, so you can reuse it for other events.</p>
          <div className="mt-5">
            <UpiAccountForm
              onCancel={() => setAddingUpi(false)}
              onSaved={(acc) => {
                setUpiAccounts((l) => [acc, ...l])
                setDraft((d) => ({ ...d, upiAccountId: acc.id }))
                setAddingUpi(false)
              }}
            />
          </div>
        </div>
      </Modal>
```

(`Modal` is already imported in `Admin.jsx`.)

- [ ] **Step 4: Build, then check it manually in the dev server**

Run: `npm run build` → `✓ built`.

Manual check (Task 12 sets up the emulator environment; until then, skip or use mock mode):
- Payments tab: add an account, and it becomes ★ Default. Add a second, then make it the default.
- Event editor: set a fee and pick "+ Add new QR account…". The modal saves and selects the new account.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/PaymentsPanel.jsx src/pages/Admin.jsx
git commit -m "feat(admin): UPI QR accounts with default, membership collect-to, per-event account picker"
```

---

### Task 6: Event registration flow (context + drawer)

**Files:**
- Modify: `src/context/RegistrationsContext.jsx` (`register`, `unregister`, new `resubmitReceipt`)
- Modify: `src/components/events/RegistrationDrawer.jsx`

**Interfaces:**
- Consumes:
  - `createRegistrationWithReceipt`, `attachReceipt`, `discardReceipt` (Task 3)
  - `holdsSeat`, `receiptReady`, `normalizeUtr` (Task 1)
  - `PayToCard`, `ReceiptUploader`, `useUpiAccount` (Task 4)
  - `isRazorpayMode`, `isApiAvailable`
- Produces:
  - `register(event, form)`, which now accepts `form.receipt: {image, utr}` and `form.upiAccountId`
  - `resubmitReceipt(reg, receipt, event) → Promise<void>` on `useRegistrations()` (used by Task 9)
  - registration docs now carry `amountDue`, `upiAccountId` and `seatHeld`

- [ ] **Step 1: Update `src/context/RegistrationsContext.jsx`**

Add these imports:

```js
import * as pay from '../services/payments'
import { isRazorpayMode } from '../lib/payments'
import { holdsSeat } from '../lib/manualPay'
```

In `register`, replace everything from `const chargeAmount = …` through `return created` with:

```js
    const chargeAmount = form.chargeAmount != null ? Number(form.chargeAmount) : (Number(event.fee) || 0)
    // Manual mode: a paid registration is only ever written together with its
    // receipt (one atomic batch), so there's no "registered but never paid" limbo.
    const manual = chargeAmount > 0 && !isRazorpayMode
    if (manual && !form.receipt) throw new Error('Upload your payment receipt to register.')
    const regDoc = {
      userId: user?.id || 'u_local',
      userName: form.name || user?.name || '',
      userEmail: form.email || user?.email || '',
      phone: form.phone || user?.phone || '',
      eventId: event.id,
      eventName: event.name,
      college: form.college || '',
      department: form.department || '',
      year: form.year || '',
      acmMember: !!form.isMember,
      membershipId: form.membershipId || '',
      date: new Date().toISOString().slice(0, 10),
      status: 'Confirmed',
      // 'pending' until verified (by an admin, or Razorpay's server); 'free'
      // when there's nothing to pay.
      paymentStatus: chargeAmount > 0 ? 'pending' : 'free',
      amountDue: chargeAmount,
      upiAccountId: manual ? (form.upiAccountId || '') : '',
      // Remember whether this event tracks capacity, and whether this record is
      // holding one of its seats right now (a rejected payment releases it).
      counted: max > 0,
      seatHeld: max > 0,
    }
    const created = manual
      ? await pay.createRegistrationWithReceipt(regDoc, { ...form.receipt, amount: chargeAmount })
      : await svc.createRegistration(regDoc)
    setRegs((prev) => [...prev, created])
    // Reserve the slot — held through review; a rejection or cancel releases it.
    if (max > 0) svc.bumpEventCount(event.id, 1)
    return created
```

Add `resubmitReceipt` after `markRegistrationPaid`:

```js
  // Upload a receipt for an existing registration: a team leader whose receipt
  // didn't go through, or a payer whose receipt was rejected. A rejection
  // released the seat, so re-taking it re-checks capacity first.
  async function resubmitReceipt(reg, receipt, event) {
    const max = Number(event?.maxRegistrations) || 0
    const needsSeat = max > 0 && !!reg.counted && !holdsSeat(reg)
    if (needsSeat && (await svc.fetchEventCount(reg.eventId)) >= max) {
      throw new Error('Sorry — this event filled up while your payment was being reviewed. Please contact the organisers.')
    }
    const applied = await pay.attachReceipt({
      kind: 'event',
      refId: reg.id,
      userId: user.id,
      ...receipt,
      amount: reg.amountDue ?? (Number(event?.fee) || 0),
      patch: needsSeat ? { seatHeld: true } : {},
    })
    if (needsSeat) svc.bumpEventCount(reg.eventId, 1)
    setRegs((prev) => prev.map((r) => (r.id === reg.id ? { ...r, ...applied } : r)))
  }
```

Replace `unregister` with:

```js
  // Drop an unverified registration (a cancelled Razorpay checkout, or the user
  // withdrawing one under review), release its seat, and free its receipt's
  // transaction ID so it can be used again.
  async function unregister(id) {
    if (!id) return
    const reg = regs.find((r) => r.id === id)
    try { await svc.deleteRegistration(id) } catch { /* best-effort cleanup */ }
    if (reg) pay.discardReceipt(reg).catch(() => {})
    if (reg && holdsSeat(reg) && reg.eventId) svc.bumpEventCount(reg.eventId, -1)
    setRegs((prev) => prev.filter((r) => r.id !== id))
  }
```

Add `resubmitReceipt` to the provider value:

```jsx
    <RegistrationsContext.Provider value={{ regs, isRegistered, register, addTeamRegistration, markRegistrationPaid, resubmitReceipt, unregister, refetch }}>
```

- [ ] **Step 2: `RegistrationDrawer.jsx` — imports and state**

Replace the payments import line with:

```js
import { payFor, validateMembership, registerTeam, isRazorpayMode, isApiAvailable } from '../../lib/payments'
import { attachReceipt } from '../../services/payments'
import { receiptReady, normalizeUtr } from '../../lib/manualPay'
import { PayToCard } from '../payments/PayToCard'
import { ReceiptUploader } from '../payments/ReceiptUploader'
import { useUpiAccount } from '../payments/useUpiAccount'
```

Add `ReceiptText` to the `lucide-react` import list.

After `const [teammates, setTeammates] = useState([])`, add:

```js
  // Manual payment: the receipt being attached, and a warning if a team's
  // registration went through but its receipt upload didn't.
  const [receipt, setReceipt] = useState({ image: '', utr: '' })
  const [receiptWarning, setReceiptWarning] = useState('')
```

Replace `const canVerify = isPaymentConfigured` with `const canVerify = isApiAvailable`.

- [ ] **Step 3: `RegistrationDrawer.jsx` — compute price and steps before the hooks that need them**

Move the pricing computation above `stepValid`. Delete these two existing lines (currently after `if (!event) return null`):

```js
  const discountEligible = !isManualTeam && isTkmVisitor && !!(memberCheck?.valid && !memberCheck?.alreadyUsed && memberCheck?.discount > 0)
  const payable = isManualTeam ? (Number(event.fee) || 0) : (discountEligible ? memberCheck.effectiveFee : (Number(event.fee) || 0))
```

Then insert this block immediately **before** `const stepValid = useMemo(`:

```js
  // The member discount applies to anyone paying their own fee — solo events
  // and Random Grouping events alike (a manual-team registration pays one
  // flat team fee instead, so it doesn't get an individual discount) — but
  // never to a non-TKM registrant, since there's no membership data for other
  // colleges to verify against.
  const discountEligible = !isManualTeam && isTkmVisitor && !!(memberCheck?.valid && !memberCheck?.alreadyUsed && memberCheck?.discount > 0)
  const baseFee = Number(event?.fee) || 0
  const payable = isManualTeam ? baseFee : (discountEligible ? memberCheck.effectiveFee : baseFee)
  // Manual mode inserts a Payment step (pay to the QR + upload the receipt)
  // before Confirm whenever something is actually owed.
  const manualPay = !isRazorpayMode && payable > 0
  const stepLabels = ['Your details', isManualTeam ? 'Your team' : 'Eligibility', ...(manualPay ? ['Payment'] : []), 'Confirm']
  const paymentStep = manualPay ? 2 : -1
  const lastStep = stepLabels.length - 1
  const { account: payAccount, loading: payAccountLoading } = useUpiAccount(event?.upiAccountId || '', !!open && manualPay)
```

Delete the old comment block that preceded the removed `discountEligible` line (lines 144–149 of the original), since it moved with the code.

In `stepValid`, replace `if (step === 2) return form.agree` with:

```js
    if (step === paymentStep) return !!payAccount && receiptReady(receipt)
    if (step === lastStep) return form.agree
```

and set its dependency array to:

```js
  }, [step, form, canVerify, memberCheck, isManualTeam, teammates, event, paymentStep, lastStep, payAccount, receipt])
```

Replace `const paid = payable > 0 && isPaymentConfigured` with:

```js
  // Razorpay mode only: charge through hosted checkout after saving.
  const razorpayCharge = payable > 0 && isRazorpayMode
```

- [ ] **Step 4: `RegistrationDrawer.jsx` — `submit()` and `handleClose()`**

Replace the `try { if (isManualTeam) {…} else {…} } catch` save block's `try` body with:

```js
      if (isManualTeam) {
        // The server validates every teammate email against real accounts and
        // creates the whole team as one registration.
        const teammates = teammates_filled()
        const res = await registerTeam({ eventId: event.id, teamName: form.teamName.trim(), teammates })
        created = { id: res.id }
        const counted = (Number(event.maxRegistrations) || 0) > 0
        let teamReg = {
          id: res.id, eventId: event.id, eventName: event.name, isTeam: true,
          teamName: form.teamName.trim(), paymentStatus: res.paymentStatus, userId: user?.id,
          counted, seatHeld: counted, amountDue: payable,
        }
        if (manualPay) {
          // The team exists now; attach the receipt. If this part fails the team
          // stays "awaiting receipt" and the leader can upload from the dashboard.
          try {
            const applied = await attachReceipt({ kind: 'event', refId: res.id, userId: user.id, ...receipt, amount: payable })
            teamReg = { ...teamReg, ...applied }
          } catch (err) {
            setReceiptWarning(`Your team is registered, but the receipt didn’t upload (${err?.message || 'unknown error'}). Upload it from your dashboard.`)
          }
        }
        onTeamCreated?.(teamReg)
      } else {
        // Only a verified, unused id is claimed — the server re-checks it and
        // applies the discount, so an unverified/used id gets no benefit.
        created = await onComplete?.(event, {
          ...form,
          membershipId: claimedId,
          isMember: form.isMember,
          chargeAmount: payable,
          receipt: manualPay ? receipt : null,
          upiAccountId: payAccount?.id || '',
        })
      }
```

In the payment block below it, replace both `paid && created?.id` occurrences with `razorpayCharge && created?.id`.

In `handleClose`'s timeout, add:

```js
      setReceipt({ image: '', utr: '' })
      setReceiptWarning('')
```

- [ ] **Step 5: `RegistrationDrawer.jsx` — rendering**

**(a) Done screen title and text.** Replace the `<h3>` content with:

```jsx
            {pendingConfirm ? 'Payment received' : manualPay ? 'Receipt submitted' : "You're registered!"}
```

and add a `manualPay` branch as the first alternative in the paragraph's ternary:

```jsx
            {pendingConfirm ? (
              <>Your payment for <strong className="text-neutral-800 dark:text-neutral-200">{event.name}</strong> went through — we’re just confirming it, and your registration will update to paid shortly.</>
            ) : manualPay ? (
              <>Your registration for <strong className="text-neutral-800 dark:text-neutral-200">{event.name}</strong> is saved. The team will verify your payment shortly — your ticket{event.whatsappLink ? ' and the event WhatsApp group' : ''} appear on your dashboard once it’s verified.</>
            ) : isRandomGroup ? (
```

(The existing `isRandomGroup` and default branches stay as they are.)

**(b) Summary rows and warning.** In the done-screen summary box, add after the `claimedId` row:

```jsx
            {manualPay && <Row label="Payment" value={`Under review · UTR ${normalizeUtr(receipt.utr)}`} />}
```

After that summary box, add:

```jsx
          {receiptWarning && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {receiptWarning}
            </p>
          )}
```

**(c) WhatsApp block.** Change its condition from `event.whatsappLink && (` to `event.whatsappLink && !manualPay && (`. The link is only revealed once the payment is verified, on the dashboard (Task 9).

**(d) Progress header.** Replace `{['Your details', isManualTeam ? 'Your team' : 'Eligibility', 'Confirm'].map((s, i) => (` with `{stepLabels.map((s, i) => (`.

**(e) Fee note.** Replace:

```jsx
                          {isPaymentConfigured
                            ? 'Paid securely via Razorpay when you submit.'
                            : 'Payment is collected separately by the organisers.'}
```

with:

```jsx
                          {isRazorpayMode
                            ? 'Paid securely via Razorpay when you submit.'
                            : 'Pay by UPI on the next step and upload your receipt — the team verifies it before your ticket is issued.'}
```

**(f) Payment step.** Insert it before `{step === 2 && (`:

```jsx
                {step === paymentStep && (
                  <div className="grid gap-4">
                    <PayToCard account={payAccount} loading={payAccountLoading} amount={payable} note={event.name} />
                    <ReceiptUploader value={receipt} onChange={setReceipt} />
                  </div>
                )}
```

**(g) Confirm step.** Change `{step === 2 && (` to `{step === lastStep && (`, and in its summary add before the Fee row:

```jsx
                      {manualPay && <Row label="Payment" value={`UPI · UTR ${normalizeUtr(receipt.utr)}`} />}
```

**(h) Footer.** Change `{step < 2 ? (` to `{step < lastStep ? (`. In the submit button, replace every `paid` with `razorpayCharge`, and make the non-Razorpay label:

```jsx
                ) : manualPay ? (
                  <><ReceiptText className="h-4 w-4" /> Submit registration & receipt</>
                ) : (
```

placed between the `razorpayCharge` branch and the final `Submit registration` branch.

- [ ] **Step 6: Build**

Run: `npm run build` → `✓ built`.
Run: `grep -n "isPaymentConfigured\|\bpaid\b" src/components/events/RegistrationDrawer.jsx` → no matches except inside the strings or comments you meant to keep.

- [ ] **Step 7: Commit**

```bash
git add src/context/RegistrationsContext.jsx src/components/events/RegistrationDrawer.jsx
git commit -m "feat(events): pay-to-QR step with receipt upload; seat held through review"
```

---

### Task 7: Membership page — manual payment

**Files:**
- Modify: `src/pages/Membership.jsx`

**Interfaces:**
- Consumes:
  - `createMembershipWithReceipt`, `attachReceipt` (Task 3)
  - `PayToCard`, `ReceiptUploader`, `ReceiptUploadModal`, `useUpiAccount` (Task 4)
  - `paymentState`, `hasTicket`, `needsReceipt`, `receiptReady`, `PAYMENT_STATE_META` (Task 1)
- Produces: membership docs with `amountDue`, `upiAccountId` and the receipt fields. The page no longer sets `acmMember` itself.

- [ ] **Step 1: Imports and fee flags**

Replace the payments import with:

```js
import { payFor, isRazorpayMode, PAYMENT_MODE } from '../lib/payments'
import { createMembershipWithReceipt, attachReceipt } from '../services/payments'
import { paymentState, hasTicket, needsReceipt, receiptReady, PAYMENT_STATE_META } from '../lib/manualPay'
import { PayToCard } from '../components/payments/PayToCard'
import { ReceiptUploader } from '../components/payments/ReceiptUploader'
import { ReceiptUploadModal } from '../components/payments/ReceiptUploadModal'
import { useUpiAccount } from '../components/payments/useUpiAccount'
```

Add `Clock` and `Upload` to the `lucide-react` import.

Replace `const chargesFee = membershipFee > 0 && isPaymentConfigured` with:

```js
  // A fee is collected in either payment mode; `manual` = UPI QR + receipt.
  const manual = !isRazorpayMode
  const chargesFee = membershipFee > 0 && (PAYMENT_MODE === 'manual' || isRazorpayMode)
```

- [ ] **Step 2: Replace `handleSubmit` and add `handleResubmit`**

```js
  async function handleSubmit(e, { receipt, accountId } = {}) {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget))
    setError('')
    setSubmitting(true)
    const data = {
      googleName: user.googleName || user.name || '',
      firstName: f.firstName.trim(),
      middleName: f.middleName.trim(),
      lastName: f.lastName.trim(),
      email: f.email.trim(),
      phone: f.phone.trim(),
      department: f.department,
      className: f.className.trim(),
    }

    // Manual payment: the application, its receipt and the UTR are written
    // together. Errors here (e.g. a reused transaction ID) are the payer's to
    // fix, so show them inline rather than the "service unavailable" screen.
    if (manual && chargesFee) {
      try {
        const created = await createMembershipWithReceipt(
          user.id,
          { ...data, amountDue: membershipFee, upiAccountId: accountId || '' },
          { ...receipt, amount: membershipFee },
        )
        setMembership(created)
        setPhase('status')
      } catch (err) {
        setError(err?.message || 'We couldn’t submit your application. Please try again.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    let created
    try {
      created = await createMembership(user.id, {
        ...data,
        amountDue: chargesFee ? membershipFee : 0,
        // Only 'pending' when a fee will actually be collected online — otherwise
        // there's nothing to pay, so it's 'free' (avoids a misleading "Pending").
        paymentStatus: chargesFee ? 'pending' : 'free',
      })
    } catch {
      setPhase('blocked')
      setSubmitting(false)
      return
    }
    // Razorpay mode: collect the fee if one is configured. A cancel/failure here
    // does NOT lose the application — it stays recorded as 'pending' and can be
    // paid later from the status screen (the server flips it to 'paid').
    if (chargesFee) {
      try {
        const result = await payFor({
          type: 'membership',
          refId: user.id,
          prefill: { name: fullName(created) || user.name, email: created.email || user.email, contact: created.phone },
        })
        if (result.status === 'paid') created = { ...created, paymentStatus: 'paid' }
        else if (result.status === 'pending_confirmation') setConfirming(true) // money taken, webhook finalises
      } catch (err) {
        setError(err?.message || 'Payment was not completed — you can pay from the next screen.')
      }
    }
    setMembership(created)
    setPhase('status')
    setSubmitting(false)
  }

  // Manual mode: upload a receipt after a rejection (or for an older
  // application that never had one).
  async function handleResubmit(receipt) {
    const applied = await attachReceipt({
      kind: 'membership',
      refId: user.id,
      userId: user.id,
      ...receipt,
      amount: membership.amountDue || membershipFee,
    })
    setMembership((m) => ({ ...m, ...applied }))
  }
```

(The removed `await saveProfile({ acmMember: true })` is intentional. Member status is now granted when the payment is verified. Remove `saveProfile` from the `useAuth()` destructure if nothing else uses it.)

- [ ] **Step 3: Pass the new props**

Replace the `MembershipForm` and `StatusCard` usages with:

```jsx
          <MembershipForm user={user} onSubmit={handleSubmit} submitting={submitting} error={error} fee={membershipFee} chargesFee={chargesFee} manual={manual} upiAccountId={content?.membershipUpiAccountId || ''} departments={departments} />
```

```jsx
          <StatusCard membership={membership} user={user} chargesFee={chargesFee} fee={membershipFee} onPay={handlePayNow} error={error} confirming={confirming} manual={manual} onResubmit={handleResubmit} upiAccountId={content?.membershipUpiAccountId || ''} />
```

- [ ] **Step 4: `MembershipForm` — the payment section**

Change the signature to `function MembershipForm({ user, onSubmit, submitting, error, fee, chargesFee, manual, upiAccountId, departments })`. Add at its top:

```js
  const collectsReceipt = manual && chargesFee
  const [receipt, setReceipt] = useState({ image: '', utr: '' })
  const { account, loading: accountLoading } = useUpiAccount(upiAccountId, collectsReceipt)
```

Change the form's `onSubmit={onSubmit}` to:

```jsx
      onSubmit={(e) => onSubmit(e, { receipt, accountId: account?.id })}
```

Insert, just before `{error && (`:

```jsx
      {collectsReceipt && (
        <div className="mt-7 grid gap-4 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <div>
            <h3 className="text-sm font-semibold">Membership fee</h3>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">Pay ₹{fee} by UPI, then attach the receipt — the team verifies it and assigns your Membership ID.</p>
          </div>
          <PayToCard account={account} loading={accountLoading} amount={fee} note="ACM TKMCE membership" />
          <ReceiptUploader value={receipt} onChange={setReceipt} disabled={submitting} />
        </div>
      )}
```

Replace the submit button and hint with:

```jsx
        <Button type="submit" size="lg" disabled={submitting || (collectsReceipt && (!account || !receiptReady(receipt)))} className="w-full sm:w-auto">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {submitting ? 'Submitting…' : collectsReceipt ? 'Submit application & receipt' : chargesFee ? `Proceed to Pay ₹${fee}` : 'Submit application'}
        </Button>
        <p className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          {collectsReceipt
            ? 'Your Membership ID is assigned once the team verifies your payment.'
            : chargesFee
              ? 'Paid securely via Razorpay. Your Membership ID is assigned by the team once your payment is confirmed.'
              : 'Your details are saved now; your Membership ID follows once it’s confirmed.'}
        </p>
```

- [ ] **Step 5: `StatusCard` — manual states**

Change the signature to `function StatusCard({ membership, user, chargesFee, fee, onPay, error, confirming, manual, onResubmit, upiAccountId })`. After `const assigned = …`, add:

```js
  const [uploadOpen, setUploadOpen] = useState(false)
  const state = paymentState(membership)
  // Manual mode: a member once verified (or free). Razorpay mode: the old rule.
  const isMember = manual ? hasTicket(membership) : !(chargesFee && !isPaid && !confirming)
```

Replace the header badge ternary (`{chargesFee && !isPaid && !confirming ? (…Payment pending…) : (…ACM Member…)}`) with:

```jsx
          {isMember ? (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-acm-500/10 px-2.5 py-1 text-xs font-semibold text-acm-600 dark:text-acm-400">
              <BadgeCheck className="h-3.5 w-3.5" /> ACM Member
            </span>
          ) : (
            <span className={cn(
              'mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              state === 'rejected' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
            )}>
              <CreditCard className="h-3.5 w-3.5" /> {manual ? `Payment ${PAYMENT_STATE_META[state].label.toLowerCase()}` : 'Payment pending'}
            </span>
          )}
```

(Import `cn` from `'../lib/cn'` if it isn't already imported.)

In `rows`, change the Payment row's value to:

```js
    { label: 'Payment', value: manual ? PAYMENT_STATE_META[state].label : (isPaid ? 'Paid' : confirming ? 'Confirming…' : chargesFee ? 'Pending' : 'Free') },
```

Change the existing Razorpay "Membership fee pending" box condition from `chargesFee && !isPaid && !confirming && (` to `!manual && chargesFee && !isPaid && !confirming && (`.

Insert these manual boxes right after it:

```jsx
      {manual && state === 'review' && (
        <div className="m-6 mt-0 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/25 dark:bg-blue-500/10">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
          <div className="text-sm">
            <div className="font-semibold">Receipt submitted — under review</div>
            <div className="text-neutral-500 dark:text-neutral-400">
              The team is verifying your payment{membership.utr ? ` (UTR ${membership.utr})` : ''}. You’ll be a member as soon as it’s approved.
            </div>
          </div>
        </div>
      )}

      {manual && needsReceipt(membership) && (
        <div className={cn(
          'm-6 mt-0 rounded-xl border p-4',
          state === 'rejected'
            ? 'border-rose-200 bg-rose-50 dark:border-rose-500/25 dark:bg-rose-500/10'
            : 'border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10',
        )}>
          <div className="flex flex-wrap items-center gap-3">
            <AlertCircle className={cn('h-5 w-5 shrink-0', state === 'rejected' ? 'text-rose-500' : 'text-amber-500')} />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold">{state === 'rejected' ? 'Your receipt was rejected' : 'Membership fee pending'}</div>
              <div className="text-neutral-600 dark:text-neutral-300">
                {state === 'rejected'
                  ? (membership.rejectReason || 'Please upload a clearer receipt.')
                  : `Pay ₹${membership.amountDue || fee} and upload the receipt to finish joining.`}
              </div>
            </div>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Upload receipt
            </Button>
          </div>
        </div>
      )}
```

Change the Membership ID text to:

```jsx
            {assigned
              ? membership.membershipId
              : !isMember
                ? (manual ? 'Assigned once your payment is verified.' : 'Assigned once your payment is confirmed.')
                : 'Will be updated soon.'}
```

Just before the closing `</motion.div>` of `StatusCard`, add:

```jsx
      {manual && (
        <ReceiptUploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          title="ACM Membership"
          amount={membership.amountDue || fee}
          upiAccountId={membership.upiAccountId || upiAccountId}
          note="ACM TKMCE membership"
          rejectReason={state === 'rejected' ? membership.rejectReason : ''}
          onSubmit={onResubmit}
        />
      )}
```

- [ ] **Step 6: Build**

Run: `npm run build` → `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Membership.jsx
git commit -m "feat(membership): UPI receipt upload, review/rejected states, no self-granted member flag"
```

---

### Task 8: Admin verification — review modal, queue tab, panels

**Files:**
- Create: `src/components/payments/ReceiptReviewModal.jsx`
- Create: `src/components/admin/PaymentReviewPanel.jsx`
- Modify: `src/pages/Admin.jsx` (tabs, pending count, Overview banner, `loadRegistrations` mapping, `paymentLabel`, `RegistrationsPanel` payment cell/CSV/alerts)
- Modify: `src/components/admin/MembershipPanel.jsx` (payment cell, CSV, alerts)

**Interfaces:**
- Consumes: `fetchReceipt`, `fetchPendingReviews`, `findMemberByMembershipId`, `approvePayment`, `rejectPayment`, `fetchUpiAccounts` (Task 3); `paymentState`, `PAYMENT_STATE_META` (Task 1).
- Produces:
  - `<ReceiptReviewModal open onClose kind record title personName personEmail reviewerName canAct canCheckMember accounts onDone(patch) />`
  - `<PaymentReviewPanel canEvents canMembership reviewerName onChanged(count) />`

- [ ] **Step 1: `src/components/payments/ReceiptReviewModal.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, XCircle, AlertCircle, ZoomIn, ZoomOut, ImageOff } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { fetchReceipt, findMemberByMembershipId, approvePayment, rejectPayment } from '../../services/payments'
import { paymentState, PAYMENT_STATE_META } from '../../lib/manualPay'
import { cn } from '../../lib/cn'

const fmt = (t) => {
  const d = typeof t === 'string' ? new Date(t) : t?.toDate?.()
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
}

// One receipt, full size, with everything needed to decide: who, for what, how
// much was owed, which account it should have gone to, and the UTR to match
// against the bank statement. Approve / Reject (reason required) when allowed.
export function ReceiptReviewModal({ open, onClose, kind, record, title, personName, personEmail, reviewerName, canAct = false, canCheckMember = false, accounts = [], onDone }) {
  const [receipt, setReceipt] = useState(null) // null loading · false missing · object
  const [zoom, setZoom] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [member, setMember] = useState(undefined) // undefined n/a · null not found · { name }

  useEffect(() => {
    if (!open || !record) return
    setReceipt(null)
    setZoom(false)
    setRejecting(false)
    setReason('')
    setErr('')
    setMember(undefined)
    let alive = true
    if (record.receiptId) {
      fetchReceipt(record.receiptId).then((r) => alive && setReceipt(r || false)).catch(() => alive && setReceipt(false))
    } else {
      setReceipt(false)
    }
    if (canCheckMember && record.membershipId) {
      findMemberByMembershipId(record.membershipId).then((m) => alive && setMember(m)).catch(() => {})
    }
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record?.id, record?.receiptId])

  if (!record) return null
  const state = paymentState(record)
  const meta = PAYMENT_STATE_META[state]
  const account = accounts.find((a) => a.id === record.upiAccountId)
  const canDecide = canAct && state === 'review'

  async function run(fn) {
    setBusy(true)
    setErr('')
    try {
      const patch = await fn()
      onDone?.(patch)
      onClose()
    } catch (ex) {
      setErr(ex?.message || 'That didn’t go through — please try again.')
    } finally {
      setBusy(false)
    }
  }

  const approve = () => run(() => approvePayment({ kind, record, reviewer: reviewerName }))
  const reject = () => {
    if (!reason.trim()) { setErr('Add a reason — the payer sees it and can fix the problem.'); return }
    run(() => rejectPayment({ kind, record, reviewer: reviewerName, reason }))
  }

  const rows = [
    ['Payer', `${personName || '—'}${personEmail ? ` · ${personEmail}` : ''}`],
    ['For', title],
    ['Amount due', record.amountDue != null ? `₹${record.amountDue}` : '—'],
    ['Paid to', account ? `${account.label} · ${account.upiId}` : (record.upiAccountId ? 'Account since removed' : 'Default account')],
    ['UTR', record.utr || receipt?.utr || '—'],
    ['Submitted', fmt(record.receiptSubmittedAt)],
    ...(record.reviewedBy ? [['Reviewed', `${record.reviewedBy} · ${fmt(record.reviewedAt)}`]] : []),
  ]

  return (
    <Modal open={open} onClose={() => !busy && onClose()} size="xl">
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3 pr-8">
            <h3 className="text-lg font-bold tracking-tight">Payment receipt</h3>
            {receipt && (
              <button onClick={() => setZoom((z) => !z)} className="inline-flex items-center gap-1.5 text-xs font-medium text-acm-600 dark:text-acm-400">
                {zoom ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />} {zoom ? 'Fit' : 'Actual size'}
              </button>
            )}
          </div>
          <div className={cn('rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900', zoom ? 'max-h-[70vh] overflow-auto' : 'grid place-items-center')}>
            {receipt === null ? (
              <div className="grid h-80 w-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-acm-500" /></div>
            ) : receipt === false ? (
              <div className="flex h-60 flex-col items-center justify-center gap-2 text-sm text-neutral-400">
                <ImageOff className="h-6 w-6" /> {record.receiptId ? 'Receipt image not found.' : 'No receipt uploaded.'}
              </div>
            ) : (
              <img src={receipt.image} alt="Payment receipt" className={zoom ? 'max-w-none' : 'max-h-[70vh] w-auto object-contain'} />
            )}
          </div>
        </div>

        <div className="grid content-start gap-4">
          <div className="flex items-center gap-2"><Badge tone={meta.tone} dot={state === 'verified'}>{meta.label}</Badge></div>
          <dl className="grid gap-2.5 text-sm">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-neutral-400">{k}</dt>
                <dd className={cn('break-words font-medium', k === 'UTR' && 'font-mono')}>{v}</dd>
              </div>
            ))}
            {record.membershipId && (
              <div>
                <dt className="text-xs text-neutral-400">Claimed membership ID</dt>
                <dd className="font-medium">
                  {record.membershipId}
                  {member === null && <span className="ml-1.5 text-rose-600 dark:text-rose-400">✗ no member with this ID</span>}
                  {member && <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">✓ {member.name || 'member found'}</span>}
                </dd>
              </div>
            )}
            {state === 'rejected' && record.rejectReason && (
              <div>
                <dt className="text-xs text-neutral-400">Rejection reason</dt>
                <dd className="font-medium text-rose-600 dark:text-rose-400">{record.rejectReason}</dd>
              </div>
            )}
          </dl>

          {canDecide && (
            <div className="grid gap-2.5 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              {rejecting ? (
                <>
                  <textarea
                    autoFocus
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why? e.g. Amount doesn’t match / screenshot unreadable / UTR not found in statement"
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 dark:border-neutral-700 dark:bg-neutral-800"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setRejecting(false)} disabled={busy}>Back</Button>
                    <Button className="flex-1 !bg-rose-600 hover:!bg-rose-700" onClick={reject} disabled={busy}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Reject
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Button className="!bg-emerald-600 hover:!bg-emerald-700" onClick={approve} disabled={busy || receipt === null}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve payment
                  </Button>
                  <Button variant="outline" onClick={() => setRejecting(true)} disabled={busy}>
                    <XCircle className="h-4 w-4" /> Reject…
                  </Button>
                </>
              )}
              <p className="text-[11px] text-neutral-400">
                {kind === 'membership'
                  ? 'Approving makes them an ACM member; assign their Membership ID in the Membership tab.'
                  : 'Approving issues their ticket. Rejecting frees their seat and lets them upload a new receipt.'}
              </p>
            </div>
          )}

          {err && (
            <p className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: `src/components/admin/PaymentReviewPanel.jsx`**

```jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ReceiptText, Loader2, AlertCircle, RefreshCw, Inbox } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { ReceiptReviewModal } from '../payments/ReceiptReviewModal'
import { fetchPendingReviews, fetchUpiAccounts } from '../../services/payments'
import { cn } from '../../lib/cn'

const inputCls =
  'rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800'

const ago = (t) => {
  const ms = typeof t?.toMillis === 'function' ? t.toMillis() : Date.parse(t) || 0
  if (!ms) return ''
  const mins = Math.round((Date.now() - ms) / 60000)
  if (mins < 60) return `${Math.max(1, mins)} min ago`
  const hrs = Math.round(mins / 60)
  return hrs < 48 ? `${hrs} h ago` : `${Math.round(hrs / 24)} days ago`
}

// The verification queue: every submitted receipt waiting for a decision,
// oldest first. Editors only see the kinds they may verify.
export function PaymentReviewPanel({ canEvents, canMembership, reviewerName, onChanged }) {
  const [items, setItems] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [loadErr, setLoadErr] = useState('')
  const [kind, setKind] = useState('all') // all | event | membership
  const [eventId, setEventId] = useState('all')
  const [open, setOpen] = useState(null)
  // The parent passes a fresh callback every render; keep the latest in a ref
  // so it isn't a dependency of `load` (which would reload in a loop).
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged

  const load = useCallback(async () => {
    setLoadErr('')
    setItems(null)
    try {
      const list = await fetchPendingReviews({ events: canEvents, membership: canMembership })
      setItems(list)
      onChangedRef.current?.(list.length)
    } catch (err) {
      setLoadErr(err?.code === 'permission-denied' ? 'Your account can’t read the payment queue.' : 'Could not load the payment queue.')
      setItems([])
    }
  }, [canEvents, canMembership])

  useEffect(() => {
    load()
    fetchUpiAccounts().then((l) => setAccounts(l || [])).catch(() => {})
  }, [load])

  const eventOptions = useMemo(() => {
    const m = new Map()
    ;(items || []).forEach((i) => { if (i.kind === 'event') m.set(i.eventId, i.title) })
    return [...m.entries()]
  }, [items])

  const filtered = (items || []).filter((i) => {
    if (kind !== 'all' && i.kind !== kind) return false
    if (eventId !== 'all' && i.eventId !== eventId) return false
    return true
  })

  function done() {
    const next = (items || []).filter((i) => i !== open)
    setItems(next)
    onChangedRef.current?.(next.length)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <ReceiptText className="h-5 w-5 text-acm-500" /> Verify payments
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            {items ? `${items.length} receipt${items.length === 1 ? '' : 's'} waiting` : 'Loading…'} · Match each UTR and amount against the account’s statement before approving.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={items === null}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {canEvents && canMembership && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-10 items-center rounded-lg border border-neutral-200 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-800">
            {[['all', 'All'], ['event', 'Events'], ['membership', 'Membership']].map(([k, label]) => (
              <button
                key={k}
                onClick={() => { setKind(k); if (k === 'membership') setEventId('all') }}
                className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  kind === k ? 'bg-acm-600 text-white' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200')}
              >
                {label}
              </button>
            ))}
          </div>
          {kind !== 'membership' && eventOptions.length > 1 && (
            <select className={cn(inputCls, 'h-10 py-0')} value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="all">All events</option>
              {eventOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
        </div>
      )}

      {items === null ? (
        <div className="grid h-40 place-items-center rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <Loader2 className="h-6 w-6 animate-spin text-acm-500" />
        </div>
      ) : loadErr ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {loadErr}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-200 p-12 text-center text-sm text-neutral-500 dark:border-neutral-800">
          <Inbox className="h-6 w-6 text-neutral-300" /> All caught up — no receipts waiting.
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {filtered.map((i) => (
            <button
              key={`${i.kind}-${i.record.id}`}
              onClick={() => setOpen(i)}
              className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{i.personName}</span>
                  <Badge tone={i.kind === 'membership' ? 'blue' : 'neutral'}>{i.kind === 'membership' ? 'Membership' : i.title}</Badge>
                </div>
                <div className="mt-0.5 truncate text-xs text-neutral-400">
                  {i.personEmail} · UTR <code>{i.record.utr}</code> · {ago(i.record.receiptSubmittedAt)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold">₹{i.record.amountDue ?? '—'}</div>
                <div className="text-xs font-medium text-acm-600 dark:text-acm-400">Review →</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <ReceiptReviewModal
        open={!!open}
        onClose={() => setOpen(null)}
        kind={open?.kind}
        record={open?.record}
        title={open?.title}
        personName={open?.personName}
        personEmail={open?.personEmail}
        reviewerName={reviewerName}
        canAct
        canCheckMember={canMembership}
        accounts={accounts}
        onDone={done}
      />
    </motion.div>
  )
}
```

- [ ] **Step 3: Admin page — tab, count and Overview banner**

In `src/pages/Admin.jsx`:

**(a) Imports:**

```js
import { PaymentReviewPanel } from '../components/admin/PaymentReviewPanel'
import { ReceiptReviewModal } from '../components/payments/ReceiptReviewModal'
import { fetchPendingReviews, fetchUpiAccounts } from '../services/payments'
import { paymentState, PAYMENT_STATE_META } from '../lib/manualPay'
```

Add `ReceiptText` to the `lucide-react` import. (`isRazorpayMode` was imported in Task 5.)

**(b) `paymentLabel`.** Replace it with:

```js
const paymentLabel = (r) => {
  if (!isRazorpayMode) return PAYMENT_STATE_META[paymentState(r)].label
  const s = (r.paymentStatus || '').toLowerCase()
  if (s === 'paid') return 'Paid'
  if (s === 'pending') return 'Pending'
  return 'Free' // 'free', 'n/a', or unset (older/mock rows)
}
```

**(c) State.** In `Admin()`, after `const [unreadMsgs, setUnreadMsgs] = useState(0)`, add:

```js
  // Receipts waiting for verification — drives the tab dot and Overview banner.
  const [pendingReviews, setPendingReviews] = useState(0)
```

After `hasAnyAccess`, add:

```js
  const canVerify = !isRazorpayMode && (can('registrations') || can('membership'))
```

**(d) Tabs.** Insert this entry after the `membership` entry:

```js
    { key: 'verify', label: 'Verify payments', icon: ReceiptText, show: canVerify },
```

**(e) Count effect.** Add after the unread-messages effect:

```js
  useEffect(() => {
    if (!canVerify) return
    let alive = true
    fetchPendingReviews({ events: can('registrations'), membership: can('membership') })
      .then((l) => alive && setPendingReviews(l.length))
      .catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canVerify, tab])
```

**(f) Alerts.** Replace `const paymentAlerts = countPaymentChecks(regRows)` with:

```js
  const paymentAlerts = isRazorpayMode ? countPaymentChecks(regRows) : 0
```

**(g) Tab dot.** Change the dot condition to include the verify tab:

```jsx
{((t.key === 'messages' && unreadMsgs > 0) || (t.key === 'registrations' && paymentAlerts > 0) || (t.key === 'verify' && pendingReviews > 0)) && (
```

**(h) Panels.** Change the Overview line to:

```jsx
            {tab === 'overview' && <Overview stats={stats} events={events} paymentAlerts={paymentAlerts} onReviewAlerts={() => setTab('registrations')} reviewCount={canVerify ? pendingReviews : 0} onOpenReviews={() => setTab('verify')} />}
```

and add after the membership panel line:

```jsx
            {tab === 'verify' && canVerify && (
              <PaymentReviewPanel
                canEvents={can('registrations')}
                canMembership={can('membership')}
                reviewerName={user.name}
                onChanged={(n) => { setPendingReviews(n); loadRegistrations() }}
              />
            )}
```

**(i) Overview banner.** Change the signature to `function Overview({ stats, events, paymentAlerts = 0, onReviewAlerts, reviewCount = 0, onOpenReviews })` and add as the first child of its root `motion.div`:

```jsx
      {reviewCount > 0 && (
        <button
          onClick={onOpenReviews}
          className="flex w-full items-start gap-3 rounded-2xl border border-acm-200 bg-acm-50 p-4 text-left transition-colors hover:bg-acm-100/70 dark:border-acm-500/30 dark:bg-acm-500/10 dark:hover:bg-acm-500/15"
        >
          <ReceiptText className="mt-0.5 h-5 w-5 shrink-0 text-acm-600 dark:text-acm-400" />
          <div>
            <p className="text-sm font-semibold text-acm-800 dark:text-acm-200">
              {reviewCount} payment{reviewCount === 1 ? '' : 's'} waiting for verification
            </p>
            <p className="mt-0.5 text-xs text-acm-700/80 dark:text-acm-300/80">
              Open Verify payments to check each receipt against the account statement and approve or reject it.
            </p>
          </div>
        </button>
      )}
```

- [ ] **Step 4: Registrations roster — payment fields, cell, CSV**

**(a) Mapping.** In `loadRegistrations`, add to the mapped object after `paidAt: r.paidAt || null,`:

```js
        receiptId: r.receiptId || '',
        utr: r.utr || '',
        amountDue: r.amountDue,
        upiAccountId: r.upiAccountId || '',
        membershipId: r.membershipId || '',
        rejectReason: r.rejectReason || '',
        reviewedBy: r.reviewedBy || '',
        reviewedAt: r.reviewedAt || null,
        receiptSubmittedAt: r.receiptSubmittedAt || null,
        counted: !!r.counted,
        seatHeld: r.seatHeld,
```

**(b) Panel state.** In `RegistrationsPanel`, add state:

```js
  const [receiptFor, setReceiptFor] = useState(null)
  const [upiAccounts, setUpiAccounts] = useState([])
  useEffect(() => { fetchUpiAccounts().then((l) => setUpiAccounts(l || [])).catch(() => {}) }, [])
```

**(c) Alerts.** Replace `const alerts = filtered.filter((r) => paymentNeedsCheck(r)).length` with:

```js
  const alerts = isRazorpayMode ? filtered.filter((r) => paymentNeedsCheck(r)).length : 0
```

**(d) CSV.** Add columns after `{ label: 'Paid at', … }`:

```js
    { label: 'UTR', value: (r) => r.utr || '' },
    { label: 'Amount due', value: (r) => (r.amountDue != null ? r.amountDue : '') },
    { label: 'Reviewed by', value: (r) => r.reviewedBy || '' },
    { label: 'Reviewed at', value: (r) => fmtDateTime(r.reviewedAt) },
```

**(e) Payment cell.** Wrap the existing payment `<td>` contents so manual mode renders its own cell:

```jsx
                  <td className="px-5 py-3.5">
                    {isRazorpayMode ? (
                      /* …existing Paid / Check / Pending / Free markup, unchanged… */
                    ) : (
                      <ManualPaymentCell p={p} onView={() => setReceiptFor(p)} />
                    )}
                  </td>
```

**(f) Modal.** Before `RegistrationsPanel`'s closing root tag, add:

```jsx
      <ReceiptReviewModal
        open={!!receiptFor}
        onClose={() => setReceiptFor(null)}
        kind="event"
        record={receiptFor}
        title={receiptFor?.event}
        personName={receiptFor?.isTeam ? `${receiptFor.teamName} · ${receiptFor.name}` : receiptFor?.name}
        personEmail={receiptFor?.email}
        reviewerName={adminName}
        canAct
        canCheckMember={isAdmin}
        accounts={upiAccounts}
        onDone={() => onTeamChanged?.()}
      />
```

**(g) Cell component.** Add it near `Switch` at the bottom of `Admin.jsx`:

```jsx
// Manual-mode payment status for a roster row, with a link to its receipt.
function ManualPaymentCell({ p, onView }) {
  const st = paymentState(p)
  const meta = PAYMENT_STATE_META[st]
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={meta.tone} dot={st === 'verified'}>{meta.label}</Badge>
      {p.utr && <code className="text-[11px] text-neutral-400">{p.utr}</code>}
      {(p.receiptId || st === 'rejected') && (
        <button onClick={onView} className="text-[11px] font-medium text-acm-600 hover:underline dark:text-acm-400">
          {p.receiptId ? 'View receipt' : 'Details'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 5: MembershipPanel — manual payment cell, CSV, alerts**

In `src/components/admin/MembershipPanel.jsx`:

**(a) Imports:**

```js
import { ReceiptReviewModal } from '../payments/ReceiptReviewModal'
import { fetchUpiAccounts } from '../../services/payments'
import { isRazorpayMode } from '../../lib/payments'
import { paymentState, PAYMENT_STATE_META } from '../../lib/manualPay'
```

**(b) Props and state.** Change the signature to `export function MembershipPanel({ canEdit = true, adminName })`, which is unchanged except that `adminName` is now used as the reviewer. Add state:

```js
  const [receiptFor, setReceiptFor] = useState(null)
  const [upiAccounts, setUpiAccounts] = useState([])
  useEffect(() => { fetchUpiAccounts().then((l) => setUpiAccounts(l || [])).catch(() => {}) }, [])
```

**(c) Alerts.** Replace `const alerts = filtered.filter((m) => paymentNeedsCheck(m)).length` with:

```js
  const alerts = isRazorpayMode ? filtered.filter((m) => paymentNeedsCheck(m)).length : 0
```

**(d) CSV.** Replace the CSV `Payment` column and add a UTR column:

```js
      { label: 'Payment', value: (m) => (isRazorpayMode ? (m.paymentStatus === 'paid' ? 'Paid' : m.paymentStatus === 'free' ? 'Free' : 'Pending') : PAYMENT_STATE_META[paymentState(m)].label) },
      { label: 'UTR', value: (m) => m.utr || '' },
```

**(e) Payment cell.** Replace the payment `<td>` contents with:

```jsx
                  <td className="px-4 py-3">
                    {isRazorpayMode ? (
                      /* …existing Paid / Free / Check / Pending markup and razorpayPaymentId block, unchanged… */
                    ) : (
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={PAYMENT_STATE_META[paymentState(m)].tone} dot={paymentState(m) === 'verified'}>
                          {PAYMENT_STATE_META[paymentState(m)].label}
                        </Badge>
                        {m.utr && <code className="text-[11px] text-neutral-400">{m.utr}</code>}
                        {(m.receiptId || paymentState(m) === 'rejected') && (
                          <button onClick={() => setReceiptFor(m)} className="text-[11px] font-medium text-acm-600 hover:underline dark:text-acm-400">
                            {m.receiptId ? 'View receipt' : 'Details'}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
```

**(f) Modal.** Before `<ComposeMessageModal`, add:

```jsx
      <ReceiptReviewModal
        open={!!receiptFor}
        onClose={() => setReceiptFor(null)}
        kind="membership"
        record={receiptFor}
        title="ACM Membership"
        personName={receiptFor ? fullName(receiptFor) : ''}
        personEmail={receiptFor?.email}
        reviewerName={adminName}
        canAct={canEdit}
        accounts={upiAccounts}
        onDone={(patch) => setRows((rs) => rs.map((r) => (r.id === receiptFor.id ? { ...r, ...patch } : r)))}
      />
```

- [ ] **Step 6: Build**

Run: `npm run build` → `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add src/components/payments/ReceiptReviewModal.jsx src/components/admin/PaymentReviewPanel.jsx src/pages/Admin.jsx src/components/admin/MembershipPanel.jsx
git commit -m "feat(admin): verify-payments queue, receipt review modal, manual status in rosters"
```

---

### Task 9: Dashboard — ticket carousel, payment states, re-upload

**Files:**
- Create: `src/components/tickets/TicketCard.jsx`
- Create: `src/components/tickets/TicketCarousel.jsx`
- Modify: `src/index.css` (ticket shape utilities)
- Modify: `src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `resubmitReceipt` (Task 6); `ReceiptUploadModal` (Task 4); `paymentState`, `hasTicket`, `needsReceipt`, `ticketCode`, `PAYMENT_STATE_META` (Task 1).
- Produces: `<TicketCard reg event holderName />` and `<TicketCarousel items={[{reg, event}]} holderName />`.

- [ ] **Step 1: Ticket shape CSS**

Append to `src/index.css`, outside any `@layer`:

```css
/* Event pass — a notched ticket silhouette cut with CSS masks. The gold border
   (.ticket-shape) and the dark body inside it (.ticket-shape-inner, inset 2px)
   get concentric notches at the tear line, so the gold outlines each notch.
   The glow is a drop-shadow on the wrapper so it follows the notched shape. */
.ticket-glow {
  filter: drop-shadow(0 0 1.5px rgba(251, 191, 36, 0.9)) drop-shadow(0 0 18px rgba(245, 158, 11, 0.45));
}
.ticket-shape {
  --r: 14px;
  --x0: 0px;
  --x1: 100%;
  --y: calc(100% - 91px);
  border-radius: 24px;
  -webkit-mask:
    radial-gradient(circle var(--r) at var(--x0) var(--y), #0000 calc(var(--r) - 0.5px), #000 var(--r)) left / 50.5% 100% no-repeat,
    radial-gradient(circle var(--r) at var(--x1) var(--y), #0000 calc(var(--r) - 0.5px), #000 var(--r)) right / 50.5% 100% no-repeat;
  mask:
    radial-gradient(circle var(--r) at var(--x0) var(--y), #0000 calc(var(--r) - 0.5px), #000 var(--r)) left / 50.5% 100% no-repeat,
    radial-gradient(circle var(--r) at var(--x1) var(--y), #0000 calc(var(--r) - 0.5px), #000 var(--r)) right / 50.5% 100% no-repeat;
}
.ticket-shape-inner {
  --r: 12px;
  --x0: -2px;
  --x1: calc(100% + 2px);
  --y: calc(100% - 89px);
  border-radius: 22px;
}
```

- [ ] **Step 2: `src/components/tickets/TicketCard.jsx`**

```jsx
import { CheckCircle2, CalendarDays, Clock, MapPin, Users } from 'lucide-react'
import { formatDate } from '../../lib/format'
import { paymentState, ticketCode } from '../../lib/manualPay'
import { cn } from '../../lib/cn'

// A registration's event pass: ticket-shaped (notched sides + tear line) with a
// gold glow, and the holder's name in a green neon "Verified" box. Rendered
// only for registrations that are verified (paid) or free.
export function TicketCard({ reg, event, holderName }) {
  const verified = paymentState(reg) === 'verified'
  const code = ticketCode(reg.id)
  return (
    <div className="ticket-glow">
      <div className="ticket-shape bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-600 p-[2px]">
        <div className="ticket-shape ticket-shape-inner relative overflow-hidden bg-neutral-950 text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-amber-400/15 blur-3xl" />

          <div className="relative p-5">
            <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-300/90">
              <span>ACM TKMCE · Event pass</span>
              <span className="font-mono tracking-normal text-amber-200/80">{code}</span>
            </div>
            <h3 className="mt-3 line-clamp-2 text-xl font-bold leading-tight tracking-tight">{event.name}</h3>

            <div className="mt-4 inline-flex max-w-full items-center gap-3 rounded-xl border border-emerald-400/80 bg-emerald-500/10 px-3.5 py-2.5 shadow-[0_0_14px_rgba(52,211,153,0.55),inset_0_0_12px_rgba(52,211,153,0.2)]">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/90">{verified ? 'Verified' : 'Confirmed'}</div>
                <div className="truncate font-semibold text-emerald-50 [text-shadow:0_0_10px_rgba(52,211,153,0.85)]">{holderName}</div>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <Detail icon={CalendarDays} label="Date" value={formatDate(event.date)} />
              <Detail icon={Clock} label="Time" value={event.time || '—'} />
              <Detail icon={MapPin} label="Venue" value={event.venue || '—'} className="col-span-2" />
              {reg.isTeam && <Detail icon={Users} label="Team" value={reg.teamName || 'Team'} className="col-span-2" />}
            </dl>
          </div>

          {/* Tear line — sits exactly on the notches (91px above the bottom). */}
          <div className="relative mx-5 border-t-2 border-dashed border-white/15" />
          <div className="relative flex h-[89px] items-center justify-between gap-4 px-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-400">
                {reg.isTeam ? `Team of ${reg.teamSize || reg.members?.length || 1}` : 'Admit one'}
              </div>
              <div className="mt-1 font-mono text-lg font-bold tracking-wider text-amber-200">{code}</div>
            </div>
            <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
              {verified ? 'Paid · Verified' : 'Free entry'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Detail({ icon: Icon, label, value, className }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
        <Icon className="h-3 w-3" /> {label}
      </dt>
      <dd className="mt-0.5 truncate font-medium text-neutral-100">{value}</dd>
    </div>
  )
}
```

(The stub is `h-[89px]` and the tear line is 2px, so the line sits at 91px from the bottom of the inner body. That matches `--y: calc(100% - 89px)` on the inner mask, taken relative to the inner box, and `calc(100% - 91px)` on the outer. If the notch looks off by a pixel in the browser, adjust `--y` in CSS, not the markup.)

- [ ] **Step 3: `src/components/tickets/TicketCarousel.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Ticket } from 'lucide-react'
import { TicketCard } from './TicketCard'
import { cn } from '../../lib/cn'

// Swipeable row of event passes (scroll-snap), with arrows on wider screens and
// dots tracking whichever ticket is centred.
export function TicketCarousel({ items, holderName }) {
  const track = useRef(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const el = track.current
    if (!el) return
    const onScroll = () => {
      const mid = el.scrollLeft + el.clientWidth / 2
      let best = 0
      let bestDist = Infinity
      ;[...el.children].forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid)
        if (d < bestDist) { bestDist = d; best = i }
      })
      setActive(best)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [items.length])

  function go(i) {
    const el = track.current
    const card = el?.children[Math.max(0, Math.min(items.length - 1, i))]
    if (!card) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' })
  }

  if (!items.length) return null
  const many = items.length > 1

  return (
    <section className="mt-10" aria-label="My tickets">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Ticket className="h-5 w-5 text-amber-500" /> My tickets
        </h2>
        {many && (
          <div className="hidden gap-1.5 sm:flex">
            <button onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous ticket" className="grid h-9 w-9 place-items-center rounded-full border border-neutral-200 transition-colors hover:border-amber-400 disabled:opacity-30 dark:border-neutral-800">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => go(active + 1)} disabled={active === items.length - 1} aria-label="Next ticket" className="grid h-9 w-9 place-items-center rounded-full border border-neutral-200 transition-colors hover:border-amber-400 disabled:opacity-30 dark:border-neutral-800">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={track}
        className="relative -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map(({ reg, event }) => (
          <div key={reg.id} className="w-[86%] max-w-[380px] shrink-0 snap-center sm:w-[360px]">
            <TicketCard reg={reg} event={event} holderName={holderName} />
          </div>
        ))}
      </div>

      {many && (
        <div className="mt-1 flex justify-center gap-1.5">
          {items.map(({ reg }, i) => (
            <button
              key={reg.id}
              onClick={() => go(i)}
              aria-label={`Ticket ${i + 1}`}
              className={cn('h-1.5 rounded-full transition-all', i === active ? 'w-5 bg-amber-500' : 'w-1.5 bg-neutral-300 dark:bg-neutral-700')}
            />
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: `Dashboard.jsx` — state and derived data**

**(a) Imports:**

```js
import { TicketCarousel } from '../components/tickets/TicketCarousel'
import { ReceiptUploadModal } from '../components/payments/ReceiptUploadModal'
import { paymentState, hasTicket, needsReceipt, PAYMENT_STATE_META } from '../lib/manualPay'
```

Add `Upload` to the `lucide-react` import.

**(b) Registrations hook.** Change `const { regs, refetch: refetchRegs } = useRegistrations()` to:

```js
  const { regs, refetch: refetchRegs, resubmitReceipt } = useRegistrations()
```

**(c) State.** After `const [openMsg, setOpenMsg] = useState(null)`, add:

```js
  // Registration whose receipt the user is (re)uploading: { reg, event }.
  const [uploadFor, setUploadFor] = useState(null)
```

**(d) Tickets.** After the `myEvents` computation, add:

```js
  // Verified (or free) registrations get a ticket in the carousel.
  const ticketItems = myEvents.filter(({ reg }) => hasTicket(reg))
  const memberVerified = !!membership && hasTicket(membership)
  const memState = membership ? paymentState(membership) : null
```

- [ ] **Step 5: `Dashboard.jsx` — render**

**(a) Carousel.** Right after the greeting `</motion.div>`, before `<div className="mt-10 grid gap-6 lg:grid-cols-[320px_1fr]">`, add:

```jsx
        <TicketCarousel items={ticketItems} holderName={displayName} />
```

**(b) Member badge.** Change the member badge condition `{membership && membership.paymentStatus !== 'pending' && (` to `{memberVerified && (`.

**(c) Membership ID text.** Replace the `membership?.membershipId?.trim() ? … : …` expression with:

```jsx
                          {membership?.membershipId?.trim()
                            ? membership.membershipId
                            : memState === 'review'
                              ? 'Your payment is under review — the ID is assigned once it’s verified.'
                              : memState === 'rejected'
                                ? <>Payment rejected{membership.rejectReason ? `: ${membership.rejectReason}` : ''}. <Link to="/membership" className="font-medium text-acm-600 underline dark:text-acm-400">Upload a new receipt</Link></>
                                : memState === 'awaiting'
                                  ? <>Payment pending. <Link to="/membership" className="font-medium text-acm-600 underline dark:text-acm-400">Upload your receipt</Link></>
                                  : 'Will be updated soon.'}
```

**(d) Status badge.** In the registered-event card, replace the status `<Badge …>{reg.status}</Badge>` with:

```jsx
                          {hasTicket(reg) ? (
                            <Badge tone={reg.status === 'Attended' ? 'neutral' : 'green'} dot={reg.status === 'Confirmed'} className="mt-2">
                              {reg.status}
                            </Badge>
                          ) : (
                            <Badge tone={PAYMENT_STATE_META[paymentState(reg)].tone} className="mt-2">
                              {PAYMENT_STATE_META[paymentState(reg)].label}
                            </Badge>
                          )}
```

**(e) Payment strip.** Below the card's `</button>` (before the team-members block), add:

```jsx
                      {!hasTicket(reg) && (
                        <div className={cn(
                          'flex items-center justify-between gap-3 border-t px-3.5 py-2.5 text-xs',
                          paymentState(reg) === 'rejected'
                            ? 'border-rose-100 bg-rose-50/70 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300'
                            : 'border-amber-100 bg-amber-50/70 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
                        )}>
                          <span className="min-w-0">
                            {paymentState(reg) === 'review'
                              ? 'Payment under review — your ticket appears once it’s verified.'
                              : paymentState(reg) === 'rejected'
                                ? `Receipt rejected: ${reg.rejectReason || 'please upload a clearer receipt.'}`
                                : reg.userId === user.id
                                  ? 'Upload your payment receipt to complete registration.'
                                  : 'Waiting for your team leader to upload the payment receipt.'}
                          </span>
                          {needsReceipt(reg) && reg.userId === user.id && (
                            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setUploadFor({ reg, event })}>
                              <Upload className="h-3.5 w-3.5" /> Upload
                            </Button>
                          )}
                        </div>
                      )}
```

**(f) WhatsApp link.** Change `{event.whatsappLink && (` to `{event.whatsappLink && hasTicket(reg) && (`.

**(g) Upload modal.** Before the final `<EventDetailsModal …/>`, add:

```jsx
      <ReceiptUploadModal
        open={!!uploadFor}
        onClose={() => setUploadFor(null)}
        title={uploadFor?.event.name || 'Event'}
        amount={uploadFor ? (uploadFor.reg.amountDue ?? (Number(uploadFor.event.fee) || 0)) : 0}
        upiAccountId={uploadFor?.reg.upiAccountId || uploadFor?.event.upiAccountId || ''}
        note={uploadFor?.event.name}
        rejectReason={uploadFor && paymentState(uploadFor.reg) === 'rejected' ? uploadFor.reg.rejectReason : ''}
        onSubmit={(receipt) => resubmitReceipt(uploadFor.reg, receipt, uploadFor.event)}
      />
```

- [ ] **Step 6: Build**

Run: `npm run build` → `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add src/components/tickets src/index.css src/pages/Dashboard.jsx
git commit -m "feat(dashboard): gold-glow ticket carousel for verified registrations; payment states and re-upload"
```

---

### Task 10: Server-side consistency (dormant `/api`)

**Files:**
- Modify: `api/_lib/grouping.js:64-95,116-133,177-187`
- Modify: `api/register-team.js:107-128`
- Modify: `api/verify-payment.js:45-51`
- Modify: `api/webhook.js:47-56`

**Interfaces:**
- Produces:
  - Random Grouping forms teams only from `paid`/`free` solo registrations, and member entries carry `receiptId`/`utr`.
  - Team registrations carry `amountDue` and `seatHeld`.
  - A Razorpay-paid membership sets `users.acmMember`.

- [ ] **Step 1: `api/_lib/grouping.js`**

**(a)** In `teamDocFromMembers`, replace `const anyPending = …` and the `paymentStatus:` line so that a team is `paid` only when every member settled:

```js
  const allSettled = members.every((m) => ['paid', 'free'].includes(m.paymentStatus))
```

```js
    paymentStatus: fee <= 0 ? 'free' : (allSettled ? 'paid' : 'pending'),
```

**(b)** In the member entry, add `receiptId: m.receiptId || '', utr: m.utr || '',` after `paidAt: m.paidAt || null,`.

**(c)** In `runGroupingForEvent`, replace `const soloDocs = regsSnap.docs.filter((d) => !d.data().isTeam)` with:

```js
  // Only verified (or free) registrants are grouped — an unverified or rejected
  // payment stays solo for an admin to place once it's sorted out.
  const soloDocs = regsSnap.docs.filter((d) => !d.data().isTeam && ['paid', 'free'].includes(d.data().paymentStatus))
```

**(d)** In **both** candidate builders (`runGroupingForEvent` and `formGroupFromRegistrations`), extend the returned object:

```js
        paymentStatus: r.paymentStatus || '', paymentId: r.razorpayPaymentId || r.utr || '', paidAt: r.paidAt || null,
        receiptId: r.receiptId || '', utr: r.utr || '',
```

- [ ] **Step 2: `api/register-team.js`**

In the `reg` object, add after `paymentStatus: fee > 0 ? 'pending' : 'free',`:

```js
      // What the leader owes, and whether this team is holding a capacity slot
      // (released if its payment receipt is rejected).
      amountDue: fee,
      seatHeld: maxTeams > 0,
```

- [ ] **Step 3: `api/verify-payment.js` and `api/webhook.js`**

In `verify-payment.js`, after the `await ref.update({...})` block, add:

```js
    // A paid membership makes them a member — the client can't set this itself.
    if (type === 'membership') {
      await db.collection('users').doc(refId).set({ acmMember: true }, { merge: true })
    }
```

In `webhook.js`, inside `if (snap.exists && snap.get('paymentStatus') !== 'paid') { … }` and after the `await ref.update({...})`, add:

```js
        if (type === 'membership') {
          await adminDb().collection('users').doc(refId).set({ acmMember: true }, { merge: true })
        }
```

- [ ] **Step 4: Syntax-check the server files**

Run: `for f in api/_lib/grouping.js api/register-team.js api/verify-payment.js api/webhook.js; do node --check "$f" || echo "FAIL $f"; done`
Expected: no `FAIL` lines.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/grouping.js api/register-team.js api/verify-payment.js api/webhook.js
git commit -m "feat(api): group only verified registrants; team amountDue/seatHeld; server sets acmMember"
```

---

### Task 11: Storage meter counts receipts and QR images

**Files:**
- Modify: `src/lib/storageBudget.js` (`estimateImageBytes`)
- Modify: `src/components/admin/StorageMeter.jsx`

- [ ] **Step 1: Extend the estimator**

Replace `estimateImageBytes` in `src/lib/storageBudget.js` with:

```js
// Best-effort byte estimate of every inline image across the site. Receipts
// aren't loaded app-wide, so their total arrives pre-summed (`receiptBytes`,
// from a server-side sum of each receipt's stored `bytes`).
export function estimateImageBytes({ gallery = [], events = [], execomGroups = [], upiAccounts = [], receiptBytes = 0 } = {}) {
  let bytes = 0
  for (const g of gallery) bytes += len(g.image)
  for (const e of events) bytes += len(e.poster)
  for (const grp of execomGroups) for (const m of grp.members || []) bytes += len(m.photo)
  for (const a of upiAccounts) bytes += len(a.qrImage)
  return bytes + (Number(receiptBytes) || 0)
}
```

- [ ] **Step 2: Feed it from `StorageMeter`**

In `src/components/admin/StorageMeter.jsx`, change the React import to `import { useEffect, useMemo, useState } from 'react'` and add `import { fetchUpiAccounts, fetchReceiptBytes } from '../../services/payments'`. Inside `StorageMeter`, before the `useMemo`, add:

```js
  // Receipts and QR codes live outside the app-wide data load; fetch their
  // share once. Non-admins can't sum receipts — that part just counts as 0.
  const [extra, setExtra] = useState({ upiAccounts: [], receiptBytes: 0 })
  useEffect(() => {
    let alive = true
    Promise.allSettled([fetchUpiAccounts(), fetchReceiptBytes()]).then(([u, r]) => {
      if (!alive) return
      setExtra({
        upiAccounts: u.status === 'fulfilled' ? u.value || [] : [],
        receiptBytes: r.status === 'fulfilled' ? r.value : 0,
      })
    })
    return () => { alive = false }
  }, [])
```

and change the memo to:

```js
  const { bytes, status, pct } = useMemo(() => {
    const b = estimateImageBytes({ gallery, events, execomGroups, ...extra })
    return { bytes: b, status: storageStatus(b), pct: Math.min(100, (b / STORAGE_BUDGET_BYTES) * 100) }
  }, [gallery, events, execomGroups, extra])
```

- [ ] **Step 3: Build**

Run: `npm run build` → `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/storageBudget.js src/components/admin/StorageMeter.jsx
git commit -m "feat(admin): storage meter includes payment receipts and QR images"
```

---

### Task 12: Emulator dev mode, end-to-end verification, docs

**Files:**
- Modify: `src/lib/firebase.js` (optional emulator connection)
- Modify: `firebase.json` (emulator ports)
- Modify: `package.json` (`dev:emu` script)
- Create: `scripts/e2e-payments.mjs`
- Modify: `PAYMENTS.md`

The new rules aren't deployed to production, and deploying needs the user's go-ahead. So the full flow is verified against local emulators with a Playwright script.

- [ ] **Step 1: Opt-in emulator connection in `src/lib/firebase.js`**

Change the imports to:

```js
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth'
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore'
```

Inside `if (isFirebaseConfigured) { … }`, after `googleProvider.setCustomParameters(...)`, add:

```js
  // Local end-to-end testing: `npm run dev:emu` points the app at the Auth +
  // Firestore emulators so payment flows can be exercised without touching
  // production data. Dev builds only; the test script signs in via the handle.
  if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === '1') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
    window.__acmAuth = auth
  }
```

- [ ] **Step 2: Emulator config and script**

In `firebase.json`, add a top-level key:

```json
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
```

In `package.json` `"scripts"`, add:

```json
    "dev:emu": "VITE_FIREBASE_EMULATORS=1 VITE_FIREBASE_PROJECT_ID=demo-acm-e2e vite --port 5174",
    "test:e2e": "firebase emulators:exec --only auth,firestore --project demo-acm-e2e \"node scripts/e2e-payments.mjs\"",
```

`VITE_FIREBASE_PROJECT_ID` overrides `.env`, so the app and the emulator agree on the `demo-` project ID. The other `.env` values only need to be non-empty.

- [ ] **Step 3: Write `scripts/e2e-payments.mjs`**

```js
// End-to-end check of the manual payment flow against the local emulators.
//   npm run test:e2e   (starts auth+firestore emulators, then runs this)
// It boots `npm run dev:emu`, seeds data with rules disabled, and drives the
// real UI in Chromium as a payer and as an admin.
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc } from 'firebase/firestore'

const BASE = 'http://localhost:5174'
const PROJECT = 'demo-acm-e2e'
const AUTH = 'http://127.0.0.1:9099'
// 1×1 white PNG — stands in for a payment screenshot.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64')

const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`) }

async function signUp(email) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'secret123', returnSecureToken: true }),
  })
  return (await r.json()).localId
}

async function waitFor(url, ms = 30000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`timeout waiting for ${url}`)
}

async function signIn(page, email) {
  await page.goto(`${BASE}/`)
  await page.waitForFunction(() => !!window.__acmAuth)
  await page.evaluate(async ({ email }) => {
    const { signInWithEmailAndPassword } = await import('/node_modules/.vite/deps/firebase_auth.js')
    await signInWithEmailAndPassword(window.__acmAuth, email, 'secret123')
  }, { email })
}

const vite = spawn('npm', ['run', 'dev:emu'], { stdio: 'ignore', detached: true })
try {
  await waitFor(BASE)

  const env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
  const adminUid = await signUp('admin@e2e.test')
  const payerUid = await signUp('payer@e2e.test')
  const profile = (name, extra = {}) => ({
    name, googleName: name, email: '', phone: '9876543210', phoneVerified: true, department: 'Computer Science & Engineering',
    year: '3rd Year', college: 'TKM College of Engineering', gender: 'Female', acmMember: false, role: 'user', permissions: {}, ...extra,
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, `users/${adminUid}`), profile('Admin One', { email: 'admin@e2e.test', role: 'admin' }))
    await setDoc(doc(db, `users/${payerUid}`), profile('Payer Two', { email: 'payer@e2e.test' }))
    await setDoc(doc(db, 'upiAccounts/main'), { label: 'ACM Main', payeeName: 'ACM TKMCE', upiId: 'acm@okicici', qrImage: `data:image/png;base64,${PNG.toString('base64')}`, active: true })
    await setDoc(doc(db, 'siteContent/main'), { defaultUpiAccountId: 'main', membershipFee: 100 })
    const opens = new Date(Date.now() - 864e5).toISOString().slice(0, 16)
    const closes = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 16)
    await setDoc(doc(db, 'events/ev1'), {
      name: 'E2E Hack', date: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10), time: '10:00 AM', venue: 'Main Hall',
      shortDescription: 'Test', description: '', status: 'open', fee: 200, acmDiscount: 0, maxRegistrations: 5, registeredCount: 0,
      regOpens: opens, regCloses: closes, whatsappLink: 'https://chat.whatsapp.com/test', poster: '',
    })
  })

  const browser = await chromium.launch()
  const payer = await browser.newPage()

  // ── Payer registers with a receipt ─────────────────────────
  await signIn(payer, 'payer@e2e.test')
  await payer.goto(`${BASE}/events`)
  await payer.getByText('E2E Hack').first().click()
  await payer.getByRole('button', { name: /register/i }).first().click()
  await payer.getByRole('button', { name: /continue/i }).click() // details
  await payer.getByRole('button', { name: /continue/i }).click() // eligibility
  check('payment step shows the QR account', await payer.getByText('acm@okicici').isVisible())
  await payer.locator('input[type=file]').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PNG })
  await payer.getByLabel(/UPI transaction ID/i).fill('4123 4567 8901')
  await payer.getByRole('button', { name: /continue/i }).click()
  await payer.getByLabel(/agree/i).check()
  await payer.getByRole('button', { name: /submit registration & receipt/i }).click()
  check('success screen says receipt submitted', await payer.getByText('Receipt submitted').isVisible({ timeout: 10000 }).catch(() => false))

  const snapCount = async () => env.withSecurityRulesDisabled(async (ctx) => (await getDoc(doc(ctx.firestore(), 'events/ev1'))).data().registeredCount)
  check('seat taken on submit', (await snapCount()) === 1, `count=${await snapCount()}`)

  await payer.goto(`${BASE}/dashboard`)
  check('dashboard shows Under review', await payer.getByText('Under review').first().isVisible())
  check('no ticket yet', !(await payer.getByText('My tickets').isVisible()))

  // ── Admin rejects ───────────────────────────────────────────
  const admin = await browser.newPage()
  await signIn(admin, 'admin@e2e.test')
  await admin.goto(`${BASE}/admin`)
  await admin.getByRole('button', { name: /verify payments/i }).click()
  await admin.getByText('Payer Two').first().click()
  await admin.getByRole('button', { name: /reject…/i }).click()
  await admin.getByPlaceholder(/why\?/i).fill('Screenshot unreadable')
  await admin.getByRole('button', { name: /^reject$/i }).click()
  await admin.waitForTimeout(1500)
  check('seat released on reject', (await snapCount()) === 0, `count=${await snapCount()}`)

  // ── Payer re-uploads ────────────────────────────────────────
  await payer.reload()
  check('dashboard shows rejection reason', await payer.getByText(/Screenshot unreadable/).isVisible())
  await payer.getByRole('button', { name: /^upload$/i }).click()
  await payer.locator('input[type=file]').setInputFiles({ name: 'receipt2.png', mimeType: 'image/png', buffer: PNG })
  await payer.getByLabel(/UPI transaction ID/i).fill('412345678901')
  await payer.getByRole('button', { name: /submit receipt/i }).click()
  await payer.waitForTimeout(1500)
  check('seat re-taken on resubmit', (await snapCount()) === 1, `count=${await snapCount()}`)

  // ── Admin approves ──────────────────────────────────────────
  await admin.reload()
  await admin.getByRole('button', { name: /verify payments/i }).click()
  await admin.getByText('Payer Two').first().click()
  await admin.getByRole('button', { name: /approve payment/i }).click()
  await admin.waitForTimeout(1500)

  await payer.reload()
  check('ticket carousel appears', await payer.getByText('My tickets').isVisible())
  check('ticket shows Verified + name', await payer.getByText('Paid · Verified').isVisible())
  check('WhatsApp link revealed', await payer.getByText('Event WhatsApp group').isVisible())

  // ── Membership ──────────────────────────────────────────────
  await payer.goto(`${BASE}/membership`)
  await payer.getByLabel('First name').fill('Payer')
  await payer.getByLabel('Last name').fill('Two')
  await payer.locator('input[type=file]').setInputFiles({ name: 'm.png', mimeType: 'image/png', buffer: PNG })
  await payer.getByLabel(/UPI transaction ID/i).fill('412345678901')
  await payer.getByRole('button', { name: /submit application & receipt/i }).click()
  check('reused UTR rejected with a clear message', await payer.getByText(/already submitted this transaction ID/i).isVisible({ timeout: 8000 }).catch(() => false))
  await payer.getByLabel(/UPI transaction ID/i).fill('998877665544')
  await payer.getByRole('button', { name: /submit application & receipt/i }).click()
  check('membership under review', await payer.getByText(/under review/i).first().isVisible({ timeout: 8000 }).catch(() => false))

  await admin.reload()
  await admin.getByRole('button', { name: /verify payments/i }).click()
  await admin.getByText('Payer Two').first().click()
  await admin.getByRole('button', { name: /approve payment/i }).click()
  await admin.waitForTimeout(1500)
  const acm = await env.withSecurityRulesDisabled(async (ctx) => (await getDoc(doc(ctx.firestore(), `users/${payerUid}`))).data().acmMember)
  check('membership approval sets acmMember', acm === true)

  await browser.close()
  await env.cleanup()
} finally {
  try { process.kill(-vite.pid) } catch { /* already gone */ }
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
```

Notes for the executor:
- Selectors must match the real UI text. If a check fails because of a selector, not behaviour, fix the selector in the script, never the app.
- The dynamic-import path `/node_modules/.vite/deps/firebase_auth.js` is Vite's pre-bundled dep. If it differs, expose `signInWithEmailAndPassword` next to `window.__acmAuth` in `firebase.js` (emulator mode only) instead.
- The event's Register button and the steps may need an extra click if the details modal differs. Adjust the selectors to match what's on screen.

- [ ] **Step 4: Run all automated checks**

Run each command and confirm the expected result:
1. `npm test` → PASS
2. `npm run test:rules` → PASS
3. `npm run build` → `✓ built`
4. `npm run test:e2e` → `N/N checks passed`

- [ ] **Step 5: Visual check of the ticket**

With `npm run test:e2e` adapted, or with the emulators running manually, take a Playwright screenshot of `/dashboard` for the verified payer in light and dark mode. Check that:
- the notches line up with the dashed tear line
- the gold glow is visible
- the neon box is legible
- the layout works at 390px width

Adjust `--y` in `index.css` if the notch is off.

- [ ] **Step 6: Document the manual mode in `PAYMENTS.md`**

Add at the top, under the title:

```markdown
## Current mode: manual UPI verification

`PAYMENT_MODE` in `src/lib/payments.js` is `'manual'`:

1. **Admin → Payments:** add one or more UPI/QR accounts (QR image + UPI ID). The first one is the ★ default. Set the membership fee and the account it's collected to.
2. **Admin → Events → (event):** with a fee, pick "Collect payment to" (default, another account, or "+ Add new QR account…").
3. **Payers:** pay to the QR shown in the registration or membership form, then upload the screenshot and the 12-digit UPI transaction ID (UTR). Each UTR can be used once.
4. **Admin → Verify payments** (admins; editors with the Registrations or Membership grant): open a receipt, check the UTR and amount against the account statement, then Approve or Reject with a reason.
   - Approving issues the ticket (dashboard carousel and WhatsApp link) or makes them a member.
   - Rejecting frees the seat and the UTR, and the payer can upload again.

The rules enforcing all of this are in `firestore.rules` and must be deployed (`firebase deploy --only firestore:rules`) for the live site to accept receipts.

Tests:
- `npm test`: pure helpers
- `npm run test:rules`: security rules on the emulator
- `npm run test:e2e`: the full flow in a browser against the emulators

To switch back to Razorpay once it's approved: set `PAYMENT_MODE = 'razorpay'` and follow the Razorpay sections below.
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/firebase.js firebase.json package.json scripts/e2e-payments.mjs PAYMENTS.md
git commit -m "test(payments): emulator dev mode + end-to-end payment flow; document manual mode"
```

---

## After the plan

- Before any `firebase deploy --only firestore:rules`, **ask the user**. Deploying is outward-facing, and it must use the account in memory (`michaelharoldsony.02.02.2006@gmail.com` for project `acm-33a08`).
- The live site needs the new rules deployed **and** a new front-end build deployed, or receipts are rejected by the old rules.

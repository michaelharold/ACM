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

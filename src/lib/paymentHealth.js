// Detects payment records that need a human to check the Razorpay dashboard.
//
// The risky case (task 14): a member starts checkout, Razorpay CAPTURES the
// money, but the tab is closed before /api/verify-payment finishes — and if the
// webhook isn't configured, the record is left 'pending' forever even though the
// user may have actually paid. We can't know from the client whether money moved,
// so we surface these so an admin can reconcile them against Razorpay.

const STALE_MS = 15 * 60 * 1000 // a pending payment older than this is suspicious

function toMillis(c) {
  if (!c) return 0
  if (typeof c === 'string') { const t = Date.parse(c); return Number.isNaN(t) ? 0 : t }
  if (typeof c.toDate === 'function') return c.toDate().getTime()
  if (typeof c.seconds === 'number') return c.seconds * 1000
  return 0
}

// True when a record's payment is stuck 'pending' in a way that warrants a check.
export function paymentNeedsCheck(rec, now = Date.now()) {
  if ((rec?.paymentStatus || '').toLowerCase() !== 'pending') return false
  // A Razorpay order/payment id on a still-pending record is the strongest
  // signal: checkout was reached (and possibly captured) but never confirmed.
  if (rec.razorpayOrderId || rec.razorpayPaymentId) return true
  const created = toMillis(rec.createdAt)
  if (!created) return true // unknown age — surface it rather than hide it
  return now - created > STALE_MS
}

export function countPaymentChecks(records = []) {
  const now = Date.now()
  return records.reduce((n, r) => n + (paymentNeedsCheck(r, now) ? 1 : 0), 0)
}

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

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'
let scriptPromise = null

function loadCheckout() {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = CHECKOUT_SRC
      s.onload = () => resolve()
      s.onerror = () => { scriptPromise = null; reject(new Error('Could not load the payment gateway. Check your connection and try again.')) }
      document.body.appendChild(s)
    })
  }
  return scriptPromise
}

// Checks a claimed ACM membership id against the database for a given event, and
// returns the price a valid member would pay:
//   { valid, alreadyUsed, memberName, fee, discount, effectiveFee }
// Requires the backend (only meaningful when isPaymentConfigured).
export async function validateMembership({ eventId, membershipId }) {
  const token = await idToken()
  return post('/api/validate-membership', { eventId, membershipId }, token)
}

// Registers a TEAM for a group event. The server validates every teammate email
// against real accounts and creates one registration for the whole team.
// Resolves with { id, paymentStatus }; rejects with a readable error otherwise.
export async function registerTeam({ eventId, teamName, teammates }) {
  const token = await idToken()
  return post('/api/register-team', { eventId, teamName, teammates }, token)
}

// Runs the full secure payment for an event registration (type 'event', refId =
// registration id) or a membership (type 'membership', refId = uid).
//
// Resolves with a status the caller can act on:
//   { status: 'paid' }                       — verified and recorded
//   { status: 'pending_confirmation', paymentId } — Razorpay CAPTURED the money
//        but our confirmation call didn't complete; the record stays pending and
//        the server-side webhook finalises it. Crucially this is NOT a failure —
//        the user WAS charged, so we must never tell them the payment failed.
// Rejects only when no money was taken (user cancelled, or the payment failed).
export async function payFor({ type, refId, prefill = {} }) {
  const token = await idToken()
  const order = await post('/api/create-order', { type, refId }, token)
  // Already settled server-side (idempotency / webhook won the race) — don't
  // open checkout again, so the user can't be double-charged.
  if (order.alreadyPaid) return { status: 'paid' }
  await loadCheckout()

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: 'ACM TKMCE Student Chapter',
      description: order.description,
      prefill: { name: prefill.name || '', email: prefill.email || '', contact: prefill.contact || '' },
      theme: { color: '#1f47f5' },
      handler: async (resp) => {
        // Reaching here means Razorpay captured the payment. From this point the
        // money is taken — a verify hiccup must degrade to "confirming", never
        // to "failed".
        try {
          await post('/api/verify-payment', {
            type,
            refId,
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          }, token)
          resolve({ status: 'paid', paymentId: resp.razorpay_payment_id })
        } catch {
          resolve({ status: 'pending_confirmation', paymentId: resp.razorpay_payment_id })
        }
      },
      modal: { ondismiss: () => reject(new Error('Payment was cancelled.')) },
    })
    rzp.on('payment.failed', (r) => reject(new Error(r?.error?.description || 'Payment failed. You were not charged.')))
    rzp.open()
  })
}

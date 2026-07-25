// Client side of the Razorpay flow. It never sees the secret key: it asks our
// own /api to create an order, opens Razorpay's hosted checkout, and hands the
// result back to /api to verify. If payments aren't configured (no public key
// in the env) the whole feature stays dormant and the site behaves exactly as
// it did before — same graceful-degradation approach as the rest of the app.
import { auth } from './firebase'

// The publishable key id is safe to expose; its presence is our on/off switch.
export const isPaymentConfigured = !!import.meta.env.VITE_RAZORPAY_KEY_ID

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

async function idToken() {
  const u = auth?.currentUser
  if (!u) throw new Error('Please sign in to pay.')
  return u.getIdToken()
}

async function post(path, payload, token) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Payment request failed.')
  return data
}

// Runs the full secure payment for an event registration (type 'event', refId =
// registration id) or a membership (type 'membership', refId = uid). Resolves
// once the server has VERIFIED and recorded the payment; rejects on cancel or
// failure. The caller can trust a resolve to mean money actually moved.
export async function payFor({ type, refId, prefill = {} }) {
  const token = await idToken()
  const order = await post('/api/create-order', { type, refId }, token)
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
        try {
          await post('/api/verify-payment', {
            type,
            refId,
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          }, token)
          resolve({ paid: true })
        } catch (e) {
          reject(e)
        }
      },
      modal: { ondismiss: () => reject(new Error('Payment was cancelled.')) },
    })
    rzp.on('payment.failed', (r) => reject(new Error(r?.error?.description || 'Payment failed. You were not charged.')))
    rzp.open()
  })
}

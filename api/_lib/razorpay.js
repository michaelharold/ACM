// Razorpay client + signature checks. The key SECRET lives only in the server
// environment; it is used to create orders and to prove that a payment callback
// (or webhook) genuinely came from Razorpay and was not forged by a client.
import Razorpay from 'razorpay'
import crypto from 'node:crypto'

export function razorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID
  const key_secret = process.env.RAZORPAY_KEY_SECRET
  if (!key_id || !key_secret) throw new Error('Razorpay keys are not set')
  return new Razorpay({ key_id, key_secret })
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

// Checkout callback signature: HMAC_SHA256("<order_id>|<payment_id>", secret).
// If this doesn't match, the payment result cannot be trusted and must be
// rejected — this is the whole security guarantee of the flow.
export function isValidPaymentSignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${orderId}|${paymentId}`)
    .digest('hex')
  return safeEqual(expected, signature || '')
}

// Razorpay client factory + signature checks. Secrets are supplied by the
// caller (resolved per payment account from the server env — see accounts.js);
// they are never hard-coded or read from Firestore.
import Razorpay from 'razorpay'
import crypto from 'node:crypto'

export function razorpayWith(keyId, keySecret) {
  if (!keyId || !keySecret) throw new Error('Razorpay keys are not set')
  return new Razorpay({ key_id: keyId, key_secret: keySecret })
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

// Checkout callback signature: HMAC_SHA256("<order_id>|<payment_id>", secret).
// A mismatch means the result can't be trusted and must be rejected — this is
// the whole security guarantee of the client flow.
export function isValidPaymentSignature({ orderId, paymentId, signature, secret }) {
  const expected = crypto
    .createHmac('sha256', secret || '')
    .update(`${orderId}|${paymentId}`)
    .digest('hex')
  return safeEqual(expected, signature || '')
}

// Webhook signature: HMAC_SHA256(rawBody, webhookSecret). Returns true if the
// body verifies against ANY of the provided secrets (one per configured
// account), so a single endpoint can serve every account.
export function webhookSignatureMatches(rawBody, signature, secrets = []) {
  for (const secret of secrets) {
    if (!secret) continue
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    if (safeEqual(expected, signature || '')) return true
  }
  return false
}

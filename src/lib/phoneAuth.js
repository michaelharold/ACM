// Phone-number verification, kept OPTIONAL and free-by-default — the same
// graceful-degradation approach as payments and Storage.
//
//   • Default (VITE_PHONE_OTP_ENABLED unset): no SMS is sent. A valid 10-digit
//     number is accepted and treated as verified, so the site stays entirely on
//     Firebase's free plan with zero SMS cost.
//   • Enabled (VITE_PHONE_OTP_ENABLED=1, after turning on the Phone provider in
//     the Firebase console): a real OTP is sent via Firebase Phone Auth and the
//     number is only marked verified once the code checks out.
//
// Verification links the phone credential to the already signed-in Google
// account, which both proves possession of the number and never disturbs the
// Google session.
import { auth } from './firebase'
import { RecaptchaVerifier, linkWithPhoneNumber, unlink } from 'firebase/auth'

export const isPhoneOtpEnabled = import.meta.env.VITE_PHONE_OTP_ENABLED === '1'

// Normalise to E.164 for India (+91). Accepts '9876543210' or '+91 98765 43210'.
export function toE164(phone) {
  const digits = String(phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '')
  return /^\d{10}$/.test(digits) ? `+91${digits}` : ''
}

let verifier = null
function recaptcha(containerId) {
  if (verifier) return verifier
  verifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' })
  return verifier
}
export function clearRecaptcha() {
  try { verifier?.clear() } catch { /* already gone */ }
  verifier = null
}

// Send an OTP to `phone`. Returns a confirmation whose .confirm(code) resolves
// on the right code and rejects on a wrong one. Re-verifying a different number
// first unlinks any previously linked phone so linking can't collide.
export async function sendPhoneOtp(phone, containerId) {
  const e164 = toE164(phone)
  if (!e164) throw new Error('Enter a valid 10-digit phone number.')
  if (auth.currentUser?.providerData?.some((p) => p.providerId === 'phone')) {
    try { await unlink(auth.currentUser, 'phone') } catch { /* nothing linked */ }
  }
  return linkWithPhoneNumber(auth.currentUser, e164, recaptcha(containerId))
}

export async function confirmPhoneOtp(confirmation, code) {
  await confirmation.confirm(code)
  return true
}

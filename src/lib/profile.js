// A single definition of "profile complete", shared by the dashboard and the
// event-registration gate. Only a complete profile may register for an event,
// so the organiser always has a usable name, email, phone, department and year.
//
// A valid Indian mobile number is exactly 10 digits (once any +91 / spaces are
// stripped). Phone OTP verification (phoneVerified) is layered on top later.
export function isValidPhone(phone) {
  return /^\d{10}$/.test(String(phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''))
}

export function isProfileComplete(user) {
  return !!(
    user &&
    user.name &&
    user.email &&
    user.phone &&
    isValidPhone(user.phone) &&
    user.phoneVerified &&
    user.department &&
    user.year
  )
}

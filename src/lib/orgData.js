// Shared campus reference data so the dashboard, membership and admin screens
// all offer the exact same department/year options.
export const departments = [
  'Computer Science & Engineering',
  'Computer Science & Engineering (AI)',
  'Electronics & Communication Engineering',
  'Electrical & Electronics Engineering',
  'Electrical & Computer Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Architecture',
]

export const years = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Alumni']

export const genders = ['Male', 'Female', 'Other', 'Rather not say']

// The chapter's own college — the canonical value the profile's College field
// writes when a member picks it from the dropdown (rather than "Other").
export const TKM_COLLEGE = 'TKM College Of Engineering, Kollam'

// Older profiles/registrations stored a free-typed "TKM College of Engineering"
// (no ", Kollam", different case) before the dropdown existed — treat anything
// starting with that phrase as TKM too, so nobody who already set it correctly
// gets silently reclassified as "Other" once eligibility checks start using this.
export function isTkmCollege(college) {
  return /^tkm\s*college\s*of\s*engineering\b/i.test(String(college || '').trim())
}

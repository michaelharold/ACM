// Server-side mirror of src/lib/orgData.js's isTkmCollege — kept separate
// (not imported from src/) to match how the rest of api/_lib is self-contained.
// Anything starting with "TKM College of/Of Engineering" counts as TKM,
// regardless of the ", Kollam" suffix or capitalization — see the client copy
// for why (older profiles predate the dropdown that writes the exact phrase).
export function isTkmCollege(college) {
  return /^tkm\s*college\s*of\s*engineering\b/i.test(String(college || '').trim())
}

// The chapter's roster of members who joined before the website existed —
// membership ID + email (+ optional name) — uploaded by an admin as a Word
// document and used to verify "Already a member?" requests automatically.
// Pure helpers (no Firebase), so they run under plain `node --test`
// (tests/unit/memberRoster.test.mjs).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// One canonical form for a membership ID, used both as the roster document id
// and to compare what a member types with what the roster holds: case,
// spacing and punctuation other than . _ - never decide a match.
export function normalizeMemberId(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9._-]/g, '')
}

// A normalized ID that can safely be a Firestore document id.
export function isUsableMemberId(value) {
  const id = normalizeMemberId(value)
  return id.length > 0 && id.length <= 64 && /[A-Z0-9]/.test(id)
}

export const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase()
export const isEmail = (value) => EMAIL_RE.test(normalizeEmail(value))

// "someone@tkmce.ac.in" → "so•••@tkmce.ac.in" — enough for an admin to spot a
// mismatch at a glance without the panel reading like a mailing list.
export function maskEmail(value) {
  const e = normalizeEmail(value)
  const at = e.indexOf('@')
  if (at < 1) return e
  return `${e.slice(0, Math.min(2, at))}•••${e.slice(at)}`
}

const HEADER_ID = /member(ship)?\s*(id|no|number|#)|^id$|^acm\s*id$/i
const HEADER_EMAIL = /e-?mail/i
const HEADER_NAME = /name/i

// Finds the ID / email / name columns from a header row, or null if the row
// isn't a header.
function headerColumns(row) {
  const cells = row.map((c) => String(c ?? '').trim())
  const email = cells.findIndex((c) => HEADER_EMAIL.test(c) && !isEmail(c))
  const id = cells.findIndex((c) => HEADER_ID.test(c))
  if (email < 0 || id < 0) return null
  const name = cells.findIndex((c, i) => i !== id && i !== email && HEADER_NAME.test(c))
  return { id, email, name }
}

// A row without a header to go by: the email is whichever cell looks like one,
// the ID is the first remaining cell containing a digit, and anything else is
// taken as the name.
function guessCells(cells) {
  const email = cells.find((c) => isEmail(c)) || ''
  const rest = cells.filter((c) => c && c !== email)
  const id = rest.find((c) => /\d/.test(c) && c.length <= 40 && c.split(' ').length <= 3) || ''
  const name = rest.filter((c) => c !== id).join(' ').trim()
  return { id, email, name }
}

// The template's sample rows use example.com addresses; they're skipped so a
// forgotten sample never becomes a real roster entry.
const isSampleEmail = (email) => /@example\.(com|org|net)$/i.test(normalizeEmail(email))

// Turns table rows (arrays of cell text) into roster entries. Rows before the
// header, blank rows and instruction lines are skipped quietly; rows that look
// like data but lack a usable ID or email are reported back to the admin.
// Duplicate IDs keep the last row, so a corrected re-upload wins.
export function parseRosterRows(rows) {
  const byId = new Map()
  const skipped = []
  let cols = null
  ;(rows || []).forEach((raw, index) => {
    const cells = (raw || []).map((c) => String(c ?? '').replace(/\s+/g, ' ').trim())
    if (!cells.some(Boolean)) return
    const header = headerColumns(cells)
    if (header) { cols = header; return }
    const picked = cols
      ? { id: cells[cols.id] || '', email: cells[cols.email] || '', name: cols.name >= 0 ? cells[cols.name] || '' : '' }
      : guessCells(cells)
    const looksLikeData = !!picked.email || isEmail(cells.join(' ')) || (!!picked.id && cells.length > 1)
    if (!looksLikeData || isSampleEmail(picked.email)) return
    const line = index + 1
    if (!isUsableMemberId(picked.id)) { skipped.push({ line, text: cells.join(' | '), reason: 'No usable membership ID' }); return }
    if (!isEmail(picked.email)) { skipped.push({ line, text: cells.join(' | '), reason: 'No valid email address' }); return }
    const membershipId = picked.id.replace(/\s+/g, '')
    byId.set(normalizeMemberId(membershipId), {
      rosterId: normalizeMemberId(membershipId),
      membershipId,
      email: normalizeEmail(picked.email),
      name: picked.name,
    })
  })
  return { entries: [...byId.values()], skipped }
}

// Plain text (a pasted list or a .csv/.txt export): one member per line, cells
// separated by a comma, semicolon, tab or pipe.
export function textToRows(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.split(/[,;\t|]/).map((c) => c.replace(/^"|"$/g, '').trim()))
}

// How a verification request compares with the roster entry for its ID:
//   'match'           ID and email both match — safe to approve automatically
//   'email-mismatch'  the ID is on the roster under a different email
//   'not-found'       the ID isn't on the roster
export function rosterVerdict(entry, email) {
  if (!entry) return 'not-found'
  return normalizeEmail(entry.email) === normalizeEmail(email) ? 'match' : 'email-mismatch'
}

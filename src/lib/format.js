// Formats an ISO date string (YYYY-MM-DD) as e.g. "22 Aug 2025".
export function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateLong(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

// A link typed as "www.site.com/x" (no scheme) is otherwise treated by the
// browser as a same-site relative path, so the external button silently goes
// nowhere. Prepend https:// unless a scheme (or protocol-relative //) is present.
export function normalizeUrl(url) {
  const u = (url || '').trim()
  if (!u) return ''
  if (/^([a-z][\w+.-]*:|\/\/)/i.test(u)) return u
  return `https://${u}`
}

// Convert a stored event time ('2:30 PM' or a bare '14:30') into the 24-hour
// 'HH:MM' a <input type="time"> needs. Returns '' when it can't be parsed.
export function to24h(value) {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(value || '')
  if (!m) return ''
  let h = parseInt(m[1], 10)
  if (m[3]) {
    if (/pm/i.test(m[3]) && h < 12) h += 12
    if (/am/i.test(m[3]) && h === 12) h = 0
  }
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

// Convert a 24-hour 'HH:MM' (from <input type="time">) into a friendly
// '2:30 PM' for storage + display. Returns '' for empty input.
export function to12h(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value || '')
  if (!m) return ''
  let h = parseInt(m[1], 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m[2]} ${ampm}`
}

// Combine a date ('YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm') into a readable label.
export function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

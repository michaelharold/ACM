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

// Combine a date ('YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm') into a readable label.
export function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

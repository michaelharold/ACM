// Admin datetime-local inputs (regOpens / regCloses / groupingAt) are saved as
// naive "YYYY-MM-DDTHH:mm" strings with no timezone marker — the admin's own
// browser timezone. Read back in a browser (src/lib/eventClock.js), that's
// correct, because the visitor's browser applies the same local-timezone
// interpretation the admin used when typing it. But Vercel's serverless
// functions run in UTC, so the identical string parsed there — e.g. by the
// grouping cron — lands 5.5h off from what the admin actually meant (this
// chapter operates in India, UTC+5:30), silently pushing "due" checks later
// than intended. Force the IST offset onto any naive string before parsing
// server-side, so cron/admin due-time checks agree with the admin's clock.
export function parseSiteDateTime(value) {
  if (!value) return null
  // Already carries a timezone marker (Z or ±HH:mm) — trust it as-is.
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) return new Date(value)
  return new Date(`${value}+05:30`)
}

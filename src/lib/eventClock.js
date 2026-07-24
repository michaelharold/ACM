import { useEffect, useState } from 'react'

// Events are considered live for this long after their start time.
export const LIVE_WINDOW_MS = 12 * 60 * 60 * 1000

// Combine event.date ('YYYY-MM-DD') and event.time ('10:00 AM') into a Date.
export function eventStart(event) {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(event.time || '')
  let h = m ? parseInt(m[1], 10) : 9
  const min = m ? parseInt(m[2], 10) : 0
  if (m && m[3]) {
    if (/pm/i.test(m[3]) && h < 12) h += 12
    if (/am/i.test(m[3]) && h === 12) h = 0
  }
  const d = new Date(`${event.date}T00:00:00`)
  d.setHours(h, min, 0, 0)
  return d
}

const pad = (n) => String(n).padStart(2, '0')

// Registration state derived from the registration window (start → end date/time)
// set on the event. When both ends are set, the badge on the events page flips
// automatically: Coming Soon before it opens → Open during → Closed after.
// If no window is configured the manually-set event.status is used as a fallback,
// so older events keep working exactly as before.
export function registrationStatus(event, now = Date.now()) {
  const opens = event?.regOpens ? new Date(event.regOpens).getTime() : null
  const closes = event?.regCloses ? new Date(event.regCloses).getTime() : null
  const hasWindow = !Number.isNaN(opens) && opens != null || (!Number.isNaN(closes) && closes != null)
  if (!hasWindow) return event?.status || 'coming-soon'
  if (opens != null && !Number.isNaN(opens) && now < opens) return 'coming-soon'
  if (closes != null && !Number.isNaN(closes) && now > closes) return 'closed'
  return 'open'
}

// True when the event carries an automatic registration window.
export function hasRegWindow(event) {
  return !!(event?.regOpens || event?.regCloses)
}

// Ticking clock for an event card: countdown until start, live flag afterwards.
export function useEventClock(event) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const start = eventStart(event).getTime()
  const diff = start - now
  const isLive = diff <= 0 && now - start < LIVE_WINDOW_MS

  let countdown = null
  if (diff > 0) {
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    countdown = d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`
  }

  return { isLive, countdown }
}

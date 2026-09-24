// What a registrant may see for an event, and where each of their
// registrations belongs on the dashboard. Pure helpers (no Firebase), so they
// run under plain `node --test` (tests/unit/eventAccess.test.mjs).
import { isEnded } from './eventClock.js'
import { normalizeUrl } from './format.js'

// The event's WhatsApp invite link as a clickable URL — or '' when there is
// none or an admin has hidden it. A hidden link is also moved out of the public
// event document (services/firestore.js), so this is the UI half of the rule:
// with the link hidden, nothing about it renders anywhere.
export function whatsappLinkFor(event) {
  if (!event || event.whatsappHidden) return ''
  return normalizeUrl(event.whatsappLink)
}

// An admin can hide an event's payment QR (e.g. while switching accounts).
// Payers then see a "payments paused" notice instead of the QR.
export const isQrHidden = (event) => !!event?.qrHidden

// A registration stays active (ticket carousel, "Registered events") until its
// event ends; after that it moves to Events History. A registration whose event
// no longer exists (deleted by an admin) can't be upcoming, so it's history too.
export function isHistory(event, now = Date.now()) {
  if (!event || event.missing) return true
  if (!event.date) return false
  return isEnded(event, now)
}

// Splits [{ reg, event }] into { active, history }. History is newest first;
// active keeps the soonest event first.
export function splitByEventEnd(items, now = Date.now()) {
  const active = []
  const history = []
  for (const it of items || []) (isHistory(it.event, now) ? history : active).push(it)
  const when = (it) => String(it.event?.date || '')
  active.sort((a, b) => when(a).localeCompare(when(b)))
  history.sort((a, b) => when(b).localeCompare(when(a)))
  return { active, history }
}

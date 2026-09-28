// Attendee engagement: star ratings for events people took part in, and
// "notify me when registration opens" alerts for upcoming events. Security
// rules decide who may rate (ticket holders only) and who may read/send
// alerts (event editors). Mock mode keeps everything in localStorage.
import { collection, doc, getDocs, setDoc, deleteDoc, query, where, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import { sendAdminMessage } from './firestore'

const readLocal = (key) => {
  try { return JSON.parse(localStorage.getItem(key)) || [] } catch { return [] }
}
const writeLocal = (key, rows) => {
  try { localStorage.setItem(key, JSON.stringify(rows)) } catch { /* quota */ }
}
const RATINGS = 'acm-event-ratings'
const ALERTS = 'acm-event-alerts'
const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))

// ── Ratings ──────────────────────────────────────────────────
export const RATING_LABELS = ['Not great', 'Okay', 'Good', 'Great', 'Loved it']

// { [eventId]: rating } for one person.
export async function fetchMyRatings(uid) {
  if (!uid) return {}
  const list = isFirebaseConfigured
    ? rows(await getDocs(query(collection(db, 'eventRatings'), where('userId', '==', uid))))
    : readLocal(RATINGS).filter((r) => r.userId === uid)
  return Object.fromEntries(list.map((r) => [r.eventId, r.rating]))
}

export async function rateEvent({ uid, event, reg, rating }) {
  const value = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)))
  const data = { eventId: event.id, eventName: event.name || '', userId: uid, registrationId: reg.id, rating: value }
  if (!isFirebaseConfigured) {
    writeLocal(RATINGS, [...readLocal(RATINGS).filter((r) => !(r.userId === uid && r.eventId === event.id)), data])
    return value
  }
  await setDoc(doc(db, 'eventRatings', `${event.id}_${uid}`), { ...data, updatedAt: serverTimestamp() })
  return value
}

// Every rating (event editors / registration managers / admins).
export async function fetchAllRatings() {
  if (!isFirebaseConfigured) return readLocal(RATINGS)
  return rows(await getDocs(collection(db, 'eventRatings')))
}

// ── Registration alerts ──────────────────────────────────────
// Set of event ids this person asked to hear about.
export async function fetchMyAlerts(uid) {
  if (!uid) return new Set()
  const list = isFirebaseConfigured
    ? rows(await getDocs(query(collection(db, 'eventAlerts'), where('userId', '==', uid))))
    : readLocal(ALERTS).filter((a) => a.userId === uid)
  return new Set(list.map((a) => a.eventId))
}

export async function setEventAlert({ user, event, on }) {
  const id = `${event.id}_${user.id}`
  const data = { eventId: event.id, userId: user.id, userName: user.name || '', userEmail: user.email || '' }
  if (!isFirebaseConfigured) {
    const rest = readLocal(ALERTS).filter((a) => !(a.userId === user.id && a.eventId === event.id))
    writeLocal(ALERTS, on ? [...rest, data] : rest)
    return
  }
  if (on) await setDoc(doc(db, 'eventAlerts', id), { ...data, createdAt: serverTimestamp() })
  else await deleteDoc(doc(db, 'eventAlerts', id))
}

export async function fetchEventAlerts(eventId) {
  if (!isFirebaseConfigured) return readLocal(ALERTS).filter((a) => a.eventId === eventId)
  return rows(await getDocs(query(collection(db, 'eventAlerts'), where('eventId', '==', eventId))))
}

// Tell everyone waiting that registration is open (an inbox message each),
// then clear their alerts so nobody is told twice. Returns how many were sent.
export async function sendEventAlerts({ event, alerts, fromName }) {
  let sent = 0
  for (const a of alerts) {
    try {
      await sendAdminMessage({
        toUid: a.userId,
        toName: a.userName,
        toEmail: a.userEmail,
        subject: `Registration is open: ${event.name}`,
        body: `You asked us to let you know — registration for ${event.name} is now open. Head to the Events page to grab your spot.`,
        fromName,
      })
      sent++
    } catch { /* keep going; that alert stays for next time */ }
  }
  if (!isFirebaseConfigured) {
    const done = new Set(alerts.map((a) => a.userId))
    writeLocal(ALERTS, readLocal(ALERTS).filter((a) => !(a.eventId === event.id && done.has(a.userId))))
    return sent
  }
  for (let i = 0; i < alerts.length; i += 400) {
    const batch = writeBatch(db)
    alerts.slice(i, i + 400).forEach((a) => batch.delete(doc(db, 'eventAlerts', a.id || `${event.id}_${a.userId}`)))
    await batch.commit()
  }
  return sent
}

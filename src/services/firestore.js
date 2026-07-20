import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import * as mock from '../data/mock'

// Every function works in both modes: it hits Firestore when configured,
// and otherwise returns/echoes mock data so the app runs with zero backend.
const map = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))
const stripId = ({ id, ...rest }) => rest

// ── Events ───────────────────────────────────────────────────
export async function fetchEvents() {
  if (!isFirebaseConfigured) return mock.events
  const snap = await getDocs(collection(db, 'events'))
  return snap.empty ? mock.events : map(snap)
}

export async function createEvent(data) {
  if (!isFirebaseConfigured) return { id: `ev_${Date.now()}`, ...data }
  const ref = await addDoc(collection(db, 'events'), { ...stripId(data), createdAt: serverTimestamp() })
  return { id: ref.id, ...data }
}

export async function updateEvent(id, patch) {
  if (isFirebaseConfigured) await updateDoc(doc(db, 'events', id), patch)
}

export async function deleteEvent(id) {
  if (isFirebaseConfigured) await deleteDoc(doc(db, 'events', id))
}

// ── Execom ───────────────────────────────────────────────────
const readLocal = (key) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function fetchExecomGroups() {
  if (!isFirebaseConfigured) return readLocal('acm-execom') || mock.execomGroups
  const snap = await getDocs(query(collection(db, 'execomGroups'), orderBy('order')))
  return snap.empty ? mock.execomGroups : map(snap)
}

const teamSlug = (team) => team.toLowerCase().replace(/[^a-z0-9]+/g, '-')

export async function saveExecomGroups(groups) {
  if (!isFirebaseConfigured) {
    localStorage.setItem('acm-execom', JSON.stringify(groups))
    return
  }
  await Promise.all(
    groups.map((g, i) => setDoc(doc(db, 'execomGroups', g.id || teamSlug(g.team)), { ...stripId(g), order: i })),
  )
}

// ── Site content (announcements, stats, editable copy) ───────
export async function fetchSiteContent() {
  if (!isFirebaseConfigured) return readLocal('acm-site-content')
  const snap = await getDoc(doc(db, 'siteContent', 'main'))
  return snap.exists() ? snap.data() : null
}

export async function saveSiteContent(content) {
  if (!isFirebaseConfigured) {
    localStorage.setItem('acm-site-content', JSON.stringify(content))
    return
  }
  await setDoc(doc(db, 'siteContent', 'main'), content, { merge: true })
}

// ── Users & access grants ────────────────────────────────────
// Returns null in mock mode; the admin Access panel falls back to demo users.
export async function fetchUsers() {
  if (!isFirebaseConfigured) return null
  const snap = await getDocs(collection(db, 'users'))
  return map(snap)
}

export async function updateUserAccess(uid, permissions) {
  if (isFirebaseConfigured) await updateDoc(doc(db, 'users', uid), { permissions })
}

// ── Testimonials ─────────────────────────────────────────────
export async function fetchTestimonials() {
  if (!isFirebaseConfigured) return mock.testimonials
  const snap = await getDocs(collection(db, 'testimonials'))
  return snap.empty ? mock.testimonials : map(snap)
}

export async function createTestimonial(data) {
  if (!isFirebaseConfigured) return { id: `t_${Date.now()}`, ...data }
  const ref = await addDoc(collection(db, 'testimonials'), stripId(data))
  return { id: ref.id, ...data }
}

export async function deleteTestimonial(id) {
  if (isFirebaseConfigured) await deleteDoc(doc(db, 'testimonials', id))
}

// ── Registrations ────────────────────────────────────────────
export async function fetchUserRegistrations(uid) {
  if (!isFirebaseConfigured) return mock.registrations
  const snap = await getDocs(query(collection(db, 'registrations'), where('userId', '==', uid)))
  return map(snap)
}

// Returns null in mock mode so the admin roster can fall back to mock participants.
export async function fetchAllRegistrations() {
  if (!isFirebaseConfigured) return null
  const snap = await getDocs(collection(db, 'registrations'))
  return map(snap)
}

export async function createRegistration(regDoc) {
  if (!isFirebaseConfigured) return { id: `r_${Date.now()}`, ...regDoc }
  const ref = await addDoc(collection(db, 'registrations'), { ...regDoc, createdAt: serverTimestamp() })
  return { id: ref.id, ...regDoc }
}

// Seed helper reused by the seed script signature (documents live in mock).
export { setDoc, doc }

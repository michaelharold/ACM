import {
  collection,
  getDocs,
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
export async function fetchExecomGroups() {
  if (!isFirebaseConfigured) return mock.execomGroups
  const snap = await getDocs(query(collection(db, 'execomGroups'), orderBy('order')))
  return snap.empty ? mock.execomGroups : map(snap)
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

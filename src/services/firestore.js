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
import { uploadImage, deleteImage } from '../lib/storage'
import * as mock from '../data/mock'

// Every function works in both modes: it hits Firestore when configured,
// and otherwise returns/echoes mock data so the app runs with zero backend.
const map = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))
const stripId = ({ id, ...rest }) => rest

// ── Events ───────────────────────────────────────────────────
export async function fetchEvents() {
  if (!isFirebaseConfigured) return mock.events
  const snap = await getDocs(collection(db, 'events'))
  // Live site shows only what's actually been added — no stock placeholders.
  return snap.empty ? [] : map(snap)
}

export async function createEvent(data) {
  if (!isFirebaseConfigured) return { id: `ev_${Date.now()}`, ...data }
  // A freshly-uploaded poster arrives as a base64 data URI; move it to Storage
  // and keep only the URL in the document. Falls back to the data URI if
  // Storage is unavailable, so the event still saves either way.
  const poster = await uploadImage('posters', data.poster)
  const ref = await addDoc(collection(db, 'events'), { ...stripId({ ...data, poster }), createdAt: serverTimestamp() })
  return { id: ref.id, ...data, poster }
}

export async function updateEvent(id, patch) {
  if (!isFirebaseConfigured) return patch
  const next = { ...patch }
  if ('poster' in next) next.poster = await uploadImage('posters', next.poster)
  await updateDoc(doc(db, 'events', id), next)
  return next
}

export async function deleteEvent(id) {
  if (!isFirebaseConfigured) return
  // Remove the poster from Storage too, so deleting an event doesn't orphan its
  // file in the bucket.
  const snap = await getDoc(doc(db, 'events', id))
  if (snap.exists()) await deleteImage(snap.data().poster)
  await deleteDoc(doc(db, 'events', id))
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

const teamSlug = (team) =>
  (team || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// Never let a team resolve to an empty/invalid document id — an unnamed team
// would otherwise make setDoc throw and block the whole save.
const execomDocId = (g, i) => g.id || teamSlug(g.team) || `team-${i + 1}`

export async function saveExecomGroups(groups) {
  if (!isFirebaseConfigured) {
    localStorage.setItem('acm-execom', JSON.stringify(groups))
    return groups
  }
  // Write every current team, AND delete any team document that no longer
  // exists in the panel — otherwise a deleted team keeps living in Firestore
  // and reappears on the next reload. (Members deleted inside a team already
  // sync, because setDoc overwrites the whole team document.)
  // Move any freshly-added member portraits (base64) to Storage; portraits that
  // are already hosted URLs pass straight through, so re-saving doesn't
  // re-upload the whole roster.
  const hosted = await Promise.all(groups.map(async (g) => ({
    ...g,
    members: await Promise.all((g.members || []).map(async (m) => ({
      ...m,
      photo: await uploadImage('execom', m.photo),
    }))),
  })))
  const keepIds = new Set(hosted.map((g, i) => execomDocId(g, i)))
  const existing = await getDocs(collection(db, 'execomGroups'))
  await Promise.all([
    ...hosted.map((g, i) => setDoc(doc(db, 'execomGroups', execomDocId(g, i)), { ...stripId(g), order: i })),
    ...existing.docs.filter((d) => !keepIds.has(d.id)).map((d) => deleteDoc(d.ref)),
  ])
  return hosted
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

// Self-service profile fields only — role and permissions are never writable here.
export async function updateUserProfile(uid, patch) {
  const { name = '', department = '', year = '', acmMember = false } = patch
  const clean = { name, department, year, acmMember: !!acmMember }
  if (isFirebaseConfigured) await updateDoc(doc(db, 'users', uid), clean)
  return clean
}

// ── Testimonials ─────────────────────────────────────────────
export async function fetchTestimonials() {
  if (!isFirebaseConfigured) return mock.testimonials
  const snap = await getDocs(collection(db, 'testimonials'))
  return snap.empty ? [] : map(snap)
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

// ── Gallery ──────────────────────────────────────────────────
// One image per document, not an array on a single doc: Firestore caps a
// document at 1 MB, and inline image data would blow through that after a
// handful of uploads.
// Mock-mode uploads persist in localStorage so the demo survives a reload,
// same as the mock message inbox.
const GAL_KEY = 'acm-gallery'
const readGallery = () => {
  try {
    return JSON.parse(localStorage.getItem(GAL_KEY) || '[]')
  } catch {
    return []
  }
}
const writeGallery = (rows) => {
  try {
    localStorage.setItem(GAL_KEY, JSON.stringify(rows))
  } catch {
    /* quota exceeded — images are big; the demo just won't persist */
  }
}

export async function fetchGallery() {
  if (!isFirebaseConfigured) return readGallery()
  const snap = await getDocs(collection(db, 'gallery'))
  return snap.empty ? [] : map(snap)
}

export async function createGalleryImage({ image, caption }) {
  const data = { image, caption: caption || '' }
  if (!isFirebaseConfigured) {
    const local = { id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ...data }
    writeGallery([local, ...readGallery()])
    return local
  }
  data.image = await uploadImage('gallery', image)
  const ref = await addDoc(collection(db, 'gallery'), { ...data, createdAt: serverTimestamp() })
  return { id: ref.id, ...data }
}

export async function deleteGalleryImage(id) {
  if (!isFirebaseConfigured) {
    writeGallery(readGallery().filter((g) => g.id !== id))
    return
  }
  const snap = await getDoc(doc(db, 'gallery', id))
  if (snap.exists()) await deleteImage(snap.data().image)
  await deleteDoc(doc(db, 'gallery', id))
}

// Edit an image's caption (title). Blank caption = no title shown on the site.
export async function updateGalleryImage(id, patch) {
  const clean = { caption: patch.caption ?? '' }
  if (!isFirebaseConfigured) {
    writeGallery(readGallery().map((g) => (g.id === id ? { ...g, ...clean } : g)))
    return
  }
  await updateDoc(doc(db, 'gallery', id), clean)
}

// ── Contact messages ─────────────────────────────────────────
// A message's identity always comes from the signed-in Firebase user, never
// from form input — the rules reject any doc whose userEmail doesn't match the
// caller's auth token, so a sender cannot claim someone else's address.
// Mock-mode inbox. Backed by localStorage rather than a module-level array so
// a message survives the page reload between sending it and opening the admin
// inbox — otherwise the demo silently loses everything you just sent.
const MSG_KEY = 'acm-messages'
const readStore = () => {
  try {
    return JSON.parse(localStorage.getItem(MSG_KEY) || '[]')
  } catch {
    return []
  }
}
const writeStore = (rows) => {
  try {
    localStorage.setItem(MSG_KEY, JSON.stringify(rows))
  } catch {
    /* quota or private mode — the demo just won't persist */
  }
}

export async function createMessage({ uid, name, email, subject, body }) {
  const docData = {
    userId: uid,
    userName: name,
    userEmail: email,
    subject: subject || 'Website enquiry',
    body,
    status: 'new',
    replies: [],
  }
  if (!isFirebaseConfigured) {
    const local = { id: `m_${Date.now()}`, ...docData, createdAt: new Date().toISOString() }
    writeStore([local, ...readStore()])
    return local
  }
  const ref = await addDoc(collection(db, 'messages'), { ...docData, createdAt: serverTimestamp() })
  return { id: ref.id, ...docData }
}

export async function fetchMessages() {
  if (!isFirebaseConfigured) return [...readStore(), ...mock.messages]
  const snap = await getDocs(query(collection(db, 'messages'), orderBy('createdAt', 'desc')))
  return map(snap)
}

export async function markMessageRead(id) {
  if (!isFirebaseConfigured) {
    writeStore(readStore().map((m) => (m.id === id && m.status === 'new' ? { ...m, status: 'read' } : m)))
    return
  }
  await updateDoc(doc(db, 'messages', id), { status: 'read' })
}

// Queues a reply for delivery and records it on the thread.
//
// Delivery itself is done by the Firebase "Trigger Email" extension, which
// watches the `mail` collection and sends each document it finds. A static
// site cannot send email on its own — without that extension installed the
// reply is still recorded here, and the admin UI offers a mailto: fallback.
export async function sendReply({ messageId, to, subject, body, fromName }) {
  const reply = { body, sentAt: new Date().toISOString(), byName: fromName }
  if (!isFirebaseConfigured) {
    writeStore(
      readStore().map((m) =>
        m.id === messageId ? { ...m, replies: [...(m.replies || []), reply], status: 'replied' } : m,
      ),
    )
    return { queued: false, reply }
  }
  await addDoc(collection(db, 'mail'), {
    to: [to],
    message: {
      subject,
      text: body,
      html: `<p>${body.replace(/\n/g, '<br/>')}</p><hr/><p style="color:#888;font-size:12px">Sent by ${fromName} — ACM TKMCE Student Chapter</p>`,
    },
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'messages', messageId), {
    replies: [...(await getMessageReplies(messageId)), reply],
    status: 'replied',
  })
  return { queued: true, reply }
}

async function getMessageReplies(id) {
  const snap = await getDoc(doc(db, 'messages', id))
  return snap.exists() ? snap.data().replies || [] : []
}

// ── ACM memberships ──────────────────────────────────────────
// One document per user (keyed by uid). The applicant fills their own details;
// the membershipId is assigned later by an admin and is never writable by the
// member themselves (enforced in firestore.rules).
const MEMBER_KEY = (uid) => `acm-membership-${uid}`

export async function fetchMembership(uid) {
  if (!uid) return null
  if (!isFirebaseConfigured) return readLocal(MEMBER_KEY(uid))
  const snap = await getDoc(doc(db, 'memberships', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function createMembership(uid, data) {
  const clean = {
    userId: uid,
    firstName: data.firstName || '',
    middleName: data.middleName || '',
    lastName: data.lastName || '',
    email: data.email || '',
    phone: data.phone || '',
    department: data.department || '',
    className: data.className || '',
    paymentStatus: data.paymentStatus || 'pending',
    membershipId: '', // admin-assigned only
  }
  if (!isFirebaseConfigured) {
    const rec = { id: uid, ...clean, createdAt: new Date().toISOString() }
    try { localStorage.setItem(MEMBER_KEY(uid), JSON.stringify(rec)) } catch { /* quota */ }
    return rec
  }
  await setDoc(doc(db, 'memberships', uid), { ...clean, createdAt: serverTimestamp() })
  return { id: uid, ...clean }
}

// Admin/membership-editor list of every application.
export async function fetchAllMemberships() {
  if (!isFirebaseConfigured) return null
  const snap = await getDocs(collection(db, 'memberships'))
  return map(snap)
}

export async function updateMembership(uid, patch) {
  if (!isFirebaseConfigured) {
    const cur = readLocal(MEMBER_KEY(uid)) || { id: uid }
    localStorage.setItem(MEMBER_KEY(uid), JSON.stringify({ ...cur, ...patch }))
    return
  }
  await updateDoc(doc(db, 'memberships', uid), patch)
}

// Pre-flight check before a user starts filling the form: confirm the backend
// is actually accepting writes for them (quota exhausted, billing disabled or a
// rules problem would all surface here). Writes then deletes a tiny probe doc.
export async function probeWritable(uid) {
  if (!isFirebaseConfigured || !uid) return true
  const ref = doc(db, 'probes', uid)
  await setDoc(ref, { at: serverTimestamp() })
  await deleteDoc(ref).catch(() => {}) // cleanup best-effort; the write is what matters
  return true
}

// Seed helper reused by the seed script signature (documents live in mock).
export { setDoc, doc }

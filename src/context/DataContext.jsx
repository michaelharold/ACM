import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as mock from '../data/mock'
import * as svc from '../services/firestore'
import { isFirebaseConfigured } from '../lib/firebase'
import { departments as defaultDepartments } from '../lib/orgData'
import { resolveText } from '../lib/siteText'

const DataContext = createContext(null)

// Central store for public content (events, execom, testimonials).
// Renders instantly from mock data, then overlays live Firestore data when
// configured — so there's never an empty flash, live or not.
// Editable site copy defaults — everything an admin can change without code.
const defaultContent = () => ({
  announcements: mock.announcements,
  stats: mock.stats,
  established: mock.chapter.established,
  // Front-page copy an admin can rewrite without touching code.
  goals: mock.goals, // Vision / Mission / Values
  whyJoin: mock.whyJoin,
  heroTagline: mock.chapter.description,
  aboutTitle: 'Built by students, for builders',
  galleryTitle: 'Life at the chapter',
  galleryBlurb: 'Hack nights, workshops, mentor circles — a running reel of what we get up to.',
  // Admin overrides for any other site copy, keyed as in lib/siteText.js.
  texts: {},
  // The "Get ACM Global Membership" button under every Join button.
  globalMembershipEnabled: true,
})

export function DataProvider({ children }) {
  // Public content starts empty so the live site never flashes stock
  // placeholders before Firestore answers — only real, uploaded data ever shows.
  // Execom keeps its seeded roster as a first paint since it's real members.
  const [events, setEvents] = useState(isFirebaseConfigured ? [] : mock.events)
  const [execomGroups, setExecomGroups] = useState(mock.execomGroups)
  const [testimonials, setTestimonials] = useState(isFirebaseConfigured ? [] : mock.testimonials)
  const [gallery, setGallery] = useState([])
  const [content, setContent] = useState(defaultContent)
  const [loaded, setLoaded] = useState(!isFirebaseConfigured)
  // Set when the site-content read fails: saving then would write the built-in
  // defaults over the real settings, so saves are refused until a reload.
  const [contentLoadFailed, setContentLoadFailed] = useState(false)

  // What visitors see: everything except events an admin is still drafting
  // (a new event starts as a draft, so a half-filled "Untitled Event" is never
  // public or registerable). Admin screens keep using `events`.
  const publicEvents = useMemo(() => events.filter((e) => !e.draft), [events])

  // The single source of truth for department options across the whole app
  // (profile, event registration, …). Admin-managed via Site Content; falls
  // back to the built-in campus list until an admin customises it.
  const departments =
    Array.isArray(content.departments) && content.departments.length ? content.departments : defaultDepartments

  useEffect(() => {
    let alive = true
    // Each source loads and paints independently, so a slow gallery query no
    // longer holds up events (and vice-versa) — sections fill in as they arrive.
    const set = (fn) => (v) => { if (alive) fn(v) }
    const jobs = [
      svc.fetchEvents().then(set(setEvents)),
      svc.fetchExecomGroups().then(set(setExecomGroups)),
      svc.fetchTestimonials().then(set(setTestimonials)),
      svc.fetchGallery().then(set(setGallery)),
      svc.fetchSiteContent()
        .then((sc) => { if (alive && sc) setContent((c) => ({ ...c, ...sc })) })
        .catch((err) => { if (alive) setContentLoadFailed(true); throw err }),
    ].map((p) => p.catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[ACM] Firestore fetch failed for one source.', err)
    }))
    Promise.allSettled(jobs).then(() => { if (alive) setLoaded(true) })
    return () => {
      alive = false
    }
  }, [])

  // ── Event mutators (admin) ─────────────────────────────────
  async function addEvent(data) {
    const created = await svc.createEvent(data)
    setEvents((p) => [created, ...p])
    return created
  }
  async function editEvent(id, patch) {
    // updateEvent returns the applied patch with the poster resolved to its
    // Storage URL (when a new one was uploaded), so state matches the document.
    const applied = await svc.updateEvent(id, patch)
    setEvents((p) => p.map((e) => (e.id === id ? { ...e, ...(applied || patch) } : e)))
  }
  async function removeEvent(id) {
    await svc.deleteEvent(id)
    setEvents((p) => p.filter((e) => e.id !== id))
  }

  // ── Site content + execom mutators (admin / editors) ───────
  async function updateContent(patch) {
    if (contentLoadFailed) {
      throw new Error('The current site settings didn’t load, so saving now could overwrite them. Refresh the page and try again.')
    }
    const prev = content
    const next = { ...content, ...patch }
    setContent(next)
    try {
      await svc.saveSiteContent(next)
    } catch (err) {
      setContent(prev) // don't leave the screen showing something that wasn't saved
      throw err
    }
  }
  async function updateExecom(groups) {
    setExecomGroups(groups) // paint immediately with the local (base64) photos
    // Reconcile with the saved roster, whose new portraits are now Storage URLs.
    const hosted = await svc.saveExecomGroups(groups)
    if (hosted) setExecomGroups(hosted)
  }

  // ── Gallery mutators (admin) ───────────────────────────────
  async function addGalleryImages(items) {
    const created = await Promise.all(items.map((i) => svc.createGalleryImage(i)))
    setGallery((p) => [...created, ...p])
    return created
  }
  async function removeGalleryImage(id) {
    await svc.deleteGalleryImage(id)
    setGallery((p) => p.filter((g) => g.id !== id))
  }
  async function updateGalleryImage(id, patch) {
    setGallery((p) => p.map((g) => (g.id === id ? { ...g, ...patch } : g)))
    await svc.updateGalleryImage(id, patch)
  }

  return (
    <DataContext.Provider
      value={{
        events,
        publicEvents,
        execomGroups,
        testimonials,
        gallery,
        content,
        departments,
        loaded,
        addGalleryImages,
        removeGalleryImage,
        updateGalleryImage,
        updateContent,
        updateExecom,
        addEvent,
        editEvent,
        removeEvent,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)

// Site copy by key — the admin's override, else the built-in default.
//   const t = useText();  t('hero.titleLead');  t('about.description', { year })
export function useText() {
  const { content } = useContext(DataContext)
  return useCallback((key, vars) => resolveText(content, key, vars), [content])
}

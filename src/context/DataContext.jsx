import { createContext, useContext, useEffect, useState } from 'react'
import * as mock from '../data/mock'
import * as svc from '../services/firestore'
import { isFirebaseConfigured } from '../lib/firebase'

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
      svc.fetchSiteContent().then((sc) => { if (alive && sc) setContent((c) => ({ ...c, ...sc })) }),
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
    await svc.updateEvent(id, patch)
    setEvents((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }
  async function removeEvent(id) {
    await svc.deleteEvent(id)
    setEvents((p) => p.filter((e) => e.id !== id))
  }

  // ── Site content + execom mutators (admin / editors) ───────
  async function updateContent(patch) {
    const next = { ...content, ...patch }
    setContent(next)
    await svc.saveSiteContent(next)
  }
  async function updateExecom(groups) {
    setExecomGroups(groups)
    await svc.saveExecomGroups(groups)
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

  // ── Testimonial mutators (admin) ───────────────────────────
  async function addTestimonial(data) {
    const created = await svc.createTestimonial(data)
    setTestimonials((p) => [...p, created])
    return created
  }
  async function removeTestimonial(id) {
    await svc.deleteTestimonial(id)
    setTestimonials((p) => p.filter((t) => t.id !== id))
  }

  return (
    <DataContext.Provider
      value={{
        events,
        execomGroups,
        testimonials,
        gallery,
        content,
        loaded,
        addGalleryImages,
        removeGalleryImage,
        updateGalleryImage,
        updateContent,
        updateExecom,
        addEvent,
        editEvent,
        removeEvent,
        addTestimonial,
        removeTestimonial,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)

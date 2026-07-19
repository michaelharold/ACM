import { createContext, useContext, useEffect, useState } from 'react'
import * as mock from '../data/mock'
import * as svc from '../services/firestore'
import { isFirebaseConfigured } from '../lib/firebase'

const DataContext = createContext(null)

// Central store for public content (events, execom, testimonials).
// Renders instantly from mock data, then overlays live Firestore data when
// configured — so there's never an empty flash, live or not.
export function DataProvider({ children }) {
  const [events, setEvents] = useState(mock.events)
  const [execomGroups, setExecomGroups] = useState(mock.execomGroups)
  const [testimonials, setTestimonials] = useState(mock.testimonials)
  const [loaded, setLoaded] = useState(!isFirebaseConfigured)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    let alive = true
    ;(async () => {
      try {
        const [ev, ex, ts] = await Promise.all([
          svc.fetchEvents(),
          svc.fetchExecomGroups(),
          svc.fetchTestimonials(),
        ])
        if (!alive) return
        setEvents(ev)
        setExecomGroups(ex)
        setTestimonials(ts)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[ACM] Firestore fetch failed, using mock data.', err)
      } finally {
        if (alive) setLoaded(true)
      }
    })()
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
        loaded,
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

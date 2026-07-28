import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import * as svc from '../services/firestore'

const RegistrationsContext = createContext(null)

// Tracks the signed-in user's event registrations. Reads from Firestore when
// live (keyed to the real uid); falls back to mock data in demo mode.
export function RegistrationsProvider({ children }) {
  const { user } = useAuth()
  const [regs, setRegs] = useState([])

  useEffect(() => {
    let alive = true
    if (!user) {
      setRegs([])
      return
    }
    ;(async () => {
      try {
        const data = await svc.fetchUserRegistrations(user.id)
        if (alive) setRegs(data)
      } catch {
        if (alive) setRegs([])
      }
    })()
    return () => {
      alive = false
    }
  }, [user])

  // Exposed so pages can pull a fresh copy on demand — e.g. Dashboard refetches
  // when the tab regains focus, since Random Grouping can turn a solo
  // registration into a team registration in the background (daily cron) while
  // the user already has the page open, and that swap won't show up otherwise.
  async function refetch() {
    if (!user) return
    try {
      const data = await svc.fetchUserRegistrations(user.id)
      setRegs(data)
    } catch { /* keep showing the last known state */ }
  }

  const isRegistered = (eventId) => regs.some((r) => r.eventId === eventId)

  async function register(event, form = {}) {
    if (!event || isRegistered(event.id)) return null
    // Capacity: when the event caps registrations, refuse once it's full. Read
    // the count fresh so we don't admit past the cap on stale data.
    const max = Number(event.maxRegistrations) || 0
    if (max > 0) {
      const count = await svc.fetchEventCount(event.id)
      if (count >= max) throw new Error('Sorry — registration for this event is full.')
    }
    // The amount actually collected — the drawer passes this after any member
    // discount, so a fully-discounted registration is correctly 'free', not a
    // 'pending' that can never be paid.
    const chargeAmount = form.chargeAmount != null ? Number(form.chargeAmount) : (Number(event.fee) || 0)
    const regDoc = {
      userId: user?.id || 'u_local',
      userName: form.name || user?.name || '',
      userEmail: form.email || user?.email || '',
      eventId: event.id,
      eventName: event.name,
      college: form.college || '',
      department: form.department || '',
      year: form.year || '',
      acmMember: !!form.isMember,
      membershipId: form.membershipId || '',
      date: new Date().toISOString().slice(0, 10),
      status: 'Confirmed',
      // Paid registrations start 'pending' and flip to 'paid' once the server
      // verifies the Razorpay payment; nothing-to-pay registrations are 'free'.
      paymentStatus: chargeAmount > 0 ? 'pending' : 'free',
      // Remember whether this event tracks capacity, so a later cleanup knows to
      // release the slot (and we never decrement an uncapped event's counter).
      counted: max > 0,
    }
    const created = await svc.createRegistration(regDoc)
    setRegs((prev) => [...prev, created])
    // Reserve the slot. For paid events this holds the place through checkout;
    // a cancelled/failed payment releases it via unregister().
    if (max > 0) svc.bumpEventCount(event.id, 1)
    return created
  }

  // Add a team registration that the server just created (group events are
  // registered through /api/register-team, not the client register() above), so
  // the leader immediately sees the event as registered without a refetch.
  function addTeamRegistration(reg) {
    if (!reg?.id) return
    setRegs((prev) => (prev.some((r) => r.id === reg.id) ? prev : [...prev, reg]))
  }

  // Reflect a server-verified payment in local state (the server is the source
  // of truth; this just avoids a refetch).
  function markRegistrationPaid(id) {
    setRegs((prev) => prev.map((r) => (r.id === id ? { ...r, paymentStatus: 'paid' } : r)))
  }

  // Drop an unpaid registration (e.g. its payment was cancelled/failed), so the
  // user isn't left "registered" without paying and can try again.
  async function unregister(id) {
    if (!id) return
    const reg = regs.find((r) => r.id === id)
    try { await svc.deleteRegistration(id) } catch { /* best-effort cleanup */ }
    // Release the capacity slot this registration was holding.
    if (reg?.counted && reg?.eventId) svc.bumpEventCount(reg.eventId, -1)
    setRegs((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <RegistrationsContext.Provider value={{ regs, isRegistered, register, addTeamRegistration, markRegistrationPaid, unregister, refetch }}>
      {children}
    </RegistrationsContext.Provider>
  )
}

export const useRegistrations = () => useContext(RegistrationsContext)

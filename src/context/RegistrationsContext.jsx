import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import * as svc from '../services/firestore'
import * as pay from '../services/payments'
import { isTkmCollege } from '../lib/orgData'
import { isRazorpayMode } from '../lib/payments'
import { holdsSeat } from '../lib/manualPay'

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
    // TKM-only events (the default) don't accept other colleges — checked
    // again here (not just in the UI) since this is what actually writes the
    // registration.
    if (!event.interCollege && !isTkmCollege(form.college || user?.college)) {
      throw new Error('This event is only open to TKM College of Engineering students.')
    }
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
    // Manual mode: a paid registration is only ever written together with its
    // receipt (one atomic batch), so there's no "registered but never paid" limbo.
    const manual = chargeAmount > 0 && !isRazorpayMode
    if (manual && !form.receipt) throw new Error('Upload your payment receipt to register.')
    const regDoc = {
      userId: user?.id || 'u_local',
      userName: form.name || user?.name || '',
      userEmail: form.email || user?.email || '',
      phone: form.phone || user?.phone || '',
      eventId: event.id,
      eventName: event.name,
      college: form.college || '',
      department: form.department || '',
      year: form.year || '',
      acmMember: !!form.isMember,
      membershipId: form.membershipId || '',
      date: new Date().toISOString().slice(0, 10),
      status: 'Confirmed',
      // 'pending' until verified (by an admin, or Razorpay's server); 'free'
      // when there's nothing to pay.
      paymentStatus: chargeAmount > 0 ? 'pending' : 'free',
      amountDue: chargeAmount,
      upiAccountId: manual ? (form.upiAccountId || '') : '',
      // Remember whether this event tracks capacity, and whether this record is
      // holding one of its seats right now (a rejected payment releases it).
      counted: max > 0,
      seatHeld: max > 0,
    }
    const created = manual
      ? await pay.createRegistrationWithReceipt(regDoc, { ...form.receipt, amount: chargeAmount })
      : await svc.createRegistration(regDoc)
    setRegs((prev) => [...prev, created])
    // Reserve the slot — held through review; a rejection or cancel releases it.
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

  // Upload a receipt for an existing registration: a team leader whose receipt
  // didn't go through, or a payer whose receipt was rejected. A rejection
  // released the seat, so re-taking it re-checks capacity first.
  async function resubmitReceipt(reg, receipt, event) {
    const max = Number(event?.maxRegistrations) || 0
    const needsSeat = max > 0 && !!reg.counted && !holdsSeat(reg)
    if (needsSeat && (await svc.fetchEventCount(reg.eventId)) >= max) {
      throw new Error('Sorry — this event filled up while your payment was being reviewed. Please contact the organisers.')
    }
    const applied = await pay.attachReceipt({
      kind: 'event',
      refId: reg.id,
      userId: user.id,
      ...receipt,
      amount: reg.amountDue ?? (Number(event?.fee) || 0),
      patch: needsSeat ? { seatHeld: true } : {},
    })
    if (needsSeat) svc.bumpEventCount(reg.eventId, 1)
    setRegs((prev) => prev.map((r) => (r.id === reg.id ? { ...r, ...applied } : r)))
  }

  // Drop an unverified registration (a cancelled Razorpay checkout, or the user
  // withdrawing one under review), release its seat, and free its receipt's
  // transaction ID so it can be used again.
  async function unregister(id) {
    if (!id) return
    const reg = regs.find((r) => r.id === id)
    try { await svc.deleteRegistration(id) } catch { /* best-effort cleanup */ }
    if (reg) pay.discardReceipt(reg).catch(() => {})
    if (reg && holdsSeat(reg) && reg.eventId) svc.bumpEventCount(reg.eventId, -1)
    setRegs((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <RegistrationsContext.Provider value={{ regs, isRegistered, register, addTeamRegistration, markRegistrationPaid, resubmitReceipt, unregister, refetch }}>
      {children}
    </RegistrationsContext.Provider>
  )
}

export const useRegistrations = () => useContext(RegistrationsContext)

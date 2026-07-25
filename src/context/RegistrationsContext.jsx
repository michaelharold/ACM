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

  const isRegistered = (eventId) => regs.some((r) => r.eventId === eventId)

  async function register(event, form = {}) {
    if (!event || isRegistered(event.id)) return null
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
      // Paid events start 'pending' and flip to 'paid' once the server verifies
      // the Razorpay payment; free events are simply 'free'.
      paymentStatus: event.fee ? 'pending' : 'free',
    }
    const created = await svc.createRegistration(regDoc)
    setRegs((prev) => [...prev, created])
    return created
  }

  // Reflect a server-verified payment in local state (the server is the source
  // of truth; this just avoids a refetch).
  function markRegistrationPaid(id) {
    setRegs((prev) => prev.map((r) => (r.id === id ? { ...r, paymentStatus: 'paid' } : r)))
  }

  return (
    <RegistrationsContext.Provider value={{ regs, isRegistered, register, markRegistrationPaid }}>
      {children}
    </RegistrationsContext.Provider>
  )
}

export const useRegistrations = () => useContext(RegistrationsContext)

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SectionHeading } from '../components/SectionHeading'
import { Reveal } from '../components/ui/Reveal'
import { EventCard } from '../components/events/EventCard'
import { EventDetailsModal } from '../components/events/EventDetailsModal'
import { RegistrationDrawer } from '../components/events/RegistrationDrawer'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useRegistrations } from '../context/RegistrationsContext'
import { cn } from '../lib/cn'

const filters = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Registration Open' },
  { key: 'coming-soon', label: 'Coming Soon' },
  { key: 'closed', label: 'Closed' },
]

export default function Events() {
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [registering, setRegistering] = useState(null)
  const navigate = useNavigate()
  const { isAuthed } = useAuth()
  const { events } = useData()
  const { isRegistered, register } = useRegistrations()

  const list = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.status === filter)),
    [filter, events],
  )

  function handleRegister(event) {
    if (!isAuthed) {
      // Per SDD: redirect to Authentication Page if login is required, then back.
      navigate('/auth', { state: { from: '/events' } })
      return
    }
    setSelected(null)
    setTimeout(() => setRegistering(event), 180)
  }

  return (
    <div className="pt-28">
      <div className="section-shell py-16">
        <SectionHeading
          eyebrow="Events"
          title="Everything happening at ACM TKMCE"
          description="Browse upcoming, ongoing and past events. Tap any card for the full breakdown and to register."
        />

        {/* Filters */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'relative rounded-full px-4 py-2 text-sm font-medium transition-colors',
                filter === f.key ? 'text-white' : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white',
              )}
            >
              {filter === f.key && (
                <span className="absolute inset-0 -z-10 rounded-full bg-acm-600" style={{ borderRadius: 9999 }} />
              )}
              {f.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <Reveal key={filter} className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" amount={0.05}>
          {list.map((event) => (
            <EventCard key={event.id} event={event} onOpen={setSelected} />
          ))}
        </Reveal>

        {list.length === 0 && (
          <p className="mt-16 text-center text-sm text-neutral-500">No events in this category yet.</p>
        )}
      </div>

      <EventDetailsModal
        event={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onRegister={handleRegister}
        registered={selected ? isRegistered(selected.id) : false}
      />

      <RegistrationDrawer
        event={registering}
        open={!!registering}
        onClose={() => setRegistering(null)}
        onComplete={register}
      />
    </div>
  )
}

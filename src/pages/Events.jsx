import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { SectionHeading } from '../components/SectionHeading'
import { Reveal } from '../components/ui/Reveal'
import { EventCard } from '../components/events/EventCard'
import { EventDetailsModal } from '../components/events/EventDetailsModal'
import { RegistrationDrawer } from '../components/events/RegistrationDrawer'
import SplitText from '../components/reactbits/SplitText'
import PixelBlast from '../components/reactbits/PixelBlast'
import { LazyBackdrop } from '../components/ui/LazyBackdrop'
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
  const [registering, setRegistering] = useState(null)
  const navigate = useNavigate()
  const { eventId } = useParams()
  const { isAuthed } = useAuth()
  const { events, loaded } = useData()
  const { isRegistered, register } = useRegistrations()

  const list = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.status === filter)),
    [filter, events],
  )

  // The open event is derived from the URL, so /events/:id is shareable and the
  // back button closes the details view.
  const selected = useMemo(() => events.find((e) => e.id === eventId) || null, [events, eventId])

  // Unknown id (stale link, deleted event) falls back to the list.
  useEffect(() => {
    if (eventId && loaded && !events.some((e) => e.id === eventId)) {
      navigate('/events', { replace: true })
    }
  }, [eventId, events, loaded, navigate])

  function handleRegister(event) {
    if (!isAuthed) {
      // Per SDD: redirect to Authentication Page if login is required, then back.
      navigate('/auth', { state: { from: `/events/${event.id}` } })
      return
    }
    navigate('/events')
    setTimeout(() => setRegistering(event), 180)
  }

  const noEventsAtAll = loaded && events.length === 0

  return (
    <div className="relative pt-28">
      {/* Dithered pixel field behind the catalogue. Interactive (click ripples,
          liquid drag) so it stays pointer-enabled, but pinned to the top band
          and faded out before the cards. */}
      <LazyBackdrop className="absolute inset-x-0 top-0 h-[70vh]">
        <PixelBlast
          variant="circle"
          pixelSize={5}
          color="#160fe0"
          patternScale={3}
          patternDensity={0.85}
          pixelSizeJitter={0.5}
          enableRipples
          rippleSpeed={0.4}
          rippleThickness={0.12}
          rippleIntensityScale={1.5}
          liquid
          liquidStrength={0.12}
          liquidRadius={1.2}
          liquidWobbleSpeed={5}
          speed={0.6}
          edgeFade={0.25}
          transparent
        />
      </LazyBackdrop>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] bg-gradient-to-b from-transparent via-neutral-950/60 to-neutral-950" />

      <div className="section-shell relative z-10 py-16">
        <SectionHeading
          eyebrow="Events"
          title="Everything happening at ACM TKMCE"
          description="Browse upcoming, ongoing and past events. Tap any card for the full breakdown and to register."
        />

        {noEventsAtAll ? (
          /* Nothing scheduled yet — a deliberate, animated placeholder. */
          <div className="mt-20 flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-neutral-200 bg-neutral-50 text-acm-500 dark:border-neutral-800 dark:bg-neutral-900">
              <CalendarClock className="h-6 w-6" />
            </span>
            <SplitText
              text="Coming Soon....."
              tag="h3"
              className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl"
              delay={70}
              duration={0.8}
              ease="power3.out"
              splitType="chars"
              from={{ opacity: 0, y: 40 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.1}
              rootMargin="-40px"
              textAlign="center"
            />
            <p className="mt-4 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
              We’re lining up the next set of workshops, talks and hackathons. Check back shortly.
            </p>
          </div>
        ) : (
          <>
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
                <EventCard key={event.id} event={event} onOpen={(e) => navigate(`/events/${e.id}`)} />
              ))}
            </Reveal>

            {list.length === 0 && (
              <p className="mt-16 text-center text-sm text-neutral-500">No events in this category yet.</p>
            )}
          </>
        )}
      </div>

      <EventDetailsModal
        event={selected}
        open={!!selected}
        onClose={() => navigate('/events')}
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

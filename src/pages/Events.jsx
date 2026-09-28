import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarClock, GraduationCap } from 'lucide-react'
import { SectionHeading } from '../components/SectionHeading'
import { stagger } from '../components/ui/Reveal'
import { EventCard } from '../components/events/EventCard'
import { EventDetailsModal } from '../components/events/EventDetailsModal'
import { RegistrationDrawer } from '../components/events/RegistrationDrawer'
import SplitText from '../components/reactbits/SplitText'
import { BrandBackdrop } from '../components/sections/BrandBackdrop'
import { useAuth } from '../context/AuthContext'
import { useData, useText } from '../context/DataContext'
import { useRegistrations } from '../context/RegistrationsContext'
import { effectiveStatus, startMs, isEnded, isLiveNow, useNow } from '../lib/eventClock'
import { isProfileComplete } from '../lib/profile'
import { isTkmCollege } from '../lib/orgData'
import { cn } from '../lib/cn'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'

const filters = [
  { key: 'all', label: 'All' },
  { key: 'latest', label: 'Latest' },
  { key: 'open', label: 'Registration Open' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'coming-soon', label: 'Coming Soon' },
  { key: 'registered', label: 'Registered' },
  { key: 'closed', label: 'Closed' },
  { key: 'past', label: 'Past' },
]

export default function Events() {
  const [filter, setFilter] = useState('all')
  const [registering, setRegistering] = useState(null)
  const [notEligible, setNotEligible] = useState(null)
  const navigate = useNavigate()
  const { eventId } = useParams()
  const { isAuthed, user } = useAuth()
  const { publicEvents: events, loaded } = useData()
  const t = useText()
  const { isRegistered, register, addTeamRegistration, markRegistrationPaid, unregister } = useRegistrations()
  // Ticks, so filters, ordering and badges move on their own as windows open,
  // close and events start or end while the page is open.
  const now = useNow(30000)

  const list = useMemo(() => {
    // Filter first.
    const match = (e) => {
      const status = effectiveStatus(e, now)
      switch (filter) {
        case 'latest': return !isEnded(e, now)
        case 'open': return status === 'open' && !isEnded(e, now)
        case 'ongoing': return isLiveNow(e, now)
        case 'coming-soon': return status === 'coming-soon' && !isEnded(e, now)
        case 'registered': return isRegistered(e.id)
        case 'closed': return status === 'closed' && !isEnded(e, now)
        case 'past': return isEnded(e, now)
        default: return true // 'all'
      }
    }
    // Then order. Live/registerable-and-unregistered events stay on top; the
    // registered ones sink a little, closed further, and finished events drop to
    // the bottom (shown in B&W). Within a group, the latest event comes first.
    const rank = (e) => {
      if (isEnded(e, now)) return 3
      if (isRegistered(e.id)) return 1
      if (effectiveStatus(e, now) === 'closed') return 2
      return 0
    }
    return events
      .filter(match)
      .sort((a, b) => rank(a) - rank(b) || startMs(b) - startMs(a))
  }, [filter, events, isRegistered, now])

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
    // Only a complete profile can register — the organiser needs a usable name,
    // email, phone, department and year. Send them to the profile to finish it,
    // then straight back to this event.
    if (!isProfileComplete(user)) {
      navigate('/dashboard', { state: { completeProfile: true, from: `/events/${event.id}` } })
      return
    }
    // TKM-only events (the default) don't accept registrants from other
    // colleges — the event stays visible to everyone, just not registerable.
    if (!event.interCollege && !isTkmCollege(user.college)) {
      setNotEligible(event)
      return
    }
    navigate('/events')
    setTimeout(() => setRegistering(event), 180)
  }

  const noEventsAtAll = loaded && events.length === 0

  return (
    <div className="relative pt-28">
      {/* Same brand backdrop as the About section. It spans the whole page here
          rather than a fixed band, so it stays behind the cards as you scroll. */}
      <BrandBackdrop feather={false} />

      <div className="section-shell relative z-10 py-16">
        <SectionHeading
          eyebrow={t('events.eyebrow')}
          title={t('events.title')}
          description={t('events.description')}
        />

        {noEventsAtAll ? (
          /* Nothing scheduled yet — a deliberate, animated placeholder. */
          <div className="mt-20 flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-neutral-200 bg-neutral-50 text-acm-500 dark:border-neutral-800 dark:bg-neutral-900">
              <CalendarClock className="h-6 w-6" />
            </span>
            <SplitText
              text={t('events.emptyTitle')}
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
              {t('events.emptyBody')}
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

            {/* Grid — animates on mount (not on scroll) so events painted after
                the async Firestore load are never left stuck invisible until the
                next interaction. */}
            <motion.div
              key={filter}
              variants={stagger}
              initial="hidden"
              animate="show"
              className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {list.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onOpen={(e) => navigate(`/events/${e.id}`)}
                  registered={isRegistered(event.id)}
                  muted={isEnded(event, now)}
                />
              ))}
            </motion.div>

            {list.length === 0 && (
              <p className="mt-16 text-center text-sm text-neutral-500">{t('events.emptyFilter')}</p>
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
        onTeamCreated={addTeamRegistration}
        onPaid={markRegistrationPaid}
        onCancelPay={unregister}
      />

      <Modal open={!!notEligible} onClose={() => setNotEligible(null)} size="md">
        <div className="p-6 text-center sm:p-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <GraduationCap className="h-6 w-6" />
          </span>
          <h3 className="mt-5 text-lg font-bold tracking-tight">This event is for TKM College students</h3>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            <strong className="text-neutral-800 dark:text-neutral-200">{notEligible?.name}</strong> isn't an Inter-College
            Event, so registration is limited to TKM College of Engineering students.
          </p>
          <Button className="mt-6 w-full" onClick={() => setNotEligible(null)}>Got it</Button>
        </div>
      </Modal>
    </div>
  )
}

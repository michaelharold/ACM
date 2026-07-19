import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarDays, MapPin, LogOut, Compass, BadgeCheck, Mail, GraduationCap, Building2, Ticket } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Reveal, Item } from '../components/ui/Reveal'
import { EventDetailsModal } from '../components/events/EventDetailsModal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useRegistrations } from '../context/RegistrationsContext'
import { formatDate } from '../lib/format'

export default function Dashboard() {
  const { user, loading, logout } = useAuth()
  const { events } = useData()
  const { regs } = useRegistrations()
  const navigate = useNavigate()
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!loading && !user) navigate('/auth', { replace: true, state: { from: '/dashboard' } })
  }, [user, loading, navigate])

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-acm-600 dark:border-neutral-800 dark:border-t-acm-500" />
      </div>
    )
  if (!user) return null

  const eventsById = Object.fromEntries(events.map((e) => [e.id, e]))
  const myEvents = regs.map((r) => ({
    reg: r,
    event: eventsById[r.eventId] || {
      id: r.eventId,
      name: r.eventName || 'Event',
      poster: '',
      date: r.date,
      venue: '—',
    },
  }))

  const profileRows = [
    { icon: Mail, label: 'Email', value: user.email },
    { icon: Building2, label: 'Department', value: user.department },
    { icon: GraduationCap, label: 'Year', value: user.year },
  ]

  return (
    <div className="pt-28">
      <div className="section-shell py-12">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={user.avatar} alt="" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white shadow-sm dark:ring-neutral-800" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Hi, {user.name.split(' ')[0]} 👋</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Here's your ACM TKMCE space.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button as={Link} to="/events" variant="outline" size="sm">
              <Compass className="h-4 w-4" /> Browse events
            </Button>
            <Button onClick={() => { logout(); navigate('/') }} variant="ghost" size="sm">
              <LogOut className="h-4 w-4" /> Log out
            </Button>
          </div>
        </motion.div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Profile */}
          <motion.aside
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="h-fit rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex items-center gap-4">
              <img src={user.avatar} alt="" className="h-16 w-16 rounded-2xl object-cover" />
              <div className="min-w-0">
                <h2 className="truncate font-semibold tracking-tight">{user.name}</h2>
                {user.acmMember && (
                  <Badge tone="blue" className="mt-1">
                    <BadgeCheck className="h-3.5 w-3.5" /> ACM Member
                  </Badge>
                )}
              </div>
            </div>
            <dl className="mt-6 space-y-3">
              {profileRows.map((r) => (
                <div key={r.label} className="flex items-center gap-3 text-sm">
                  <r.icon className="h-4 w-4 shrink-0 text-neutral-400" />
                  <dt className="sr-only">{r.label}</dt>
                  <dd className="truncate text-neutral-600 dark:text-neutral-300">{r.value || '—'}</dd>
                </div>
              ))}
            </dl>
            <Button variant="outline" size="sm" className="mt-6 w-full" disabled>
              Edit profile (soon)
            </Button>
          </motion.aside>

          {/* Registered events */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Ticket className="h-5 w-5 text-acm-500" /> Registered events
              </h2>
              <span className="text-sm text-neutral-400">{myEvents.length} total</span>
            </div>

            {myEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 p-12 text-center dark:border-neutral-800">
                <p className="text-sm text-neutral-500">You haven't registered for any events yet.</p>
                <Button as={Link} to="/events" size="sm" className="mt-4">Explore events</Button>
              </div>
            ) : (
              <Reveal className="grid gap-4 sm:grid-cols-2" amount={0.1}>
                {myEvents.map(({ reg, event }) => (
                  <Item key={reg.id}>
                    <button
                      onClick={() => setSelected(event)}
                      className="group flex w-full gap-4 rounded-2xl border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-acm-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-acm-500/40"
                    >
                      <img src={event.poster} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                      <div className="min-w-0 flex-1 py-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate font-semibold tracking-tight">{event.name}</h3>
                        </div>
                        <div className="mt-1.5 space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                          <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(event.date)}</p>
                          <p className="flex items-center gap-1.5 truncate"><MapPin className="h-3.5 w-3.5 shrink-0" /> {event.venue}</p>
                        </div>
                        <Badge tone={reg.status === 'Attended' ? 'neutral' : 'green'} dot={reg.status === 'Confirmed'} className="mt-2">
                          {reg.status}
                        </Badge>
                      </div>
                    </button>
                  </Item>
                ))}
              </Reveal>
            )}
          </div>
        </div>
      </div>

      <EventDetailsModal event={selected} open={!!selected} onClose={() => setSelected(null)} registered />
    </div>
  )
}

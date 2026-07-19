import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, CalendarCog, Users, SlidersHorizontal, ShieldCheck, Plus, Trash2,
  CalendarDays, TrendingUp, UserCheck, Ticket, LogOut, ArrowRight,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { participants as seedParticipants, statusMeta } from '../data/mock'
import * as svc from '../services/firestore'
import { formatDate } from '../lib/format'
import { cn } from '../lib/cn'

const tabs = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'events', label: 'Events', icon: CalendarCog },
  { key: 'registrations', label: 'Registrations', icon: Users },
  { key: 'content', label: 'Content', icon: SlidersHorizontal },
]

const statusCycle = ['open', 'coming-soon', 'closed']

export default function Admin() {
  const { user, loading, loginAsAdmin, logout, isLive } = useAuth()
  const { events, addEvent, editEvent, removeEvent } = useData()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [content, setContent] = useState({ testimonials: true, execom: true, gallery: false, announcements: true })
  const [regRows, setRegRows] = useState(seedParticipants)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const live = await svc.fetchAllRegistrations()
      if (!alive || !live) return // null → mock mode, keep seedParticipants
      setRegRows(
        live.map((r) => ({
          id: r.id,
          name: r.userName || '—',
          email: r.userEmail || '—',
          event: r.eventName || '—',
          college: r.college || '—',
          acmMember: !!r.acmMember,
          status: r.status || 'Confirmed',
        })),
      )
    })()
    return () => {
      alive = false
    }
  }, [])

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-acm-600 dark:border-neutral-800 dark:border-t-acm-500" />
      </div>
    )

  // ── Access gate ──────────────────────────────────────────
  if (!user || user.role !== 'admin') {
    return (
      <div className="section-shell flex min-h-screen flex-col items-center justify-center py-32 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
          <ShieldCheck className="h-6 w-6 text-acm-500" />
        </span>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Admin access required</h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
          {isLive
            ? 'This control center is restricted to administrators. Set your user’s `role` field to "admin" in Firestore to gain access.'
            : 'This control center is restricted to chapter administrators.'}
        </p>
        <div className="mt-6 flex gap-3">
          {!isLive && <Button onClick={() => loginAsAdmin()}>Continue as Admin (demo)</Button>}
          <Button as={Link} to="/" variant="outline">Back home</Button>
        </div>
      </div>
    )
  }

  const cycleStatus = (e) =>
    editEvent(e.id, { status: statusCycle[(statusCycle.indexOf(e.status) + 1) % 3] })
  const handleAdd = () =>
    addEvent({
      name: 'Untitled Event',
      poster: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=800&auto=format&fit=crop',
      date: new Date(Date.now() + 12096e5).toISOString().slice(0, 10),
      time: '10:00 AM',
      venue: 'TBD',
      shortDescription: 'Draft event — edit details.',
      description: '',
      status: 'coming-soon',
      fee: 0,
      deadline: new Date(Date.now() + 6048e5).toISOString().slice(0, 10),
      speakers: [],
    })

  const stats = [
    { label: 'Total Events', value: events.length, icon: CalendarDays, tone: 'blue' },
    { label: 'Total Registrations', value: regRows.length, icon: Ticket, tone: 'green' },
    { label: 'Active Users', value: 128, icon: UserCheck, tone: 'amber' },
    { label: 'Open Events', value: events.filter((e) => e.status === 'open').length, icon: TrendingUp, tone: 'blue' },
  ]

  return (
    <div className="pt-24">
      <div className="section-shell py-10">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge tone="blue" className="mb-2"><ShieldCheck className="h-3.5 w-3.5" /> Admin</Badge>
            <h1 className="text-2xl font-bold tracking-tight">Control Center</h1>
          </div>
          <Button onClick={() => { logout(); navigate('/') }} variant="ghost" size="sm">
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Tabs */}
          <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {tabs.map((t) => {
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'relative flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                    active ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white',
                  )}
                >
                  {active && (
                    <motion.span layoutId="admin-tab" transition={{ type: 'spring', stiffness: 360, damping: 30 }} className="absolute inset-0 -z-10 rounded-xl bg-neutral-100 dark:bg-neutral-800" />
                  )}
                  <t.icon className="h-4 w-4" /> {t.label}
                </button>
              )
            })}
          </nav>

          {/* Panels */}
          <div className="min-w-0">
            {tab === 'overview' && <Overview stats={stats} events={events} />}
            {tab === 'events' && <EventsPanel events={events} onAdd={handleAdd} onCycle={cycleStatus} onDelete={removeEvent} />}
            {tab === 'registrations' && <RegistrationsPanel rows={regRows} />}
            {tab === 'content' && <ContentPanel content={content} setContent={setContent} />}
          </div>
        </div>
      </div>
    </div>
  )
}

const toneBg = {
  blue: 'text-acm-600 bg-acm-50 dark:bg-acm-500/10 dark:text-acm-400',
  green: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400',
  amber: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400',
}

function Overview({ stats, events }) {
  const upcoming = [...events].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <span className={cn('grid h-10 w-10 place-items-center rounded-xl', toneBg[s.tone])}>
              <s.icon className="h-5 w-5" />
            </span>
            <div className="mt-4 text-3xl font-extrabold tracking-tight">{s.value}</div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Upcoming events</h3>
        <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
          {upcoming.map((e) => (
            <div key={e.id} className="flex items-center gap-4 py-3">
              <img src={e.poster} alt="" className="h-11 w-11 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.name}</p>
                <p className="text-xs text-neutral-400">{formatDate(e.date)} · {e.venue}</p>
              </div>
              <Badge tone={statusMeta[e.status].tone}>{statusMeta[e.status].label}</Badge>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function EventsPanel({ events, onAdd, onCycle, onDelete }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-100 p-5 dark:border-neutral-800">
        <h3 className="font-semibold tracking-tight">Manage events <span className="text-neutral-400">({events.length})</span></h3>
        <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" /> New event</Button>
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {events.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-4 p-4">
            <img src={e.poster} alt="" className="h-12 w-12 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{e.name}</p>
              <p className="text-xs text-neutral-400">{formatDate(e.date)} · {e.venue}</p>
            </div>
            <button onClick={() => onCycle(e)} title="Click to change status" className="transition-transform hover:scale-105">
              <Badge tone={statusMeta[e.status].tone} dot={e.status === 'open'}>{statusMeta[e.status].label}</Badge>
            </button>
            <button
              onClick={() => onDelete(e.id)}
              aria-label="Delete event"
              className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-400 transition-colors hover:border-rose-300 hover:text-rose-500 dark:border-neutral-800"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <p className="border-t border-neutral-100 p-4 text-xs text-neutral-400 dark:border-neutral-800">
        Tip: click a status badge to cycle Open → Coming Soon → Closed.
      </p>
    </motion.div>
  )
}

function RegistrationsPanel({ rows }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="border-b border-neutral-100 p-5 dark:border-neutral-800">
        <h3 className="font-semibold tracking-tight">Registration roster</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-neutral-400">
            <tr className="border-b border-neutral-100 dark:border-neutral-800">
              <th className="px-5 py-3 font-medium">Participant</th>
              <th className="px-5 py-3 font-medium">Event</th>
              <th className="px-5 py-3 font-medium">College</th>
              <th className="px-5 py-3 font-medium">ACM</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                <td className="px-5 py-3">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-neutral-400">{p.email}</div>
                </td>
                <td className="px-5 py-3 text-neutral-600 dark:text-neutral-300">{p.event}</td>
                <td className="px-5 py-3 text-neutral-600 dark:text-neutral-300">{p.college}</td>
                <td className="px-5 py-3">
                  {p.acmMember ? <Badge tone="blue">Member</Badge> : <span className="text-neutral-400">—</span>}
                </td>
                <td className="px-5 py-3">
                  <Badge tone={p.status === 'Confirmed' ? 'green' : 'amber'} dot={p.status === 'Confirmed'}>{p.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-neutral-100 p-4 dark:border-neutral-800">
        <span className="text-xs text-neutral-400">{rows.length} registrations</span>
        <Button size="sm" variant="outline" disabled>Export CSV <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </motion.div>
  )
}

const contentItems = [
  { key: 'testimonials', label: 'Testimonials', desc: 'Show the alumni testimonials carousel on the home page.' },
  { key: 'execom', label: 'Execom', desc: 'Display the executive committee section.' },
  { key: 'gallery', label: 'Gallery', desc: 'Show the event gallery preview.' },
  { key: 'announcements', label: 'Announcements', desc: 'Display updates & announcements banner.' },
]

function ContentPanel({ content, setContent }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="border-b border-neutral-100 p-5 dark:border-neutral-800">
        <h3 className="font-semibold tracking-tight">Website content</h3>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Toggle which sections appear on the public site.</p>
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {contentItems.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-medium">{c.label}</p>
              <p className="text-xs text-neutral-400">{c.desc}</p>
            </div>
            <Switch on={content[c.key]} onClick={() => setContent((s) => ({ ...s, [c.key]: !s[c.key] }))} />
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function Switch({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', on ? 'bg-acm-600' : 'bg-neutral-200 dark:bg-neutral-700')}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm', on ? 'left-[22px]' : 'left-0.5')}
      />
    </button>
  )
}

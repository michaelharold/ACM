import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, CalendarCog, Users, SlidersHorizontal, ShieldCheck, Plus, Trash2,
  CalendarDays, TrendingUp, UserCheck, Ticket, LogOut, ArrowRight, KeyRound,
  Contact2, ImageUp, ChevronDown, Save, Inbox, Images, CheckCircle2, Clock,
} from 'lucide-react'
import { MessagesPanel } from '../components/admin/MessagesPanel'
import { GalleryPanel } from '../components/admin/GalleryPanel'
import { ExecomPanel } from '../components/admin/ExecomPanel'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { participants as seedParticipants, statusMeta } from '../data/mock'
import * as svc from '../services/firestore'
import { avatarDataUri } from '../lib/avatar'
import { cropToPoster } from '../lib/imagePrep'
import { formatDate } from '../lib/format'
import { registrationStatus, hasRegWindow } from '../lib/eventClock'
import { cn } from '../lib/cn'

const statusCycle = ['open', 'coming-soon', 'closed']

// Format a Date as the value a <input type="datetime-local"> expects, in the
// admin's own local time (toISOString would shift it to UTC).
const toLocalInput = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function Admin() {
  const { user, loading, loginAsAdmin, loginAsEditor, logout, isLive } = useAuth()
  const { events, addEvent, editEvent, removeEvent } = useData()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [regRows, setRegRows] = useState(seedParticipants)
  const [unreadMsgs, setUnreadMsgs] = useState(0)

  const isAdmin = user?.role === 'admin'
  const perms = user?.permissions || {}
  const can = (key) => isAdmin || !!perms[key]
  const hasAnyAccess = isAdmin || Object.values(perms).some(Boolean)

  // Tabs are permission-gated: editors only see what they were granted.
  const tabs = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard, show: hasAnyAccess },
    { key: 'events', label: 'Events', icon: CalendarCog, show: can('events') },
    { key: 'execom', label: 'Execom', icon: Contact2, show: can('execom') },
    { key: 'content', label: 'Site Content', icon: SlidersHorizontal, show: can('content') },
    { key: 'gallery', label: 'Gallery', icon: Images, show: can('content') },
    { key: 'messages', label: 'Messages', icon: Inbox, show: isAdmin },
    { key: 'registrations', label: 'Registrations', icon: Users, show: isAdmin },
    { key: 'access', label: 'Access', icon: KeyRound, show: isAdmin },
  ].filter((t) => t.show)

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

  // Unread count for the overview tile; the Messages panel owns the full inbox.
  // Editors without the admin role can't read the inbox — the rules deny it —
  // so don't even ask, or the denial surfaces as an unhandled rejection.
  useEffect(() => {
    if (!isAdmin) return
    let alive = true
    svc.fetchMessages()
      .then((m) => alive && setUnreadMsgs(m.filter((x) => x.status === 'new').length))
      .catch(() => {})
    return () => { alive = false }
  }, [tab, isAdmin])

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-acm-600 dark:border-neutral-800 dark:border-t-acm-500" />
      </div>
    )

  // ── Access gate: admins, or members holding at least one grant ──
  if (!user || !hasAnyAccess) {
    return (
      <div className="section-shell flex min-h-screen flex-col items-center justify-center py-32 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
          <ShieldCheck className="h-6 w-6 text-acm-500" />
        </span>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Editor access required</h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
          {isLive
            ? 'This control center is restricted to administrators and members granted edit access from the Access tab.'
            : 'This control center is restricted to chapter administrators and members with edit access.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!isLive && <Button onClick={() => loginAsAdmin()}>Continue as Admin (demo)</Button>}
          {!isLive && <Button variant="secondary" onClick={() => loginAsEditor()}>Continue as Editor (demo)</Button>}
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
      // Registration window drives the Open/Coming Soon/Closed badge on its own.
      regOpens: toLocalInput(new Date()),
      regCloses: toLocalInput(new Date(Date.now() + 12096e5)),
      speakers: [],
      external: false,
      externalUrl: '',
    })

  const stats = [
    { label: 'Total Events', value: events.length, icon: CalendarDays, tone: 'blue' },
    { label: 'Total Registrations', value: regRows.length, icon: Ticket, tone: 'green' },
    { label: 'Unread Messages', value: unreadMsgs, icon: Inbox, tone: 'amber' },
    { label: 'Open Events', value: events.filter((e) => registrationStatus(e) === 'open').length, icon: TrendingUp, tone: 'blue' },
  ]

  return (
    <div className="pt-24">
      <div className="section-shell py-10">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge tone="blue" className="mb-2">
              <ShieldCheck className="h-3.5 w-3.5" /> {isAdmin ? 'Admin' : 'Editor'}
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight">Control Center</h1>
            {!isAdmin && (
              <p className="mt-1 text-xs text-neutral-400">
                Access granted for: {Object.keys(perms).filter((k) => perms[k]).join(', ')}
              </p>
            )}
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
            {tab === 'events' && can('events') && (
              <EventsPanel events={events} onAdd={handleAdd} onCycle={cycleStatus} onDelete={removeEvent} onSave={editEvent} />
            )}
            {tab === 'execom' && can('execom') && <ExecomPanel />}
            {tab === 'content' && can('content') && <SiteContentPanel />}
            {tab === 'gallery' && can('content') && <GalleryPanel />}
            {tab === 'messages' && isAdmin && <MessagesPanel adminName={user.name} />}
            {tab === 'registrations' && isAdmin && <RegistrationsPanel rows={regRows} />}
            {tab === 'access' && isAdmin && <AccessPanel isLive={isLive} />}
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

const inputCls =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800'

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

// ── Events: inline editor + poster upload ────────────────────
function EventEditor({ event, onSave }) {
  const [draft, setDraft] = useState({
    name: event.name,
    date: event.date,
    time: event.time,
    venue: event.venue,
    shortDescription: event.shortDescription,
    description: event.description || '',
    fee: event.fee || 0,
    deadline: event.deadline || '',
    regOpens: event.regOpens || '',
    regCloses: event.regCloses || '',
    external: !!event.external,
    externalUrl: event.externalUrl || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef(null)
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }))
  const isExternal = draft.external

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(draft)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function uploadPoster(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // Cropped and recompressed first — a raw phone photo is megabytes once
    // base64-encoded and would push the event document past Firestore's 1 MB
    // cap, so the save would fail and the poster would vanish on reload.
    try {
      onSave({ poster: await cropToPoster(file) })
    } catch {
      /* not a readable image — leave the existing poster in place */
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="grid gap-3 border-t border-neutral-100 bg-neutral-50/60 p-4 sm:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-800/30">
      <label className="text-xs font-medium text-neutral-500 sm:col-span-2">
        Event name
        <input className={cn(inputCls, 'mt-1')} value={draft.name} onChange={set('name')} />
      </label>

      {/* Internal (register on this site) vs external (redirect elsewhere) */}
      <div className="sm:col-span-2">
        <span className="text-xs font-medium text-neutral-500">Event type</span>
        <div className="mt-1 inline-flex rounded-lg border border-neutral-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-800">
          {[
            { key: false, label: 'Internal (register here)' },
            { key: true, label: 'External (redirect)' },
          ].map((opt) => (
            <button
              key={String(opt.key)}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, external: opt.key }))}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                isExternal === opt.key
                  ? 'bg-acm-600 text-white'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isExternal && (
        <label className="text-xs font-medium text-neutral-500 sm:col-span-2">
          Event website URL (users are redirected here to register)
          <input
            type="url"
            placeholder="https://external-site.com/event"
            className={cn(inputCls, 'mt-1')}
            value={draft.externalUrl}
            onChange={set('externalUrl')}
          />
        </label>
      )}

      <label className="text-xs font-medium text-neutral-500">
        Date
        <input type="date" className={cn(inputCls, 'mt-1')} value={draft.date} onChange={set('date')} />
      </label>
      <label className="text-xs font-medium text-neutral-500">
        Time
        <input className={cn(inputCls, 'mt-1')} placeholder="10:00 AM" value={draft.time} onChange={set('time')} />
      </label>
      <label className="text-xs font-medium text-neutral-500 sm:col-span-2">
        Venue
        <input className={cn(inputCls, 'mt-1')} value={draft.venue} onChange={set('venue')} />
      </label>
      {!isExternal && (
        <label className="text-xs font-medium text-neutral-500 sm:col-span-2">
          Registration Fee (₹)
          <input type="number" className={cn(inputCls, 'mt-1')} value={draft.fee} onChange={set('fee')} placeholder="Enter Registration Fee"  />
        </label>
      )}

      {/* Status window drives the Open/Coming Soon/Closed badge for both
          internal and external events, so nobody has to flip it by hand. */}
      <div className="rounded-lg border border-neutral-200 bg-white p-3 sm:col-span-2 dark:border-neutral-700 dark:bg-neutral-800/40">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
          <Clock className="h-3.5 w-3.5 text-acm-500" /> {isExternal ? 'Open / close window' : 'Registration window'} — the status badge updates automatically
        </div>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-neutral-500">
            Opens
            <input type="datetime-local" className={cn(inputCls, 'mt-1')} value={draft.regOpens} onChange={set('regOpens')} />
          </label>
          <label className="text-xs font-medium text-neutral-500">
            Closes
            <input type="datetime-local" className={cn(inputCls, 'mt-1')} value={draft.regCloses} onChange={set('regCloses')} />
          </label>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
          Before <strong>Opens</strong> → Coming Soon · between the two → {isExternal ? 'Open' : 'Registration Open'} · after <strong>Closes</strong> → Closed. Leave both blank to set the status manually instead.
        </p>
      </div>
      <label className="text-xs font-medium text-neutral-500 sm:col-span-2">
        Card blurb (short description)
        <input className={cn(inputCls, 'mt-1')} value={draft.shortDescription} onChange={set('shortDescription')} />
      </label>
      <label className="text-xs font-medium text-neutral-500 sm:col-span-2">
        Full description
        <textarea rows={3} className={cn(inputCls, 'mt-1')} value={draft.description} onChange={set('description')} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadPoster} />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <ImageUp className="h-4 w-4" /> Upload poster
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save details'}
        </Button>
        <span className="text-xs text-neutral-400">Countdown & LIVE badge come from date + time automatically.</span>
      </div>

      {/* Saved confirmation card */}
      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700 sm:col-span-2 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Event saved — changes are live.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function EventsPanel({ events, onAdd, onCycle, onDelete, onSave }) {
  const [openId, setOpenId] = useState(null)
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-100 p-5 dark:border-neutral-800">
        <h3 className="font-semibold tracking-tight">Manage events <span className="text-neutral-400">({events.length})</span></h3>
        <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" /> New event</Button>
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {events.map((e) => {
          const status = registrationStatus(e)
          const auto = hasRegWindow(e)
          return (
          <div key={e.id}>
            <div className="flex flex-wrap items-center gap-4 p-4">
              <img src={e.poster} alt="" className="h-12 w-12 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.name}</p>
                <p className="text-xs text-neutral-400">{formatDate(e.date)} · {e.time} · {e.venue}</p>
              </div>
              {auto ? (
                <span className="inline-flex items-center gap-1.5" title="Status is automatic from the registration window">
                  <Badge tone={statusMeta[status].tone} dot={status === 'open'}>{statusMeta[status].label}</Badge>
                  <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:bg-neutral-800">Auto</span>
                </span>
              ) : (
                <button onClick={() => onCycle(e)} title="Click to change status" className="transition-transform hover:scale-105">
                  <Badge tone={statusMeta[status].tone} dot={status === 'open'}>{statusMeta[status].label}</Badge>
                </button>
              )}
              <button
                onClick={() => setOpenId(openId === e.id ? null : e.id)}
                aria-label="Edit event"
                className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-400 transition-colors hover:border-acm-300 hover:text-acm-600 dark:border-neutral-800"
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', openId === e.id && 'rotate-180')} />
              </button>
              <button
                onClick={() => onDelete(e.id)}
                aria-label="Delete event"
                className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-400 transition-colors hover:border-rose-300 hover:text-rose-500 dark:border-neutral-800"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {openId === e.id && <EventEditor key={e.id} event={e} onSave={(patch) => onSave(e.id, patch)} />}
          </div>
          )
        })}
      </div>
      <p className="border-t border-neutral-100 p-4 text-xs text-neutral-400 dark:border-neutral-800">
        Tip: click a status badge to cycle Open → Coming Soon → Closed. Expand a row to edit details or upload a poster.
      </p>
    </motion.div>
  )
}

// ── Execom: member details + profile photo uploads ───────────
// ── Site content: ticker, stats, establishment — no code needed ──
function SiteContentPanel() {
  const { content, updateContent } = useData()
  const [draft, setDraft] = useState(content)
  const [dirty, setDirty] = useState(false)
  const mark = (next) => { setDraft(next); setDirty(true) }

  const setStat = (i, p) => mark({ ...draft, stats: draft.stats.map((s, j) => (j === i ? { ...s, ...p } : s)) })
  const setGoal = (i, p) => mark({ ...draft, goals: draft.goals.map((g, j) => (j === i ? { ...g, ...p } : g)) })
  const setWhy = (i, p) => mark({ ...draft, whyJoin: draft.whyJoin.map((w, j) => (j === i ? { ...w, ...p } : w)) })
  const setAnn = (i, p) => mark({ ...draft, announcements: draft.announcements.map((a, j) => (j === i ? { ...a, ...p } : a)) })
  const addAnn = () => mark({ ...draft, announcements: [...draft.announcements, { id: `a_${Date.now()}`, tag: 'New', text: '' }] })
  const delAnn = (i) => mark({ ...draft, announcements: draft.announcements.filter((_, j) => j !== i) })

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 p-5 dark:border-neutral-800">
        <div>
          <h3 className="font-semibold tracking-tight">Site content</h3>
          <p className="mt-1 text-xs text-neutral-400">Edit the front-page copy — headline, vision/mission/values, why-join cards, stats and the ticker. Live on the site, no code.</p>
        </div>
        <Button size="sm" disabled={!dirty} onClick={() => { updateContent(draft); setDirty(false) }}>
          <Save className="h-4 w-4" /> {dirty ? 'Save changes' : 'Saved'}
        </Button>
      </div>

      <div className="space-y-8 p-5">
        {/* Headline copy */}
        <div className="grid gap-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Headline copy</h4>
          <label className="block">
            <span className="mb-1.5 block text-xs text-neutral-400">Hero tagline</span>
            <textarea
              rows={2}
              className={cn(inputCls, 'resize-y')}
              value={draft.heroTagline}
              onChange={(e) => mark({ ...draft, heroTagline: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-neutral-400">About section title</span>
            <input
              className={inputCls}
              value={draft.aboutTitle}
              onChange={(e) => mark({ ...draft, aboutTitle: e.target.value })}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs text-neutral-400">Gallery title</span>
              <input
                className={inputCls}
                value={draft.galleryTitle}
                onChange={(e) => mark({ ...draft, galleryTitle: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-neutral-400">Gallery blurb</span>
              <input
                className={inputCls}
                value={draft.galleryBlurb}
                onChange={(e) => mark({ ...draft, galleryBlurb: e.target.value })}
              />
            </label>
          </div>
        </div>

        {/* Vision / Mission / Values */}
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Vision · Mission · Values</h4>
          <div className="mt-3 space-y-3">
            {draft.goals.map((g, i) => (
              <div key={i} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                <input
                  className={cn(inputCls, 'max-w-[200px] font-semibold')}
                  value={g.key}
                  onChange={(e) => setGoal(i, { key: e.target.value })}
                />
                <textarea
                  rows={2}
                  className={cn(inputCls, 'mt-2 resize-y')}
                  value={g.text}
                  onChange={(e) => setGoal(i, { text: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Why join cards */}
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">“Why join us” cards</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {draft.whyJoin.map((w, i) => (
              <div key={i} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                <input
                  className={cn(inputCls, 'font-semibold')}
                  value={w.title}
                  onChange={(e) => setWhy(i, { title: e.target.value })}
                />
                <textarea
                  rows={3}
                  className={cn(inputCls, 'mt-2 resize-y')}
                  value={w.body}
                  onChange={(e) => setWhy(i, { body: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Establishment */}
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Year of establishment</h4>
          <input
            className={cn(inputCls, 'mt-2 max-w-[160px]')}
            value={draft.established}
            onChange={(e) => mark({ ...draft, established: e.target.value })}
          />
        </div>

        {/* Stats */}
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Chapter statistics</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {draft.stats.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.label}</span>
                <input
                  type="number"
                  className={cn(inputCls, 'max-w-[100px]')}
                  value={s.value}
                  onChange={(e) => setStat(i, { value: Number(e.target.value) })}
                />
                <input
                  className={cn(inputCls, 'max-w-[60px]')}
                  placeholder="+"
                  value={s.suffix || ''}
                  onChange={(e) => setStat(i, { suffix: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Announcements ticker */}
        <div>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Announcement ticker</h4>
            <Button size="sm" variant="outline" onClick={addAnn}><Plus className="h-4 w-4" /> Add</Button>
          </div>
          <div className="mt-3 space-y-2">
            {draft.announcements.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2">
                <input
                  className={cn(inputCls, 'max-w-[110px]')}
                  value={a.tag}
                  onChange={(e) => setAnn(i, { tag: e.target.value })}
                />
                <input
                  className={cn(inputCls, 'flex-1')}
                  value={a.text}
                  placeholder="Announcement text…"
                  onChange={(e) => setAnn(i, { text: e.target.value })}
                />
                <button
                  onClick={() => delAnn(i)}
                  aria-label="Delete announcement"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-neutral-200 text-neutral-400 transition-colors hover:border-rose-300 hover:text-rose-500 dark:border-neutral-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Access: grant per-section edit rights to members ─────────
const grantKeys = [
  { key: 'events', label: 'Events' },
  { key: 'execom', label: 'Execom' },
  { key: 'content', label: 'Site Content' },
]

const demoUsers = [
  { id: 'du1', name: 'Parthiv P', email: 'design@acmtkmce.org', role: 'user', permissions: { execom: true } },
  { id: 'du2', name: 'Fitha Asma Sulfeekhar', email: 'program@acmtkmce.org', role: 'user', permissions: { events: true } },
  { id: 'du3', name: 'Ananya Suresh', email: 'docs@acmtkmce.org', role: 'user', permissions: {} },
]

function AccessPanel({ isLive }) {
  const [rows, setRows] = useState(() => {
    if (isLive) return []
    try {
      return JSON.parse(localStorage.getItem('acm-demo-users')) || demoUsers
    } catch {
      return demoUsers
    }
  })

  useEffect(() => {
    if (!isLive) return
    let alive = true
    svc.fetchUsers().then((users) => alive && users && setRows(users))
    return () => { alive = false }
  }, [isLive])

  function toggle(u, key) {
    const permissions = { ...(u.permissions || {}), [key]: !u.permissions?.[key] }
    const next = rows.map((r) => (r.id === u.id ? { ...r, permissions } : r))
    setRows(next)
    if (isLive) svc.updateUserAccess(u.id, permissions)
    else localStorage.setItem('acm-demo-users', JSON.stringify(next))
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="border-b border-neutral-100 p-5 dark:border-neutral-800">
        <h3 className="font-semibold tracking-tight">Access grants</h3>
        <p className="mt-1 text-xs text-neutral-400">
          Give members (e.g. team heads) permission to edit specific sections. Admins always have full access.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-neutral-400">
            <tr className="border-b border-neutral-100 dark:border-neutral-800">
              <th className="px-5 py-3 font-medium">Member</th>
              {grantKeys.map((g) => (
                <th key={g.key} className="px-5 py-3 text-center font-medium">{g.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {rows.filter((u) => u.role !== 'admin').map((u) => (
              <tr key={u.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                <td className="px-5 py-3">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-neutral-400">{u.email}</div>
                </td>
                {grantKeys.map((g) => (
                  <td key={g.key} className="px-5 py-3 text-center">
                    <Switch on={!!u.permissions?.[g.key]} onClick={() => toggle(u, g.key)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isLive && (
        <p className="border-t border-neutral-100 p-4 text-xs text-neutral-400 dark:border-neutral-800">
          Demo mode: grants persist locally. With Firebase live, grants write to each user’s `permissions` field.
        </p>
      )}
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

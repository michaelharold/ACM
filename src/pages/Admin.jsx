import { useEffect, useMemo, useRef, useState, Fragment } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, CalendarCog, Users, SlidersHorizontal, ShieldCheck, Plus, Trash2,
  CalendarDays, TrendingUp, UserCheck, Ticket, LogOut, ArrowRight, KeyRound,
  Contact2, ImageUp, ChevronDown, Save, Inbox, Images, CheckCircle2, Clock, Fingerprint, Download, Wallet, AlertCircle,
} from 'lucide-react'
import { MessagesPanel } from '../components/admin/MessagesPanel'
import { GalleryPanel } from '../components/admin/GalleryPanel'
import { ExecomPanel } from '../components/admin/ExecomPanel'
import { MembershipPanel } from '../components/admin/MembershipPanel'
import { PaymentsPanel } from '../components/admin/PaymentsPanel'
import { StorageMeter } from '../components/admin/StorageMeter'
import { downloadCsv } from '../lib/csv'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { participants as seedParticipants, statusMeta } from '../data/mock'
import * as svc from '../services/firestore'
import { avatarDataUri } from '../lib/avatar'
import { fitPoster } from '../lib/imagePrep'
import { formatDate, to24h, to12h } from '../lib/format'
import { registrationStatus, hasRegWindow, eventStart } from '../lib/eventClock'
import { departments as orgDepartments } from '../lib/orgData'
import { ComposeMessageModal } from '../components/messages/Thread'
import { MessageSquare, AlertTriangle, Search } from 'lucide-react'
import { paymentNeedsCheck, countPaymentChecks } from '../lib/paymentHealth'
import { cn } from '../lib/cn'

const statusCycle = ['open', 'coming-soon', 'closed']

// Format a Date as the value a <input type="datetime-local"> expects, in the
// admin's own local time (toISOString would shift it to UTC).
const toLocalInput = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

// Firestore Timestamp or ISO string → short readable date+time (blank if unset).
const fmtDateTime = (c) => {
  const d = typeof c === 'string' ? new Date(c) : c?.toDate?.()
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ''
}

const paymentLabel = (r) => {
  const s = (r.paymentStatus || '').toLowerCase()
  if (s === 'paid') return 'Paid'
  if (s === 'pending') return 'Pending'
  return 'Free' // 'free', 'n/a', or unset (older/mock rows)
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
    { key: 'membership', label: 'Membership', icon: Fingerprint, show: can('membership') },
    { key: 'payments', label: 'Payments', icon: Wallet, show: isAdmin },
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
          userId: r.userId || '',
          name: r.userName || '—',
          email: r.userEmail || '—',
          event: r.eventName || '—',
          eventId: r.eventId || '',
          department: r.department || '—',
          college: r.college || '—',
          acmMember: !!r.acmMember,
          isTeam: !!r.isTeam,
          teamName: r.teamName || '',
          members: r.members || [],
          teamSize: r.teamSize || (r.members ? r.members.length : 1),
          status: r.status || 'Confirmed',
          paymentStatus: r.paymentStatus || '',
          paymentId: r.razorpayPaymentId || '',
          razorpayOrderId: r.razorpayOrderId || '',
          paidAt: r.paidAt || null,
          createdAt: r.createdAt || null,
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
      .then((m) => alive && setUnreadMsgs(m.filter((x) => x.unreadForAdmin ?? (x.status === 'new')).length))
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

  // Registrations whose payment is stuck 'pending' (possible money-taken-but-
  // -not-recorded case) — surfaced so an admin reconciles them with Razorpay.
  const paymentAlerts = countPaymentChecks(regRows)

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
                  <span className="relative">
                    <t.icon className="h-4 w-4" />
                    {/* Red alert dot: unread messages, or payments needing a check */}
                    {((t.key === 'messages' && unreadMsgs > 0) || (t.key === 'registrations' && paymentAlerts > 0)) && (
                      <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 dark:border-neutral-900" />
                    )}
                  </span>
                  {t.label}
                </button>
              )
            })}
          </nav>

          {/* Panels */}
          <div className="min-w-0">
            {tab === 'overview' && <Overview stats={stats} events={events} paymentAlerts={paymentAlerts} onReviewAlerts={() => setTab('registrations')} />}
            {tab === 'events' && can('events') && (
              <EventsPanel events={events} onAdd={handleAdd} onCycle={cycleStatus} onDelete={removeEvent} onSave={editEvent} />
            )}
            {tab === 'execom' && can('execom') && <ExecomPanel />}
            {tab === 'content' && can('content') && <SiteContentPanel />}
            {tab === 'gallery' && can('content') && <GalleryPanel />}
            {tab === 'membership' && can('membership') && <MembershipPanel canEdit={can('membership')} adminName={user.name} />}
            {tab === 'payments' && isAdmin && <PaymentsPanel />}
            {tab === 'messages' && isAdmin && <MessagesPanel adminName={user.name} />}
            {tab === 'registrations' && isAdmin && <RegistrationsPanel rows={regRows} events={events} adminName={user.name} />}
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

function Overview({ stats, events, paymentAlerts = 0, onReviewAlerts }) {
  const upcoming = [...events].sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(0, 4)
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {paymentAlerts > 0 && (
        <button
          onClick={onReviewAlerts}
          className="flex w-full items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-left transition-colors hover:bg-amber-100/70 dark:border-amber-500/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/15"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {paymentAlerts} payment{paymentAlerts === 1 ? '' : 's'} need{paymentAlerts === 1 ? 's' : ''} a check
            </p>
            <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-300/80">
              These registrations are stuck “pending” — a payment may have been taken but not recorded (e.g. the tab was
              closed mid-checkout). Open Registrations to review and reconcile them against your Razorpay dashboard.
            </p>
          </div>
        </button>
      )}
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

      <StorageMeter />

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Upcoming events</h3>
        <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
          {upcoming.map((e) => {
            // Use the SAME live status the events page shows (derived from the
            // registration window), not the stored e.status — otherwise every
            // freshly-created event reads its default 'coming-soon' here.
            const meta = statusMeta[registrationStatus(e)] || statusMeta['coming-soon']
            return (
              <div key={e.id} className="flex items-center gap-4 py-3">
                <img src={e.poster} alt="" className="h-11 w-11 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-neutral-400">{formatDate(e.date)} · {e.venue}</p>
                </div>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </div>
            )
          })}
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
    acmDiscount: event.acmDiscount || 0,
    maxRegistrations: event.maxRegistrations || '',
    isGroup: !!event.isGroup,
    minTeamSize: event.minTeamSize || '',
    maxTeamSize: event.maxTeamSize || '',
    paymentAccountId: event.paymentAccountId || '',
    deadline: event.deadline || '',
    regOpens: event.regOpens || '',
    regCloses: event.regCloses || '',
    external: !!event.external,
    externalUrl: event.externalUrl || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [accounts, setAccounts] = useState([])
  const fileRef = useRef(null)

  useEffect(() => {
    let alive = true
    svc.fetchPaymentAccounts().then((l) => alive && setAccounts((l || []).filter((a) => a.active !== false))).catch(() => {})
    return () => { alive = false }
  }, [])
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }))
  const isExternal = draft.external

  // Basic sanity checks so a nonsensical event can't be saved (dates in the
  // past, discount bigger than the fee, window inverted, etc.). Returns the
  // first problem to show, or '' when everything's fine.
  function validate(d) {
    if (!d.name?.trim()) return 'Give the event a name.'
    if (!d.date) return 'Pick an event date.'
    const todayStr = new Date().toISOString().slice(0, 10)
    if (d.date !== event.date && d.date < todayStr) return 'The event date can’t be in the past.'
    if (d.external) {
      if (!d.externalUrl?.trim()) return 'An external event needs its registration URL.'
    } else {
      const fee = Number(d.fee)
      if (d.fee !== '' && (Number.isNaN(fee) || fee < 0)) return 'Fee must be a number of ₹0 or more.'
      const disc = Number(d.acmDiscount)
      if (d.acmDiscount !== '' && (Number.isNaN(disc) || disc < 0)) return 'Discount must be a number of ₹0 or more.'
      if (fee > 0 && disc > fee) return 'The ACM discount can’t be more than the fee.'
      if (d.maxRegistrations !== '' && d.maxRegistrations != null) {
        const cap = Number(d.maxRegistrations)
        if (!Number.isInteger(cap) || cap < 0) return `${d.isGroup ? 'Max teams' : 'Max registrations'} must be a whole number of 0 or more.`
      }
      if (d.isGroup) {
        const min = Number(d.minTeamSize)
        const max = Number(d.maxTeamSize)
        if (!Number.isInteger(min) || min < 1) return 'Minimum team size must be a whole number of 1 or more.'
        if (!Number.isInteger(max) || max < 1) return 'Maximum team size must be a whole number of 1 or more.'
        if (max < min) return 'Maximum team size can’t be less than the minimum.'
      }
    }
    const opens = d.regOpens ? new Date(d.regOpens).getTime() : null
    const closes = d.regCloses ? new Date(d.regCloses).getTime() : null
    if (opens && closes && opens > closes) return 'Registration “Opens” must be before “Closes”.'
    if (opens && d.date) {
      const start = eventStart(d).getTime()
      if (!Number.isNaN(start) && start < opens) return 'The event start time should be after registration opens.'
    }
    return ''
  }

  async function handleSave() {
    const err = validate(draft)
    if (err) { setFormErr(err); return }
    setFormErr('')
    setSaving(true)
    try {
      // Numbers are clamped so a stray "-" or blank can't be saved (and a fee
      // never reaches Razorpay negative). Max 0 = unlimited.
      await onSave({
        ...draft,
        fee: Math.max(0, Number(draft.fee) || 0),
        acmDiscount: Math.max(0, Number(draft.acmDiscount) || 0),
        maxRegistrations: Math.max(0, Math.floor(Number(draft.maxRegistrations) || 0)),
        isGroup: !!draft.isGroup,
        minTeamSize: draft.isGroup ? Math.max(1, Math.floor(Number(draft.minTeamSize) || 1)) : 0,
        maxTeamSize: draft.isGroup ? Math.max(1, Math.floor(Number(draft.maxTeamSize) || 1)) : 0,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function uploadPoster(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // Resized (not cropped) and recompressed first — the full poster is kept at
    // any aspect ratio, and a raw phone photo is megabytes once base64-encoded,
    // which would push the event document past Firestore's 1 MB cap.
    try {
      onSave({ poster: await fitPoster(file) })
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
        Start time
        <input
          type="time"
          className={cn(inputCls, 'mt-1')}
          value={to24h(draft.time)}
          onChange={(e) => setDraft((d) => ({ ...d, time: to12h(e.target.value) }))}
        />
      </label>
      <label className="text-xs font-medium text-neutral-500 sm:col-span-2">
        Venue
        <input className={cn(inputCls, 'mt-1')} value={draft.venue} onChange={set('venue')} />
      </label>
      {!isExternal && (
        <label className="text-xs font-medium text-neutral-500">
          Registration Fee (₹)
          <input type="number" min="0" className={cn(inputCls, 'mt-1')} value={draft.fee} onChange={set('fee')} placeholder="Enter Registration Fee"  />
        </label>
      )}
      {!isExternal && (
        <label className="text-xs font-medium text-neutral-500">
          {draft.isGroup ? 'Max teams' : 'Max registrations'}
          <input
            type="number"
            min="0"
            step="1"
            className={cn(inputCls, 'mt-1')}
            value={draft.maxRegistrations}
            onChange={set('maxRegistrations')}
            placeholder="0 = unlimited"
          />
          <span className="mt-1 block text-[11px] font-normal text-neutral-400">
            Registration closes automatically once this many {draft.isGroup ? 'teams have' : 'people have'} registered.
          </span>
        </label>
      )}

      {/* Group / team event */}
      {!isExternal && (
        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={draft.isGroup}
              onChange={(e) => setDraft((d) => ({ ...d, isGroup: e.target.checked }))}
              className="h-4 w-4 rounded border-neutral-300 text-acm-600 dark:border-neutral-700 dark:bg-neutral-800"
            />
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Group event (register as a team)</span>
          </label>
          {draft.isGroup && (
            <div className="mt-2.5 grid gap-3 rounded-lg border border-neutral-200 bg-white p-3 sm:grid-cols-2 dark:border-neutral-700 dark:bg-neutral-800/40">
              <label className="text-xs font-medium text-neutral-500">
                Minimum members per team
                <input type="number" min="1" step="1" className={cn(inputCls, 'mt-1')} value={draft.minTeamSize} onChange={set('minTeamSize')} placeholder="e.g. 2" />
              </label>
              <label className="text-xs font-medium text-neutral-500">
                Maximum members per team
                <input type="number" min="1" step="1" className={cn(inputCls, 'mt-1')} value={draft.maxTeamSize} onChange={set('maxTeamSize')} placeholder="e.g. 4" />
              </label>
              <p className="text-[11px] font-normal leading-relaxed text-neutral-400 sm:col-span-2">
                Counts include the person registering. The registrant adds their teammates by their website-registered email during signup.
              </p>
            </div>
          )}
        </div>
      )}
      {!isExternal && Number(draft.fee) > 0 && (
        <label className="text-xs font-medium text-neutral-500">
          ACM member discount (₹ off)
          <input type="number" min="0" className={cn(inputCls, 'mt-1')} value={draft.acmDiscount} onChange={set('acmDiscount')} placeholder="0 = no discount" />
        </label>
      )}
      {!isExternal && Number(draft.fee) > 0 && (
        <label className="text-xs font-medium text-neutral-500">
          Credit payment to
          <select className={cn(inputCls, 'mt-1')} value={draft.paymentAccountId} onChange={set('paymentAccountId')}>
            <option value="">Default account</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
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

      {formErr && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 sm:col-span-2 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {formErr}
        </p>
      )}

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
        <Button
          size="sm"
          onClick={async () => {
            // Create the draft AND open its editor straight away, so the form is
            // ready to fill instead of making the admin click the new row.
            const created = await onAdd()
            if (created?.id) setOpenId(created.id)
          }}
        >
          <Plus className="h-4 w-4" /> New event
        </Button>
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

  // Departments — the shared dropdown options for profiles and event
  // registration. Empty until customised, which falls back to the built-in list.
  const depts = Array.isArray(draft.departments) && draft.departments.length ? draft.departments : orgDepartments
  const setDept = (i, v) => mark({ ...draft, departments: depts.map((d, j) => (j === i ? v : d)) })
  const addDept = () => mark({ ...draft, departments: [...depts, ''] })
  const delDept = (i) => mark({ ...draft, departments: depts.filter((_, j) => j !== i) })

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 p-5 dark:border-neutral-800">
        <div>
          <h3 className="font-semibold tracking-tight">Site content</h3>
          <p className="mt-1 text-xs text-neutral-400">Edit the front-page copy — headline, vision/mission/values, why-join cards, stats and the ticker. Live on the site, no code.</p>
        </div>
        <Button size="sm" disabled={!dirty} onClick={() => {
          // Clean the department list on the way out: trim, drop blanks, de-dupe.
          const cleaned = [...new Set((draft.departments || []).map((d) => d.trim()).filter(Boolean))]
          updateContent({ ...draft, departments: cleaned })
          setDirty(false)
        }}>
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

        {/* Departments — shared dropdown options */}
        <div>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Departments</h4>
            <Button size="sm" variant="outline" onClick={addDept}><Plus className="h-4 w-4" /> Add</Button>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            The options members pick from in their profile and when registering for events. Changes apply everywhere on save.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {depts.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={cn(inputCls, 'flex-1')}
                  value={d}
                  placeholder="Department name…"
                  onChange={(e) => setDept(i, e.target.value)}
                />
                <button
                  onClick={() => delDept(i)}
                  aria-label="Delete department"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-neutral-200 text-neutral-400 transition-colors hover:border-rose-300 hover:text-rose-500 dark:border-neutral-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
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
  { key: 'membership', label: 'Membership' },
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

  const [q, setQ] = useState('')
  const [grant, setGrant] = useState('all') // all | any | none | <grantKey>

  function toggle(u, key) {
    const permissions = { ...(u.permissions || {}), [key]: !u.permissions?.[key] }
    const next = rows.map((r) => (r.id === u.id ? { ...r, permissions } : r))
    setRows(next)
    if (isLive) svc.updateUserAccess(u.id, permissions)
    else localStorage.setItem('acm-demo-users', JSON.stringify(next))
  }

  const members = rows.filter((u) => u.role !== 'admin')
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return members.filter((u) => {
      if (needle && ![u.name, u.email].some((f) => (f || '').toLowerCase().includes(needle))) return false
      const perms = u.permissions || {}
      const anyGranted = Object.values(perms).some(Boolean)
      if (grant === 'any' && !anyGranted) return false
      if (grant === 'none' && anyGranted) return false
      if (grant !== 'all' && grant !== 'any' && grant !== 'none' && !perms[grant]) return false
      return true
    })
  }, [members, q, grant])

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="border-b border-neutral-100 p-5 dark:border-neutral-800">
        <h3 className="font-semibold tracking-tight">Access grants</h3>
        <p className="mt-1 text-xs text-neutral-400">
          Give members (e.g. team heads) permission to edit specific sections. Admins always have full access.
        </p>
      </div>

      {/* Search + filter so a specific member is easy to find */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-4 dark:border-neutral-800">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email"
            className={cn(inputCls, 'pl-9')}
          />
        </div>
        <select className={cn(inputCls, 'max-w-[200px]')} value={grant} onChange={(e) => setGrant(e.target.value)}>
          <option value="all">All members</option>
          <option value="any">Has any access</option>
          <option value="none">No access yet</option>
          {grantKeys.map((g) => <option key={g.key} value={g.key}>Can edit: {g.label}</option>)}
        </select>
        <span className="text-xs text-neutral-400">{list.length} of {members.length}</span>
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
            {list.map((u) => (
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
        {list.length === 0 && (
          <p className="p-10 text-center text-sm text-neutral-500">
            {members.length ? 'No members match your search.' : 'No members yet.'}
          </p>
        )}
      </div>
      {!isLive && (
        <p className="border-t border-neutral-100 p-4 text-xs text-neutral-400 dark:border-neutral-800">
          Demo mode: grants persist locally. With Firebase live, grants write to each user’s `permissions` field.
        </p>
      )}
    </motion.div>
  )
}

function RegistrationsPanel({ rows, events = [], adminName }) {
  const [dept, setDept] = useState('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [member, setMember] = useState('all') // all | member | non-member
  const [msgTo, setMsgTo] = useState(null)

  // Events actually present in the roster, for the dropdown.
  const eventOptions = useMemo(() => {
    const seen = new Map()
    rows.forEach((r) => { if (r.event) seen.set(r.eventId || r.event, r.event) })
    events.forEach((e) => { if (!seen.has(e.id)) seen.set(e.id, e.name) })
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
  }, [rows, events])

  const deptOptions = useMemo(
    () => [...new Set(rows.map((r) => r.department).filter((d) => d && d !== '—'))].sort(),
    [rows],
  )

  const filtered = useMemo(() => rows.filter((r) => {
    if (dept !== 'all' && r.department !== dept) return false
    if (eventFilter !== 'all' && (r.eventId || r.event) !== eventFilter) return false
    if (member === 'member' && !r.acmMember) return false
    if (member === 'non-member' && r.acmMember) return false
    return true
  }), [rows, dept, eventFilter, member])

  const alerts = filtered.filter((r) => paymentNeedsCheck(r)).length

  // Team member rows expand to show every member's email + phone.
  const [expanded, setExpanded] = useState(() => new Set())
  const toggleExpand = (id) => setExpanded((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  // With no filter applied, group the roster by event; each group exports on its own.
  const grouped = eventFilter === 'all' && dept === 'all' && member === 'all'
  const groups = useMemo(() => {
    const m = new Map()
    filtered.forEach((r) => {
      const k = r.event || '—'
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(r)
    })
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const slug = (s) => (s || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

  // CSV columns are team-aware: team name + every member's name/email/phone are
  // filled for team rows and blank for solo ones.
  const csvCols = [
    { label: 'Team', value: (r) => (r.isTeam ? r.teamName : '') },
    { label: 'Name', value: (r) => r.name },
    { label: 'Email', value: (r) => r.email },
    { label: 'Event', value: (r) => r.event },
    { label: 'Department', value: (r) => r.department },
    { label: 'College', value: (r) => r.college },
    { label: 'Team members', value: (r) => (r.isTeam ? (r.members || []).map((m) => m.name).filter(Boolean).join('; ') : '') },
    { label: 'Member emails', value: (r) => (r.isTeam ? (r.members || []).map((m) => m.email).filter(Boolean).join('; ') : '') },
    { label: 'Member phones', value: (r) => (r.isTeam ? (r.members || []).map((m) => m.phone).filter(Boolean).join('; ') : '') },
    { label: 'ACM Member', value: (r) => (r.acmMember ? 'Yes' : 'No') },
    { label: 'Status', value: (r) => r.status },
    { label: 'Payment', value: (r) => paymentLabel(r) },
    { label: 'Payment ID', value: (r) => r.paymentId || '' },
    { label: 'Paid at', value: (r) => fmtDateTime(r.paidAt) },
  ]
  const exportCsv = (list, name = 'event-registrations') => downloadCsv(name, list, csvCols)

  const renderTable = (list) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-neutral-400">
          <tr className="border-b border-neutral-100 dark:border-neutral-800">
            <th className="px-5 py-3 font-medium">Participant / Team</th>
            <th className="px-5 py-3 font-medium">Event</th>
            <th className="px-5 py-3 font-medium">Department</th>
            <th className="px-5 py-3 font-medium">ACM</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Payment</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {list.map((p) => {
            const isOpen = expanded.has(p.id)
            return (
              <Fragment key={p.id}>
                <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        {p.isTeam ? (
                          <>
                            <button onClick={() => toggleExpand(p.id)} className="flex items-center gap-1.5 text-left font-medium">
                              <Users className="h-3.5 w-3.5 text-acm-500" /> {p.teamName || 'Team'}
                              <ChevronDown className={cn('h-3.5 w-3.5 text-neutral-400 transition-transform', isOpen && 'rotate-180')} />
                            </button>
                            <div className="text-xs text-neutral-400">{p.teamSize} members · led by {p.name}</div>
                          </>
                        ) : (
                          <>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-neutral-400">{p.email}</div>
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => setMsgTo(p)}
                        disabled={!p.userId}
                        title={p.userId ? 'Message the registrant' : 'No account linked'}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-neutral-200 text-neutral-400 transition-colors hover:border-acm-300 hover:text-acm-500 disabled:opacity-30 dark:border-neutral-700"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-neutral-600 dark:text-neutral-300">{p.event}</td>
                  <td className="px-5 py-3 text-neutral-600 dark:text-neutral-300">{p.department}</td>
                  <td className="px-5 py-3">
                    {p.acmMember ? <Badge tone="blue">Member</Badge> : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={p.status === 'Confirmed' ? 'green' : 'amber'} dot={p.status === 'Confirmed'}>{p.status}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    {(p.paymentStatus || '').toLowerCase() === 'paid' ? (
                      <div>
                        <Badge tone="green" dot>Paid</Badge>
                        {p.paymentId && (
                          <div className="mt-1 text-[11px] leading-tight text-neutral-400">
                            <code>{p.paymentId}</code>
                            {fmtDateTime(p.paidAt) && <div>{fmtDateTime(p.paidAt)}</div>}
                          </div>
                        )}
                      </div>
                    ) : (p.paymentStatus || '').toLowerCase() === 'pending' ? (
                      paymentNeedsCheck(p) ? (
                        <span className="inline-flex items-center gap-1.5" title="Stuck pending — a payment may have been taken but not recorded. Check Razorpay.">
                          <Badge tone="red" dot>Check</Badge>
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        </span>
                      ) : (
                        <Badge tone="amber">Pending</Badge>
                      )
                    ) : (
                      <span className="text-neutral-400">Free</span>
                    )}
                  </td>
                </tr>
                {p.isTeam && isOpen && (
                  <tr className="bg-neutral-50/60 dark:bg-neutral-800/30">
                    <td colSpan={6} className="px-5 py-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Team members</div>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {(p.members || []).map((m, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                            <span className="font-medium">{m.name || '—'}</span>
                            {m.role === 'leader' && <Badge tone="blue">Leader</Badge>}
                            <span className="text-neutral-400">{m.email}</span>
                            {m.phone && <span className="text-neutral-400">· {m.phone}</span>}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 p-5 dark:border-neutral-800">
        <h3 className="font-semibold tracking-tight">Registration roster</h3>
        <Button size="sm" variant="outline" onClick={() => exportCsv(filtered)} disabled={!filtered.length}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {alerts > 0 && (
        <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-500/25 dark:bg-amber-500/10">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-amber-800 dark:text-amber-200">
            <strong>{alerts}</strong> registration{alerts === 1 ? '' : 's'} below {alerts === 1 ? 'is' : 'are'} stuck on a
            pending payment (marked <span className="font-semibold">Check</span>). A payment may have been taken but not
            recorded — verify each against your Razorpay dashboard, then mark it paid or remove it there.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-4 dark:border-neutral-800">
        <select className={cn(inputCls, 'max-w-[200px]')} value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
          <option value="all">All events</option>
          {eventOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select className={cn(inputCls, 'max-w-[220px]')} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="all">All departments</option>
          {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-800">
          {[
            { k: 'all', label: 'All' },
            { k: 'member', label: 'ACM members' },
            { k: 'non-member', label: 'Non-members' },
          ].map((o) => (
            <button
              key={o.k}
              onClick={() => setMember(o.k)}
              className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                member === o.k ? 'bg-acm-600 text-white' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200')}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="p-10 text-center text-sm text-neutral-500">
          {rows.length ? 'No registrations match these filters.' : 'No registrations yet.'}
        </p>
      ) : grouped ? (
        // No filter → one section per event, each independently exportable.
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {groups.map(([name, list]) => (
            <div key={name}>
              <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-50/60 px-5 py-3 dark:bg-neutral-800/30">
                <h4 className="text-sm font-semibold tracking-tight">
                  {name} <span className="text-neutral-400">({list.length})</span>
                </h4>
                <Button size="sm" variant="outline" onClick={() => exportCsv(list, `registrations-${slug(name)}`)}>
                  <Download className="h-4 w-4" /> Export
                </Button>
              </div>
              {renderTable(list)}
            </div>
          ))}
        </div>
      ) : (
        renderTable(filtered)
      )}
      <div className="flex items-center justify-between border-t border-neutral-100 p-4 dark:border-neutral-800">
        <span className="text-xs text-neutral-400">{filtered.length} of {rows.length} registrations</span>
      </div>

      <ComposeMessageModal
        open={!!msgTo}
        onClose={() => setMsgTo(null)}
        toUid={msgTo?.userId}
        toName={msgTo?.name}
        toEmail={msgTo?.email}
        fromName={adminName}
      />
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

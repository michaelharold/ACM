import { useEffect, useMemo, useRef, useState, Fragment } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, CalendarCog, Users, SlidersHorizontal, ShieldCheck, Plus, Trash2,
  CalendarDays, TrendingUp, UserCheck, Ticket, LogOut, ArrowRight, KeyRound,
  Contact2, ImageUp, ChevronDown, Save, Inbox, Images, CheckCircle2, Clock, Fingerprint, Download, Wallet, AlertCircle,
  Loader2, UserX, FileText, Shuffle, Info, MessageCircle, School, UserRound, Mail, Phone, Send, Globe, GraduationCap, ReceiptText, Eye, EyeOff,
  BarChart3,
} from 'lucide-react'
import { MessagesPanel } from '../components/admin/MessagesPanel'
import { GalleryPanel } from '../components/admin/GalleryPanel'
import { ExecomPanel } from '../components/admin/ExecomPanel'
import { MembershipPanel } from '../components/admin/MembershipPanel'
import { MemberVerificationPanel } from '../components/admin/MemberVerificationPanel'
import { AnalyticsPanel } from '../components/admin/AnalyticsPanel'
import { fetchPendingVerificationCount } from '../services/membership'
import { PaymentsPanel } from '../components/admin/PaymentsPanel'
import { StorageMeter } from '../components/admin/StorageMeter'
import { UpiAccountForm } from '../components/payments/UpiAccountForm'
import { PaymentReviewPanel } from '../components/admin/PaymentReviewPanel'
import { ReceiptReviewModal } from '../components/payments/ReceiptReviewModal'
import { fetchPendingReviews, fetchUpiAccounts } from '../services/payments'
import { paymentState, PAYMENT_STATE_META } from '../lib/manualPay'
import * as pay from '../services/payments'
import { isRazorpayMode, isApiAvailable } from '../lib/payments'
import { downloadCsv } from '../lib/csv'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { participants as seedParticipants, statusMeta } from '../data/mock'
import * as svc from '../services/firestore'
import { avatarDataUri } from '../lib/avatar'
import { fitPoster } from '../lib/imagePrep'
import { EVENT_GUIDELINE_MAX_IMAGES } from '../lib/storageBudget'
import { formatDate, to24h, to12h } from '../lib/format'
import { effectiveStatus, hasRegWindow, eventStart, isEnded, startMs } from '../lib/eventClock'
import { departments as orgDepartments } from '../lib/orgData'
import { ComposeMessageModal } from '../components/messages/Thread'
import { MessageSquare, AlertTriangle, Search } from 'lucide-react'
import { paymentNeedsCheck, countPaymentChecks } from '../lib/paymentHealth'
import { adminTeamAction } from '../lib/teamAdmin'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Modal } from '../components/ui/Modal'
import { Field, FormSection, InfoHint } from '../components/ui/Field'
import { Switch } from '../components/ui/Switch'
import { VisibilityRow, EventControlsModal, EventQuickChips, lifecycle } from '../components/admin/EventControls'
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
  if (!isRazorpayMode) return PAYMENT_STATE_META[paymentState(r)].label
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
  // Demo mode shows sample rows; live mode starts empty and loads the real
  // roster (only for those allowed to read it — see loadRegistrations).
  const [regRows, setRegRows] = useState(() => (isLive ? [] : seedParticipants))
  const [unreadMsgs, setUnreadMsgs] = useState(0)
  // Receipts waiting for verification — drives the tab dot and Overview banner.
  const [pendingReviews, setPendingReviews] = useState(0)
  // "Already a member?" requests waiting for a decision.
  const [pendingMembers, setPendingMembers] = useState(0)

  const isAdmin = user?.role === 'admin'
  const perms = user?.permissions || {}
  const can = (key) => isAdmin || !!perms[key]
  const hasAnyAccess = isAdmin || Object.values(perms).some(Boolean)
  const canVerify = !isRazorpayMode && (can('registrations') || can('membership'))

  // Tabs are permission-gated: editors only see what they were granted.
  const tabs = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard, show: hasAnyAccess },
    { key: 'analytics', label: 'Analytics', icon: BarChart3, show: can('registrations') },
    { key: 'events', label: 'Events', icon: CalendarCog, show: can('events') },
    { key: 'execom', label: 'Execom', icon: Contact2, show: can('execom') },
    { key: 'content', label: 'Site Content', icon: SlidersHorizontal, show: can('content') },
    { key: 'gallery', label: 'Gallery', icon: Images, show: can('content') },
    { key: 'membership', label: 'Membership', icon: Fingerprint, show: can('membership') },
    { key: 'memberVerify', label: 'Member verification', icon: UserCheck, show: can('membership') },
    { key: 'verify', label: 'Verify payments', icon: ReceiptText, show: canVerify },
    { key: 'payments', label: 'Payments', icon: Wallet, show: isAdmin },
    { key: 'messages', label: 'Messages', icon: Inbox, show: can('messages') },
    { key: 'registrations', label: 'Registrations', icon: Users, show: can('registrations') },
    { key: 'access', label: 'Access', icon: KeyRound, show: isAdmin },
  ].filter((t) => t.show)

  // Pulled out so an admin team edit (add/remove member, delete team) can
  // refresh the roster on demand, not just on first mount.
  async function loadRegistrations() {
    // Only registrations readers can list them — for anyone else the rules deny
    // the query, which used to surface as an unhandled rejection.
    if (!can('registrations')) return
    let live
    try {
      live = await svc.fetchAllRegistrations()
    } catch {
      return // keep whatever is showing; the Registrations tab has its own state
    }
    if (!live) return // null → mock mode, keep seedParticipants
    setRegRows(
      live.map((r) => ({
        id: r.id,
        userId: r.userId || '',
        name: r.userName || '—',
        email: r.userEmail || '—',
        phone: r.phone || '',
        event: r.eventName || '—',
        eventName: r.eventName || '',
        eventId: r.eventId || '',
        department: r.department || '—',
        college: r.college || '—',
        year: r.year || '',
        acmMember: !!r.acmMember,
        isTeam: !!r.isTeam,
        teamName: r.teamName || '',
        randomlyGrouped: !!r.randomlyGrouped,
        members: r.members || [],
        memberUids: r.memberUids || [],
        date: r.date || '',
        teamSize: r.teamSize || (r.members ? r.members.length : 1),
        status: r.status || 'Confirmed',
        paymentStatus: r.paymentStatus || '',
        paymentId: r.razorpayPaymentId || '',
        // Kept alongside the renamed `paymentId` (used for display/CSV) so
        // paymentNeedsCheck's razorpayPaymentId check still has a field to read.
        razorpayPaymentId: r.razorpayPaymentId || '',
        razorpayOrderId: r.razorpayOrderId || '',
        paidAt: r.paidAt || null,
        receiptId: r.receiptId || '',
        utr: r.utr || '',
        amountDue: r.amountDue,
        upiAccountId: r.upiAccountId || '',
        membershipId: r.membershipId || '',
        claimedMembershipId: r.claimedMembershipId || '',
        rejectReason: r.rejectReason || '',
        reviewedBy: r.reviewedBy || '',
        reviewedAt: r.reviewedAt || null,
        receiptSubmittedAt: r.receiptSubmittedAt || null,
        counted: !!r.counted,
        seatHeld: r.seatHeld,
        createdAt: r.createdAt || null,
      })),
    )
  }

  useEffect(() => {
    loadRegistrations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, can('registrations')])

  // Signed-out visitors go to sign in, then come straight back here.
  useEffect(() => {
    if (isLive && !loading && !user) navigate('/auth', { replace: true, state: { from: '/admin' } })
  }, [isLive, loading, user, navigate])

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

  useEffect(() => {
    if (!canVerify) return
    let alive = true
    fetchPendingReviews({ events: can('registrations'), membership: can('membership') })
      .then((l) => alive && setPendingReviews(l.length))
      .catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canVerify, tab])

  useEffect(() => {
    if (!can('membership')) return
    let alive = true
    fetchPendingVerificationCount().then((n) => alive && setPendingMembers(n)).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tab])

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
          {!isLive && import.meta.env.DEV && <Button onClick={() => loginAsAdmin()}>Continue as Admin (demo)</Button>}
          {!isLive && import.meta.env.DEV && <Button variant="secondary" onClick={() => loginAsEditor()}>Continue as Editor (demo)</Button>}
          <Button as={Link} to="/" variant="outline">Back home</Button>
        </div>
      </div>
    )
  }

  const cycleStatus = (e) =>
    editEvent(e.id, { status: statusCycle[(statusCycle.indexOf(e.status) + 1) % 3] })
      .catch((err) => alert(err?.message || 'Could not change the status — please try again.'))
  const handleAdd = () => {
    // Two weeks out at 10:00 local time; registration opens now and closes when
    // the event starts. It's saved as a DRAFT — hidden from the public site
    // until the admin fills it in and switches on "Show on website".
    const start = new Date(Date.now() + 12096e5)
    start.setHours(10, 0, 0, 0)
    return addEvent({
      name: 'Untitled Event',
      poster: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=800&auto=format&fit=crop',
      date: toLocalInput(start).slice(0, 10),
      time: '10:00 AM',
      venue: 'TBD',
      shortDescription: 'Draft event — edit details.',
      description: '',
      status: 'coming-soon',
      fee: 0,
      draft: true,
      // Registration window drives the Open/Coming Soon/Closed badge on its own.
      regOpens: toLocalInput(new Date()),
      regCloses: toLocalInput(start),
      speakers: [],
      external: false,
      externalUrl: '',
    })
  }

  // Registrations whose payment is stuck 'pending' (possible money-taken-but-
  // -not-recorded case) — surfaced so an admin reconciles them with Razorpay.
  const paymentAlerts = isRazorpayMode ? countPaymentChecks(regRows) : 0

  const stats = [
    { label: 'Total Events', value: events.length, icon: CalendarDays, tone: 'blue' },
    { label: 'Total Registrations', value: regRows.length, icon: Ticket, tone: 'green' },
    { label: 'Unread Messages', value: unreadMsgs, icon: Inbox, tone: 'amber' },
    { label: 'Open Events', value: events.filter((e) => effectiveStatus(e) === 'open').length, icon: TrendingUp, tone: 'blue' },
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
                    {((t.key === 'messages' && unreadMsgs > 0) || (t.key === 'registrations' && paymentAlerts > 0) || (t.key === 'verify' && pendingReviews > 0) || (t.key === 'memberVerify' && pendingMembers > 0)) && (
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
            {tab === 'overview' && <Overview stats={stats} events={events} paymentAlerts={paymentAlerts} onReviewAlerts={() => setTab('registrations')} reviewCount={canVerify ? pendingReviews : 0} onOpenReviews={() => setTab('verify')} memberCount={can('membership') ? pendingMembers : 0} onOpenMembers={() => setTab('memberVerify')} />}
            {tab === 'analytics' && can('registrations') && (
              <AnalyticsPanel regs={regRows} events={events} adminName={user.name} canMessage={can('messages') || can('membership') || can('registrations')} />
            )}
            {tab === 'events' && can('events') && (
              <EventsPanel events={events} onAdd={handleAdd} onCycle={cycleStatus} onDelete={removeEvent} onSave={editEvent} />
            )}
            {tab === 'execom' && can('execom') && <ExecomPanel />}
            {tab === 'content' && can('content') && <SiteContentPanel />}
            {tab === 'gallery' && can('content') && <GalleryPanel />}
            {tab === 'membership' && can('membership') && <MembershipPanel canEdit={can('membership')} adminName={user.name} />}
            {tab === 'memberVerify' && can('membership') && <MemberVerificationPanel canEdit={can('membership')} adminName={user.name} onChanged={setPendingMembers} />}
            {tab === 'verify' && canVerify && (
              <PaymentReviewPanel
                canEvents={can('registrations')}
                canMembership={can('membership')}
                reviewerName={user.name}
                onChanged={(n) => { setPendingReviews(n); loadRegistrations() }}
              />
            )}
            {tab === 'payments' && isAdmin && <PaymentsPanel />}
            {tab === 'messages' && can('messages') && <MessagesPanel adminName={user.name} />}
            {tab === 'registrations' && can('registrations') && (
              <RegistrationsPanel rows={regRows} events={events} adminName={user.name} canMessage={can('messages')} isAdmin={isAdmin} onTeamChanged={loadRegistrations} />
            )}
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

function Overview({ stats, events, paymentAlerts = 0, onReviewAlerts, reviewCount = 0, onOpenReviews, memberCount = 0, onOpenMembers }) {
  // Soonest first, finished events left out.
  const upcoming = events.filter((e) => !isEnded(e)).sort((a, b) => startMs(a) - startMs(b)).slice(0, 4)
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {reviewCount > 0 && (
        <button
          onClick={onOpenReviews}
          className="flex w-full items-start gap-3 rounded-2xl border border-acm-200 bg-acm-50 p-4 text-left transition-colors hover:bg-acm-100/70 dark:border-acm-500/30 dark:bg-acm-500/10 dark:hover:bg-acm-500/15"
        >
          <ReceiptText className="mt-0.5 h-5 w-5 shrink-0 text-acm-600 dark:text-acm-400" />
          <div>
            <p className="text-sm font-semibold text-acm-800 dark:text-acm-200">
              {reviewCount} payment{reviewCount === 1 ? '' : 's'} waiting for verification
            </p>
            <p className="mt-0.5 text-xs text-acm-700/80 dark:text-acm-300/80">
              Open Verify payments to check each receipt against the account statement and approve or reject it.
            </p>
          </div>
        </button>
      )}
      {memberCount > 0 && (
        <button
          onClick={onOpenMembers}
          className="flex w-full items-start gap-3 rounded-2xl border border-amber-300/80 bg-amber-50 p-4 text-left shadow-[0_0_14px_rgba(251,191,36,0.25)] transition-colors hover:bg-amber-100/70 dark:border-amber-500/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/15"
        >
          <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {memberCount} membership verification{memberCount === 1 ? '' : 's'} waiting
            </p>
            <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-300/80">
              Existing members asking to be recognised. Open Member verification to approve or deny — or upload the roster to verify matches automatically.
            </p>
          </div>
        </button>
      )}
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
            const meta = statusMeta[effectiveStatus(e)] || statusMeta['coming-soon']
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
    randomGrouping: !!event.randomGrouping,
    groupingMode: event.groupingMode || 'pureRandom',
    groupingAt: event.groupingAt || '',
    paymentAccountId: event.paymentAccountId || '',
    upiAccountId: event.upiAccountId || '',
    deadline: event.deadline || '',
    regOpens: event.regOpens || '',
    regCloses: event.regCloses || '',
    external: !!event.external,
    externalUrl: event.externalUrl || '',
    guidelinesEnabled: !!event.guidelinesEnabled,
    guidelinesText: event.guidelinesText || '',
    codeOfConductEnabled: !!event.codeOfConductEnabled,
    codeOfConductText: event.codeOfConductText || '',
    whatsappLink: event.whatsappLink || '',
    whatsappHidden: !!event.whatsappHidden,
    qrHidden: !!event.qrHidden,
    // Defaults closed (TKM-only) — an admin has to deliberately open it up.
    interCollege: !!event.interCollege,
    // Saved as the event's `draft` flag — drafts are hidden from the public site.
    isDraft: !!event.draft,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [accounts, setAccounts] = useState([])
  const { content } = useData()
  const [upiAccounts, setUpiAccounts] = useState([])
  const [addingUpi, setAddingUpi] = useState(false)
  const defaultUpi = upiAccounts.find((a) => a.id === content.defaultUpiAccountId)
  const fileRef = useRef(null)

  // Guideline images live in their own collection (api parity with gallery —
  // one doc per image), so they're fetched/edited immediately here rather
  // than batched into the draft-and-Save-details flow the rest of the form uses.
  const [guideImages, setGuideImages] = useState([])
  const [guideBusy, setGuideBusy] = useState(false)
  const [guideErr, setGuideErr] = useState('')
  const guideFileRef = useRef(null)

  useEffect(() => {
    let alive = true
    pay.fetchUpiAccounts().then((l) => alive && setUpiAccounts((l || []).filter((a) => a.active !== false))).catch(() => {})
    if (isRazorpayMode) svc.fetchPaymentAccounts().then((l) => alive && setAccounts((l || []).filter((a) => a.active !== false))).catch(() => {})
    svc.fetchEventGuidelineImages(event.id).then((l) => alive && setGuideImages(l || [])).catch(() => {})
    // A hidden WhatsApp link isn't on the public event document — load the
    // admin's saved copy so it can be edited or shown again.
    svc.fetchEventWhatsapp(event.id).then((link) => {
      if (alive && link != null) setDraft((d) => ({ ...d, whatsappLink: link }))
    })
    return () => { alive = false }
  }, [event.id])

  async function uploadGuideImages(e) {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    setGuideErr('')
    const remaining = EVENT_GUIDELINE_MAX_IMAGES - guideImages.length
    if (remaining <= 0) {
      setGuideErr(`Up to ${EVENT_GUIDELINE_MAX_IMAGES} guideline images per event — remove one before adding more.`)
      e.target.value = ''
      return
    }
    const toUpload = files.slice(0, remaining)
    setGuideBusy(true)
    try {
      let order = guideImages.length
      for (const file of toUpload) {
        try {
          const image = await fitPoster(file)
          const created = await svc.addEventGuidelineImage(event.id, image, order++)
          setGuideImages((g) => [...g, created])
        } catch (err) {
          setGuideErr(err?.message || 'Could not upload one of those images.')
        }
      }
      if (files.length > toUpload.length) {
        setGuideErr(`Only ${remaining} more image${remaining === 1 ? '' : 's'} fit (cap ${EVENT_GUIDELINE_MAX_IMAGES}); the rest were skipped.`)
      }
    } finally {
      setGuideBusy(false)
      e.target.value = ''
    }
  }

  async function removeGuideImage(id) {
    setGuideErr('')
    const prev = guideImages
    setGuideImages((g) => g.filter((img) => img.id !== id))
    try {
      await svc.deleteEventGuidelineImage(id)
    } catch (err) {
      setGuideImages(prev)
      setGuideErr(err?.message || 'Could not remove that image.')
    }
  }

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }))
  const isExternal = draft.external

  // Basic sanity checks so a nonsensical event can't be saved (dates in the
  // past, discount bigger than the fee, window inverted, etc.). Returns the
  // first problem to show, or '' when everything's fine.
  function validate(d) {
    if (!d.name?.trim()) return 'Give the event a name.'
    if (!d.date) return 'Pick an event date.'
    const todayStr = toLocalInput(new Date()).slice(0, 10) // local date, not UTC
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
        if (!Number.isInteger(cap) || cap < 0) return `${d.isGroup && !d.randomGrouping ? 'Max teams' : 'Max registrations'} must be a whole number of 0 or more.`
      }
      if (d.isGroup) {
        const min = Number(d.minTeamSize)
        const max = Number(d.maxTeamSize)
        if (!Number.isInteger(min) || min < 1) return 'Minimum team size must be a whole number of 1 or more.'
        if (!Number.isInteger(max) || max < 1) return 'Maximum team size must be a whole number of 1 or more.'
        if (max < min) return 'Maximum team size can’t be less than the minimum.'
        if (d.randomGrouping && !d.groupingAt && !d.regCloses) {
          return 'Random Grouping needs a time to run — set "Group at" below, or set Registration closes.'
        }
      }
    }
    const opens = d.regOpens ? new Date(d.regOpens).getTime() : null
    const closes = d.regCloses ? new Date(d.regCloses).getTime() : null
    if (opens && closes && opens > closes) return 'Registration “Opens” must be before “Closes”.'
    if (d.date) {
      const start = eventStart(d).getTime()
      if (opens && !Number.isNaN(start) && start < opens) return 'The event start time should be after registration opens.'
      if (closes && !Number.isNaN(start) && closes > start) return 'Registration should close by the time the event starts — set “Closes” to the start time or earlier.'
    }
    if (d.guidelinesEnabled && !d.guidelinesText?.trim()) {
      return 'Guidelines are empty — add the text, or turn off "Publish guidelines".'
    }
    if (d.codeOfConductEnabled && !d.codeOfConductText?.trim()) {
      return 'Code of conduct is empty — add the text, or turn off "Publish code of conduct".'
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
      const { isDraft, ...fields } = draft
      await onSave({
        ...fields,
        draft: !!isDraft,
        fee: Math.max(0, Number(draft.fee) || 0),
        acmDiscount: Math.max(0, Number(draft.acmDiscount) || 0),
        maxRegistrations: Math.max(0, Math.floor(Number(draft.maxRegistrations) || 0)),
        isGroup: !!draft.isGroup,
        minTeamSize: draft.isGroup ? Math.max(1, Math.floor(Number(draft.minTeamSize) || 1)) : 0,
        maxTeamSize: draft.isGroup ? Math.max(1, Math.floor(Number(draft.maxTeamSize) || 1)) : 0,
        randomGrouping: draft.isGroup && !!draft.randomGrouping,
        groupingMode: draft.groupingMode || 'pureRandom',
        groupingAt: draft.isGroup && draft.randomGrouping ? draft.groupingAt : '',
        whatsappLink: draft.whatsappLink.trim(),
        whatsappHidden: !!draft.whatsappHidden,
        qrHidden: !!draft.qrHidden,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setFormErr(err?.message || 'Could not save the event — please try again.')
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
      await onSave({ poster: await fitPoster(file) })
      setFormErr('')
    } catch (err) {
      // Unreadable image or a failed save — say so, and keep the old poster.
      setFormErr(err?.message || 'Could not update the poster — please try another image.')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-3.5 border-t border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
      {/* Publish switch — a new event starts as a hidden draft. */}
      <div className={cn(
        'flex items-center justify-between gap-3 rounded-xl border p-4',
        draft.isDraft
          ? 'border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10'
          : 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/10',
      )}>
        <div className="flex min-w-0 items-center gap-3">
          {draft.isDraft
            ? <EyeOff className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            : <Eye className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
          <div className="min-w-0">
            <div className="text-sm font-semibold">{draft.isDraft ? 'Draft — hidden from the website' : 'Published — visible on the website'}</div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {draft.isDraft
                ? 'Fill in the details, switch this on, then Save details to publish.'
                : 'Visitors see this event; registration opens and closes with the window below.'}
            </p>
          </div>
        </div>
        <Switch on={!draft.isDraft} onClick={() => setDraft((d) => ({ ...d, isDraft: !d.isDraft }))} />
      </div>

      <FormSection icon={CalendarDays} title="Basics" hint="The core facts shown on the event card and details page.">
        <Field label="Event name" hint="The name shown everywhere — the events page, posters, and registration." className="sm:col-span-2">
          <input className={cn(inputCls, 'mt-1')} value={draft.name} onChange={set('name')} />
        </Field>

        {/* Internal (register on this site) vs external (redirect elsewhere) */}
        <div className="sm:col-span-2">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            Event type
            <InfoHint text="Internal events collect registrations here — a roster, payments, the works. External just links out; nothing is tracked on this site." />
          </span>
          <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-800">
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
          <Field label="Event website URL" hint="Where visitors are sent to register — the site never sees who signs up." className="sm:col-span-2">
            <input
              type="url"
              placeholder="https://external-site.com/event"
              className={cn(inputCls, 'mt-1')}
              value={draft.externalUrl}
              onChange={set('externalUrl')}
            />
          </Field>
        )}

        <Field label="Date" hint="Also drives the countdown and LIVE badge automatically.">
          <input type="date" className={cn(inputCls, 'mt-1')} value={draft.date} onChange={set('date')} />
        </Field>
        <Field label="Start time">
          <input
            type="time"
            className={cn(inputCls, 'mt-1')}
            value={to24h(draft.time)}
            onChange={(e) => setDraft((d) => ({ ...d, time: to12h(e.target.value) }))}
          />
        </Field>
        <Field label="Venue" hint="Shown on the event card and details page." className="sm:col-span-2">
          <input className={cn(inputCls, 'mt-1')} value={draft.venue} onChange={set('venue')} />
        </Field>
      </FormSection>

      {!isExternal && (
        <FormSection icon={Wallet} title="Registration & pricing" hint="What it costs, how many can join, and where the money goes.">
          {/* Deliberately loud — this decides who's even allowed to register,
              not just a preference, so it shouldn't blend in with the rest. */}
          <div className={cn(
            'flex items-center justify-between gap-3 rounded-xl border p-4 shadow-sm sm:col-span-2',
            draft.interCollege
              ? 'border-sky-200 bg-gradient-to-br from-sky-50 via-blue-50/50 to-white dark:border-sky-500/30 dark:from-sky-500/10 dark:via-blue-500/5 dark:to-transparent'
              : 'border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/60',
          )}>
            <div className="flex items-center gap-3">
              <span className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-sm',
                draft.interCollege ? 'bg-gradient-to-br from-sky-500 to-blue-500 shadow-sky-500/30' : 'bg-neutral-400 dark:bg-neutral-600',
              )}>
                {draft.interCollege ? <Globe className="h-4.5 w-4.5" /> : <GraduationCap className="h-4.5 w-4.5" />}
              </span>
              <div>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                  Inter-College Event
                  <InfoHint text="Off (default): only TKM College of Engineering students can register — anyone can still see the event. On: students from any college can register." />
                </span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {draft.interCollege ? 'Open to students from any college' : 'Registration limited to TKM College students'}
                </p>
              </div>
            </div>
            <Switch tone="sky" on={!!draft.interCollege} onClick={() => setDraft((d) => ({ ...d, interCollege: !d.interCollege }))} />
          </div>

          <Field label="Registration fee (₹)" hint="What each registrant pays. Leave at 0 for a free event.">
            <input type="number" min="0" className={cn(inputCls, 'mt-1')} value={draft.fee} onChange={set('fee')} placeholder="0 = free" />
          </Field>
          <Field
            label={draft.isGroup && !draft.randomGrouping ? 'Max teams' : 'Max registrations'}
            hint={`Registration closes automatically once this many ${draft.isGroup && !draft.randomGrouping ? 'teams have' : 'people have'} registered. 0 = unlimited.${draft.isGroup && draft.randomGrouping ? ' Random Grouping registers people individually, so this caps registrants, not teams.' : ''}`}
          >
            <input
              type="number"
              min="0"
              step="1"
              className={cn(inputCls, 'mt-1')}
              value={draft.maxRegistrations}
              onChange={set('maxRegistrations')}
              placeholder="0 = unlimited"
            />
          </Field>
          {Number(draft.fee) > 0 && (
            <Field label="ACM member discount (₹ off)" hint="How much a verified ACM member saves off the fee.">
              <input type="number" min="0" className={cn(inputCls, 'mt-1')} value={draft.acmDiscount} onChange={set('acmDiscount')} placeholder="0 = no discount" />
            </Field>
          )}
          {Number(draft.fee) > 0 && (
            <Field label="Collect payment to" hint="The UPI QR registrants pay to. “Default” follows whichever account is the default in the Payments tab.">
              <select
                className={cn(inputCls, 'mt-1')}
                value={draft.upiAccountId}
                onChange={(e) => (e.target.value === '__new__' ? setAddingUpi(true) : setDraft((d) => ({ ...d, upiAccountId: e.target.value })))}
              >
                <option value="">Default account{defaultUpi ? ` (${defaultUpi.label})` : ' (not set yet)'}</option>
                {upiAccounts.map((a) => <option key={a.id} value={a.id}>{a.label} · {a.upiId}</option>)}
                <option value="__new__">+ Add new QR account…</option>
              </select>
            </Field>
          )}
          {Number(draft.fee) > 0 && !isRazorpayMode && (
            <VisibilityRow
              className="sm:col-span-2"
              label="Show payment QR"
              shown={!draft.qrHidden}
              onToggle={() => setDraft((d) => ({ ...d, qrHidden: !d.qrHidden }))}
              onHint="Payers see the QR and can register."
              offHint="QR hidden — payers see “payments paused” and can’t finish a paid registration until you show it again."
            />
          )}
          {Number(draft.fee) > 0 && isRazorpayMode && (
            <Field label="Razorpay account" hint="Which Razorpay account profile this event's payments are credited to.">
              <select className={cn(inputCls, 'mt-1')} value={draft.paymentAccountId} onChange={set('paymentAccountId')}>
                <option value="">Default account</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </Field>
          )}
        </FormSection>
      )}

      {!isExternal && (
        <FormSection icon={Users} title="Team settings" hint="Register solo, or as a pre-formed team.">
          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={draft.isGroup}
                onChange={(e) => setDraft((d) => ({ ...d, isGroup: e.target.checked }))}
                className="h-4 w-4 rounded border-neutral-300 text-acm-600 dark:border-neutral-700 dark:bg-neutral-800"
              />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Group event (register as a team)</span>
            </label>
            {draft.isGroup && !isApiAvailable && (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Team registration and Random Grouping run on the website’s server (/api), which isn’t deployed on this site yet — until it is, people can’t register teams for this event online.
              </p>
            )}
            {draft.isGroup && (
              <div className="mt-3 grid gap-3.5 rounded-lg border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-2 dark:border-neutral-700 dark:bg-neutral-800/60">
                <Field label="Minimum members per team" hint="Counts include the person registering.">
                  <input type="number" min="1" step="1" className={cn(inputCls, 'mt-1')} value={draft.minTeamSize} onChange={set('minTeamSize')} placeholder="e.g. 2" />
                </Field>
                <Field label="Maximum members per team">
                  <input type="number" min="1" step="1" className={cn(inputCls, 'mt-1')} value={draft.maxTeamSize} onChange={set('maxTeamSize')} placeholder="e.g. 4" />
                </Field>
                <p className="text-[11px] font-normal leading-relaxed text-neutral-400 sm:col-span-2">
                  The registrant adds teammates by name and email. An existing account is linked immediately; someone without one yet is still recorded and linked automatically if they sign up later.
                </p>

                {/* Random Grouping — deliberately styled apart from the rest of
                    the form, since it changes registration behaviour entirely
                    (solo sign-up, teams assigned later) rather than just
                    tweaking a limit. */}
                <div className="overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-fuchsia-50/50 to-white p-4 shadow-sm sm:col-span-2 dark:border-violet-500/30 dark:from-violet-500/10 dark:via-fuchsia-500/5 dark:to-transparent">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm shadow-violet-500/30">
                        <Shuffle className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-violet-900 dark:text-violet-200">
                          Random Grouping
                          <InfoHint text="People register solo — normal fee, normal ACM discount — and get placed into teams automatically once registration closes (or a time you set). They see their team on their dashboard once it's assigned." />
                        </span>
                        <p className="text-xs text-violet-600/80 dark:text-violet-300/70">Skip team sign-up — assign teammates automatically</p>
                      </div>
                    </div>
                    <Switch tone="violet" on={!!draft.randomGrouping} onClick={() => setDraft((d) => ({ ...d, randomGrouping: !d.randomGrouping }))} />
                  </div>

                  <AnimatePresence initial={false}>
                    {draft.randomGrouping && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="mt-4 grid gap-3.5 border-t border-violet-200/70 pt-4 dark:border-violet-500/20 sm:grid-cols-2">
                          <Field label="Group at" hint="When grouping runs. Leave blank to use Registration closes instead. This runs once a day (free-tier scheduling) — allow up to 24h after this time.">
                            <input type="datetime-local" className={cn(inputCls, 'mt-1')} value={draft.groupingAt} onChange={set('groupingAt')} />
                          </Field>
                          <Field label="Grouping style" hint="How teammates are picked across departments.">
                            <select className={cn(inputCls, 'mt-1')} value={draft.groupingMode} onChange={set('groupingMode')}>
                              <option value="pureRandom">Pure random mix</option>
                              <option value="sameDept">Group same departments together</option>
                              <option value="noSameDept">Avoid same department in a team</option>
                            </select>
                          </Field>
                        </div>
                        <p className="mt-3 text-[11px] leading-relaxed text-violet-600/70 dark:text-violet-300/60">
                          Anyone left over who can't fill a full team stays ungrouped, queued for you to place manually from the Registrations tab.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </FormSection>
      )}

      {/* Status window drives the Open/Coming Soon/Closed badge for both
          internal and external events, so nobody has to flip it by hand. */}
      <FormSection
        icon={Clock}
        title={isExternal ? 'Open / close window' : 'Registration window'}
        hint="Automatically flips the event's status badge — no manual toggling needed once this is set."
      >
        <Field label="Opens">
          <input type="datetime-local" className={cn(inputCls, 'mt-1')} value={draft.regOpens} onChange={set('regOpens')} />
        </Field>
        <Field label="Closes">
          <input type="datetime-local" className={cn(inputCls, 'mt-1')} value={draft.regCloses} onChange={set('regCloses')} />
        </Field>
        <p className="text-[11px] leading-relaxed text-neutral-400 sm:col-span-2">
          Before <strong>Opens</strong> → Coming Soon · between the two → {isExternal ? 'Open' : 'Registration Open'} · after <strong>Closes</strong> → Closed. Leave both blank to set the status manually instead.
        </p>
      </FormSection>

      <FormSection icon={FileText} title="Description & poster" hint="The copy and image shown on the card and details page.">
        <Field label="Card blurb" hint="The one-line summary shown on the event card." className="sm:col-span-2">
          <input className={cn(inputCls, 'mt-1')} value={draft.shortDescription} onChange={set('shortDescription')} />
        </Field>
        <Field label="Full description" hint="The longer write-up shown on the event's details page." className="sm:col-span-2">
          <textarea rows={3} className={cn(inputCls, 'mt-1')} value={draft.description} onChange={set('description')} />
        </Field>
        <div className="sm:col-span-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadPoster} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <ImageUp className="h-4 w-4" /> Upload poster
          </Button>
        </div>
      </FormSection>

      {!isExternal && (
        <FormSection icon={MessageCircle} title="WhatsApp group" hint="Shown to a registrant right after they successfully register, on their ticket, and on their dashboard for this event — so they (and their team) can join.">
          <Field label="WhatsApp group link" hint="Paste your group's invite link. Leave blank to skip this." className="sm:col-span-2">
            <input
              type="url"
              placeholder="https://chat.whatsapp.com/…"
              className={cn(inputCls, 'mt-1')}
              value={draft.whatsappLink}
              onChange={set('whatsappLink')}
            />
          </Field>
          {draft.whatsappLink.trim() && (
            <VisibilityRow
              className="sm:col-span-2"
              label="Show link to registrants"
              shown={!draft.whatsappHidden}
              onToggle={() => setDraft((d) => ({ ...d, whatsappHidden: !d.whatsappHidden }))}
              onHint="Verified registrants see it on their ticket and dashboard."
              offHint="Hidden — it disappears from every ticket and dashboard as if it never existed. Your copy stays saved here."
            />
          )}
        </FormSection>
      )}

      <FormSection icon={ShieldCheck} title="Guidelines & code of conduct" hint="Rules or expectations for this specific event — shown when someone opens it, beyond the site-wide agreement they accept when registering.">
        <div className="sm:col-span-2">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            Guideline images
            <InfoHint text="Rules sheets, infographics — anything visual. Shown together on the event's details page." />
          </span>
          {guideImages.length > 0 && (
            <div className="mb-2.5 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {guideImages.map((g) => (
                <div key={g.id} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <img src={g.image} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeGuideImage(g.id)}
                    aria-label="Remove guideline image"
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-neutral-950/70 text-white opacity-0 backdrop-blur transition-opacity hover:bg-rose-600 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input ref={guideFileRef} type="file" accept="image/*" multiple className="hidden" onChange={uploadGuideImages} />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => guideFileRef.current?.click()}
            disabled={guideBusy || guideImages.length >= EVENT_GUIDELINE_MAX_IMAGES}
          >
            {guideBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />} Upload guideline images
          </Button>
          <span className="ml-2 text-xs text-neutral-400">{guideImages.length}/{EVENT_GUIDELINE_MAX_IMAGES}</span>
          {guideErr && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {guideErr}
            </p>
          )}
          <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-acm-500" />
            Add guideline images above, or check “Publish guidelines” below to write them as text instead.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={draft.guidelinesEnabled}
              onChange={(e) => setDraft((d) => ({ ...d, guidelinesEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-neutral-300 text-acm-600 dark:border-neutral-700 dark:bg-neutral-800"
            />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Publish guidelines (text)</span>
          </label>
          {draft.guidelinesEnabled && (
            <div className="mt-2.5">
              <textarea
                rows={4}
                className={inputCls}
                placeholder="e.g. Teams must check in 30 minutes before the event starts…"
                value={draft.guidelinesText}
                onChange={set('guidelinesText')}
              />
              {!draft.guidelinesText.trim() && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Guidelines are empty — add some text before saving, or turn this off.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={draft.codeOfConductEnabled}
              onChange={(e) => setDraft((d) => ({ ...d, codeOfConductEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-neutral-300 text-acm-600 dark:border-neutral-700 dark:bg-neutral-800"
            />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Publish code of conduct (text)</span>
          </label>
          {draft.codeOfConductEnabled && (
            <div className="mt-2.5">
              <textarea
                rows={4}
                className={inputCls}
                placeholder="e.g. Be respectful, no harassment, follow organiser instructions…"
                value={draft.codeOfConductText}
                onChange={set('codeOfConductText')}
              />
              {!draft.codeOfConductText.trim() && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Code of conduct is empty — add some text before saving, or turn this off.
                </p>
              )}
            </div>
          )}
        </div>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save details'}
        </Button>
        <span className="text-xs text-neutral-400">Countdown & LIVE badge come from date + time automatically.</span>
      </div>

      {formErr && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
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
            className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Event saved — changes are live.
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={addingUpi} onClose={() => setAddingUpi(false)} size="md">
        <div className="p-6 sm:p-8">
          <h3 className="text-lg font-bold tracking-tight">New QR account</h3>
          <p className="mt-1 text-xs text-neutral-400">It’s saved to the Payments tab too, so you can reuse it for other events.</p>
          <div className="mt-5">
            <UpiAccountForm
              onCancel={() => setAddingUpi(false)}
              onSaved={(acc) => {
                setUpiAccounts((l) => [acc, ...l])
                setDraft((d) => ({ ...d, upiAccountId: acc.id }))
                setAddingUpi(false)
              }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

function EventsPanel({ events, onAdd, onCycle, onDelete, onSave }) {
  const [openId, setOpenId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  // Event whose quick controls (venue / WhatsApp / QR) are open.
  const [controlsId, setControlsId] = useState(null)
  const controlsEvent = events.find((e) => e.id === controlsId) || null
  const openControls = (id) => { setOpenId(null); setControlsId(id) }
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
          const status = effectiveStatus(e)
          const auto = hasRegWindow(e)
          return (
          <div key={e.id}>
            <div className="flex flex-wrap items-center gap-4 p-4">
              <img src={e.poster} alt="" className="h-12 w-12 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{e.name}</span>
                  {e.draft && <Badge tone="amber">Draft</Badge>}
                </p>
                <p className="text-xs text-neutral-400">{formatDate(e.date)} · {e.time} · {e.venue}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {lifecycle(e) === 'live' && (
                    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" /> Live now
                    </span>
                  )}
                  {lifecycle(e) === 'ended' && (
                    <span className="inline-flex h-7 items-center rounded-full bg-neutral-100 px-2.5 text-[11px] font-medium text-neutral-500 dark:bg-neutral-800">Ended</span>
                  )}
                  <EventQuickChips event={e} onSave={(patch) => onSave(e.id, patch)} onOpenControls={() => openControls(e.id)} />
                </div>
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
                onClick={() => openControls(e.id)}
                aria-label="Event controls"
                title="Quick controls: venue, WhatsApp link, payment QR"
                className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-400 transition-colors hover:border-acm-300 hover:text-acm-600 dark:border-neutral-800"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpenId(openId === e.id ? null : e.id)}
                aria-label="Edit event"
                className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-400 transition-colors hover:border-acm-300 hover:text-acm-600 dark:border-neutral-800"
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', openId === e.id && 'rotate-180')} />
              </button>
              <button
                onClick={() => setDeleteTarget(e)}
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
        Tip: click a status badge to cycle Open → Coming Soon → Closed. Click a WhatsApp / QR chip to show or hide it instantly, the sliders for quick venue and link changes, or expand a row for the full editor.
      </p>

      <EventControlsModal
        event={controlsEvent}
        open={!!controlsEvent}
        onClose={() => setControlsId(null)}
        onSave={(patch) => onSave(controlsId, patch)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => onDelete(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name || 'this event'}"?`}
        description="This removes the event and its poster from the site. Any existing registrations for it are unaffected but will no longer show an event to link back to. This can't be undone."
        confirmLabel="Delete event"
      />
    </motion.div>
  )
}

// ── Execom: member details + profile photo uploads ───────────
// ── Site content: ticker, stats, establishment — no code needed ──
function SiteContentPanel() {
  const { content, updateContent } = useData()
  const [draft, setDraft] = useState(content)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const mark = (next) => { setDraft(next); setDirty(true) }

  async function save() {
    // Clean the department list on the way out: trim, drop blanks, de-dupe.
    const cleaned = [...new Set((draft.departments || []).map((d) => d.trim()).filter(Boolean))]
    setSaving(true)
    setSaveErr('')
    try {
      await updateContent({ ...draft, departments: cleaned })
      setDirty(false)
    } catch (err) {
      setSaveErr(err?.message || 'Could not save — please try again.')
    } finally {
      setSaving(false)
    }
  }

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
        <Button size="sm" disabled={!dirty || saving} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </Button>
        {saveErr && (
          <p className="flex w-full items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {saveErr}
          </p>
        )}
      </div>

      <div className="space-y-8 p-5">
        {/* Headline copy */}
        <div className="grid gap-4">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Headline copy
            <InfoHint text="The hero section and about-page copy on the home page." />
          </h4>
          <Field label="Hero tagline" hint="The line under the big headline on the home page.">
            <textarea
              rows={2}
              className={cn(inputCls, 'resize-y')}
              value={draft.heroTagline}
              onChange={(e) => mark({ ...draft, heroTagline: e.target.value })}
            />
          </Field>
          <Field label="About section title">
            <input
              className={inputCls}
              value={draft.aboutTitle}
              onChange={(e) => mark({ ...draft, aboutTitle: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gallery title">
              <input
                className={inputCls}
                value={draft.galleryTitle}
                onChange={(e) => mark({ ...draft, galleryTitle: e.target.value })}
              />
            </Field>
            <Field label="Gallery blurb">
              <input
                className={inputCls}
                value={draft.galleryBlurb}
                onChange={(e) => mark({ ...draft, galleryBlurb: e.target.value })}
              />
            </Field>
          </div>
        </div>

        {/* Vision / Mission / Values */}
        <div>
          <h4 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Vision · Mission · Values
            <InfoHint text="The three cards in the Goals section. The bold key (e.g. 'Vision') and the body text are both editable." />
          </h4>
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
          <h4 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            “Why join us” cards
            <InfoHint text="The four cards on the home page explaining why someone should join the chapter." />
          </h4>
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
          <h4 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Year of establishment
            <InfoHint text="Used wherever the site shows how long the chapter has been around." />
          </h4>
          <input
            className={cn(inputCls, 'mt-2 max-w-[160px]')}
            value={draft.established}
            onChange={(e) => mark({ ...draft, established: e.target.value })}
          />
        </div>

        {/* Departments — shared dropdown options */}
        <div>
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Departments
              <InfoHint text="The options members pick from in their profile and when registering for events." />
            </h4>
            <Button size="sm" variant="outline" onClick={addDept}><Plus className="h-4 w-4" /> Add</Button>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            Changes apply everywhere on save.
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
          <h4 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Chapter statistics
            <InfoHint text="The number tiles on the About section (e.g. Members, Events Conducted). Left field is the number, right is its suffix like '+'." />
          </h4>
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
            <h4 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Announcement ticker
              <InfoHint text="The scrolling strip near the top of the home page. Tag is the small pill (e.g. 'New'), text is the message." />
            </h4>
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
  { key: 'messages', label: 'Messages' },
  { key: 'registrations', label: 'Registrations' },
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

  async function toggle(u, key) {
    const permissions = { ...(u.permissions || {}), [key]: !u.permissions?.[key] }
    const prev = rows
    const next = rows.map((r) => (r.id === u.id ? { ...r, permissions } : r))
    setRows(next)
    if (!isLive) {
      localStorage.setItem('acm-demo-users', JSON.stringify(next))
      return
    }
    try {
      await svc.updateUserAccess(u.id, permissions)
    } catch (err) {
      // Optimistic, but never leave a grant looking given when it wasn't.
      setRows(prev)
      alert(err?.message || 'Could not change that access — please try again.')
    }
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

function RegistrationsPanel({ rows, events = [], adminName, canMessage, isAdmin, onTeamChanged }) {
  const [dept, setDept] = useState('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [member, setMember] = useState('all') // all | member | non-member
  const [msgTo, setMsgTo] = useState(null)
  const [msgTeam, setMsgTeam] = useState(null)
  const [detailFor, setDetailFor] = useState(null)
  // Admin-only team editing: which team's "add teammate" row is open, and any
  // pending destructive action (delete team / remove member) awaiting confirm.
  const [addingTo, setAddingTo] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // { kind: 'deleteTeam'|'removeMember', reg, member? }
  // Random Grouping: manual "run now" per event, and the ungrouped-leftover picker.
  const [groupingBusyEventId, setGroupingBusyEventId] = useState(null)
  const [groupingErr, setGroupingErr] = useState('')
  const [groupingErrEventId, setGroupingErrEventId] = useState(null)
  const [formTeamFor, setFormTeamFor] = useState(null) // the event whose leftover pool we're picking from
  // Manual payments: the roster row whose receipt is open, and the UPI accounts
  // (to show which one a payment should have gone to).
  const [receiptFor, setReceiptFor] = useState(null)
  const [upiAccounts, setUpiAccounts] = useState([])
  useEffect(() => { fetchUpiAccounts().then((l) => setUpiAccounts(l || [])).catch(() => {}) }, [])

  async function addTeammate(reg, { name, email }) {
    await adminTeamAction({ action: 'addMember', registrationId: reg.id, name, email })
    setAddingTo(null)
    await onTeamChanged?.()
  }

  async function confirmDeleteTeam() {
    await adminTeamAction({ action: 'delete', registrationId: confirmAction.reg.id })
    await onTeamChanged?.()
  }

  async function confirmRemoveMember() {
    await adminTeamAction({ action: 'removeMember', registrationId: confirmAction.reg.id, email: confirmAction.member.email })
    await onTeamChanged?.()
  }

  async function runGroupingNow(eventId) {
    setGroupingErr('')
    setGroupingErrEventId(null)
    setGroupingBusyEventId(eventId)
    try {
      await adminTeamAction({ action: 'runGroupingNow', eventId })
      await onTeamChanged?.()
    } catch (err) {
      setGroupingErr(err?.message || 'Could not run grouping.')
      setGroupingErrEventId(eventId)
    } finally {
      setGroupingBusyEventId(null)
    }
  }

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

  const alerts = isRazorpayMode ? filtered.filter((r) => paymentNeedsCheck(r)).length : 0

  // Team member rows expand to show every member's email + phone.
  const [expanded, setExpanded] = useState(() => new Set())
  const toggleExpand = (id) => setExpanded((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  // Always group the roster by event — even under a department/member filter,
  // so registrations for the same event stay visually together and each
  // event's slice still exports on its own.
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
    { label: 'UTR', value: (r) => r.utr || '' },
    { label: 'Amount due', value: (r) => (r.amountDue != null ? r.amountDue : '') },
    { label: 'Reviewed by', value: (r) => r.reviewedBy || '' },
    { label: 'Reviewed at', value: (r) => fmtDateTime(r.reviewedAt) },
  ]
  const exportCsv = (list, name = 'event-registrations') => downloadCsv(name, list, csvCols)

  const renderTable = (list) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-neutral-400">
          <tr className="border-b border-neutral-100 dark:border-neutral-800">
            <th className="px-5 py-3.5 font-medium">Participant / Team</th>
            <th className="px-5 py-3.5 font-medium">Event</th>
            <th className="px-5 py-3.5 font-medium">Department</th>
            <th className="px-5 py-3.5 font-medium">ACM</th>
            <th className="px-5 py-3.5 font-medium">Status</th>
            <th className="px-5 py-3.5 font-medium">Payment</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {list.map((p) => {
            const isOpen = expanded.has(p.id)
            const linkedMemberCount = p.isTeam ? (p.members || []).filter((m) => m.uid).length : 0
            return (
              <Fragment key={p.id}>
                <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <div className="min-w-0">
                        {p.isTeam ? (
                          <>
                            <button onClick={() => toggleExpand(p.id)} className="flex items-center gap-1.5 text-left font-medium">
                              <Users className="h-3.5 w-3.5 shrink-0 text-acm-500" /> {p.teamName || 'Team'}
                              {p.randomlyGrouped && (
                                <span title="Formed by Random Grouping" className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                                  <Shuffle className="h-2.5 w-2.5" /> Auto
                                </span>
                              )}
                              <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform', isOpen && 'rotate-180')} />
                            </button>
                            <div className="mt-0.5 text-xs text-neutral-400">
                              {p.teamSize} members{p.randomlyGrouped ? '' : ` · led by ${p.name}`}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-neutral-400">{p.email}</div>
                          </>
                        )}
                      </div>
                      {!p.isTeam && (
                        <button
                          onClick={() => setDetailFor(p)}
                          title="View profile details"
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canMessage && (
                        <button
                          onClick={() => setMsgTo(p)}
                          disabled={!p.userId}
                          title={p.userId ? 'Message the registrant' : 'No account linked'}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:border-acm-300 hover:bg-acm-50 hover:text-acm-600 disabled:opacity-30 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-acm-500/10"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canMessage && p.isTeam && linkedMemberCount > 1 && (
                        <button
                          onClick={() => setMsgTeam(p)}
                          title="Message every team member with an account — reaches each of their inboxes"
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:border-acm-300 hover:bg-acm-50 hover:text-acm-600 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-acm-500/10"
                        >
                          <Users className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-neutral-600 dark:text-neutral-300">{p.event}</td>
                  <td className="px-5 py-3.5 text-neutral-600 dark:text-neutral-300">{p.department}</td>
                  <td className="px-5 py-3.5">
                    {p.acmMember ? (
                      <Badge tone="blue">Member</Badge>
                    ) : p.claimedMembershipId ? (
                      <span title={`Claimed ID ${p.claimedMembershipId} — not verified`}><Badge tone="amber">Claimed</Badge></span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge tone={p.status === 'Confirmed' ? 'green' : 'amber'} dot={p.status === 'Confirmed'}>{p.status}</Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    {isRazorpayMode ? (
                      <>
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
                      </>
                    ) : (
                      <ManualPaymentCell p={p} onView={() => setReceiptFor(p)} />
                    )}
                  </td>
                </tr>
                {p.isTeam && isOpen && (
                  <tr className="bg-neutral-50/60 dark:bg-neutral-800/30">
                    <td colSpan={6} className="px-5 py-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Team members</span>
                        {isAdmin && (
                          <button
                            onClick={() => setConfirmAction({ kind: 'deleteTeam', reg: p })}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-500 hover:text-rose-600"
                          >
                            <Trash2 className="h-3 w-3" /> Delete team
                          </button>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(p.members || []).map((m, i) => (
                          <div key={i} className="flex items-start justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-2.5 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                                {m.name || '—'}
                                {m.role === 'leader' && <Badge tone="blue">Leader</Badge>}
                                {!m.uid && (
                                  <span title="No website account yet — recorded from what the leader entered.">
                                    <Badge tone="amber">No account</Badge>
                                  </span>
                                )}
                                {p.randomlyGrouped && m.paymentStatus && (
                                  <Badge tone={m.paymentStatus === 'paid' || m.paymentStatus === 'free' ? 'green' : 'amber'}>
                                    {m.paymentStatus === 'free' ? 'Free' : m.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1 truncate text-[11px] text-neutral-400">
                                {m.email}{m.phone && ` · ${m.phone}`}
                              </div>
                              {m.department && (
                                <div className="mt-0.5 truncate text-[11px] text-neutral-400">{m.department}</div>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                onClick={() => setDetailFor(m)}
                                title="View profile details"
                                className="grid h-7 w-7 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                              {isAdmin && m.role !== 'leader' && (
                                <button
                                  onClick={() => setConfirmAction({ kind: 'removeMember', reg: p, member: m })}
                                  aria-label={`Remove ${m.name || m.email}`}
                                  title="Remove from team"
                                  className="grid h-7 w-7 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:text-neutral-500 dark:hover:bg-rose-500/10"
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {isAdmin && (
                        addingTo === p.id ? (
                          <AddTeammateForm onAdd={(vals) => addTeammate(p, vals)} onCancel={() => setAddingTo(null)} />
                        ) : (
                          <button
                            onClick={() => setAddingTo(p.id)}
                            className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-acm-600 hover:text-acm-700 dark:text-acm-400"
                          >
                            <Plus className="h-3 w-3" /> Add teammate
                          </button>
                        )
                      )}
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
      ) : (
        // One section per event, each independently exportable — registrations
        // for the same event always stay visually grouped, filters or not.
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {groups.map(([name, list]) => {
            const ev = events.find((e) => e.id === list[0]?.eventId)
            const isRandomGroup = !!(ev?.isGroup && ev?.randomGrouping)
            const ungrouped = isRandomGroup ? list.filter((r) => !r.isTeam) : []
            return (
            <div key={name}>
              <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-50/60 px-5 py-3 dark:bg-neutral-800/30">
                <h4 className="text-sm font-semibold tracking-tight">
                  {name} <span className="text-neutral-400">({list.length})</span>
                </h4>
                <Button size="sm" variant="outline" onClick={() => exportCsv(list, `registrations-${slug(name)}`)}>
                  <Download className="h-4 w-4" /> Export
                </Button>
              </div>

              {isRandomGroup && isAdmin && !ev.groupingRanAt && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 bg-violet-50/60 px-5 py-2.5 text-xs dark:border-violet-500/20 dark:bg-violet-500/5">
                  <span className="flex items-center gap-1.5 text-violet-700 dark:text-violet-300">
                    <Shuffle className="h-3.5 w-3.5" />
                    Random Grouping is on — teams form automatically {ev.groupingAt ? `at ${fmtDateTime(ev.groupingAt)}` : 'once registration closes'}.
                  </span>
                  <Button size="sm" variant="outline" onClick={() => runGroupingNow(ev.id)} disabled={groupingBusyEventId === ev.id}>
                    {groupingBusyEventId === ev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shuffle className="h-3.5 w-3.5" />} Run grouping now
                  </Button>
                </div>
              )}
              {isRandomGroup && isAdmin && ev.groupingRanAt && ungrouped.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs dark:border-amber-500/25 dark:bg-amber-500/10">
                  <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" /> {ungrouped.length} {ungrouped.length === 1 ? 'person needs' : 'people need'} a team.
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setFormTeamFor({ event: ev, ungrouped })}>
                    <Users className="h-3.5 w-3.5" /> Form team
                  </Button>
                </div>
              )}
              {groupingErr && ev?.id === groupingErrEventId && (
                <p className="border-b border-rose-200 bg-rose-50 px-5 py-2 text-xs text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">{groupingErr}</p>
              )}

              {renderTable(list)}
            </div>
            )
          })}
        </div>
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

      <ReceiptReviewModal
        open={!!receiptFor}
        onClose={() => setReceiptFor(null)}
        kind="event"
        record={receiptFor}
        title={receiptFor?.event}
        personName={receiptFor?.isTeam ? `${receiptFor.teamName} · ${receiptFor.name}` : receiptFor?.name}
        personEmail={receiptFor?.email}
        reviewerName={adminName}
        canAct
        canCheckMember={isAdmin}
        accounts={upiAccounts}
        onDone={() => onTeamChanged?.()}
      />

      <ConfirmDialog
        open={confirmAction?.kind === 'deleteTeam'}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmDeleteTeam}
        title={`Delete "${confirmAction?.reg?.teamName || 'this team'}"?`}
        description="This removes the whole team's registration — every member loses their spot, and the payment record (if any) goes with it. This can't be undone."
        confirmLabel="Delete team"
      />
      <ConfirmDialog
        open={confirmAction?.kind === 'removeMember'}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmRemoveMember}
        title={`Remove ${confirmAction?.member?.name || confirmAction?.member?.email || 'this member'}?`}
        description="They'll no longer be registered for this event — if registration is still open, they (or someone else) can register for the spot again."
        confirmLabel="Remove"
      />

      <FormTeamModal
        data={formTeamFor}
        onClose={() => setFormTeamFor(null)}
        onDone={async () => { setFormTeamFor(null); await onTeamChanged?.() }}
      />

      <MemberDetailModal data={detailFor} onClose={() => setDetailFor(null)} />
      <TeamMessageModal team={msgTeam} onClose={() => setMsgTeam(null)} fromName={adminName} />
    </motion.div>
  )
}

// A compact read-only card: everything an admin needs to know about one
// registrant (or team member) without leaving the roster — email, phone and
// the profile fields (college, department, year) collected at registration.
function MemberDetailModal({ data, onClose }) {
  if (!data) return null
  const rows = [
    { icon: Mail, label: 'Email', value: data.email },
    { icon: Phone, label: 'Phone', value: data.phone },
    { icon: School, label: 'College', value: data.college },
    { icon: Contact2, label: 'Department', value: data.department },
    { icon: CalendarDays, label: 'Year', value: data.year },
  ]
  return (
    <Modal open={!!data} onClose={onClose} size="md">
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-acm-500/10 text-acm-600 dark:text-acm-400">
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold tracking-tight">{data.name || 'Member'}</h3>
            {data.role === 'leader' && <Badge tone="blue" className="mt-1">Team leader</Badge>}
          </div>
        </div>
        <dl className="mt-5 space-y-3">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 text-sm">
              <r.icon className="h-4 w-4 shrink-0 text-neutral-400" />
              <dt className="sr-only">{r.label}</dt>
              <dd className="truncate text-neutral-600 dark:text-neutral-300">
                {r.value || <span className="text-neutral-400">Not set</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Modal>
  )
}

// Bulk-compose: sends the SAME message to every team member who has a linked
// account — each lands in that person's own profile inbox individually,
// exactly like a one-to-one message, just fanned out to the whole team.
function TeamMessageModal({ team, onClose, fromName }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const recipients = (team?.members || []).filter((m) => m.uid)

  async function submit(e) {
    e.preventDefault()
    if (!body.trim() || recipients.length === 0) return
    setSending(true)
    setErr('')
    try {
      await Promise.all(recipients.map((m) => svc.sendAdminMessage({
        toUid: m.uid, toName: m.name, toEmail: m.email,
        subject: subject.trim() || `Message from ACM TKMCE — ${team.teamName || 'your team'}`,
        body: body.trim(), fromName,
      })))
      setDone(true)
      setTimeout(() => { onClose(); setDone(false); setBody(''); setSubject('') }, 1200)
    } catch (e2) {
      setErr(e2?.message || 'Could not send the message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal open={!!team} onClose={onClose} size="md">
      <form onSubmit={submit} className="p-6 sm:p-8">
        <h3 className="text-lg font-bold tracking-tight">Message {team?.teamName || 'team'}</h3>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Sent to {recipients.length} member{recipients.length === 1 ? '' : 's'}' own profile inboxes: {recipients.map((m) => m.name || m.email).join(', ')}.
        </p>
        {done ? (
          <p className="mt-6 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Message sent to the whole team.
          </p>
        ) : (
          <>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (optional)"
              className="mt-5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm outline-none focus:border-acm-500 dark:border-neutral-800 dark:bg-neutral-900"
            />
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              className="mt-3 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-acm-500 focus:ring-4 focus:ring-acm-500/10 dark:border-neutral-800 dark:bg-neutral-900"
            />
            {err && <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={sending}>Cancel</Button>
              <Button type="submit" size="sm" disabled={sending || !body.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send to team
              </Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}

function FormTeamModal({ data, onClose, onDone }) {
  const [picked, setPicked] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { setPicked(new Set()); setErr('') }, [data])

  const event = data?.event
  const ungrouped = data?.ungrouped || []
  const maxSize = Math.max(1, Number(event?.maxTeamSize) || 1)

  const toggle = (id) => setPicked((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else if (n.size < maxSize) n.add(id)
    return n
  })

  async function submit() {
    setBusy(true)
    setErr('')
    try {
      await adminTeamAction({ action: 'formGroup', eventId: event.id, registrationIds: [...picked] })
      onDone()
    } catch (e) {
      setErr(e?.message || 'Could not form the team.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={!!data} onClose={busy ? () => {} : onClose} size="md">
      {event && (
        <div className="p-6 sm:p-8">
          <h3 className="text-lg font-bold tracking-tight">Form a team</h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Pick up to {maxSize} people from {event.name}'s leftover pool to place on a team together.
          </p>
          <div className="mt-4 max-h-72 space-y-1.5 overflow-y-auto">
            {ungrouped.map((p) => (
              <label
                key={p.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-sm transition-colors',
                  picked.has(p.id) ? 'border-acm-400 bg-acm-50 dark:border-acm-500/50 dark:bg-acm-500/10' : 'border-neutral-200 dark:border-neutral-800',
                )}
              >
                <input
                  type="checkbox"
                  checked={picked.has(p.id)}
                  onChange={() => toggle(p.id)}
                  disabled={!picked.has(p.id) && picked.size >= maxSize}
                  className="h-4 w-4 shrink-0 rounded border-neutral-300 text-acm-600 dark:border-neutral-700 dark:bg-neutral-800"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-neutral-400">{p.email} · {p.department || '—'}</span>
                </span>
              </label>
            ))}
          </div>
          {err && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
            </p>
          )}
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-xs text-neutral-400">{picked.size} of {maxSize} max selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button size="sm" onClick={submit} disabled={busy || picked.size === 0}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Create team
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function AddTeammateForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setErr('')
    try {
      await onAdd({ name: name.trim(), email: email.trim() })
    } catch (e2) {
      setErr(e2?.message || 'Could not add that teammate.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-2.5 flex flex-wrap items-center gap-1.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className={cn(inputCls, 'h-8 max-w-[112px] px-2 text-xs')}
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className={cn(inputCls, 'h-8 max-w-[176px] px-2 text-xs')}
      />
      <Button type="submit" size="sm" disabled={busy || !email.trim()}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
      {err && <p className="mt-1 w-full text-xs text-rose-600 dark:text-rose-300">{err}</p>}
    </form>
  )
}

// Manual-mode payment status for a roster row, with a link to its receipt.
function ManualPaymentCell({ p, onView }) {
  const st = paymentState(p)
  const meta = PAYMENT_STATE_META[st]
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={meta.tone} dot={st === 'verified'}>{meta.label}</Badge>
      {p.utr && <code className="text-[11px] text-neutral-400">{p.utr}</code>}
      {(p.receiptId || st === 'rejected') && (
        <button onClick={onView} className="text-[11px] font-medium text-acm-600 hover:underline dark:text-acm-400">
          {p.receiptId ? 'View receipt' : 'Details'}
        </button>
      )}
    </div>
  )
}



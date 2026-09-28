import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3, Users, CalendarDays, IndianRupee, BadgeCheck, Globe, Gauge as GaugeIcon, Download, Search, Radio,
  CheckCircle2, Clock, XCircle, Hourglass, Gift, Sparkles, ArrowRight, MessageSquare, Trophy, Info, ChevronUp, ChevronDown,
  Star, MessageSquareQuote, Lightbulb, Reply,
} from 'lucide-react'
import { Button } from '../ui/Button'
import RubberSegment from '../reactbits/RubberSegment'
import { Badge } from '../ui/Badge'
import { InfoHint } from '../ui/Field'
import { ComposeMessageModal } from '../messages/Thread'
import * as svc from '../../services/firestore'
import { fetchAllRatings } from '../../services/engagement'
import { useNow, startMs } from '../../lib/eventClock'
import { formatDate } from '../../lib/format'
import { downloadCsv } from '../../lib/csv'
import { cn } from '../../lib/cn'
import { allEventStats, peopleStats, totals, timeline, memberIndex, registeredAt, latestFeedback } from '../../lib/analytics'
import { ChartCard, StatTile, BarList, Donut, StackedBar, LineChart, Gauge, fmtInt, fmtMoney, fmtPct } from './analytics/Charts'

const fieldCls =
  'rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800'
const inputCls = `w-full ${fieldCls}`
const plural = (n, one, many = `${one}s`) => `${fmtInt(n)} ${n === 1 ? one : many}`

const PERIODS = [
  { k: 'all', label: 'All time', days: null },
  { k: '365', label: 'Last 12 months', days: 365 },
  { k: '90', label: 'Last 90 days', days: 90 },
]

const STAGE = {
  live: { label: 'Live now', tone: 'red' },
  upcoming: { label: 'Upcoming', tone: 'blue' },
  ended: { label: 'Ended', tone: 'neutral' },
}

const SCORE_HINT = 'Success score (0–100) = half reach + half completion. Reach is how full the event got (registrations ÷ cap), or — with no cap — how it did against the average event. Completion is the share of registrations that ended with a ticket (payment verified, or free).'

const paymentParts = (s) => [
  { key: 'verified', label: 'Verified', value: s.verified || 0, color: 'good', icon: CheckCircle2 },
  { key: 'free', label: 'Free', value: s.free || 0, color: 'member', icon: Gift },
  { key: 'review', label: 'Under review', value: s.review || 0, color: 'warning', icon: Hourglass },
  { key: 'awaiting', label: 'Awaiting receipt', value: s.awaiting || 0, color: 'serious', icon: Clock },
  { key: 'rejected', label: 'Rejected', value: s.rejected || 0, color: 'critical', icon: XCircle },
]

export function AnalyticsPanel({ regs = [], events = [], adminName, canMessage = false }) {
  const [view, setView] = useState('overview') // overview | events | people
  const [period, setPeriod] = useState('all')
  const [focusId, setFocusId] = useState(null)
  const [peopleFilter, setPeopleFilter] = useState('all')
  const [users, setUsers] = useState([])
  const [memberships, setMemberships] = useState([])
  const [ratings, setRatings] = useState([])
  const [limited, setLimited] = useState(false)
  const now = useNow(60000)

  // Profiles and member records sharpen member counts and let "never
  // registered" people show up. Editors without access still get everything
  // the registrations themselves can tell.
  useEffect(() => {
    let alive = true
    Promise.all([
      svc.fetchUsers().catch(() => null),
      svc.fetchAllMemberships().catch(() => null),
      fetchAllRatings().catch(() => []),
    ]).then(([u, m, r]) => {
      if (!alive) return
      setRatings(r || [])
      setUsers(u || [])
      setMemberships(m || [])
      setLimited(!u || !m)
    })
    return () => { alive = false }
  }, [])

  const data = useMemo(() => {
    const days = PERIODS.find((p) => p.k === period)?.days
    const from = days ? now - days * 864e5 : null
    const evs = events.filter((e) => !e.draft && (from == null || (e.date && startMs(e) >= from)))
    const ids = new Set(evs.map((e) => e.id))
    const rs = regs.filter((r) => ids.has(r.eventId))
    const members = memberIndex({ users, memberships })
    const stats = allEventStats(evs, rs, { now, members, ratings }).sort((a, b) => b.start - a.start)
    const people = peopleStats({ regs: rs, users, memberships, events: evs, now })
    const periodLabel = PERIODS.find((p) => p.k === period)?.label || 'All time'
    return { from, evs, rs, stats, people, periodLabel, t: totals(stats, people, memberships) }
  }, [events, regs, users, memberships, ratings, period, now])

  const focus = data.stats.find((s) => s.id === focusId)
    || [...data.stats].filter((s) => s.registrations > 0).sort((a, b) => b.start - a.start)[0]
    || data.stats[0]

  function openEvent(id, section) {
    setFocusId(id)
    setView('events')
    if (section) setTimeout(() => document.getElementById(`analytics-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <BarChart3 className="h-5 w-5 text-acm-500" /> Analytics
          </h2>
          <p className="mt-1 text-xs text-neutral-400">Registrations, members, money and how every event performed — live from the database.</p>
        </div>
      </div>

      {/* One filter row above everything it scopes. */}
      <div className="flex flex-wrap items-center gap-2">
        <RubberSegment
          items={[{ value: 'overview', label: 'Overview' }, { value: 'events', label: 'Event success' }, { value: 'people', label: 'People' }]}
          value={view}
          onChange={(v) => setView(v)}
          aria-label="Analytics view"
          size="sm"
          radius={9}
          inset={3}
          trackColor="#262626"
          thumbColor="#1f47f5"
          textColor="#a3a3a3"
          activeTextColor="#ffffff"
          speed={0.85}
          className="admin-segment"
        />
        <select className={cn(fieldCls, 'h-10 py-0')} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
          {PERIODS.map((p) => <option key={p.k} value={p.k}>{p.label}</option>)}
        </select>
        {limited && (
          <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400" title="Your account can't read user profiles or member records, so member counts come from registrations alone.">
            <Info className="h-3.5 w-3.5" /> Member figures from registration data only
          </span>
        )}
      </div>

      {view === 'overview' && <Overview data={data} now={now} onOpenEvent={openEvent} onPeople={(f) => { setPeopleFilter(f); setView('people') }} />}
      {view === 'events' && <EventSuccess data={data} focus={focus} onFocus={setFocusId} adminName={adminName} canMessage={canMessage} />}
      {view === 'people' && <People data={data} filter={peopleFilter} setFilter={setPeopleFilter} adminName={adminName} canMessage={canMessage} />}
    </motion.div>
  )
}

// ── Overview ──────────────────────────────────────────────────
function Overview({ data, now, onOpenEvent, onPeople }) {
  const { t, stats, rs } = data
  const latest = latestFeedback(stats, 3)
  const span = data.from ? now - data.from : now - Math.min(now, ...rs.map((r) => registeredAt(r) || now))
  const bucket = span > 200 * 864e5 ? 'month' : 'week'
  const trend = timeline(rs, { bucket, from: data.from ?? undefined, to: now })
  const byRegs = [...stats].filter((s) => s.registrations > 0).sort((a, b) => b.registrations - a.registrations)
  const nowNext = stats.filter((s) => s.stage !== 'ended').sort((a, b) => a.start - b.start).slice(0, 5)
  const depts = new Map()
  stats.forEach((s) => s.departments.forEach((d) => depts.set(d.label, (depts.get(d.label) || 0) + d.value)))
  const deptItems = [...depts].map(([label, value]) => ({ key: label, label, value })).sort((a, b) => b.value - a.value).slice(0, 8)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Users} label="Registrations" value={fmtInt(t.registrations)} sub={plural(t.uniquePeople, 'person', 'people')} accent="bar" />
        <StatTile icon={CalendarDays} label="Events" value={fmtInt(stats.length)} sub={`${t.live} live · ${t.upcoming} next · ${t.ended} done`} accent="inside" />
        <StatTile icon={IndianRupee} label="Collected" value={fmtMoney(t.collected + t.membershipFees)} sub={`${fmtMoney(t.membershipFees)} memberships${t.underReview ? ` · ${fmtMoney(t.underReview)} in review` : ''}`} accent="good" />
        <StatTile icon={BadgeCheck} label="By ACM members" value={fmtPct(t.registrations ? t.memberRegs / t.registrations : null)} sub={`${fmtInt(t.members)} members on record`} accent="member" />
        <StatTile icon={Globe} label="From outside TKM" value={fmtInt(t.outside)} sub={fmtPct(t.registrations ? t.outside / t.registrations : null) + ' of registrations'} accent="outside" />
        <StatTile icon={GaugeIcon} label="Avg success" value={t.avgSuccess} sub={t.avgRating != null ? `out of 100 · ★ ${t.avgRating.toFixed(1)} from ${fmtInt(t.ratingCount)} ratings` : 'score out of 100'} accent="line" />
      </div>

      {t.participatedNonMembers > 0 && (
        <button
          onClick={() => onPeople('took-part-non-member')}
          className="flex w-full items-center gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-left shadow-[0_0_16px_rgba(251,191,36,0.2)] transition-colors hover:bg-amber-100/70 dark:border-amber-500/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/15"
        >
          <Sparkles className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">{fmtInt(t.participatedNonMembers)} people took part in events but aren’t ACM members</div>
            <div className="text-xs text-amber-800/80 dark:text-amber-200/80">Your warmest recruitment list — see who they are, export it, or message them.</div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
        </button>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard title="Registrations over time" subtitle={`Per ${bucket} · ${data.periodLabel.toLowerCase()}`} className="lg:col-span-2">
          <LineChart points={trend} color="line" label="Registrations" />
        </ChartCard>
        <ChartCard title="ACM members vs non-members" subtitle="Share of all registrations">
          <Donut
            centerLabel="registrations"
            segments={[
              { key: 'm', label: 'ACM members', value: t.memberRegs, color: 'member' },
              { key: 'n', label: 'Non-members', value: t.registrations - t.memberRegs, color: 'nonmember' },
            ]}
          />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard title="Registrations by event" subtitle="Click an event for its full breakdown" className="lg:col-span-2">
          <BarList
            items={byRegs.slice(0, 10).map((s) => ({ key: s.id, label: s.name, value: s.registrations, sub: s.fillRate != null ? `${fmtPct(s.fillRate)} full` : '' }))}
            onSelect={onOpenEvent}
            empty="No registrations in this period."
          />
        </ChartCard>
        <div className="grid gap-5">
          <ChartCard title="TKM vs outside colleges">
            <Donut
              size={120}
              centerLabel="registrations"
              segments={[
                { key: 'in', label: 'TKM College', value: t.registrations - t.outside, color: 'inside' },
                { key: 'out', label: 'Other colleges', value: t.outside, color: 'outside' },
              ]}
            />
          </ChartCard>
          <ChartCard title="Latest feedback" subtitle={t.feedbackCount ? `${plural(t.feedbackCount, 'written note')} · click to see the event` : 'Remarks and suggestions from attendees'}>
            {latest.length === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-400">No remarks yet — attendees can add them from their profile once an event ends.</p>
            ) : (
              <ul className="space-y-3">
                {latest.map((f) => (
                  <li key={f.id}>
                    <button onClick={() => onOpenEvent(f.eventId, 'feedback')} className="w-full text-left">
                      <div className="flex items-center gap-2 text-xs">
                        <Stars value={f.rating} />
                        <span className="min-w-0 flex-1 truncate text-neutral-500">{f.eventName}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-700 dark:text-neutral-300">“{f.remarks || f.suggestions}”</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard title="Payment status" subtitle="Every registration, by where its payment stands">
          <StackedBar parts={paymentParts(t.states)} />
        </ChartCard>
        <ChartCard title="Happening now & next">
          {nowNext.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-3">
              {nowNext.map((s) => (
                <li key={s.id}>
                  <button onClick={() => onOpenEvent(s.id)} className="w-full text-left">
                    <div className="flex items-center gap-2 text-sm">
                      {s.stage === 'live' && <Radio className="h-3.5 w-3.5 shrink-0 animate-pulse text-rose-500" />}
                      <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                      <span className="shrink-0 text-xs text-neutral-400">{formatDate(s.event.date)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-neutral-500">
                      <div className="h-1.5 flex-1 rounded-full" style={{ background: 'var(--viz-grid)' }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.round((s.fillRate ?? s.reach) * 100)}%`, background: 'var(--viz-bar)', boxShadow: '0 0 8px var(--viz-bar)' }} />
                      </div>
                      <span className="shrink-0 tabular-nums">{fmtInt(s.registrations)}{s.capacity ? ` / ${fmtInt(s.capacity)}` : ''}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
        <ChartCard title="Departments" subtitle="Who registers">
          <BarList items={deptItems} empty="No registrations yet." />
        </ChartCard>
      </div>
    </div>
  )
}

// ── Event success ────────────────────────────────────────────
function EventSuccess({ data, focus, onFocus, adminName, canMessage }) {
  const [sort, setSort] = useState({ k: 'start', dir: -1 })
  const ranked = [...data.stats].sort((a, b) => b.registrations - a.registrations)
  const rank = focus ? ranked.findIndex((s) => s.id === focus.id) + 1 : 0
  const rows = [...data.stats].sort((a, b) => {
    const v = (s) => (sort.k === 'name' ? s.name.toLowerCase() : s[sort.k] ?? -1)
    return v(a) > v(b) ? sort.dir : v(a) < v(b) ? -sort.dir : 0
  })

  if (!focus) {
    return <p className="rounded-2xl border border-dashed border-neutral-200 p-12 text-center text-sm text-neutral-500 dark:border-neutral-800">No published events in this period.</p>
  }

  const firstReg = focus.regs.reduce((m, r) => Math.min(m, registeredAt(r) || m), Infinity)
  const cumulative = timeline(focus.regs, {
    bucket: 'day',
    from: Number.isFinite(firstReg) ? firstReg : undefined,
    to: Math.max(Number.isFinite(firstReg) ? firstReg : 0, Math.min(Date.now(), focus.start || Date.now())),
    cumulative: true,
  })

  function exportCsv() {
    downloadCsv('acm-event-success', rows, [
      { label: 'Event', value: (s) => s.name },
      { label: 'Date', value: (s) => s.event.date || '' },
      { label: 'Stage', value: (s) => STAGE[s.stage].label },
      { label: 'Registrations', value: (s) => s.registrations },
      { label: 'People', value: (s) => s.people },
      { label: 'Capacity', value: (s) => s.capacity || '' },
      { label: 'Fill rate', value: (s) => (s.fillRate == null ? '' : fmtPct(s.fillRate)) },
      { label: 'Completion', value: (s) => fmtPct(s.completion) },
      { label: 'ACM members', value: (s) => s.memberRegs },
      { label: 'Non-members', value: (s) => s.nonMemberRegs },
      { label: 'Outside TKM', value: (s) => s.outside },
      { label: 'Collected (₹)', value: (s) => s.collected },
      { label: 'Under review (₹)', value: (s) => s.underReview },
      { label: 'Average rating', value: (s) => (s.avgRating != null ? s.avgRating.toFixed(2) : '') },
      { label: 'Ratings', value: (s) => s.ratingCount },
      { label: 'Written feedback', value: (s) => s.feedback.length },
      { label: 'Success score', value: (s) => s.successScore },
    ])
  }

  const th = (k, label, cls = '') => (
    <th className={cn('px-3 py-2.5 font-medium', cls)}>
      <button onClick={() => setSort((s) => ({ k, dir: s.k === k ? -s.dir : -1 }))} className="inline-flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-200">
        {label}
        {sort.k === k && (sort.dir < 0 ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
      </button>
    </th>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <select className={cn(fieldCls, 'h-10 w-full py-0 sm:w-auto sm:min-w-[260px]')} value={focus.id} onChange={(e) => onFocus(e.target.value)} aria-label="Event">
          {data.stats.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.event.date ? formatDate(s.event.date) : 'no date'}</option>)}
        </select>
        <Badge tone={STAGE[focus.stage].tone} dot={focus.stage === 'live'}>{STAGE[focus.stage].label}</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <ChartCard title={<span className="flex items-center gap-1.5">Success <InfoHint text={SCORE_HINT} /></span>} subtitle={focus.event.venue || ''}>
          <Gauge value={focus.successScore} />
          <dl className="mt-4 space-y-1.5 text-xs">
            <div className="flex justify-between"><dt className="text-neutral-500">Reach</dt><dd className="font-semibold tabular-nums">{fmtPct(focus.reach)}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-500">Completion</dt><dd className="font-semibold tabular-nums">{fmtPct(focus.completion)}</dd></div>
          </dl>
        </ChartCard>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile icon={Star} label="Rating" value={focus.avgRating != null ? `★ ${focus.avgRating.toFixed(1)}` : '—'} sub={focus.ratingCount ? `${plural(focus.ratingCount, 'rating')}${focus.feedback.length ? ` · ${plural(focus.feedback.length, 'note')}` : ''}` : focus.stage === 'ended' ? 'No ratings yet' : 'After it ends'} accent="nonmember" />
          <StatTile icon={Trophy} label="Registrations" value={fmtInt(focus.registrations)} sub={rank ? `#${rank} of ${ranked.length} events` : ''} accent="bar" />
          <StatTile icon={Users} label="Fill rate" value={focus.fillRate == null ? 'No cap' : fmtPct(focus.fillRate)} sub={focus.capacity ? `${fmtInt(focus.registrations - focus.states.rejected)} of ${fmtInt(focus.capacity)} seats` : plural(focus.people, 'person', 'people')} accent="inside" />
          <StatTile icon={CheckCircle2} label="Tickets issued" value={fmtInt(focus.ticketed)} sub={`${fmtPct(focus.completion)} of registrations`} accent="good" />
          <StatTile icon={IndianRupee} label="Collected" value={fmtMoney(focus.collected)} sub={focus.underReview ? `${fmtMoney(focus.underReview)} under review` : focus.fee ? `₹${focus.fee} fee` : 'Free event'} accent="member" />
          <ChartCard title="Registrations vs other events" subtitle="This event highlighted" className="col-span-2 sm:col-span-3">
            <BarList
              items={ranked.slice(0, 12).map((s) => ({ key: s.id, label: s.name, value: s.registrations }))}
              highlight={focus.id}
              onSelect={onFocus}
            />
          </ChartCard>
        </div>
      </div>

      <AttendeeFeedback focus={focus} people={data.people} adminName={adminName} canMessage={canMessage} />

      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard title="How registrations came in" subtitle="Running total, day by day" className="lg:col-span-2">
          <LineChart points={cumulative} color="line" label="Registered so far" />
        </ChartCard>
        <ChartCard title="ACM members vs non-members">
          <Donut size={130} centerLabel="registrations" segments={[
            { key: 'm', label: 'ACM members', value: focus.memberRegs, color: 'member' },
            { key: 'n', label: 'Non-members', value: focus.nonMemberRegs, color: 'nonmember' },
          ]} />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard title="TKM vs outside colleges" subtitle={focus.event.interCollege ? 'Inter-college event' : 'TKM-only event'}>
          <Donut size={130} centerLabel="registrations" segments={[
            { key: 'in', label: 'TKM College', value: focus.inside, color: 'inside' },
            { key: 'out', label: 'Other colleges', value: focus.outside, color: 'outside' },
          ]} />
        </ChartCard>
        <ChartCard title="Payment status">
          <StackedBar parts={paymentParts(focus.states)} />
        </ChartCard>
        <ChartCard title="Departments & years">
          <BarList items={focus.departments.slice(0, 5).map((d) => ({ key: `d-${d.label}`, label: d.label, value: d.value }))} empty="No registrations yet." />
          {focus.years.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {focus.years.map((y) => (
                <span key={y.label} className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs dark:border-neutral-700">{y.label} · <strong>{y.value}</strong></span>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Every event, ranked"
        subtitle="Click a column to sort, a row to open it"
        action={<Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>}
      >
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-neutral-400">
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                {th('name', 'Event', 'pl-5')}
                {th('start', 'Date')}
                {th('registrations', 'Regs')}
                {th('fillRate', 'Fill')}
                {th('completion', 'Completion')}
                {th('memberRegs', 'Members')}
                {th('outside', 'Outside')}
                {th('collected', 'Collected')}
                {th('avgRating', 'Rating')}
                {th('successScore', 'Score', 'pr-5')}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {rows.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onFocus(s.id)}
                  className={cn('cursor-pointer tabular-nums transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40', s.id === focus.id && 'bg-acm-50/60 dark:bg-acm-500/10')}
                >
                  <td className="max-w-[240px] px-3 py-2.5 pl-5">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="text-[11px] text-neutral-400">{STAGE[s.stage].label}</div>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-500">{s.event.date ? formatDate(s.event.date) : '—'}</td>
                  <td className="px-3 py-2.5 font-semibold">{fmtInt(s.registrations)}</td>
                  <td className="px-3 py-2.5">{s.fillRate == null ? <span className="text-neutral-400">—</span> : fmtPct(s.fillRate)}</td>
                  <td className="px-3 py-2.5">{s.registrations ? fmtPct(s.completion) : '—'}</td>
                  <td className="px-3 py-2.5">{fmtInt(s.memberRegs)}<span className="text-neutral-400"> / {fmtInt(s.nonMemberRegs)}</span></td>
                  <td className="px-3 py-2.5">{fmtInt(s.outside)}</td>
                  <td className="px-3 py-2.5">{fmtMoney(s.collected)}</td>
                  <td className="px-3 py-2.5">
                    {s.avgRating != null ? <span title={`${s.ratingCount} ratings`}>★ {s.avgRating.toFixed(1)}</span> : <span className="text-neutral-400">—</span>}
                    {s.feedback.length > 0 && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-neutral-400" title={`${s.feedback.length} written`}>
                        <MessageSquareQuote className="h-3 w-3" />{s.feedback.length}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 pr-5">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700">
                        <span className="block h-1.5 rounded-full bg-acm-500" style={{ width: `${s.successScore}%` }} />
                      </span>
                      <strong>{s.successScore}</strong>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-neutral-400">Members / non-members column shows ACM members first. {SCORE_HINT}</p>
      </ChartCard>
    </div>
  )
}

// ── Attendee feedback ─────────────────────────────────────────
function Stars({ value, className }) {
  return (
    <span className={cn('shrink-0 tracking-tight', className)} role="img" aria-label={`${value} of 5 stars`}>
      <span className="text-amber-400">{'★'.repeat(value)}</span>
      <span className="text-neutral-300 dark:text-neutral-700">{'★'.repeat(5 - value)}</span>
    </span>
  )
}

const FEEDBACK_FILTERS = [
  { k: 'all', label: 'All', test: () => true },
  { k: 'remarks', label: 'Remarks', test: (f) => !!f.remarks },
  { k: 'suggestions', label: 'Suggestions', test: (f) => !!f.suggestions },
  { k: 'low', label: '3★ or less', test: (f) => f.rating <= 3 },
]

function AttendeeFeedback({ focus, people, adminName, canMessage }) {
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [msgTo, setMsgTo] = useState(null)
  useEffect(() => { setShowAll(false); setQ(''); setFilter('all') }, [focus.id])

  const byUid = useMemo(() => new Map(people.filter((p) => p.uid).map((p) => [p.uid, p])), [people])
  const entries = focus.feedback.map((f) => {
    const p = byUid.get(f.userId)
    return { ...f, name: f.name !== 'Attendee' ? f.name : p?.name || 'Attendee', email: p?.email || '' }
  })
  const test = FEEDBACK_FILTERS.find((f) => f.k === filter)?.test || (() => true)
  const needle = q.trim().toLowerCase()
  const list = entries.filter(test).filter((f) => !needle || `${f.name} ${f.remarks} ${f.suggestions}`.toLowerCase().includes(needle))
  const shown = showAll ? list : list.slice(0, 6)
  const maxCount = Math.max(1, ...focus.ratingSpread.map((r) => r.count))

  function exportCsv() {
    downloadCsv(`acm-feedback-${focus.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, entries, [
      { label: 'Name', value: (f) => f.name },
      { label: 'Email', value: (f) => f.email },
      { label: 'Rating', value: (f) => f.rating },
      { label: 'Remarks', value: (f) => f.remarks },
      { label: 'Suggestions', value: (f) => f.suggestions },
      { label: 'Updated', value: (f) => (f.at ? new Date(f.at).toISOString() : '') },
    ])
  }

  return (
    <div id="analytics-feedback" className="scroll-mt-28">
      <ChartCard
        title={<span className="flex items-center gap-1.5"><MessageSquareQuote className="h-4 w-4 text-amber-400" /> What attendees said</span>}
        subtitle={focus.ratingCount ? `${plural(focus.ratingCount, 'rating')} · ${plural(entries.length, 'written note')}` : focus.stage === 'ended' ? 'No ratings yet — attendees rate from their profile' : 'Opens to attendees once the event ends'}
        action={entries.length > 0 && <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>}
      >
        <div className="grid gap-6 md:grid-cols-[200px_1fr]">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">{focus.avgRating != null ? focus.avgRating.toFixed(1) : '—'}</span>
              {focus.avgRating != null && <Stars value={Math.round(focus.avgRating)} className="text-sm" />}
            </div>
            <ul className="mt-4 space-y-1.5" aria-label="Ratings by stars">
              {focus.ratingSpread.map((r) => (
                <li key={r.stars} className="flex items-center gap-2 text-xs">
                  <span className="w-6 shrink-0 tabular-nums text-neutral-500">{r.stars}★</span>
                  <span className="h-1.5 flex-1 rounded-full" style={{ background: 'var(--viz-grid)' }}>
                    <span
                      className="block h-1.5 rounded-full bg-amber-400 transition-[width] duration-500"
                      style={{ width: `${(r.count / maxCount) * 100}%`, boxShadow: r.count ? '0 0 8px rgba(251,191,36,0.55)' : 'none' }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right tabular-nums text-neutral-500">{r.count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            {entries.length === 0 ? (
              <p className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-400 dark:border-neutral-800">
                {focus.ratingCount ? 'People have rated this event but nobody has written remarks yet.' : 'Nothing written yet.'}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {FEEDBACK_FILTERS.map((f) => {
                    const n = entries.filter(f.test).length
                    return (
                      <button
                        key={f.k}
                        onClick={() => setFilter(f.k)}
                        className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                          filter === f.k ? 'border-acm-500 bg-acm-600 text-white' : 'border-neutral-200 text-neutral-500 hover:text-neutral-800 dark:border-neutral-700 dark:hover:text-neutral-200')}
                      >
                        {f.label} · {n}
                      </button>
                    )
                  })}
                  {entries.length > 6 && (
                    <div className="relative ml-auto w-full sm:w-52">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search feedback" aria-label="Search feedback" className={cn(inputCls, 'h-8 py-0 pl-8 text-xs')} />
                    </div>
                  )}
                </div>
                <ul className="mt-3 space-y-2.5">
                  {shown.map((f) => (
                    <li key={f.id} className="rounded-xl border border-neutral-200 p-3.5 dark:border-neutral-800">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 truncate font-medium">{f.name}</span>
                        <Stars value={f.rating} className="text-xs" />
                        <span className="ml-auto shrink-0 text-[11px] text-neutral-400">{f.at ? new Date(f.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}</span>
                        {canMessage && f.userId && (
                          <button onClick={() => setMsgTo(f)} className="shrink-0 rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-acm-500 dark:hover:bg-neutral-800" aria-label={`Reply to ${f.name}`} title="Reply">
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {f.remarks && (
                        <p className="mt-2 whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">{f.remarks}</p>
                      )}
                      {f.suggestions && (
                        <div className="mt-2 flex gap-2 rounded-lg bg-amber-500/[0.07] p-2.5 text-sm">
                          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                          <p className="min-w-0 whitespace-pre-line text-neutral-700 dark:text-neutral-300"><span className="sr-only">Suggestion: </span>{f.suggestions}</p>
                        </div>
                      )}
                    </li>
                  ))}
                  {list.length === 0 && <li className="py-6 text-center text-sm text-neutral-400">No feedback matches.</li>}
                </ul>
                {list.length > 6 && (
                  <button onClick={() => setShowAll((v) => !v)} className="mt-3 text-xs font-medium text-acm-600 hover:underline dark:text-acm-400">
                    {showAll ? 'Show fewer' : `Show all ${fmtInt(list.length)}`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </ChartCard>
      <ComposeMessageModal
        open={!!msgTo}
        onClose={() => setMsgTo(null)}
        toUid={msgTo?.userId}
        toName={msgTo?.name}
        toEmail={msgTo?.email}
        fromName={adminName}
      />
    </div>
  )
}

// ── People ───────────────────────────────────────────────────
const PEOPLE_FILTERS = [
  { k: 'all', label: 'Everyone', test: () => true },
  { k: 'members', label: 'ACM members', test: (p) => p.isMember },
  { k: 'non-members', label: 'Non-members', test: (p) => !p.isMember },
  { k: 'took-part-non-member', label: 'Took part, not a member', test: (p) => p.participated > 0 && !p.isMember },
  { k: 'registered', label: 'Registered for events', test: (p) => p.registered > 0 },
  { k: 'never', label: 'Never registered', test: (p) => p.registered === 0 },
  { k: 'outside', label: 'Outside TKM', test: (p) => p.outside },
]

function People({ data, filter, setFilter, adminName, canMessage }) {
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(60)
  const [msgTo, setMsgTo] = useState(null)
  const test = PEOPLE_FILTERS.find((f) => f.k === filter)?.test || (() => true)
  const counts = Object.fromEntries(PEOPLE_FILTERS.map((f) => [f.k, data.people.filter(f.test).length]))
  const needle = q.trim().toLowerCase()
  const rows = data.people
    .filter(test)
    .filter((p) => !needle || [p.name, p.email, p.college, p.department, p.membershipId].some((f) => String(f || '').toLowerCase().includes(needle)))
    .sort((a, b) => b.participated - a.participated || b.registered - a.registered || a.name.localeCompare(b.name))
  const top = [...data.people].filter((p) => p.registered > 0).sort((a, b) => b.participated - a.participated || b.registered - a.registered).slice(0, 8)

  function exportCsv() {
    downloadCsv(`acm-people-${filter}`, rows, [
      { label: 'Name', value: (p) => p.name },
      { label: 'Email', value: (p) => p.email },
      { label: 'Phone', value: (p) => p.phone },
      { label: 'College', value: (p) => p.college },
      { label: 'Department', value: (p) => p.department },
      { label: 'Year', value: (p) => p.year },
      { label: 'ACM member', value: (p) => (p.isMember ? 'Yes' : 'No') },
      { label: 'Membership ID', value: (p) => p.membershipId },
      { label: 'Events registered', value: (p) => p.registered },
      { label: 'Events taken part in', value: (p) => p.participated },
      { label: 'Upcoming', value: (p) => p.upcoming },
      { label: 'Events', value: (p) => p.events.join('; ') },
      { label: 'Has an account', value: (p) => (p.hasAccount ? 'Yes' : 'No') },
    ])
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard title="Most active people" subtitle="Events taken part in (registered in brackets)" className="lg:col-span-1">
          <BarList
            items={top.map((p) => ({ key: p.key, label: p.name || p.email, value: p.participated, sub: `(${p.registered})`, color: p.isMember ? 'member' : 'nonmember' }))}
            empty="No one has taken part yet."
          />
          {top.length > 0 && (
            <div className="mt-4 flex gap-4 text-[11px] text-neutral-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: 'var(--viz-member)' }} /> ACM member</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: 'var(--viz-nonmember)' }} /> Non-member</span>
            </div>
          )}
        </ChartCard>
        <div className="viz grid grid-cols-2 gap-3 lg:col-span-2">
          <StatTile icon={Users} label="People on the site" value={fmtInt(data.t.accounts)} sub="accounts" accent="bar" />
          <StatTile icon={CalendarDays} label="Registered for events" value={fmtInt(data.t.uniquePeople)} sub="incl. teammates without accounts" accent="inside" />
          <StatTile icon={Trophy} label="Took part" value={fmtInt(data.t.participants)} sub="with a ticket, event finished" accent="good" />
          <StatTile icon={Sparkles} label="Took part, not members" value={fmtInt(data.t.participatedNonMembers)} sub="recruitment prospects" accent="nonmember" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PEOPLE_FILTERS.map((f) => (
          <button
            key={f.k}
            onClick={() => { setFilter(f.k); setLimit(60) }}
            className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
              filter === f.k
                ? 'border-acm-500 bg-acm-600 text-white'
                : 'border-neutral-200 text-neutral-600 hover:border-neutral-300 dark:border-neutral-700 dark:text-neutral-300')}
          >
            {f.label} <span className="opacity-70">{counts[f.k]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input className={cn(inputCls, 'h-10 py-0 pl-9')} placeholder="Search name, email, college, ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
          <Download className="h-4 w-4" /> Export {fmtInt(rows.length)} as CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-neutral-400">
            <tr className="border-b border-neutral-100 dark:border-neutral-800">
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">College · Dept · Year</th>
              <th className="px-4 py-3 font-medium">ACM</th>
              <th className="px-4 py-3 text-right font-medium">Registered</th>
              <th className="px-4 py-3 text-right font-medium">Took part</th>
              <th className="px-4 py-3 text-right font-medium">Upcoming</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {rows.slice(0, limit).map((p) => (
              <tr key={p.key} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                <td className="max-w-[240px] px-4 py-2.5">
                  <div className="truncate font-medium">{p.name || '—'}</div>
                  <div className="truncate text-xs text-neutral-400">{p.email || '—'}{!p.hasAccount && ' · no account'}</div>
                </td>
                <td className="max-w-[260px] px-4 py-2.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <div className="truncate">{p.college || '—'}</div>
                  <div className="truncate">{[p.department, p.year].filter(Boolean).join(' · ') || '—'}</div>
                </td>
                <td className="px-4 py-2.5">
                  {p.isMember ? <Badge tone="green">{p.membershipId || 'Member'}</Badge> : <span className="text-xs text-neutral-400">No</span>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.registered}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{p.participated}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.upcoming}</td>
                <td className="px-4 py-2.5 text-right">
                  {canMessage && p.uid && (
                    <button
                      onClick={() => setMsgTo(p)}
                      title={`Message ${p.name || 'this person'}`}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-neutral-200 text-neutral-400 transition-colors hover:border-acm-300 hover:text-acm-500 dark:border-neutral-700"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-10 text-center text-sm text-neutral-500">No one matches.</p>}
      </div>
      {rows.length > limit && (
        <div className="text-center">
          <Button size="sm" variant="outline" onClick={() => setLimit((l) => l + 100)}>Show more ({fmtInt(rows.length - limit)} left)</Button>
        </div>
      )}

      <ComposeMessageModal
        open={!!msgTo}
        onClose={() => setMsgTo(null)}
        toUid={msgTo?.uid}
        toName={msgTo?.name}
        toEmail={msgTo?.email}
        fromName={adminName}
      />
    </div>
  )
}

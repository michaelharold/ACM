// Numbers behind the admin Analytics tab: per-event success, who takes part,
// members vs non-members, money collected. Pure functions over the records the
// admin already loads (events, registrations, memberships, user profiles), so
// they run under plain `node --test` (tests/unit/analytics.test.mjs).
import { isEnded, isLiveNow, startMs } from './eventClock.js'
import { paymentState, hasTicket } from './manualPay.js'
import { isTkmCollege } from './orgData.js'

export const toMillis = (t) => {
  if (!t) return 0
  if (typeof t === 'string') return Date.parse(t) || 0
  if (typeof t === 'number') return t
  if (typeof t.toMillis === 'function') return t.toMillis()
  if (typeof t.seconds === 'number') return t.seconds * 1000
  return 0
}

export function eventStage(event, now = Date.now()) {
  if (!event?.date) return 'upcoming'
  if (isLiveNow(event, now)) return 'live'
  if (isEnded(event, now)) return 'ended'
  return 'upcoming'
}

// When a registration was made: its timestamp, else its 'YYYY-MM-DD' date.
export const registeredAt = (r) => toMillis(r.createdAt) || (r.date ? Date.parse(`${r.date}T12:00:00`) || 0 : 0)

// The admin roster fills blanks with '—' for display; treat that as unknown.
const known = (v) => (v && v !== '—' ? v : '')

// Everyone a registration puts in the room: a team's members (leader
// included), or the solo registrant.
export function participantsOf(r) {
  if (r.isTeam && Array.isArray(r.members) && r.members.length) {
    return r.members.map((m) => ({
      uid: m.uid || '', name: known(m.name), email: known(m.email).toLowerCase(),
      college: known(m.college), department: known(m.department), year: known(m.year),
    }))
  }
  return [{
    uid: r.userId || '', name: known(r.userName || r.name), email: known(r.userEmail || r.email).toLowerCase(),
    college: known(r.college), department: known(r.department), year: known(r.year),
  }]
}

const personKey = (p) => p.uid || (p.email ? `mail:${p.email}` : '')

// uid → member?  Built from user profiles (acmMember) and membership records
// (verified, free or existing). Either source is enough.
export function memberIndex({ users = [], memberships = [] } = {}) {
  const set = new Set()
  users.forEach((u) => { if (u.acmMember) set.add(u.id) })
  memberships.forEach((m) => {
    if (m.legacy || hasTicket(m)) set.add(m.userId || m.id)
  })
  return set
}

const isMemberReg = (r, members) =>
  !!(r.acmMember || r.membershipId) || members.has(r.userId)

// Counts values into [{ label, value }] sorted by size.
function tally(list, key, fallback = 'Not set') {
  const m = new Map()
  list.forEach((x) => {
    const k = key(x) || fallback
    m.set(k, (m.get(k) || 0) + 1)
  })
  return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

// Per-event figures. `members` is a memberIndex(); `avgRegs` (the average
// registrations per event) lets an uncapped event's reach be judged against
// the others.
export function eventStats(event, regs, { now = Date.now(), members = new Set(), avgRegs = 0 } = {}) {
  const rs = regs.filter((r) => r.eventId === event.id)
  const registrations = rs.length
  const states = { verified: 0, free: 0, review: 0, awaiting: 0, rejected: 0 }
  rs.forEach((r) => { states[paymentState(r)]++ })
  const ticketed = states.verified + states.free
  const live = rs.filter((r) => paymentState(r) !== 'rejected')
  const people = rs.reduce((n, r) => n + participantsOf(r).length, 0)
  const memberRegs = rs.filter((r) => isMemberReg(r, members)).length
  const outside = rs.filter((r) => known(r.college) && !isTkmCollege(r.college)).length
  const sumDue = (list) => list.reduce((n, r) => n + (Number(r.amountDue) || 0), 0)
  const collected = sumDue(rs.filter((r) => paymentState(r) === 'verified'))
  const underReview = sumDue(rs.filter((r) => paymentState(r) === 'review'))
  const capacity = Number(event.maxRegistrations) || 0
  const fillRate = capacity > 0 ? Math.min(1, live.length / capacity) : null
  const completion = registrations ? ticketed / registrations : 0
  // Reach: how full it got, or — with no cap — how it did against the average
  // event (capped at 100%).
  const reach = fillRate != null ? fillRate : avgRegs > 0 ? Math.min(1, registrations / avgRegs) : (registrations ? 1 : 0)
  const successScore = registrations ? Math.round(100 * (0.5 * reach + 0.5 * completion)) : 0
  return {
    event,
    id: event.id,
    name: event.name || 'Event',
    stage: eventStage(event, now),
    start: event.date ? startMs(event) : 0,
    registrations,
    people,
    ticketed,
    states,
    capacity,
    fillRate,
    completion,
    reach,
    successScore,
    memberRegs,
    nonMemberRegs: registrations - memberRegs,
    outside,
    inside: registrations - outside,
    collected,
    underReview,
    fee: Number(event.fee) || 0,
    departments: tally(rs, (r) => known(r.department)),
    years: tally(rs, (r) => known(r.year)),
    regs: rs,
  }
}

export function allEventStats(events, regs, opts = {}) {
  const counts = events.map((e) => regs.filter((r) => r.eventId === e.id).length).filter((n) => n > 0)
  const avgRegs = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0
  return events.map((e) => eventStats(e, regs, { ...opts, avgRegs }))
}

// Registrations bucketed by week or month: [{ t, label, value }] oldest first,
// with empty buckets filled so the line doesn't skip time.
export function timeline(regs, { bucket = 'month', from, to = Date.now(), cumulative = false } = {}) {
  const stamps = regs.map(registeredAt).filter(Boolean)
  if (!stamps.length) return []
  const start = new Date(from ?? Math.min(...stamps))
  const floor = (d) => {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    if (bucket === 'month') x.setDate(1)
    else if (bucket === 'week') x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
    return x
  }
  const step = (d) => {
    const x = new Date(d)
    if (bucket === 'month') x.setMonth(x.getMonth() + 1)
    else x.setDate(x.getDate() + (bucket === 'week' ? 7 : 1))
    return x
  }
  const buckets = []
  for (let d = floor(start); d.getTime() <= to; d = step(d)) buckets.push({ t: d.getTime(), value: 0 })
  if (!buckets.length) return []
  stamps.forEach((s) => {
    if (s < buckets[0].t || s > to) return
    let i = buckets.length - 1
    while (i > 0 && buckets[i].t > s) i--
    buckets[i].value++
  })
  let run = 0
  return buckets.map((b) => {
    run += b.value
    const d = new Date(b.t)
    const label = bucket === 'month'
      ? d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
      : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return { t: b.t, label, value: cumulative ? run : b.value }
  })
}

// One row per person who has an account or has registered: how many events
// they signed up for, how many they took part in (ticket + event over), and
// whether they're a member. People without an account (team members typed in
// by a leader) are keyed by email.
export function peopleStats({ regs = [], users = [], memberships = [], events = [], now = Date.now() }) {
  const members = memberIndex({ users, memberships })
  const byEvent = new Map(events.map((e) => [e.id, e]))
  const memberIds = new Map(memberships.filter((m) => m.membershipId).map((m) => [m.userId || m.id, m.membershipId]))
  const people = new Map()
  const touch = (p) => {
    const key = personKey(p)
    if (!key) return null
    if (!people.has(key)) {
      people.set(key, {
        key, uid: p.uid || '', name: p.name || '', email: p.email || '', college: p.college || '',
        department: p.department || '', year: p.year || '', phone: p.phone || '',
        registered: 0, participated: 0, upcoming: 0, events: [], lastEvent: 0, hasAccount: !!p.uid,
      })
    }
    const row = people.get(key)
    for (const f of ['name', 'email', 'college', 'department', 'year', 'phone']) if (!row[f] && p[f]) row[f] = p[f]
    return row
  }
  users.forEach((u) => touch({ uid: u.id, name: u.name || u.googleName, email: String(u.email || '').toLowerCase(), college: u.college, department: u.department, year: u.year, phone: u.phone }))
  regs.forEach((r) => {
    const ev = byEvent.get(r.eventId)
    const ended = ev ? isEnded(ev, now) : true
    const at = ev?.date ? startMs(ev) : registeredAt(r)
    participantsOf(r).forEach((p) => {
      const row = touch(p)
      if (!row) return
      row.registered++
      row.events.push(r.eventName || ev?.name || 'Event')
      if (hasTicket(r)) ended ? row.participated++ : row.upcoming++
      row.lastEvent = Math.max(row.lastEvent, at)
    })
  })
  return [...people.values()].map((p) => ({
    ...p,
    isMember: !!p.uid && members.has(p.uid),
    membershipId: memberIds.get(p.uid) || '',
    outside: !!p.college && !isTkmCollege(p.college),
  }))
}

// Headline totals for the overview tiles.
export function totals(stats, people, memberships = []) {
  const sum = (k) => stats.reduce((n, s) => n + s[k], 0)
  const regs = sum('registrations')
  const withRegs = stats.filter((s) => s.registrations > 0)
  const membershipFees = memberships
    .filter((m) => !m.legacy && paymentState(m) === 'verified')
    .reduce((n, m) => n + (Number(m.amountDue) || 0), 0)
  return {
    registrations: regs,
    uniquePeople: people.filter((p) => p.registered > 0).length,
    accounts: people.filter((p) => p.hasAccount).length,
    participants: people.filter((p) => p.participated > 0).length,
    participatedNonMembers: people.filter((p) => p.participated > 0 && !p.isMember).length,
    members: people.filter((p) => p.isMember).length,
    memberRegs: sum('memberRegs'),
    outside: sum('outside'),
    collected: sum('collected'),
    membershipFees,
    underReview: sum('underReview'),
    live: stats.filter((s) => s.stage === 'live').length,
    upcoming: stats.filter((s) => s.stage === 'upcoming').length,
    ended: stats.filter((s) => s.stage === 'ended').length,
    avgSuccess: withRegs.length ? Math.round(withRegs.reduce((n, s) => n + s.successScore, 0) / withRegs.length) : 0,
    states: stats.reduce((acc, s) => {
      Object.entries(s.states).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v })
      return acc
    }, {}),
  }
}

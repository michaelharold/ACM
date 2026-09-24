import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eventStats, allEventStats, peopleStats, totals, timeline, memberIndex, participantsOf } from '../../src/lib/analytics.js'

const TKM = 'TKM College Of Engineering, Kollam'
const now = new Date(2030, 5, 15, 12).getTime()
const past = { id: 'past', name: 'Past', date: '2030-05-01', time: '10:00 AM', maxRegistrations: 4, fee: 100 }
const soon = { id: 'soon', name: 'Soon', date: '2030-07-01', time: '10:00 AM', fee: 0 }
const regs = [
  { id: 'r1', eventId: 'past', userId: 'u1', userName: 'Asha', userEmail: 'a@x.in', college: TKM, department: 'CSE', paymentStatus: 'paid', amountDue: 100, createdAt: '2030-04-01T10:00:00Z' },
  { id: 'r2', eventId: 'past', userId: 'u2', userName: 'Ravi', userEmail: 'r@x.in', college: 'Other College', department: 'ECE', paymentStatus: 'pending', receiptId: 'rc', amountDue: 100, createdAt: '2030-04-10T10:00:00Z' },
  { id: 'r3', eventId: 'past', userId: 'u3', userName: 'Cara', college: TKM, paymentStatus: 'rejected', amountDue: 100, createdAt: '2030-04-12T10:00:00Z' },
  { id: 'r4', eventId: 'soon', userId: 'u2', userName: 'Ravi', userEmail: 'r@x.in', college: 'Other College', paymentStatus: 'free', amountDue: 0, createdAt: '2030-06-01T10:00:00Z',
    isTeam: true, teamSize: 2, members: [{ uid: 'u2', name: 'Ravi', email: 'r@x.in' }, { uid: null, name: 'Guest', email: 'G@x.in' }] },
]
const users = [{ id: 'u1', name: 'Asha', acmMember: true }, { id: 'u2', name: 'Ravi' }, { id: 'u3', name: 'Cara' }, { id: 'u4', name: 'Dev' }]

test('per-event figures: states, money, members, outside, fill and success', () => {
  const s = eventStats(past, regs, { now, members: memberIndex({ users }) })
  assert.equal(s.registrations, 3)
  assert.equal(s.stage, 'ended')
  assert.deepEqual(s.states, { verified: 1, free: 0, review: 1, awaiting: 0, rejected: 1 })
  assert.equal(s.collected, 100)
  assert.equal(s.underReview, 100)
  assert.equal(s.memberRegs, 1)
  assert.equal(s.outside, 1)
  assert.equal(s.fillRate, 0.5) // 2 non-rejected of 4
  assert.equal(s.successScore, Math.round(100 * (0.5 * 0.5 + 0.5 * (1 / 3))))
})

test('uncapped events are judged against the average event', () => {
  const [a, b] = allEventStats([past, soon], regs, { now })
  assert.equal(b.fillRate, null)
  assert.equal(b.reach, 0.5) // 1 registration vs an average of 2
  assert.equal(a.registrations, 3)
})

test('people: team members count, participation needs a ticket and a finished event', () => {
  const people = peopleStats({ regs, users, events: [past, soon], now })
  const by = Object.fromEntries(people.map((p) => [p.name, p]))
  assert.equal(by.Asha.participated, 1)
  assert.equal(by.Asha.isMember, true)
  assert.equal(by.Ravi.registered, 2)
  assert.equal(by.Ravi.participated, 0) // past one never verified
  assert.equal(by.Ravi.upcoming, 1)
  assert.equal(by.Guest.hasAccount, false)
  assert.equal(by.Dev.registered, 0)
  const t = totals(allEventStats([past, soon], regs, { now }), people)
  assert.equal(t.registrations, 4)
  assert.equal(t.uniquePeople, 4) // Asha, Ravi, Cara, Guest
  assert.equal(t.participants, 1)
  assert.equal(t.participatedNonMembers, 0)
  assert.equal(participantsOf(regs[3]).length, 2)
})

test('timeline fills empty months and can run cumulative', () => {
  const t = timeline(regs, { bucket: 'month', to: now })
  assert.deepEqual(t.map((b) => b.value), [3, 0, 1])
  assert.deepEqual(timeline(regs, { bucket: 'month', to: now, cumulative: true }).map((b) => b.value), [3, 3, 4])
})

test('the admin roster\'s "—" placeholder is unknown, not an outside college', () => {
  const s = eventStats(soon, [{ id: 'x', eventId: 'soon', userId: 'u9', college: '—', department: '—', paymentStatus: 'free' }], { now })
  assert.equal(s.outside, 0)
  assert.deepEqual(s.departments, [{ label: 'Not set', value: 1 }])
})

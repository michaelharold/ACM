import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effectiveStatus, isEnded, isLiveNow, registrationStatus } from '../../src/lib/eventClock.js'

const pad = (n) => String(n).padStart(2, '0')
const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const dateOnly = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const H = 3600e3

// An event starting at 10:00 local on the given day.
const eventOn = (start, extra = {}) => ({ date: dateOnly(start), time: '10:00 AM', ...extra })

test('window drives status: coming-soon → open → closed', () => {
  const start = new Date(2030, 0, 10, 10, 0)
  const ev = eventOn(start, { regOpens: local(new Date(2030, 0, 1, 9, 0)), regCloses: local(new Date(2030, 0, 9, 18, 0)) })
  assert.equal(registrationStatus(ev, new Date(2029, 11, 31).getTime()), 'coming-soon')
  assert.equal(registrationStatus(ev, new Date(2030, 0, 5).getTime()), 'open')
  assert.equal(registrationStatus(ev, new Date(2030, 0, 9, 19, 0).getTime()), 'closed')
})

test('a full event reads closed', () => {
  const ev = eventOn(new Date(2030, 0, 10), { status: 'open', maxRegistrations: 2, registeredCount: 2 })
  assert.equal(effectiveStatus(ev, new Date(2030, 0, 1).getTime()), 'closed')
})

test('an event that has ended is closed even if its window (or manual status) says open', () => {
  const start = new Date(2030, 0, 10, 10, 0)
  const longWindow = eventOn(start, { regOpens: local(new Date(2030, 0, 1)), regCloses: local(new Date(2030, 1, 1)) })
  const manual = eventOn(start, { status: 'open' })
  const after = start.getTime() + 13 * H
  assert.equal(isEnded(longWindow, after), true)
  assert.equal(effectiveStatus(longWindow, after), 'closed')
  assert.equal(effectiveStatus(manual, after), 'closed')
  // …but still open while it's merely upcoming
  assert.equal(effectiveStatus(manual, start.getTime() - H), 'open')
})

test('live window: live from start for 12h', () => {
  const start = new Date(2030, 0, 10, 10, 0)
  const ev = eventOn(start)
  assert.equal(isLiveNow(ev, start.getTime() - 1), false)
  assert.equal(isLiveNow(ev, start.getTime() + H), true)
  assert.equal(isLiveNow(ev, start.getTime() + 13 * H), false)
})

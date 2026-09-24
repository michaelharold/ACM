import { test } from 'node:test'
import assert from 'node:assert/strict'
import { whatsappLinkFor, isQrHidden, isHistory, splitByEventEnd } from '../../src/lib/eventAccess.js'

const pad = (n) => String(n).padStart(2, '0')
const dateOnly = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const H = 3600e3

test('the WhatsApp link disappears entirely when hidden', () => {
  assert.equal(whatsappLinkFor({ whatsappLink: 'chat.whatsapp.com/abc' }), 'https://chat.whatsapp.com/abc')
  assert.equal(whatsappLinkFor({ whatsappLink: 'https://chat.whatsapp.com/abc', whatsappHidden: true }), '')
  assert.equal(whatsappLinkFor({ whatsappLink: '' }), '')
  assert.equal(whatsappLinkFor(null), '')
})

test('QR visibility flag', () => {
  assert.equal(isQrHidden({ qrHidden: true }), true)
  assert.equal(isQrHidden({}), false)
})

test('a registration moves to history once its event has ended', () => {
  const start = new Date(2030, 0, 10, 10, 0)
  const ev = { date: dateOnly(start), time: '10:00 AM' }
  assert.equal(isHistory(ev, start.getTime() - H), false) // upcoming
  assert.equal(isHistory(ev, start.getTime() + 2 * H), false) // live
  assert.equal(isHistory(ev, start.getTime() + 13 * H), true) // over
  assert.equal(isHistory({ missing: true }, start.getTime()), true) // event deleted
})

test('splitByEventEnd sorts upcoming soonest-first and history newest-first', () => {
  const now = new Date(2030, 5, 1).getTime()
  const item = (date) => ({ reg: { id: date }, event: { date, time: '10:00 AM' } })
  const { active, history } = splitByEventEnd([item('2030-07-02'), item('2030-01-01'), item('2030-06-20'), item('2030-03-01')], now)
  assert.deepEqual(active.map((i) => i.reg.id), ['2030-06-20', '2030-07-02'])
  assert.deepEqual(history.map((i) => i.reg.id), ['2030-03-01', '2030-01-01'])
})

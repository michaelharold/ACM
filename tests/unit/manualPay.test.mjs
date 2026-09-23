import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeUtr, isValidUtr, isValidUpiId, upiLink, ticketCode, paymentState,
  hasTicket, needsReceipt, holdsSeat, resolveUpiAccount, receiptReady,
} from '../../src/lib/manualPay.js'

test('UTR: 12 digits, spaces ignored', () => {
  assert.equal(normalizeUtr(' 4123 4567 8901 '), '412345678901')
  assert.equal(isValidUtr('412345678901'), true)
  assert.equal(isValidUtr('4123 4567 8901'), true)
  assert.equal(isValidUtr('41234567890'), false)
  assert.equal(isValidUtr('4123456789012'), false)
  assert.equal(isValidUtr('41234567890a'), false)
  assert.equal(isValidUtr(undefined), false)
})

test('UPI id shape', () => {
  assert.equal(isValidUpiId('acmtkmce@okicici'), true)
  assert.equal(isValidUpiId('first.last-1@ybl'), true)
  assert.equal(isValidUpiId('no-at-sign'), false)
  assert.equal(isValidUpiId('a@'), false)
  assert.equal(isValidUpiId(''), false)
})

test('upiLink keeps @ raw, encodes the rest, fixes 2dp amount', () => {
  const link = upiLink({ upiId: 'acm@okicici', payeeName: 'ACM TKMCE', amount: 250, note: 'HackTKM & more' })
  assert.equal(link, 'upi://pay?pa=acm@okicici&pn=ACM%20TKMCE&am=250.00&cu=INR&tn=HackTKM%20%26%20more')
  assert.equal(upiLink({ upiId: 'a@b', amount: '99.5' }), 'upi://pay?pa=a@b&pn=&am=99.50&cu=INR')
})

test('ticketCode is short, stable, uppercase', () => {
  assert.equal(ticketCode('aB3dE9xyz'), 'ACM-AB3DE9')
  assert.equal(ticketCode('a-b_c'), 'ACM-ABC')
})

test('paymentState maps every status', () => {
  assert.equal(paymentState({ paymentStatus: 'free' }), 'free')
  assert.equal(paymentState({}), 'free')
  assert.equal(paymentState({ paymentStatus: 'N/A' }), 'free')
  assert.equal(paymentState({ paymentStatus: 'paid' }), 'verified')
  assert.equal(paymentState({ paymentStatus: 'pending', receiptId: 'rc1' }), 'review')
  assert.equal(paymentState({ paymentStatus: 'pending' }), 'awaiting')
  assert.equal(paymentState({ paymentStatus: 'rejected' }), 'rejected')
  assert.equal(hasTicket({ paymentStatus: 'paid' }), true)
  assert.equal(hasTicket({ paymentStatus: 'free' }), true)
  assert.equal(hasTicket({ paymentStatus: 'pending', receiptId: 'x' }), false)
  assert.equal(needsReceipt({ paymentStatus: 'rejected' }), true)
  assert.equal(needsReceipt({ paymentStatus: 'pending' }), true)
  assert.equal(needsReceipt({ paymentStatus: 'pending', receiptId: 'x' }), false)
})

test('holdsSeat: explicit flag wins, legacy falls back to counted', () => {
  assert.equal(holdsSeat({ seatHeld: false, counted: true }), false)
  assert.equal(holdsSeat({ seatHeld: true, counted: false }), true)
  assert.equal(holdsSeat({ counted: true }), true)
  assert.equal(holdsSeat({}), false)
})

test('resolveUpiAccount: explicit active → default → null', () => {
  const accts = [
    { id: 'a', active: true },
    { id: 'b', active: false },
    { id: 'c' },
  ]
  assert.equal(resolveUpiAccount(accts, 'a', 'c').id, 'a')
  assert.equal(resolveUpiAccount(accts, 'b', 'c').id, 'c') // inactive → default
  assert.equal(resolveUpiAccount(accts, 'gone', 'c').id, 'c') // deleted → default
  assert.equal(resolveUpiAccount(accts, '', 'c').id, 'c')
  assert.equal(resolveUpiAccount(accts, '', ''), null)
  assert.equal(resolveUpiAccount([], 'a', 'c'), null)
})

test('receiptReady needs image + valid UTR', () => {
  assert.equal(receiptReady({ image: 'data:x', utr: '412345678901' }), true)
  assert.equal(receiptReady({ image: '', utr: '412345678901' }), false)
  assert.equal(receiptReady({ image: 'data:x', utr: '123' }), false)
})

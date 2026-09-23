// End-to-end check of the manual payment flow against the local emulators.
//   npm run test:e2e   (starts auth+firestore emulators, then runs this)
// It boots `npm run dev:emu`, seeds data with rules disabled, and drives the
// real UI in Chromium as a payer and as an admin (separate browser contexts,
// so the two sign-ins don't share a session).
import { spawn } from 'node:child_process'
import { readFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc } from 'firebase/firestore'

const BASE = 'http://localhost:5174'
const PROJECT = 'demo-acm-e2e'
const AUTH = 'http://127.0.0.1:9099'
const SHOTS = process.env.E2E_SHOTS // optional dir for screenshots
// 1×1 white PNG — stands in for a payment screenshot / QR code.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64')

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const visible = (locator, timeout = 8000) => locator.first().waitFor({ state: 'visible', timeout }).then(() => true, () => false)

async function signUp(email) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'secret123', returnSecureToken: true }),
  })
  const data = await r.json()
  if (!data.localId) throw new Error(`signUp failed: ${JSON.stringify(data)}`)
  return data.localId
}

async function waitFor(url, ms = 60000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`timeout waiting for ${url}`)
}

async function signedInPage(browser, email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log(`  [pageerror:${email}] ${e.message}`))
  await page.goto(`${BASE}/`)
  await page.waitForFunction(() => typeof window.__acmSignIn === 'function', null, { timeout: 30000 })
  await page.evaluate(({ email }) => window.__acmSignIn(email, 'secret123'), { email })
  return page
}

const shot = async (page, name) => {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
}

const vite = spawn('npm', ['run', 'dev:emu'], { stdio: 'ignore', detached: true })
let env
let browser
try {
  await waitFor(BASE)

  env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
  const adminUid = await signUp('admin@e2e.test')
  const payerUid = await signUp('payer@e2e.test')
  const profile = (name, extra = {}) => ({
    name, googleName: name, email: '', avatar: '', phone: '9876543210', phoneVerified: true,
    department: 'Computer Science & Engineering', year: '3rd Year', college: 'TKM College Of Engineering, Kollam',
    gender: 'Female', acmMember: false, role: 'user', permissions: {}, ...extra,
  })
  const pad = (n) => String(n).padStart(2, '0')
  const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, `users/${adminUid}`), profile('Admin One', { email: 'admin@e2e.test', role: 'admin' }))
    await setDoc(doc(db, `users/${payerUid}`), profile('Payer Two', { email: 'payer@e2e.test' }))
    await setDoc(doc(db, 'upiAccounts/main'), {
      label: 'ACM Main', payeeName: 'ACM TKMCE', upiId: 'acm@okicici',
      qrImage: `data:image/png;base64,${PNG.toString('base64')}`, active: true,
    })
    await setDoc(doc(db, 'siteContent/main'), { defaultUpiAccountId: 'main', membershipFee: 100 })
    await setDoc(doc(db, 'events/ev1'), {
      name: 'E2E Hack', date: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10), time: '10:00 AM',
      venue: 'Main Hall', shortDescription: 'Test event', description: 'Test event', status: 'open',
      fee: 200, acmDiscount: 0, maxRegistrations: 5, registeredCount: 0,
      regOpens: local(new Date(Date.now() - 864e5)), regCloses: local(new Date(Date.now() + 7 * 864e5)),
      whatsappLink: 'https://chat.whatsapp.com/test', poster: '',
    })
  })
  // withSecurityRulesDisabled resolves to void, so read into a local.
  const readDoc = async (path) => {
    let data
    await env.withSecurityRulesDisabled(async (ctx) => { data = (await getDoc(doc(ctx.firestore(), path))).data() })
    return data
  }
  const seatCount = async () => (await readDoc('events/ev1'))?.registeredCount

  browser = await chromium.launch()
  const payer = await signedInPage(browser, 'payer@e2e.test')
  const admin = await signedInPage(browser, 'admin@e2e.test')

  // ── Payer registers with a receipt ─────────────────────────
  await payer.goto(`${BASE}/events/ev1`)
  await payer.getByRole('button', { name: 'Register Now' }).click()
  await payer.getByRole('button', { name: /continue/i }).click() // details
  await payer.getByRole('button', { name: /continue/i }).click() // eligibility
  check('payment step shows the QR account', await visible(payer.getByText('acm@okicici')))
  await payer.locator('input[type=file]').last().setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PNG })
  await payer.getByLabel(/UPI transaction ID/i).fill('4123 4567 8901')
  await shot(payer, '1-payment-step')
  await payer.getByRole('button', { name: /continue/i }).click()
  await payer.getByLabel(/agree/i).check()
  await payer.getByRole('button', { name: /submit registration & receipt/i }).click()
  check('success screen says receipt submitted', await visible(payer.getByText('Receipt submitted')))
  check('WhatsApp link hidden before verification', !(await payer.getByText('Join the event WhatsApp group').isVisible()))
  await payer.waitForTimeout(800)
  check('seat taken on submit', (await seatCount()) === 1, `count=${await seatCount()}`)

  await payer.goto(`${BASE}/dashboard`)
  check('dashboard shows Under review', await visible(payer.getByText('Under review')))
  check('no ticket yet', !(await payer.getByText('My tickets').isVisible()))

  // ── Admin rejects ───────────────────────────────────────────
  await admin.goto(`${BASE}/admin`)
  await admin.getByRole('button', { name: 'Verify payments', exact: true }).click()
  await admin.getByText('Payer Two').first().click()
  check('receipt image loads for admin', await visible(admin.getByAltText('Payment receipt')))
  await shot(admin, '2-review-modal')
  await admin.getByRole('button', { name: /reject…/i }).click()
  await admin.getByPlaceholder(/why\?/i).fill('Screenshot unreadable')
  await admin.getByRole('button', { name: 'Reject', exact: true }).click()
  await admin.waitForTimeout(1500)
  check('seat released on reject', (await seatCount()) === 0, `count=${await seatCount()}`)

  // ── Payer re-uploads ────────────────────────────────────────
  await payer.reload()
  check('dashboard shows rejection reason', await visible(payer.getByText(/Screenshot unreadable/)))
  await payer.getByRole('button', { name: 'Upload', exact: true }).click()
  await payer.locator('input[type=file]').last().setInputFiles({ name: 'receipt2.png', mimeType: 'image/png', buffer: PNG })
  await payer.getByLabel(/UPI transaction ID/i).fill('412345678901')
  await payer.getByRole('button', { name: /submit receipt/i }).click()
  await payer.waitForTimeout(1500)
  check('seat re-taken on resubmit', (await seatCount()) === 1, `count=${await seatCount()}`)

  // ── Admin approves ──────────────────────────────────────────
  await admin.reload()
  await admin.getByRole('button', { name: 'Verify payments', exact: true }).click()
  await admin.getByText('Payer Two').first().click()
  await admin.getByRole('button', { name: /approve payment/i }).click()
  await admin.waitForTimeout(1500)

  await payer.reload()
  check('ticket carousel appears', await visible(payer.getByText('My tickets')))
  check('ticket shows verified holder', await visible(payer.getByText('Paid · Verified')))
  check('WhatsApp link revealed', await visible(payer.getByText('Event WhatsApp group')))
  await shot(payer, '3-ticket-light')
  await payer.emulateMedia({ colorScheme: 'dark' })
  await shot(payer, '3-ticket-dark')
  await payer.emulateMedia({ colorScheme: 'light' })
  if (SHOTS) {
    await payer.setViewportSize({ width: 390, height: 844 })
    await payer.reload()
    await visible(payer.getByText('My tickets'))
    await payer.getByText('My tickets').scrollIntoViewIfNeeded()
    await shot(payer, '4-ticket-mobile')
    await payer.setViewportSize({ width: 1280, height: 900 })
  }

  // ── Membership ──────────────────────────────────────────────
  await payer.goto(`${BASE}/membership`)
  await payer.getByLabel('First name').fill('Payer')
  await payer.getByLabel('Last name').fill('Two')
  await payer.locator('input[type=file]').last().setInputFiles({ name: 'm.png', mimeType: 'image/png', buffer: PNG })
  await payer.getByLabel(/UPI transaction ID/i).fill('412345678901')
  await payer.getByRole('button', { name: /submit application & receipt/i }).click()
  check('reused UTR refused with a clear message', await visible(payer.getByText(/already submitted this transaction ID/i)))
  await payer.getByLabel(/UPI transaction ID/i).fill('998877665544')
  await payer.getByRole('button', { name: /submit application & receipt/i }).click()
  check('membership under review', await visible(payer.getByText(/Receipt submitted — under review/)))

  await admin.reload()
  await admin.getByRole('button', { name: 'Verify payments', exact: true }).click()
  await admin.getByText('Payer Two').first().click()
  await admin.getByRole('button', { name: /approve payment/i }).click()
  await admin.waitForTimeout(1500)
  const acm = (await readDoc(`users/${payerUid}`))?.acmMember
  check('membership approval sets acmMember', acm === true)

  await payer.reload()
  check('membership page shows ACM Member', await visible(payer.getByText('ACM Member')))
} catch (err) {
  check('script ran to completion', false, err?.message || String(err))
} finally {
  await browser?.close().catch(() => {})
  await env?.cleanup().catch(() => {})
  try { process.kill(-vite.pid) } catch { /* already gone */ }
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)

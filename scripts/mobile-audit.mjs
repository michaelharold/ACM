// Mobile layout + admin write sweep against the local emulators.
//   npm run audit:mobile   (starts auth+firestore emulators, then runs this)
// Loads every page at phone width with realistic seeded data, flags anything
// that spills past the screen edge, saves screenshots (AUDIT_SHOTS=<dir>), and
// checks that admin event create/edit actually persist to Firestore.
import { spawn } from 'node:child_process'
import { readFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore'

const BASE = 'http://localhost:5174'
const PROJECT = 'demo-acm-e2e'
const AUTH = 'http://127.0.0.1:9099'
const SHOTS = process.env.AUDIT_SHOTS
const WIDTH = Number(process.env.AUDIT_WIDTH) || 390
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function signUp(email) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'secret123', returnSecureToken: true }),
  })
  return (await r.json()).localId
}

async function waitFor(url, ms = 60000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`timeout waiting for ${url}`)
}

// Anything wider than the viewport that isn't inside an intentionally
// scrollable/clipping container (tables, carousels, decorative blobs).
function measureOverflow() {
  const vw = document.documentElement.clientWidth
  const clippedByAncestor = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true
    }
    return false
  }
  const offenders = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    if (r.right <= vw + 1 && r.left >= -1) continue
    if (getComputedStyle(el).position === 'fixed' && getComputedStyle(el).visibility === 'hidden') continue
    if (clippedByAncestor(el)) continue
    const cls = typeof el.className === 'string' ? el.className.slice(0, 70) : ''
    offenders.push(`${el.tagName.toLowerCase()}.${cls} [${Math.round(r.left)}→${Math.round(r.right)}] "${(el.textContent || '').trim().slice(0, 40)}"`)
  }
  const docOverflow = document.documentElement.scrollWidth - vw
  // When the page itself is too wide, name the deepest elements that are wider
  // than the screen — those are what's forcing the width.
  if (docOverflow > 1) {
    const wide = [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().width > vw + 1)
    const deepest = wide.filter((el) => !wide.some((o) => o !== el && el.contains(o)))
    for (const el of deepest.slice(0, 4)) {
      const cls = typeof el.className === 'string' ? el.className.slice(0, 90) : ''
      offenders.unshift(`WIDE ${el.tagName.toLowerCase()}.${cls} w=${Math.round(el.getBoundingClientRect().width)} "${(el.textContent || '').trim().slice(0, 50)}"`)
    }
  }
  return { docOverflow, offenders: offenders.slice(0, 8) }
}

async function audit(page, name) {
  await page.waitForTimeout(700)
  // The intro loader's exit swells its wordmark past the viewport on purpose;
  // measure the page itself, once the loader has gone.
  await page.locator('#acm-loader').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
  const m = await page.evaluate(measureOverflow)
  const ok = m.docOverflow <= 1 && m.offenders.length === 0
  check(`${name} fits ${WIDTH}px`, ok, ok ? '' : `docOverflow=${m.docOverflow}; ${m.offenders.join(' | ')}`)
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true })
    await page.screenshot({ path: `${SHOTS}/${name.replace(/[^a-z0-9]+/gi, '-')}.png`, fullPage: true })
  }
}

async function newPage(browser, email) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`))
  await page.goto(`${BASE}/`)
  if (email) {
    await page.waitForFunction(() => typeof window.__acmSignIn === 'function', null, { timeout: 30000 })
    await page.evaluate(({ email }) => window.__acmSignIn(email, 'secret123'), { email })
  }
  return page
}

const vite = spawn('npm', ['run', 'dev:emu'], { stdio: 'ignore', detached: true })
let env
let browser
try {
  await waitFor(BASE)
  env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
  const adminUid = await signUp('admin@audit.test')
  const payerUid = await signUp('payer@audit.test')
  const pad = (n) => String(n).padStart(2, '0')
  const local = (ms) => { const d = new Date(Date.now() + ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
  const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
  const D = 864e5
  const profile = (name, extra = {}) => ({
    name, googleName: name, email: '', avatar: '', phone: '9876543210', phoneVerified: true,
    department: 'Computer Science & Engineering', year: '3rd Year', college: 'TKM College Of Engineering, Kollam',
    gender: 'Female', acmMember: false, role: 'user', permissions: {}, ...extra,
  })
  const ev = (name, extra) => ({
    name, date: day(10), time: '10:00 AM', venue: 'Seminar Hall, Main Block', shortDescription: 'A hands-on session with mentors from industry.',
    description: 'Full description of the event with objectives, highlights and everything a participant needs to know.',
    status: 'open', fee: 0, acmDiscount: 0, maxRegistrations: 0, registeredCount: 0, poster: '',
    regOpens: local(-D), regCloses: local(7 * D), whatsappLink: 'https://chat.whatsapp.com/test', speakers: [], ...extra,
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, `users/${adminUid}`), profile('Admin One', { email: 'admin@audit.test', role: 'admin' }))
    await setDoc(doc(db, `users/${payerUid}`), profile('Aswathy Krishnan Nair', { email: 'payer@audit.test' }))
    await setDoc(doc(db, 'upiAccounts/main'), { label: 'ACM Main', payeeName: 'ACM TKMCE Student Chapter', upiId: 'acmtkmce.treasurer@okicici', qrImage: PNG, active: true })
    await setDoc(doc(db, 'siteContent/main'), { defaultUpiAccountId: 'main', membershipFee: 100 })
    await setDoc(doc(db, 'events/ev-open'), ev('HackTKM 2026 — 24-hour Build Sprint for Absolute Beginners', { fee: 200, maxRegistrations: 50, registeredCount: 1 }))
    await setDoc(doc(db, 'events/ev-open2'), ev('Intro to Systems Design', { fee: 100, acmDiscount: 30, maxRegistrations: 40 }))
    await setDoc(doc(db, 'events/ev-team'), ev('Open Source Sprint', { isGroup: true, minTeamSize: 2, maxTeamSize: 4, maxRegistrations: 10 }))
    await setDoc(doc(db, 'events/ev-soon'), ev('Design Jam', { regOpens: local(3 * D), regCloses: local(9 * D), status: 'coming-soon' }))
    await setDoc(doc(db, 'events/ev-full'), ev('Resume Clinic', { maxRegistrations: 2, registeredCount: 2 }))
    await setDoc(doc(db, 'events/ev-past'), ev('Web Dev Bootcamp', { date: day(-20), regOpens: local(-40 * D), regCloses: local(-21 * D) }))
    await setDoc(doc(db, 'registrations/r1'), {
      userId: payerUid, userName: 'Aswathy Krishnan Nair', userEmail: 'payer@audit.test', eventId: 'ev-open', eventName: 'HackTKM 2026 — 24-hour Build Sprint for Absolute Beginners',
      department: 'Computer Science & Engineering', year: '3rd Year', college: 'TKM College Of Engineering, Kollam', status: 'Confirmed',
      paymentStatus: 'paid', amountDue: 200, utr: '412345678901', receiptId: 'rc1', counted: true, seatHeld: true, date: day(-1),
    })
    await setDoc(doc(db, 'receipts/rc1'), { kind: 'event', refId: 'r1', userId: payerUid, image: PNG, utr: '412345678901', amount: 200, bytes: PNG.length })
    await setDoc(doc(db, 'registrations/r2'), {
      userId: payerUid, userName: 'Aswathy Krishnan Nair', userEmail: 'payer@audit.test', eventId: 'ev-full', eventName: 'Resume Clinic',
      department: 'Computer Science & Engineering', status: 'Confirmed', paymentStatus: 'rejected', amountDue: 150,
      rejectReason: 'The amount on the screenshot doesn’t match the fee — please upload the right receipt.', counted: true, seatHeld: false, date: day(-1),
    })
    await setDoc(doc(db, 'memberships/' + payerUid), {
      userId: payerUid, firstName: 'Aswathy', lastName: 'Nair', email: 'payer@audit.test', phone: '9876543210', department: 'Computer Science & Engineering',
      className: 'R5B', paymentStatus: 'pending', receiptId: 'rc2', utr: '998877665544', amountDue: 100, membershipId: '',
    })
    await setDoc(doc(db, 'receipts/rc2'), { kind: 'membership', refId: payerUid, userId: payerUid, image: PNG, utr: '998877665544', amount: 100, bytes: PNG.length })
  })
  const readEvents = async () => {
    let list = []
    await env.withSecurityRulesDisabled(async (ctx) => { list = (await getDocs(collection(ctx.firestore(), 'events'))).docs.map((d) => ({ id: d.id, ...d.data() })) })
    return list
  }
  const readDoc = async (path) => {
    let data
    await env.withSecurityRulesDisabled(async (ctx) => { data = (await getDoc(doc(ctx.firestore(), path))).data() })
    return data
  }

  browser = await chromium.launch()

  const only = process.env.AUDIT_ONLY // e.g. 'payer' to run just that section
  // ── Signed out ─────────────────────────────────────────────
  if (!only || only === 'guest') {
  const guest = await newPage(browser)
  for (const [path, name] of [['/', 'home'], ['/events', 'events'], ['/events/ev-open', 'event-details'], ['/execom', 'execom'], ['/contact', 'contact'], ['/auth', 'auth'], ['/nope', '404']]) {
    await guest.goto(`${BASE}${path}`)
    await audit(guest, `guest ${name}`)
  }
  await guest.goto(`${BASE}/`)
  await guest.getByRole('button', { name: 'Menu' }).click()
  await audit(guest, 'guest mobile menu')
  }

  // ── Payer ──────────────────────────────────────────────────
  if (!only || only === 'payer') {
  const payer = await newPage(browser, 'payer@audit.test')
  await payer.goto(`${BASE}/dashboard`)
  await payer.getByText('My tickets').first().waitFor({ timeout: 15000 }).catch(() => {})
  await audit(payer, 'payer dashboard')
  await payer.goto(`${BASE}/membership`)
  await audit(payer, 'payer membership')
  await payer.goto(`${BASE}/events/ev-open2`)
  await payer.getByRole('button', { name: 'Register Now' }).click()
  await audit(payer, 'drawer step1 details')
  await payer.getByRole('button', { name: /continue/i }).click()
  await payer.getByText("I'm an ACM member").click()
  await audit(payer, 'drawer step2 eligibility')
  await payer.getByText("I'm an ACM member").click()
  await payer.getByRole('button', { name: /continue/i }).click()
  await audit(payer, 'drawer step3 payment')
  await payer.goto(`${BASE}/events/ev-team`)
  await payer.getByRole('button', { name: 'Register Now' }).click()
  await payer.getByRole('button', { name: /continue/i }).click()
  await audit(payer, 'drawer team step')
  await payer.goto(`${BASE}/`)
  await payer.getByRole('button', { name: 'Menu' }).click()
  await audit(payer, 'payer mobile menu')
  }

  // ── Admin: every tab ───────────────────────────────────────
  if (!only || only === 'admin') {
  const admin = await newPage(browser, 'admin@audit.test')
  await admin.goto(`${BASE}/admin`)
  await admin.getByText('Control Center').waitFor({ timeout: 15000 })
  for (const tab of ['Overview', 'Events', 'Execom', 'Text Content', 'Gallery', 'Membership', 'Verify payments', 'Payments', 'Messages', 'Registrations', 'Access']) {
    await admin.getByRole('button', { name: tab, exact: true }).first().click()
    await audit(admin, `admin ${tab}`)
  }

  // ── Database writes from the admin UI ──────────────────────
  await admin.getByRole('button', { name: 'Events', exact: true }).first().click()
  const before = (await readEvents()).length
  await admin.getByRole('button', { name: /new event/i }).click()
  await admin.waitForTimeout(1500)
  const afterList = await readEvents()
  check('admin "New event" creates a Firestore doc', afterList.length === before + 1, `${before} → ${afterList.length}`)
  const created = afterList.find((e) => e.name === 'Untitled Event')
  await audit(admin, 'admin event editor open')
  if (created) {
    const nameInput = admin.locator('label', { hasText: 'Event name' }).locator('input')
    await nameInput.fill('Audit Renamed Event')
    await admin.getByRole('button', { name: /save details/i }).click()
    await admin.waitForTimeout(1500)
    const saved = await readDoc(`events/${created.id}`)
    check('admin "Save details" persists edits', saved?.name === 'Audit Renamed Event', `name=${saved?.name}`)
    check('a new event starts as a hidden draft', saved?.draft === true, `draft=${saved?.draft}`)

    // Visitors must not see (or register for) a draft…
    const visitor = await newPage(browser)
    await visitor.goto(`${BASE}/events`)
    await visitor.getByText('Intro to Systems Design').first().waitFor({ timeout: 15000 })
    check('draft event hidden from visitors', !(await visitor.getByText('Audit Renamed Event').first().isVisible().catch(() => false)))

    // …until it's published.
    await admin.getByRole('switch').first().click()
    await admin.getByRole('button', { name: /save details/i }).click()
    await admin.waitForTimeout(1500)
    const published = await readDoc(`events/${created.id}`)
    check('publish switch clears the draft flag', published?.draft === false, `draft=${published?.draft}`)
    await visitor.reload()
    check('published event visible to visitors', await visitor.getByText('Audit Renamed Event').first().waitFor({ timeout: 15000 }).then(() => true, () => false))
  }
  }
} catch (err) {
  check('audit ran to completion', false, err?.message || String(err))
} finally {
  await browser?.close().catch(() => {})
  await env?.cleanup().catch(() => {})
  try { process.kill(-vite.pid) } catch { /* already gone */ }
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)

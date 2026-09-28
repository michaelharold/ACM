// End-to-end check of "Already a member?" verification, the member roster,
// event WhatsApp/QR visibility and Events History, against the emulators.
//   npm run test:e2e:members
// Same harness as e2e-payments.mjs: boots `npm run dev:emu`, seeds with rules
// disabled, and drives the real UI as members and as an admin.
import { spawn } from 'node:child_process'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { buildDocx } from '../src/lib/docx.js'

const BASE = 'http://localhost:5174'
const PROJECT = 'demo-acm-e2e'
const AUTH = 'http://127.0.0.1:9099'
const SHOTS = process.env.E2E_SHOTS
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64')

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const visible = (locator, timeout = 8000) => locator.first().waitFor({ state: 'visible', timeout }).then(() => true, () => false)
const gone = (locator, timeout = 8000) => locator.first().waitFor({ state: 'hidden', timeout }).then(() => true, () => false)

async function signUp(email, { verified = false } = {}) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'secret123', returnSecureToken: true }),
  })
  const data = await r.json()
  if (!data.localId) throw new Error(`signUp failed: ${JSON.stringify(data)}`)
  if (verified) {
    // Stand-in for a Google account, whose email is always verified.
    const u = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ localId: data.localId, emailVerified: true }),
    })
    if (!u.ok) throw new Error(`verify email failed: ${await u.text()}`)
  }
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
  const asha = await signUp('asha@e2e.test', { verified: true }) // on the roster → instant
  const ravi = await signUp('ravi@e2e.test', { verified: true }) // not on the roster → manual
  const cara = await signUp('cara@e2e.test', { verified: true }) // pending, then roster upload → auto
  const profile = (name, extra = {}) => ({
    name, googleName: name, email: '', avatar: '', phone: '9876543210', phoneVerified: true,
    department: 'Computer Science & Engineering', year: '3rd Year', college: 'TKM College Of Engineering, Kollam',
    gender: 'Female', acmMember: false, role: 'user', permissions: {}, ...extra,
  })
  const day = 864e5
  const ymd = (ms) => new Date(ms).toISOString().slice(0, 10)
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, `users/${adminUid}`), profile('Admin One', { email: 'admin@e2e.test', role: 'admin' }))
    await setDoc(doc(db, `users/${asha}`), profile('Asha K', { email: 'asha@e2e.test' }))
    await setDoc(doc(db, `users/${ravi}`), profile('Ravi M', { email: 'ravi@e2e.test' }))
    await setDoc(doc(db, `users/${cara}`), profile('Cara J', { email: 'cara@e2e.test' }))
    await setDoc(doc(db, 'memberRoster/1111111'), { membershipId: '1111111', email: 'asha@e2e.test', name: 'Asha K' })
    await setDoc(doc(db, 'upiAccounts/main'), {
      label: 'ACM Main', payeeName: 'ACM TKMCE', upiId: 'acm@okicici',
      qrImage: `data:image/png;base64,${PNG.toString('base64')}`, active: true,
    })
    await setDoc(doc(db, 'siteContent/main'), { defaultUpiAccountId: 'main', membershipFee: 100 })
    const event = (over) => ({
      time: '10:00 AM', venue: 'Main Hall', shortDescription: 'Test', description: 'Test', status: 'open',
      fee: 0, acmDiscount: 0, maxRegistrations: 0, registeredCount: 0, poster: '', speakers: [], ...over,
    })
    await setDoc(doc(db, 'events/up'), event({ name: 'Upcoming Workshop', date: ymd(Date.now() + 10 * day), whatsappLink: 'https://chat.whatsapp.com/up' }))
    await setDoc(doc(db, 'events/past'), event({ name: 'Last Month Meetup', date: ymd(Date.now() - 30 * day), status: 'closed' }))
    await setDoc(doc(db, 'events/paid'), event({ name: 'Paid Hack', date: ymd(Date.now() + 12 * day), fee: 150, qrHidden: true }))
    const pad2 = (n) => String(n).padStart(2, '0')
    const localDT = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}` }
    await setDoc(doc(db, 'events/soon'), event({ name: 'Soon Summit', date: ymd(Date.now() + 20 * day), status: 'coming-soon', regOpens: localDT(Date.now() + 3 * day), regCloses: localDT(Date.now() + 15 * day) }))
    const reg = (id, eventId, eventName) => setDoc(doc(db, `registrations/${id}`), {
      userId: asha, userName: 'Asha K', userEmail: 'asha@e2e.test', eventId, eventName,
      paymentStatus: 'free', amountDue: 0, status: 'Confirmed', date: ymd(Date.now()),
    })
    await reg('regup', 'up', 'Upcoming Workshop')
    await reg('regpast', 'past', 'Last Month Meetup')
  })
  const readDoc = async (path) => {
    let data
    await env.withSecurityRulesDisabled(async (ctx) => { data = (await getDoc(doc(ctx.firestore(), path))).data() })
    return data
  }

  browser = await chromium.launch()
  const admin = await signedInPage(browser, 'admin@e2e.test')
  const a = await signedInPage(browser, 'asha@e2e.test')

  // ── Tickets: active vs Events History, WhatsApp on the ticket ─────
  await a.goto(`${BASE}/dashboard`)
  check('upcoming ticket in My tickets', await visible(a.getByText('My tickets')))
  check('ticket carries the WhatsApp prompt', await visible(a.getByText('Join WhatsApp group')))
  check('Events History lists the past event', await visible(a.getByRole('region', { name: 'Events History' }).getByText('Last Month Meetup')))
  const carousel = a.getByRole('region', { name: 'My tickets' })
  check('past event is not an active ticket', !(await carousel.getByText('Last Month Meetup').isVisible()))
  await a.getByRole('region', { name: 'Events History' }).getByText('Last Month Meetup').click()
  check('past ticket opens stamped "Event ended"', await visible(a.getByText('Event ended')))
  await shot(a, 'm1-history-ticket')
  await a.keyboard.press('Escape')

  // ── Rate the event you went to ──────────────────────────────────
  await a.getByText('Event ended').waitFor({ state: 'detached' }).catch(() => {})
  await a.getByRole('radio', { name: /^4 of 5/ }).click()
  let rated
  for (let i = 0; i < 30 && !rated; i++) { rated = await readDoc(`eventRatings/past_${asha}`); if (!rated) await a.waitForTimeout(200) }
  check('attendee rates a past event', rated?.rating === 4 && rated?.registrationId === 'regpast', JSON.stringify(rated))
  check('rating thanks the attendee', await visible(a.getByText('Thanks for rating!')))
  await shot(a, 'm1b-rating')

  // ── Remarks & suggestions ────────────────────────────────────────
  await a.getByRole('button', { name: 'Add remarks & suggestions' }).click()
  const sheet = a.getByRole('form', { name: 'Event feedback' })
  await sheet.waitFor()
  check('feedback sheet starts from the saved rating', (await sheet.getByRole('radio', { name: /^4 of 5/ }).getAttribute('aria-checked')) === 'true')
  await sheet.getByLabel('Remarks').fill('Loved the hands-on demos')
  await sheet.getByLabel('Suggestions').fill('Start ten minutes earlier')
  await shot(a, 'm1c-feedback-sheet')
  await sheet.getByRole('button', { name: 'Save feedback' }).click()
  let fb
  for (let i = 0; i < 30 && !fb?.remarks; i++) { fb = await readDoc(`eventRatings/past_${asha}`); if (!fb?.remarks) await a.waitForTimeout(200) }
  check('attendee saves remarks and suggestions', fb?.rating === 4 && fb?.remarks === 'Loved the hands-on demos' && fb?.suggestions === 'Start ten minutes earlier', JSON.stringify(fb))
  await sheet.waitFor({ state: 'detached' }).catch(() => {})
  check('history card offers to edit the remarks', await visible(a.getByRole('button', { name: 'Edit your remarks' })))

  // ── Notify me when registration opens ───────────────────────────
  await a.goto(`${BASE}/events/soon`)
  const bell = a.getByRole('button', { name: 'Notify me when registration opens' })
  check('coming-soon event offers Notify me', await visible(bell, 15000))
  await bell.click()
  let alert
  for (let i = 0; i < 30 && !alert; i++) { alert = await readDoc(`eventAlerts/soon_${asha}`); if (!alert) await a.waitForTimeout(200) }
  check('alert saved', alert?.userId === asha)
  await shot(a, 'm1c-notify')
  await a.keyboard.press('Escape')

  // ── Admin hides the WhatsApp link → it vanishes from the ticket ───
  await admin.goto(`${BASE}/admin`)
  await visible(admin.getByText('Control Center'), 30000)
  // .last(): the site navbar has an "Events" button too; the admin tab comes after it.
  await admin.getByRole('button', { name: 'Events', exact: true }).last().click()
  await admin.getByRole('button', { name: /WhatsApp shown/ }).first().click()
  check('chip flips to hidden', await visible(admin.getByRole('button', { name: /WhatsApp hidden/ })))
  const pub = await readDoc('events/up')
  const priv = await readDoc('eventPrivate/up')
  check('hidden link removed from the public event doc', pub.whatsappLink === '' && pub.whatsappHidden === true)
  check('admin copy kept privately', priv?.whatsappLink === 'https://chat.whatsapp.com/up')
  await a.goto(`${BASE}/dashboard`)
  await visible(a.getByText('My tickets'), 15000)
  check('ticket no longer shows WhatsApp', await gone(a.getByText('Join WhatsApp group')))
  check('dashboard card no longer shows WhatsApp', !(await a.getByText('Event WhatsApp group').isVisible()))

  // Quick controls: change the venue and show the link again.
  const upRow = admin.locator('div.flex.flex-wrap.items-center.gap-4', { hasText: 'Upcoming Workshop' })
  await upRow.getByRole('button', { name: 'Event controls' }).click()
  await admin.getByLabel(/^Venue/).fill('Seminar Hall 2')
  await admin.getByRole('switch', { name: 'Show link to registrants' }).click()
  await admin.getByRole('button', { name: /save changes/i }).click()
  await admin.waitForTimeout(1500)
  const after = await readDoc('events/up')
  check('quick controls save venue + show link', after.venue === 'Seminar Hall 2' && after.whatsappLink === 'https://chat.whatsapp.com/up' && !after.whatsappHidden, JSON.stringify({ v: after.venue, l: after.whatsappLink, h: after.whatsappHidden }))
  await a.goto(`${BASE}/dashboard`)
  check('ticket shows the link and new venue again', (await visible(a.getByText('Join WhatsApp group'))) && (await visible(a.getByText('Seminar Hall 2'))))
  await shot(a, 'm2-ticket-whatsapp')

  // ── Admin sends the "registration is open" alert ──────────────────
  const soonRow = admin.locator('div.flex.flex-wrap.items-center.gap-4', { hasText: 'Soon Summit' })
  await soonRow.getByRole('button', { name: 'Event controls' }).click()
  check('controls show who is waiting', await visible(admin.getByText(/1 person is waiting/)))
  await admin.getByRole('button', { name: 'Notify them' }).click()
  check('alert sent confirmation', await visible(admin.getByText(/Sent to 1 person/)))
  check('alert cleared after sending', !(await readDoc(`eventAlerts/soon_${asha}`)))
  await admin.keyboard.press('Escape')
  await a.goto(`${BASE}/dashboard`)
  check('attendee gets the alert in their inbox', await visible(a.getByText(/Registration is open: Soon Summit/), 15000))

  // ── QR hidden → payments paused in the registration drawer ────────
  await a.goto(`${BASE}/events/paid`)
  await a.getByRole('button', { name: 'Register Now' }).click()
  check('paused QR shows a notice', await visible(a.getByText('Payments are paused for this event')))
  await a.keyboard.press('Escape')

  // ── Already a member? — instant roster match ──────────────────────
  await a.goto(`${BASE}/membership`)
  await a.getByRole('button', { name: /Already a member\? Verify/ }).click()
  await a.getByLabel('ACM Membership ID').fill(' 111 1111 ')
  await a.getByRole('button', { name: 'Verify', exact: true }).click()
  check('roster match verifies instantly', await visible(a.getByText(/Welcome back/)))
  const am = await readDoc(`memberships/${asha}`)
  check('member record carries the roster ID', am?.membershipId === '1111111' && am?.legacy === true && am?.verifiedVia === 'roster')
  check('acmMember set', (await readDoc(`users/${asha}`))?.acmMember === true)
  await shot(a, 'm3-verified')

  // ── Not on the roster → pending → denied → re-request → approved ──
  const r = await signedInPage(browser, 'ravi@e2e.test')
  await r.goto(`${BASE}/membership`)
  await r.getByRole('button', { name: /Already a member\? Verify/ }).click()
  await r.getByLabel('ACM Membership ID').fill('2222222')
  await r.getByRole('button', { name: 'Verify', exact: true }).click()
  check('unmatched ID waits: pending approval', await visible(r.getByText('Pending approval')))
  await shot(r, 'm4-pending')
  await r.goto(`${BASE}/dashboard`)
  check('dashboard shows the pending glow', await visible(r.getByText('Pending approval')))

  await admin.reload()
  await visible(admin.getByText('Control Center'), 30000)
  await admin.getByRole('button', { name: 'Member verification', exact: true }).click()
  check('admin sees the request', await visible(admin.getByText('Ravi M')))
  check('admin sees "Not on the roster"', await visible(admin.getByText('Not on the roster')))
  await shot(admin, 'm5-admin-queue')
  await admin.getByRole('button', { name: /deny…/i }).click()
  await admin.getByPlaceholder(/reason/i).fill('ID not in our records')
  await admin.getByRole('button', { name: 'Deny', exact: true }).click()
  await admin.waitForTimeout(1200)
  check('request denied', (await readDoc(`memberVerifications/${ravi}`))?.status === 'denied')

  await r.goto(`${BASE}/membership`)
  check('member sees the denial reason', await visible(r.getByText(/ID not in our records/)))
  check('join / verify options are back', await visible(r.getByRole('button', { name: /Already a member\? Verify/ })))
  await r.getByRole('button', { name: /Already a member\? Verify/ }).click()
  await r.getByLabel('ACM Membership ID').fill('2222223')
  await r.getByRole('button', { name: 'Verify', exact: true }).click()
  check('re-request goes back to pending', await visible(r.getByText('Pending approval')))

  await admin.reload()
  await visible(admin.getByText('Control Center'), 30000)
  await admin.getByRole('button', { name: 'Member verification', exact: true }).click()
  await admin.getByRole('button', { name: 'Approve', exact: true }).first().click()
  await admin.waitForTimeout(1500)
  const rm = await readDoc(`memberships/${ravi}`)
  check('admin approval creates the member record', rm?.membershipId === '2222223' && rm?.verifiedVia === 'admin')
  check('admin approval sets acmMember', (await readDoc(`users/${ravi}`))?.acmMember === true)
  await r.reload()
  check('member page shows ACM Member', await visible(r.getByText('ACM Member')))

  // ── Pending request, then a roster upload verifies it automatically ─
  const c = await signedInPage(browser, 'cara@e2e.test')
  await c.goto(`${BASE}/membership`)
  await c.getByRole('button', { name: /Already a member\? Verify/ }).click()
  await c.getByLabel('ACM Membership ID').fill('3333333')
  await c.getByRole('button', { name: 'Verify', exact: true }).click()
  check('cara waits (roster lacks her yet)', await visible(c.getByText('Pending approval')))

  const docx = buildDocx({ title: 'Roster', header: ['Membership ID', 'Email', 'Name'], rows: [['3333333', 'CARA@e2e.test', 'Cara J'], ['bad', 'nope', 'x']] })
  const tmp = join(tmpdir(), 'acm-e2e-roster.docx')
  writeFileSync(tmp, docx)
  await admin.reload()
  await visible(admin.getByText('Control Center'), 30000)
  await admin.getByRole('button', { name: 'Member verification', exact: true }).click()
  await admin.locator('input[type=file][accept*=docx]').setInputFiles(tmp)
  check('import preview counts the good row', await visible(admin.getByText('members ready to import')))
  await shot(admin, 'm6-roster-preview')
  await admin.getByRole('button', { name: /Import 1 member/ }).click()
  check('upload auto-verifies the waiting request', await visible(admin.getByText(/matched the roster/), 15000))
  check('manual queue is empty', await visible(admin.getByText(/Nothing waiting/)))
  check('cara is a member now', (await readDoc(`memberships/${cara}`))?.verifiedVia === 'roster')

  // ── Members panel: both existing members listed ───────────────────
  await admin.getByRole('button', { name: 'Membership', exact: true }).last().click()
  check('members panel lists existing members', (await visible(admin.getByText('Asha K'))) && (await visible(admin.getByText('Existing member'))))
  await shot(admin, 'm7-members')

  // ── Analytics ───────────────────────────────────────────────────
  await admin.getByRole('button', { name: 'Analytics', exact: true }).last().click()
  check('analytics overview renders', await visible(admin.getByText('Registrations over time')))
  check('analytics counts members vs non-members', await visible(admin.getByText('ACM members vs non-members')))
  const quote = admin.getByText('“Loved the hands-on demos”')
  check('overview shows the latest feedback', await visible(quote))
  await shot(admin, 'm8-analytics-overview')
  await quote.click()
  const fbCard = admin.locator('#analytics-feedback')
  check('event feedback lists remarks and suggestions',
    (await visible(fbCard.getByText('Loved the hands-on demos'))) && (await visible(fbCard.getByText('Start ten minutes earlier'))))
  check('feedback shows who wrote it', await visible(fbCard.getByText('Asha K')))
  await fbCard.scrollIntoViewIfNeeded()
  await shot(admin, 'm9b-analytics-feedback')
  await admin.getByRole('button', { name: 'Event success', exact: true }).click()
  check('event success view renders', await visible(admin.getByText('Every event, ranked')))
  check('analytics shows the rating', await visible(admin.getByText('★ 4.0')))
  await shot(admin, 'm9-analytics-event')
  await admin.getByRole('button', { name: 'People', exact: true }).click()
  check('people view lists Asha', await visible(admin.getByRole('cell', { name: /Asha K/ })))
  await shot(admin, 'm10-analytics-people')
} catch (err) {
  check('script ran to completion', false, err?.message || String(err))
  if (SHOTS && browser) {
    let i = 0
    for (const ctx of browser.contexts()) for (const p of ctx.pages()) await shot(p, `fail-${i++}`).catch(() => {})
  }
} finally {
  await browser?.close().catch(() => {})
  await env?.cleanup().catch(() => {})
  try { process.kill(-vite.pid) } catch { /* already gone */ }
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)

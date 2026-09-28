// End-to-end check of admin-editable site text, the header sign-in / profile
// button, the ACM Global Membership button and the Execom admin panel.
//   npm run test:e2e:content
// Same harness as e2e-payments.mjs: boots `npm run dev:emu`, seeds with rules
// disabled, and drives the real UI.
import { spawn } from 'node:child_process'
import { readFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { ACM_GLOBAL_URL } from '../src/lib/siteText.js'

const BASE = 'http://localhost:5174'
const PROJECT = 'demo-acm-e2e'
const AUTH = 'http://127.0.0.1:9099'
const SHOTS = process.env.E2E_SHOTS

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

async function newPage(browser, { email, mobile = false } = {}) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log(`  [pageerror:${email || 'visitor'}] ${e.message}`))
  await page.goto(`${BASE}/`)
  if (email) {
    await page.waitForFunction(() => typeof window.__acmSignIn === 'function', null, { timeout: 30000 })
    await page.evaluate(({ email }) => window.__acmSignIn(email, 'secret123'), { email })
  }
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
  const userUid = await signUp('user@e2e.test')
  const profile = (name, extra = {}) => ({
    name, googleName: name, email: '', avatar: '', phone: '9876543210', phoneVerified: true,
    department: 'Computer Science & Engineering', year: '3rd Year', college: 'TKM College Of Engineering, Kollam',
    gender: 'Female', acmMember: false, role: 'user', permissions: {}, ...extra,
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, `users/${adminUid}`), profile('Admin One', { email: 'admin@e2e.test', role: 'admin' }))
    await setDoc(doc(db, `users/${userUid}`), profile('User Two', { email: 'user@e2e.test' }))
    await setDoc(doc(db, 'events/sheet'), {
      name: 'Sheet Test Talk', date: new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10), time: '10:00 AM',
      venue: 'Hall', shortDescription: 'Test', description: 'Test', status: 'open', fee: 0, poster: '', speakers: [],
    })
  })
  const readDoc = async (path) => {
    let data
    await env.withSecurityRulesDisabled(async (ctx) => { data = (await getDoc(doc(ctx.firestore(), path))).data() })
    return data
  }

  browser = await chromium.launch()

  // ── Header: red Sign In / Sign Up on phones and desktop ──────────
  const visitorPhone = await newPage(browser, { mobile: true })
  const signInPhone = visitorPhone.locator('header nav').getByRole('link', { name: /Sign In \/ Sign Up/ })
  check('phone: Sign In / Sign Up sits in the top bar', await visible(signInPhone))
  const glow = await signInPhone.first().evaluate((el) => getComputedStyle(el).backgroundColor)
  check('phone: the button is red', /rgb\(2[0-9]{2}, [0-9]{1,2}, [0-9]{1,2}/.test(glow), glow)
  await shot(visitorPhone, 'c1-phone-signed-out')
  const visitor = await newPage(browser)
  check('desktop: Sign In / Sign Up sits in the top bar', await visible(visitor.locator('header nav').getByRole('link', { name: /Sign In \/ Sign Up/ })))

  // ── Phone: dialogs are sheets you can pull down to dismiss ──────
  await visitorPhone.goto(`${BASE}/events/sheet`)
  const sheet = visitorPhone.getByRole('dialog')
  check('phone: event opens as a sheet', await visible(sheet, 15000))
  await visitorPhone.waitForTimeout(600) // let it finish rising
  const grip = await sheet.locator('.cursor-grab').first().boundingBox()
  if (grip) {
    const x = grip.x + grip.width / 2
    const y = grip.y + grip.height / 2
    await visitorPhone.mouse.move(x, y)
    await visitorPhone.mouse.down()
    for (let i = 1; i <= 8; i++) await visitorPhone.mouse.move(x, y + i * 45)
    await visitorPhone.mouse.up()
  }
  const dismissed = await sheet.first().waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false)
  check('phone: pulling the sheet down dismisses it', dismissed)
  await visitorPhone.goto(`${BASE}/`)

  // ── Home: new Join label + Global Membership button ─────────────
  check('hero Join button says the full chapter name', await visible(visitor.getByText('Join ACM TKMCE Student Chapter')))
  const global = visitor.getByRole('link', { name: /Get ACM Global Membership/ }).first()
  check('Global Membership button links to ACM', (await global.getAttribute('href')) === ACM_GLOBAL_URL)
  check('Global Membership opens in a new tab', (await global.getAttribute('target')) === '_blank')
  await shot(visitor, 'c2-hero')

  // ── Signed in: the button becomes the profile picture ───────────
  const userPhone = await newPage(browser, { email: 'user@e2e.test', mobile: true })
  const profileBtn = userPhone.locator('header nav').getByRole('button', { name: 'Your profile' })
  check('phone, signed in: profile icon in the top bar', await visible(profileBtn, 15000))
  check('phone, signed in: no Sign In button', !(await userPhone.locator('header nav').getByRole('link', { name: /Sign In/ }).isVisible()))
  await profileBtn.click()
  check('profile icon opens the account menu', await visible(userPhone.getByRole('link', { name: 'My profile' })))
  await shot(userPhone, 'c3-phone-signed-in')

  // ── Admin edits text, numbers, links ────────────────────────────
  const admin = await newPage(browser, { email: 'admin@e2e.test' })
  await admin.goto(`${BASE}/admin`)
  await visible(admin.getByText('Control Center'), 30000)
  await admin.getByRole('button', { name: 'Text Content', exact: true }).click()
  check('Text Content tab opens', await visible(admin.getByText('Modify text content')))
  await admin.getByLabel('Headline (highlighted word)').fill('TKM CE')
  await admin.getByLabel('“Join” button').fill('Join the Chapter')
  await shot(admin, 'c4-text-home')

  await admin.getByRole('button', { name: /^About & numbers/ }).click()
  await admin.getByLabel('Workshops number').fill('42')
  await admin.getByLabel('Workshops number').locator('xpath=preceding-sibling::input[1]').fill('Workshops held')
  await admin.getByRole('button', { name: 'Add a number' }).click()
  await admin.getByLabel('Year of establishment').fill('2018')
  await shot(admin, 'c5-text-numbers')

  await admin.getByRole('button', { name: /^Contact & social links/ }).click()
  await admin.getByLabel('Chapter email').fill('hello@tkmce.ac.in')
  await admin.getByRole('switch', { name: 'Show Instagram link' }).click()

  await admin.getByRole('button', { name: /^Membership/ }).last().click()
  await admin.getByLabel('Global Membership link').fill('acm.org/membership')
  await admin.getByRole('button', { name: 'Save changes' }).click()
  check('a link without https:// is refused', await visible(admin.getByText(/Use a full link starting with https/)))
  check('nothing saved while a field is invalid', !(await readDoc('siteContent/main')))
  await admin.getByLabel('Global Membership link').fill('https://www.acm.org/membership')
  await admin.getByRole('button', { name: 'Save changes' }).click()
  check('save confirms', await visible(admin.getByText(/Saved — the site shows the new text now/)))
  const sc = await readDoc('siteContent/main')
  check('texts stored', sc?.texts?.['hero.titleHighlight'] === 'TKM CE' && sc?.texts?.['cta.join'] === 'Join the Chapter', JSON.stringify(sc?.texts?.['cta.join']))
  check('untouched text stored blank (keeps the default)', sc?.texts?.['hero.ctaEvents'] === '')
  check('numbers stored', sc?.stats?.some((s) => s.label === 'Workshops held' && s.value === 42) && sc?.stats?.length === 5 && sc?.established === '2018')

  // ── The public site shows it all ────────────────────────────────
  await visitor.goto(`${BASE}/`)
  check('headline updated', await visible(visitor.getByText('TKM CE'), 20000))
  check('Join label updated', await visible(visitor.getByRole('button', { name: /Join the Chapter/ }), 20000))
  check('Global link updated', (await visitor.getByRole('link', { name: /Get ACM Global Membership/ }).first().getAttribute('href')) === 'https://www.acm.org/membership')
  await visitor.locator('#about').scrollIntoViewIfNeeded()
  check('number tile relabelled', await visible(visitor.getByText('Workshops held')))
  check('establishment year updated', await visible(visitor.getByText('2018').first()))
  check('Instagram icon hidden everywhere', (await visitor.getByRole('link', { name: 'Instagram' }).count()) === 0)
  check('footer email updated', await visible(visitor.getByRole('link', { name: /hello@tkmce\.ac\.in/ })))
  await shot(visitor, 'c6-about-updated')

  // ── Switch the Global Membership button off ─────────────────────
  await admin.getByRole('switch', { name: 'Show Global Membership button' }).click()
  await admin.getByRole('button', { name: 'Save changes' }).click()
  let off = false
  for (let i = 0; i < 40 && !off; i++) {
    off = (await readDoc('siteContent/main'))?.globalMembershipEnabled === false
    if (!off) await new Promise((r) => setTimeout(r, 250))
  }
  check('switching the Global button off is saved', off)
  await visitor.reload()
  await visible(visitor.getByText('Join the Chapter'), 20000)
  const gone = await visitor.getByRole('link', { name: /Get ACM Global Membership/ }).first().waitFor({ state: 'detached', timeout: 10000 }).then(() => true, () => false)
  check('Global Membership button can be switched off', gone)

  // ── Execom admin panel ──────────────────────────────────────────
  await admin.getByRole('button', { name: 'Execom', exact: true }).last().click()
  check('team and member totals shown', await visible(admin.getByText(/members in total/)))
  check('each team shows its member count', (await admin.getByText(/^\d+ members?\b/).count()) >= 3)
  check('Edit members buttons are labelled', (await admin.getByRole('button', { name: /Edit members|Close editor/ }).count()) >= 3)
  await admin.getByRole('button', { name: /^Delete Chair$/ }).click()
  check('deleting a team asks first', await visible(admin.getByText('Delete “Chair”?')))
  await shot(admin, 'c7-execom-confirm')
  await admin.getByRole('button', { name: 'Cancel' }).click()
  await admin.getByText('Delete “Chair”?').waitFor({ state: 'detached' }).catch(() => {})
  await admin.getByRole('button', { name: /Edit members|Close editor/ }).first().scrollIntoViewIfNeeded()
  await shot(admin, 'c8-execom')
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

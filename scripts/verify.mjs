// Drives the running dev server in a real browser and asserts that navigation
// actually renders — the "blank until refresh" class of bug.
//   npm run dev        (in one terminal)
//   node scripts/verify.mjs [baseUrl]
import { chromium } from 'playwright'

const BASE = process.argv[2] || 'http://localhost:5173'
const results = []
const pass = (n, d = '') => results.push({ ok: true, n, d })
const fail = (n, d = '') => results.push({ ok: false, n, d })

// Text that proves a given route actually painted its own content.
const marker = {
  '/': 'Advancing computing at',
  '/events': 'Everything happening at ACM TKMCE',
  '/execom': 'The team behind ACM TKMCE',
  '/contact': 'Let’s connect',
  '/auth': 'Sign in to ACM TKMCE',
  '/dashboard': 'Sign in to ACM TKMCE', // unauthenticated -> redirected to auth
  '/admin': 'Editor access required',
}

// Sections that remain scroll targets on the home page.
const homeSections = ['about', 'goals', 'gallery']

const mainText = (page) => page.locator('main').innerText().catch(() => '')

async function settle(page) {
  await page.waitForTimeout(900) // page transition + Lenis settle
}

const run = async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))

  // ── 1. Every route renders on a cold load ────────────────────
  for (const [route, text] of Object.entries(marker)) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const body = await mainText(page)
    body.includes(text)
      ? pass(`cold load ${route}`)
      : fail(`cold load ${route}`, `missing "${text}"`)
  }

  // ── 2. Client-side nav renders WITHOUT a refresh ─────────────
  // This is the reported bug: click a link, get a blank page until F5.
  const navCases = []
  // Every route -> every reachable destination, via the real UI controls.
  for (const from of ['/', '/events', '/execom', '/contact', '/admin', '/nope']) { // /auth is bare by design
    for (const dest of ['Events', 'Execom', 'Contact']) {
      navCases.push({ from, click: dest, expect: marker['/' + dest.toLowerCase()] })
    }
    navCases.push({ from, click: 'Login / Sign Up', expect: marker['/auth'] })
  }
  // Footer links (present on every non-auth route).
  for (const from of ['/', '/events', '/execom', '/contact', '/admin']) {
    navCases.push({ from, click: 'Dashboard', expect: marker['/auth'], where: 'footer' })
  }
  for (const c of navCases) {
    await page.goto(BASE + c.from, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const scope = c.where === 'footer' ? page.locator('footer') : page
    const target = scope.getByRole('link', { name: c.click }).or(scope.getByRole('button', { name: c.click })).first()
    if (!(await target.count())) { fail(`nav ${c.from} -> ${c.click}`, 'control not found'); continue }
    await target.click()
    await settle(page)
    const body = await mainText(page)
    const painted = body.trim().length > 0
    const label = `nav ${c.from} -> ${c.where || 'nav'}:${c.click}`
    body.includes(c.expect)
      ? pass(label)
      : fail(label, painted ? `wrong content: "${body.slice(0, 60)}"` : 'MAIN IS EMPTY (blank until refresh)')
  }

  // Logo returns home from every route.
  for (const from of ['/events', '/execom', '/contact', '/admin', '/auth']) {
    await page.goto(BASE + from, { waitUntil: 'domcontentloaded' })
    await settle(page)
    await page.getByRole('link').filter({ hasText: 'ACM TKMCE' }).first().click()
    await settle(page)
    new URL(page.url()).pathname === '/' && (await mainText(page)).length > 200
      ? pass(`logo ${from} -> /`)
      : fail(`logo ${from} -> /`, `at ${new URL(page.url()).pathname}`)
  }

  // ── 3. Section links scroll, from home and from another route ─
  for (const from of ['/', '/admin', '/events']) {
    for (const id of homeSections) {
      await page.goto(BASE + from, { waitUntil: 'domcontentloaded' })
      await settle(page)
      await page.getByRole('button', { name: new RegExp(`^${id}$`, 'i') }).first().click()
      await page.waitForTimeout(1600) // smooth scroll
      const box = await page.locator(`#${id}`).boundingBox().catch(() => null)
      if (!box) { fail(`scroll ${from} -> #${id}`, 'section not in DOM'); continue }
      // Section top should land just under the fixed navbar.
      box.y > 40 && box.y < 140
        ? pass(`scroll ${from} -> #${id}`)
        : fail(`scroll ${from} -> #${id}`, `section at y=${Math.round(box.y)}, expected 40-140 (just under navbar)`)
    }
  }

  // ── 4. Back / forward still paint ────────────────────────────
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await settle(page)
  await page.getByRole('button', { name: 'Events' }).first().click()
  await settle(page)
  await page.goBack(); await settle(page)
  ;(await mainText(page)).length > 200 ? pass('history back paints') : fail('history back paints', 'blank')
  await page.goForward(); await settle(page)
  ;(await mainText(page)).includes(marker['/events'])
    ? pass('history forward paints')
    : fail('history forward paints', 'blank or wrong')

  // ── 5. Auth page has no navbar/footer clash, Google-only ─────
  await page.goto(BASE + '/auth', { waitUntil: 'domcontentloaded' })
  await settle(page)
  const logos = await page.locator('header').count()
  logos === 0 ? pass('auth: no fixed navbar overlay') : fail('auth: no fixed navbar overlay', `${logos} header(s)`)
  const pw = await page.locator('input[type="password"]').count()
  pw === 0 ? pass('auth: password field removed') : fail('auth: password field removed', `${pw} found`)
  const google = await page.getByRole('button', { name: /Continue with Google/i }).count()
  google === 1 ? pass('auth: Google button present') : fail('auth: Google button present', `${google} found`)

  // ── 6. Execom rows align (no stagger offsets) ────────────────
  await page.goto(BASE + '/execom', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const tops = await page.$$eval('#execom figure', (els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().top)))
  if (tops.length < 2) fail('execom: cards found', `${tops.length}`)
  else {
    // Group by row (within 40px) and confirm each row shares one baseline.
    const rows = new Map()
    tops.forEach((t) => {
      const k = [...rows.keys()].find((r) => Math.abs(r - t) < 40)
      rows.set(k ?? t, [...(rows.get(k ?? t) || []), t])
    })
    const ragged = [...rows.values()].filter((r) => Math.max(...r) - Math.min(...r) > 4)
    ragged.length === 0
      ? pass(`execom: ${tops.length} cards aligned in ${rows.size} rows`)
      : fail('execom: rows aligned', `${ragged.length} ragged row(s)`)
  }

  // ── 7. Goals cards enlarge on hover ─────────────────────────
  await page.goto(BASE + '/#goals', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  const cards = page.locator('#goals button')
  const before = await cards.nth(1).boundingBox()
  await cards.nth(1).hover()
  await page.waitForTimeout(600)
  const after = await cards.nth(1).boundingBox()
  after && before && after.width > before.width + 2
    ? pass(`goals: hover enlarges (${Math.round(before.width)} -> ${Math.round(after.width)}px)`)
    : fail('goals: hover enlarges', `${before?.width} -> ${after?.width}`)

  // ── 8. Dark-only theme ───────────────────────────────────────
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await settle(page)
  const htmlDark = await page.locator('html').evaluate((el) => el.classList.contains('dark'))
  htmlDark ? pass('theme: html is dark') : fail('theme: html is dark', 'missing .dark')
  const toggle = await page.getByRole('button', { name: /toggle theme/i }).count()
  toggle === 0 ? pass('theme: toggle removed') : fail('theme: toggle removed', `${toggle} found`)
  // Light-scheme visitors must still get the dark canvas.
  const lightPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' })
  await lightPage.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await lightPage.waitForTimeout(1200)
  const bg = await lightPage.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor)
  const [r, g, b] = bg.match(/\d+/g).map(Number)
  r + g + b < 120 ? pass(`theme: dark canvas under light OS (${bg})`) : fail('theme: dark canvas under light OS', bg)
  await lightPage.close()

  // ── 9. Hero: official logo, no "Est." pill ───────────────────
  const heroLogo = page.locator('section img[src*="acm-logo"]').first()
  const heroBox = await heroLogo.boundingBox().catch(() => null)
  heroBox && heroBox.width >= 200
    ? pass(`hero: official logo rendered large (${Math.round(heroBox.width)}px)`)
    : fail('hero: official logo rendered large', heroBox ? `only ${Math.round(heroBox.width)}px` : 'not found')
  // The mark should settle and hold — no perpetual float.
  const y1 = (await heroLogo.boundingBox()).y
  await page.waitForTimeout(1800)
  const y2 = (await heroLogo.boundingBox()).y
  Math.abs(y1 - y2) < 1
    ? pass('hero: logo holds still after reveal')
    : fail('hero: logo holds still after reveal', `drifted ${Math.abs(y1 - y2).toFixed(1)}px`)
  const estPill = await page.getByText(/Est\. \d{4}\s*·/).count()
  estPill === 0 ? pass('hero: Est. pill removed') : fail('hero: Est. pill removed', `${estPill} found`)

  // ── 10. Explore cards link to the dedicated routes ───────────
  for (const [name, path, text] of [
    ['Events', '/events', marker['/events']],
    ['Execom', '/execom', marker['/execom']],
    ['Contact', '/contact', marker['/contact']],
  ]) {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await settle(page)
    const card = page.locator('#explore a[href="' + path + '"]')
    if (!(await card.count())) { fail(`explore card -> ${name}`, 'card not found'); continue }
    await card.first().click()
    await settle(page)
    ;(await mainText(page)).includes(text)
      ? pass(`explore card -> ${name}`)
      : fail(`explore card -> ${name}`, `landed on ${new URL(page.url()).pathname}`)
  }

  // Sections moved off the home page must no longer be there.
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await settle(page)
  for (const id of ['execom', 'contact']) {
    ;(await page.locator(`#${id}`).count()) === 0
      ? pass(`home: #${id} moved to its own page`)
      : fail(`home: #${id} moved to its own page`, 'still on home')
  }

  // ── 11. Real chapter links ───────────────────────────────────
  const expectLinks = {
    'instagram.com/acm_tkmce': 'Instagram',
    'linkedin.com/company/acm-tkmce': 'LinkedIn',
    'mailto:acm.cse@tkmce.ac.in': 'email',
  }
  await page.goto(BASE + '/contact', { waitUntil: 'domcontentloaded' })
  await settle(page)
  const hrefs = await page.$$eval('a[href]', (els) => els.map((e) => e.getAttribute('href')))
  for (const [needle, label] of Object.entries(expectLinks)) {
    hrefs.some((h) => h && h.includes(needle))
      ? pass(`links: ${label} -> ${needle}`)
      : fail(`links: ${label}`, `no href containing "${needle}"`)
  }
  // Stale handles and the dropped GitHub link must be gone everywhere.
  for (const stale of ['instagram.com/acmtkmce', 'hello@acmtkmce.org', 'linkedin.com/company/acmtkmce', 'github.com']) {
    hrefs.some((h) => h && h.includes(stale))
      ? fail(`links: stale ${stale} removed`, 'still present')
      : pass(`links: stale ${stale} removed`)
  }

  await browser.close()

  // ── Report ──────────────────────────────────────────────────
  const bad = results.filter((r) => !r.ok)
  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.n}${r.d ? ` — ${r.d}` : ''}`)
  if (errors.length) {
    console.log(`\n${errors.length} console error(s):`)
    ;[...new Set(errors)].slice(0, 10).forEach((e) => console.log('  ! ' + e.slice(0, 160)))
  }
  console.log(`\n${results.length - bad.length}/${results.length} passed`)
  process.exit(bad.length ? 1 : 0)
}

run().catch((e) => { console.error(e); process.exit(1) })

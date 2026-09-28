// Every piece of site copy an admin can change without code, with its built-in
// default. Pages read text through `resolveText` (via useText in DataContext);
// the admin "Text Content" tab edits overrides, stored as siteContent.texts.
// A blank override means "use the default", so resetting a field is just
// clearing it. Pure module (no React/Firebase) — tests/unit/siteText.test.mjs.

export const ACM_GLOBAL_URL =
  'https://services.acm.org/public/qj/proflevel/proflevel_control.cfm?level=3&country=India&form_type=Student&promo=ACMMSDEPT&pay=DD'

// Field types: text (one line), long (paragraph), url, email.
// `vars` lists the {placeholders} a field may use.
// `contentKey` fields live at the top level of siteContent (older fields that
// predate `texts`), so existing saved values keep working.
export const TEXT_SECTIONS = [
  {
    id: 'home',
    title: 'Home page',
    blurb: 'The big headline, tagline and buttons at the top of the home page.',
    fields: [
      { key: 'hero.titleLead', label: 'Headline (first part)', default: 'Association for Computing Machinery at' },
      { key: 'hero.titleHighlight', label: 'Headline (highlighted word)', default: 'TKMCE' },
      { key: 'heroTagline', contentKey: 'heroTagline', label: 'Tagline under the headline', type: 'long', default: 'The official ACM Student Chapter at TKM College of Engineering. We host workshops, hackathons and talks that turn curious students into confident builders.' },
      { key: 'cta.join', label: '“Join” button', default: 'Join ACM TKMCE Student Chapter', hint: 'Used on the home page, the header, the membership page and the profile.' },
      { key: 'hero.ctaEvents', label: '“Events” button', default: 'Explore Events' },
      { key: 'hero.ctaLearn', label: '“Learn more” button', default: 'Learn More' },
    ],
  },
  {
    id: 'about',
    title: 'About & numbers',
    blurb: 'The About section: its heading, the year of establishment, the number tiles and the “Why join us” cards.',
    fields: [
      { key: 'about.band', label: 'Big scrolling line', default: 'Think. Build. Ship.' },
      { key: 'about.eyebrow', label: 'Small label above the title', default: 'About' },
      { key: 'aboutTitle', contentKey: 'aboutTitle', label: 'Section title', default: 'Built by students, for builders' },
      { key: 'about.description', label: 'Section description', type: 'long', vars: ['year'], default: 'ACM Student Chapter, TKM College of Engineering. Since {year}, we’ve turned curious first-years into confident engineers through relentless hands-on learning.' },
      { key: 'about.establishedLabel', label: 'Caption under the year', default: 'Year of establishment' },
      { key: 'about.whyTitle', label: '“Why join us” heading', default: 'Why join Us?' },
    ],
  },
  {
    id: 'goals',
    title: 'Goals',
    blurb: 'The Vision / Mission / Values section.',
    fields: [
      { key: 'goals.eyebrow', label: 'Small label above the title', default: 'Our Goals' },
      { key: 'goals.title', label: 'Section title', default: 'What we point every event toward' },
      { key: 'goals.description', label: 'Section description', type: 'long', default: 'Three pillars keep the chapter honest — a clear picture of where we’re going, how we get there, and what we refuse to compromise on.' },
    ],
  },
  {
    id: 'gallery',
    title: 'Gallery',
    blurb: 'The photo reel on the home page. Photos themselves are managed in the Gallery tab.',
    fields: [
      { key: 'gallery.eyebrow', label: 'Small label above the title', default: 'Gallery' },
      { key: 'galleryTitle', contentKey: 'galleryTitle', label: 'Title', default: 'Life at the chapter' },
      { key: 'galleryBlurb', contentKey: 'galleryBlurb', label: 'Description', type: 'long', default: 'Hack nights, workshops, mentor circles — a running reel of what we get up to.' },
    ],
  },
  {
    id: 'explore',
    title: 'Explore cards',
    blurb: 'The three cards at the bottom of the home page that lead to Events, Execom and Contact.',
    fields: [
      { key: 'explore.eyebrow', label: 'Small label above the title', default: 'Explore' },
      { key: 'explore.title', label: 'Section title', default: 'Go deeper' },
      { key: 'explore.description', label: 'Section description', default: 'Three corners of the chapter big enough to deserve their own space.' },
      { key: 'explore.eventsTitle', label: 'Events card — title', default: 'Events' },
      { key: 'explore.eventsCopy', label: 'Events card — text', type: 'long', default: 'Workshops, talks and hackathons — browse what’s open, what’s coming and what we’ve run.' },
      { key: 'explore.execomTitle', label: 'Execom card — title', default: 'Execom' },
      { key: 'explore.execomCopy', label: 'Execom card — text', type: 'long', default: 'The students who plan, build and run everything — organised team by team.' },
      { key: 'explore.contactTitle', label: 'Contact card — title', default: 'Contact' },
      { key: 'explore.contactCopy', label: 'Contact card — text', type: 'long', default: 'Questions, collaborations, or want to join a team? Every channel, plus a direct message form.' },
      { key: 'explore.contactMeta', label: 'Contact card — footnote', default: 'We reply fast' },
      { key: 'explore.open', label: 'Card link text', default: 'Open' },
    ],
  },
  {
    id: 'events',
    title: 'Events page',
    blurb: 'Headings on the Events page. Each event’s own details are edited in the Events tab.',
    fields: [
      { key: 'events.eyebrow', label: 'Small label above the title', default: 'Events' },
      { key: 'events.title', label: 'Page title', default: 'Everything happening at ACM TKMCE' },
      { key: 'events.description', label: 'Page description', type: 'long', default: 'Browse upcoming, ongoing and past events. Tap any card for the full breakdown and to register.' },
      { key: 'events.emptyTitle', label: 'No events yet — heading', default: 'Coming Soon.....' },
      { key: 'events.emptyBody', label: 'No events yet — text', type: 'long', default: 'We’re lining up the next set of workshops, talks and hackathons. Check back shortly.' },
      { key: 'events.emptyFilter', label: 'Empty filter message', default: 'No events in this category yet.' },
    ],
  },
  {
    id: 'execom',
    title: 'Execom page',
    blurb: 'Headings on the Execom page. The teams and members are edited in the Execom tab.',
    fields: [
      { key: 'execom.eyebrow', label: 'Small label above the title', default: 'Execom' },
      { key: 'execom.title', label: 'Page title', default: 'The team behind ACM TKMCE' },
      { key: 'execom.description', label: 'Page description', type: 'long', default: 'The students who plan, build and run everything — organised team by team, in order of responsibility.' },
    ],
  },
  {
    id: 'contact',
    title: 'Contact & social links',
    blurb: 'The Contact page and the chapter’s email and social links, used across the site (header, footer, home page). Switch a link off to hide its icon everywhere.',
    fields: [
      { key: 'contact.eyebrow', label: 'Small label above the title', default: 'Contact' },
      { key: 'contact.title', label: 'Page title', default: 'Let’s connect' },
      { key: 'contact.description', label: 'Page description', type: 'long', default: 'Questions, collaborations, or want to join a team? Reach out — we reply fast.' },
      { key: 'contact.email', label: 'Chapter email', type: 'email', default: 'acm.cse@tkmce.ac.in' },
      { key: 'social.instagram', label: 'Instagram link', type: 'url', optional: true, default: 'https://www.instagram.com/acm_tkmce' },
      { key: 'social.instagramLabel', label: 'Instagram — shown as', default: '@acm_tkmce' },
      { key: 'social.linkedin', label: 'LinkedIn link', type: 'url', optional: true, default: 'https://www.linkedin.com/company/acm-tkmce/' },
      { key: 'social.linkedinLabel', label: 'LinkedIn — shown as', default: '/company/acm-tkmce' },
      { key: 'contact.signInTitle', label: 'Signed-out visitors — heading', default: 'Sign in to send a message' },
      { key: 'contact.signInBody', label: 'Signed-out visitors — text', type: 'long', default: 'We ask you to sign in with Google so every message carries a verified email we can actually reply to.' },
      { key: 'contact.sendLabel', label: 'Send button', default: 'Send message' },
    ],
  },
  {
    id: 'membership',
    title: 'Membership',
    blurb: 'The Membership page, and the ACM Global Membership button shown under every “Join” button.',
    fields: [
      { key: 'membership.eyebrow', label: 'Small label above the title', default: 'Membership' },
      { key: 'membership.title', label: 'Page title', default: 'Join ACM TKMCE Student Chapter' },
      { key: 'membership.description', label: 'Page description', type: 'long', default: 'Become a member of the chapter — get member discounts on events and workshops, and a spot in the community.' },
      { key: 'membership.verifyLabel', label: '“Already a member?” option', default: 'Already a member? Verify' },
      { key: 'global.label', label: 'Global Membership button', default: 'Get ACM Global Membership' },
      { key: 'global.url', label: 'Global Membership link', type: 'url', default: ACM_GLOBAL_URL, hint: 'Where the Global Membership button takes people (opens in a new tab).' },
      { key: 'global.note', label: 'Global Membership — small note', default: 'Joins you to ACM worldwide (acm.org) — separate from the chapter membership.' },
    ],
  },
  {
    id: 'chrome',
    title: 'Header, footer & profile',
    blurb: 'Text in the top bar, the footer and the member’s profile page.',
    fields: [
      { key: 'brand.name', label: 'Chapter short name', default: 'ACM TKMCE', hint: 'Shown next to the logo, in the footer and on the sign-in page.' },
      { key: 'brand.subtitle', label: 'Line under the name', default: 'Student Chapter' },
      { key: 'nav.about', label: 'Menu — About', default: 'About' },
      { key: 'nav.goals', label: 'Menu — Goals', default: 'Goals' },
      { key: 'nav.gallery', label: 'Menu — Gallery', default: 'Gallery' },
      { key: 'nav.events', label: 'Menu — Events', default: 'Events' },
      { key: 'nav.execom', label: 'Menu — Execom', default: 'Execom' },
      { key: 'nav.contact', label: 'Menu — Contact', default: 'Contact' },
      { key: 'nav.signIn', label: 'Sign-in button', default: 'Sign In / Sign Up' },
      { key: 'footer.tagline', label: 'Footer tagline', type: 'long', default: 'Advancing computing as a science & profession — one build at a time.' },
      { key: 'footer.explore', label: 'Footer column 1 heading', default: 'Explore' },
      { key: 'footer.engage', label: 'Footer column 2 heading', default: 'Engage' },
      { key: 'footer.wordmark', label: 'Big outlined footer word', default: 'ACM TKMCE' },
      { key: 'profile.subtitle', label: 'Profile greeting line', default: 'Here’s your ACM TKMCE space.' },
      { key: 'profile.notMember', label: 'Profile — non-member text', default: 'Join the chapter to get member discounts on events.' },
    ],
  },
  {
    id: 'signin',
    title: 'Sign-in page',
    blurb: 'The page people see when they sign in or sign up.',
    fields: [
      { key: 'auth.panelTitle', label: 'Left panel headline', default: 'One account for every ACM TKMCE event.' },
      { key: 'auth.title', label: 'Heading', default: 'Sign in to ACM TKMCE' },
      { key: 'auth.body', label: 'Text under the heading', type: 'long', default: 'Continue with your Google account. New here? Signing in creates your chapter profile automatically.' },
      { key: 'auth.consent', label: 'Small print', type: 'long', default: 'By continuing you agree to take part in ACM TKMCE activities under the chapter code of conduct.' },
    ],
  },
  {
    id: 'notfound',
    title: 'Page not found',
    blurb: 'Shown when someone opens a link that doesn’t exist.',
    fields: [
      { key: 'notFound.title', label: 'Heading', default: '404 — Not Found' },
      { key: 'notFound.body', label: 'Text', type: 'long', default: 'That page doesn’t exist. Let’s get you back to the ACM TKMCE home.' },
    ],
  },
]

export const TEXT_FIELDS = Object.fromEntries(TEXT_SECTIONS.flatMap((s) => s.fields.map((f) => [f.key, f])))

const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m)) : s)

// The saved override for a field, or '' when there isn't one.
export function savedText(content, key) {
  const f = TEXT_FIELDS[key]
  const raw = f?.contentKey ? content?.[f.contentKey] : content?.texts?.[key]
  return typeof raw === 'string' ? raw : ''
}

// The text to show: the override when one is set, otherwise the default, with
// {placeholders} filled in. Optional fields (e.g. a social link) may be
// deliberately cleared with the NONE marker to hide them.
export const NONE = '—none—'
export function resolveText(content, key, vars) {
  const f = TEXT_FIELDS[key]
  const saved = savedText(content, key).trim()
  if (f?.optional && saved === NONE) return ''
  return fill(saved || f?.default || '', vars)
}

// Is the link safe to send people to? (http/https only — never javascript:)
export const isWebUrl = (s) => /^https?:\/\/[^\s]+$/i.test(String(s || '').trim())
export const isEmailAddress = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim())

// Problems that would make a field unsafe or broken to save.
export function validateText(key, value) {
  const f = TEXT_FIELDS[key]
  const v = String(value || '').trim()
  if (!f || !v || (f.optional && v === NONE)) return ''
  if (f.type === 'url' && !isWebUrl(v)) return 'Use a full link starting with https://'
  if (f.type === 'email' && !isEmailAddress(v)) return 'That doesn’t look like an email address.'
  return ''
}

export function searchFields(query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return null
  return TEXT_SECTIONS.flatMap((s) => s.fields
    .filter((f) => [f.label, f.default, s.title, f.hint].some((x) => String(x || '').toLowerCase().includes(q)))
    .map((f) => ({ ...f, section: s.title })))
}

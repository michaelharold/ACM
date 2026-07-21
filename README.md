# ACM TKMCE — Website & Event Management Portal

Premium, minimalist, fully responsive site for the ACM TKMCE Student Chapter.

**Frontend:** React 18 · Vite 5 · Tailwind CSS · Framer Motion · React Router · Lucide
**Backend:** Firebase — Authentication (Google) + Cloud Firestore
**Extras:** GSAP, Three.js / OGL (WebGL section backdrops), Lenis (smooth scroll)

> **You do not need a backend to run this.** With no Firebase config the app
> transparently falls back to an in-memory mock layer, so a fresh clone runs
> with real content after two commands.

---

## 1. Prerequisites

| Tool | Version | Check with | Get it |
|---|---|---|---|
| **Node.js** | 18 or newer (20+ recommended) | `node -v` | [nodejs.org](https://nodejs.org) |
| **npm** | 9 or newer (ships with Node) | `npm -v` | — |
| **Git** | any recent | `git --version` | [git-scm.com](https://git-scm.com) |

If `node -v` prints nothing or a version below 18, install the current LTS from
nodejs.org first — Vite 5 will not start on older runtimes.

---

## 2. Quick start

Four commands from nothing to a running site:

```bash
# 1. Clone the repository
git clone https://github.com/michaelharold/ACM.git

# 2. Enter the project folder
cd ACM

# 3. Install dependencies (takes 1–3 min the first time)
npm install

# 4. Start the dev server
npm run dev
```

Then open the URL it prints — normally **<http://localhost:5173>**.

That's it. The site is now running on mock data with every page, animation and
interaction working. Edit any file in `src/` and the browser updates instantly.

**To stop the server:** press `Ctrl + C` in the terminal.

<details>
<summary>If port 5173 is already in use</summary>

Vite automatically moves to the next free port (5174, 5175, …) and prints the
real URL. Use whichever it shows. To force a specific one:

```bash
npm run dev -- --port 3000
```
</details>

<details>
<summary>If <code>npm install</code> fails</summary>

Delete the lockfile artefacts and retry with a clean cache:

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```
</details>

---

## 3. Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built `dist/` locally to check the real build |
| `npm run verify` | Drive the site in a real browser and assert everything works (see §6) |
| `npm run seed` | Upload the mock content into your Firestore (needs `.env`, see §5) |

---

## 4. Project structure

```
src/
├── pages/            Route-level screens (Home, Events, Auth, Dashboard, Admin)
├── components/
│   ├── layout/       Navbar, Footer
│   ├── sections/     Home page sections (Hero, About, Goals, Execom, …)
│   ├── events/       Event card, details modal, registration drawer
│   ├── reactbits/    WebGL / animated visual components
│   └── ui/           Reusable primitives (Button, Input, Modal, Card, …)
├── context/          Auth, Data, Registrations, Theme providers
├── services/         All Firestore reads/writes live here
├── lib/              Helpers (smooth scroll, formatting, avatars, firebase init)
└── data/mock.js      Fallback content used when Firebase is not configured
```

---

## 5. Going live with Firebase (optional)

Skip this entirely if you just want to run or develop the site locally.

**1. Create a project** at [console.firebase.google.com](https://console.firebase.google.com).

**2. Enable sign-in:** Authentication → Sign-in method → enable **Google**.

**3. Create the database:** Firestore Database → Create database → start in **test mode**.

**4. Add your config.** Project settings → Your apps → Web app, then copy the
values into a new `.env` file in the project root (copy `.env.example` as a
starting point):

```bash
cp .env.example .env
```

```ini
VITE_FIREBASE_API_KEY=…
VITE_FIREBASE_AUTH_DOMAIN=…
VITE_FIREBASE_PROJECT_ID=…
VITE_FIREBASE_STORAGE_BUCKET=…
VITE_FIREBASE_MESSAGING_SENDER_ID=…
VITE_FIREBASE_APP_ID=…
```

> `.env` is gitignored — never commit it. Restart `npm run dev` after editing it;
> Vite only reads env vars at startup.

**5. Seed the content** while rules are still open:

```bash
npm run seed
```

**6. Make yourself an admin.** Sign in on the site once (this creates your
`users/{uid}` document), then in the Firestore console set that document's
`role` field to `"admin"`. `/admin` unlocks for that account.

**7. Enable reply emails** (needed for the admin Messages inbox to actually
send replies — see §5a below).

**8. Lock the database down** with the strict rules in `firestore.rules`:

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

Order matters: seed first, grant yourself admin, *then* deploy the rules —
public content becomes admin-write-only once they are live.

---

## 5a. Contact messages & admin replies

Visitors sign in with Google and send a message from `/contact`. It lands in
**Admin → Messages**, where an admin can open the thread and reply.

**Sender identity is enforced server-side.** The Firestore rules require a new
message's `userId` and `userEmail` to equal the caller's own auth token, so
nobody can post under someone else's address — which matters, because the reply
goes to whatever address is on the message.

### Making replies actually send

A static site cannot send email by itself. Replies are written to a `mail`
collection, which is the format the official Firebase **Trigger Email**
extension consumes:

1. Firebase console → **Extensions** → install **Trigger Email from Firestore**.
2. Set **Collection** to `mail`.
3. Give it an SMTP connection URI — a Gmail app password works for low volume:
   `smtps://acm.cse@tkmce.ac.in:APP_PASSWORD@smtp.gmail.com:465`
4. Set the **default FROM** address to the chapter mailbox.

Once installed, every reply sent from the admin panel is delivered
automatically. The extension needs the **Blaze** plan.

**Until you install it**, the reply is still recorded on the thread and the
detail view offers *Open in email client*, which opens a pre-filled `mailto:`
to the sender — so the inbox is usable from day one, just not automated.

In demo mode (no Firebase config) messages persist in `localStorage` so the
whole flow can be clicked through without a backend.

---

## 5b. Editing the site without touching code

**Admin → Site Content** edits the front-page copy live: hero tagline, About
title, Vision/Mission/Values, the "why join us" cards, chapter stats,
establishment year, gallery heading and the announcement ticker.

**Admin → Gallery** takes photo uploads for the "Life at the chapter" strip.
Drop in any number of images at any size — each is centre-cropped to the card
ratio (800×560) and recompressed in the browser before saving, so the strip
stays uniform whatever you upload. The strip reshuffles on every visit, so new
photos surface in different positions rather than always landing last.

Images are stored inline, one per Firestore document. That keeps each upload
far below the 1 MB per-document cap and avoids needing Cloud Storage, at the
cost of the photos counting toward your Firestore quota — fine for a gallery of
tens of images, not for hundreds.

Both panels are open to admins and to editors holding the `content` grant.

---

## 6. Verifying the site works

`scripts/verify.mjs` drives the app in a real Chromium browser and asserts that
every route paints, every link navigates, sections scroll to the right place and
the layout holds. Useful after any change to routing or navigation.

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run verify                             # defaults to localhost:5173
npm run verify -- http://localhost:5174    # or point it at another port
```

It exits non-zero if anything fails, so it also works in CI. First run may need
the browser binary:

```bash
npx playwright install chromium
```

---

## 7. Deploying

Build first, then publish `dist/` to any static host.

```bash
npm run build
```

**Firebase Hosting:**

```bash
firebase deploy --only hosting
```

**Vercel / Netlify / GitHub Pages:** point the host at build command
`npm run build` and output directory `dist`.

Whichever host you use, add your production domain under **Firebase →
Authentication → Settings → Authorized domains**, or Google sign-in will be
rejected in production.

---

## 8. Data model (Firestore)

| Collection | Purpose | Write access |
|---|---|---|
| `users/{uid}` | Profiles (name, email, dept, year, acmMember, role, permissions) | owner (except `role`/`permissions`) or admin |
| `events` | Event catalogue | admin or `events` grant |
| `registrations` | Event sign-ups (denormalised user + event fields) | owner creates, admin manages |
| `execomGroups` | Committee, ordered by `order` | admin or `execom` grant |
| `siteContent` | Editable page copy | admin or `content` grant |
| `messages` | Contact messages + reply history | signed-in user creates as themselves, admin manages |
| `mail` | Outbound queue drained by the Trigger Email extension | admin only |
| `testimonials` | Alumni testimonials | admin |
| `gallery` | Photos for the "Life at the chapter" strip, one image per doc | admin or `content` grant |

Admins can hand out per-section edit grants from **Admin → Access**, letting a
member edit (say) only events without full admin rights.

---

## 9. Architecture notes

- **Auth** — `context/AuthContext.jsx`, dual-mode: real Firebase when configured, mock otherwise. Same API either way.
- **Public data** — `context/DataContext.jsx` renders mock data instantly, then overlays live Firestore when it arrives, so there is no loading flash.
- **Registrations** — `context/RegistrationsContext.jsx`, keyed to the real `uid`.
- **Data access** — every Firestore read/write is funnelled through `services/firestore.js`.
- **Routing** — `App.jsx` uses a keyed enter-only page transition. It deliberately avoids `AnimatePresence mode="wait"`, which deadlocks when a redirect changes the route key mid-exit and leaves the page blank until a refresh.
- **Scrolling** — Lenis drives smooth scroll (`lib/smoothScroll.jsx`). Clearance under the fixed navbar comes from each section's `scroll-mt-*` class, which Lenis already honours — do not add a manual offset on top of it.

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `command not found: npm` | Node isn't installed or not on PATH — install the LTS from nodejs.org and reopen the terminal. |
| Blank page, console mentions a module | Stop the server, `rm -rf node_modules`, `npm install`, `npm run dev`. |
| Firebase changes have no effect | Restart the dev server — Vite reads `.env` only at startup. |
| `[ACM] Firebase not configured` in the console | Expected on a fresh clone. The app is on mock data; add `.env` to go live. |
| Google sign-in fails in production | Add the domain under Firebase → Authentication → Settings → Authorized domains. |
| `npm run seed` errors on `.env` | Create `.env` first (`cp .env.example .env`) and fill in your values. |
| Animations stutter on a low-end machine | The WebGL backdrops are heavy; they respect `prefers-reduced-motion`, so enabling that in your OS disables them. |
| Admin replies never arrive | The Trigger Email extension isn't installed or its SMTP credentials are wrong — see §5a. Check the `mail` collection: a doc with a `delivery.error` field tells you what SMTP rejected. |
| "Permission denied" on the Messages tab | Only accounts with `role: "admin"` can read the inbox. Editor grants don't cover it. |

---

## Contributing

```bash
git checkout -b your-feature
# make changes
npm run build     # must pass
npm run verify    # must pass (dev server running in another terminal)
git commit -m "Describe your change"
git push -u origin your-feature
```

Then open a pull request on GitHub.

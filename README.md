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

**7. Lock the database down** with the strict rules in `firestore.rules`:

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

Order matters: seed first, grant yourself admin, *then* deploy the rules —
public content becomes admin-write-only once they are live.

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
| `testimonials` | Alumni testimonials | admin |
| `gallery` | Event photos | admin |

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

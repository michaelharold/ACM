# ACM TKMCE — Website & Event Management Portal

Premium, minimalist, fully responsive site for the ACM TKMCE Student Chapter, built to the SDD.

**Frontend:** React + Vite · Tailwind CSS · Framer Motion · Lucide · React Router
**Backend:** Firebase — Authentication (Google + email) + Cloud Firestore

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # serve the built app
```

The app runs with **zero backend** out of the box: with no Firebase config it
uses an in-memory mock layer (`src/data/mock.js`). Add config to go live.

## Backend setup (Firebase)

1. **Create a project** at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Sign-in method** → enable **Google** (and optionally **Email/Password**).
3. **Firestore Database → Create database** (start in **test mode**).
4. **Project settings → Your apps → Web app** → copy config into a `.env` file
   (see `.env.example`):

   ```
   VITE_FIREBASE_API_KEY=…
   VITE_FIREBASE_AUTH_DOMAIN=…
   VITE_FIREBASE_PROJECT_ID=…
   VITE_FIREBASE_STORAGE_BUCKET=…
   VITE_FIREBASE_MESSAGING_SENDER_ID=…
   VITE_FIREBASE_APP_ID=…
   ```

5. **Seed content** (events, execom, testimonials, gallery) while rules are open:

   ```bash
   npm run seed
   ```

6. **Lock down security** — deploy the strict rules (make yourself admin first,
   step 7):

   ```bash
   npm i -g firebase-tools && firebase login
   firebase deploy --only firestore:rules
   ```

7. **Grant admin** — sign in once (creates your `users/{uid}` doc), then in the
   Firestore console set that doc's `role` field to `"admin"`. The Admin
   Dashboard (`/admin`) unlocks for that account.

### Deploy the frontend (optional — Firebase Hosting)

```bash
npm run build
firebase deploy --only hosting
```

(Any static host works too — Vercel, Netlify, GitHub Pages. Add the domain
under **Authentication → Settings → Authorized domains**.)

## Data model (Firestore collections)

| Collection | Purpose | Write access |
|---|---|---|
| `users/{uid}` | Profiles (name, email, dept, year, acmMember, role) | owner (not `role`) / admin |
| `events` | Event catalogue | admin |
| `registrations` | Event sign-ups (denormalized user + event fields) | owner creates / admin |
| `execomGroups` | Committee, ordered by `order` | admin |
| `testimonials` | Alumni testimonials | admin |
| `gallery` | Event photos | admin |

## Architecture

- **Auth** — `context/AuthContext.jsx`, dual-mode (Firebase when configured, mock otherwise).
- **Public data** — `context/DataContext.jsx` renders mock instantly, overlays live Firestore.
- **Registrations** — `context/RegistrationsContext.jsx`, keyed to the real `uid`.
- **Data access** — all Firestore reads/writes in `services/firestore.js`.
- **Security** — `firestore.rules`; seed via `scripts/seed.mjs`.

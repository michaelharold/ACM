// One-off seeder: uploads the mock content (events, execom, testimonials,
// gallery) into Firestore so the live site has real data to render.
//
//   npm run seed
//
// Requirements:
//   • .env filled with your VITE_FIREBASE_* values
//   • Firestore rules temporarily in TEST MODE (open writes) OR run before
//     deploying the strict rules. Public content is admin-write only once
//     firestore.rules is deployed, so seed first, then lock down.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'
import { events, execomGroups, testimonials, gallery } from '../src/data/mock.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Minimal .env parser (no dotenv dependency).
const env = Object.fromEntries(
  readFileSync(join(__dirname, '../.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})
const db = getFirestore(app)
const strip = ({ id, ...rest }) => rest

async function run() {
  if (!env.VITE_FIREBASE_PROJECT_ID) {
    throw new Error('Missing Firebase config in .env')
  }
  console.log(`Seeding project "${env.VITE_FIREBASE_PROJECT_ID}"…`)

  for (const e of events) await setDoc(doc(db, 'events', e.id), strip(e))
  console.log(`  ✔ events (${events.length})`)

  await Promise.all(
    execomGroups.map((g, i) => setDoc(doc(db, 'execomGroups', `g${String(i).padStart(2, '0')}`), { ...g, order: i })),
  )
  console.log(`  ✔ execomGroups (${execomGroups.length})`)

  for (const t of testimonials) await setDoc(doc(db, 'testimonials', t.id), strip(t))
  console.log(`  ✔ testimonials (${testimonials.length})`)

  for (const im of gallery) await setDoc(doc(db, 'gallery', im.id), strip(im))
  console.log(`  ✔ gallery (${gallery.length})`)

  console.log('\nDone. You can now deploy the strict Firestore rules.')
  process.exit(0)
}

run().catch((err) => {
  console.error('Seed failed:', err.message || err)
  process.exit(1)
})

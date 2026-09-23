import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth'
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore'

// Config is read from Vite env vars (see .env.example). If they're absent,
// the whole app transparently falls back to the in-memory mock layer, so
// `npm run dev` keeps working with zero setup.
const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(cfg.apiKey && cfg.projectId && cfg.appId)

let app = null
let auth = null
let db = null
let googleProvider = null

if (isFirebaseConfigured) {
  app = initializeApp(cfg)
  auth = getAuth(app)
  // ignoreUndefinedProperties: a single `undefined` field (e.g. an optional
  // photo/bio left unset) otherwise makes setDoc throw `invalid-argument`, which
  // the admin UI used to surface as a misleading "team too large" error.
  db = initializeFirestore(app, { ignoreUndefinedProperties: true })
  googleProvider = new GoogleAuthProvider()
  googleProvider.setCustomParameters({ prompt: 'select_account' })

  // Local end-to-end testing: `npm run dev:emu` points the app at the Auth +
  // Firestore emulators so payment flows can be exercised without touching
  // production data. Dev builds only; the test script signs in via the hook.
  if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === '1') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
    window.__acmSignIn = (email, password) => signInWithEmailAndPassword(auth, email, password)
  }
} else if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.info('[ACM] Firebase not configured — running on mock data. Add VITE_FIREBASE_* to .env to go live.')
}

export { app, auth, db, googleProvider }

import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider, isFirebaseConfigured } from '../lib/firebase'
import { updateUserProfile } from '../services/firestore'

const AuthContext = createContext(null)

// Default profile fields for a freshly created user.
const defaultProfile = (partial = {}) => ({
  name: 'ACM Member',
  email: '',
  avatar: '',
  department: '',
  year: '',
  acmMember: false,
  role: 'user',
  // Per-section edit grants an admin can hand out: { events, execom, content }
  permissions: {},
  ...partial,
})

// ── Firestore profile helpers (live mode) ────────────────────
async function ensureProfile(fbUser, extra = {}) {
  const ref = doc(db, 'users', fbUser.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return { id: fbUser.uid, ...snap.data() }

  const profile = defaultProfile({
    name: fbUser.displayName || extra.name || 'ACM Member',
    email: fbUser.email || '',
    avatar: fbUser.photoURL || '',
    ...extra,
    createdAt: serverTimestamp(),
  })
  await setDoc(ref, profile)
  return { id: fbUser.uid, ...profile }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (isFirebaseConfigured) return null
    try {
      const raw = localStorage.getItem('acm-user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(isFirebaseConfigured)

  // Live mode: subscribe to Firebase auth state and hydrate the profile.
  useEffect(() => {
    if (!isFirebaseConfigured) return
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          setUser(await ensureProfile(fbUser))
        } catch {
          setUser({ id: fbUser.uid, ...defaultProfile({ name: fbUser.displayName, email: fbUser.email, avatar: fbUser.photoURL }) })
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  // Mock mode: persist the fake session.
  useEffect(() => {
    if (isFirebaseConfigured) return
    if (user) localStorage.setItem('acm-user', JSON.stringify(user))
    else localStorage.removeItem('acm-user')
  }, [user])

  // ── Public API (identical shape in both modes) ─────────────
  const mockUser = (partial) =>
    setUser({
      id: 'u_local',
      name: 'Aparna Menon',
      email: 'aparna@tkmce.ac.in',
      avatar: 'https://i.pravatar.cc/150?img=47',
      department: 'Computer Science & Engineering',
      year: '3rd Year',
      acmMember: true,
      role: 'user',
      permissions: {},
      ...partial,
    })

  async function signInWithGoogle() {
    if (!isFirebaseConfigured) return mockUser({})
    const res = await signInWithPopup(auth, googleProvider)
    return ensureProfile(res.user)
  }

  async function signInWithEmail(email, password) {
    if (!isFirebaseConfigured) return mockUser({ email })
    const res = await signInWithEmailAndPassword(auth, email, password)
    return ensureProfile(res.user)
  }

  async function signUpWithEmail(email, password, name) {
    if (!isFirebaseConfigured) return mockUser({ email, name })
    const res = await createUserWithEmailAndPassword(auth, email, password)
    if (name) await updateProfile(res.user, { displayName: name })
    return ensureProfile(res.user, { name })
  }

  // Demo-only admin shortcut (mock mode). In live mode, admin is granted by
  // the user's Firestore `role` field.
  const loginAsAdmin = () => {
    if (isFirebaseConfigured) return
    mockUser({ name: 'Admin', email: 'admin@acmtkmce.org', role: 'admin', acmMember: true })
  }

  // Demo-only editor shortcut (mock mode): a member with partial edit access.
  const loginAsEditor = () => {
    if (isFirebaseConfigured) return
    mockUser({
      name: 'Parthiv P',
      email: 'design@acmtkmce.org',
      role: 'user',
      permissions: { events: true, execom: true },
    })
  }

  // Self-service profile edit from the dashboard. Persists in live mode and
  // updates local state either way so the UI reflects it immediately.
  async function saveProfile(patch) {
    if (!user) return
    const clean = await updateUserProfile(user.id, { ...user, ...patch })
    if (isFirebaseConfigured && auth.currentUser && clean.name !== auth.currentUser.displayName) {
      await updateProfile(auth.currentUser, { displayName: clean.name })
    }
    setUser((u) => ({ ...u, ...clean }))
  }

  async function logout() {
    if (isFirebaseConfigured) await signOut(auth)
    else setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthed: !!user,
        isLive: isFirebaseConfigured,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        loginAsAdmin,
        loginAsEditor,
        saveProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

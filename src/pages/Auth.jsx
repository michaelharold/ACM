import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, User as UserIcon, ArrowRight, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react'
import { Logo } from '../components/Logo'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { chapter } from '../data/mock'

function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

function friendlyError(err) {
  const code = err?.code || ''
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return 'Sign-in was cancelled.'
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Incorrect email or password.'
  if (code.includes('user-not-found')) return 'No account found for that email.'
  if (code.includes('email-already-in-use')) return 'An account already exists for that email.'
  if (code.includes('weak-password')) return 'Password should be at least 6 characters.'
  if (code.includes('popup-blocked')) return 'Popup blocked — allow popups and try again.'
  return err?.message?.replace('Firebase: ', '') || 'Something went wrong. Please try again.'
}

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, isLive } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/dashboard'

  async function handleGoogle() {
    setError('')
    setLoading(true)
    try {
      await signInWithGoogle()
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleEmail(e) {
    e.preventDefault()
    setError('')
    const data = Object.fromEntries(new FormData(e.currentTarget))
    setLoading(true)
    try {
      if (mode === 'signup') await signUpWithEmail(data.email, data.password, data.name)
      else await signInWithEmail(data.email, data.password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left — brand panel */}
      <div className="relative hidden overflow-hidden bg-neutral-950 lg:block">
        <div className="bg-grid absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -left-20 top-1/3 h-96 w-96 rounded-full bg-acm-600/30 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link to="/" className="[&_span]:!text-white [&_.text-neutral-400]:!text-neutral-500">
            <Logo />
          </Link>
          <div>
            <Sparkles className="h-8 w-8 text-acm-400" />
            <h2 className="mt-6 max-w-sm text-3xl font-bold leading-tight tracking-tight">
              One account for every ACM TKMCE event.
            </h2>
            <p className="mt-4 max-w-sm text-neutral-400">
              Sign in to register for events, track your registrations, and manage your profile — all in one place.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <ShieldCheck className="h-4 w-4 text-acm-400" /> Secured with Google Authentication
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center px-5 py-24 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link to="/">
              <Logo />
            </Link>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {mode === 'login' ? 'Sign in to continue to ACM TKMCE.' : 'Join the chapter and start registering for events.'}
          </p>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 flex items-start gap-2.5 overflow-hidden rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Google (primary) */}
          <Button
            variant="outline"
            size="lg"
            onClick={handleGoogle}
            disabled={loading}
            className="mt-6 w-full"
          >
            <GoogleIcon className="h-5 w-5" />
            {loading ? 'Signing in…' : `Continue with Google`}
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-neutral-400">
            <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
            or use email
            <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          </div>

          {/* Email fallback */}
          <form onSubmit={handleEmail} className="grid gap-4">
            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <Input label="Full name" name="name" placeholder="Your name" icon={UserIcon} required />
                </motion.div>
              )}
            </AnimatePresence>
            <Input label="Email" name="email" type="email" placeholder="you@tkmce.ac.in" icon={Mail} required />
            <Input label="Password" name="password" type="password" placeholder="••••••••" icon={Lock} required />
            <Button type="submit" size="lg" disabled={loading} className="mt-1 w-full">
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="font-semibold text-acm-600 hover:underline dark:text-acm-400"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          <p className="mt-8 text-center text-xs text-neutral-400">
            {isLive
              ? `Secured by Firebase Authentication · ${chapter.name}`
              : `Demo mode — add Firebase config to go live (${chapter.name} uses Google Sign-In).`}
          </p>
        </div>
      </div>
    </div>
  )
}

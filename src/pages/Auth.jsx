import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ShieldCheck, Sparkles, AlertCircle, CalendarCheck, Ticket, UserCircle2 } from 'lucide-react'
import { Logo } from '../components/Logo'
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
  if (code.includes('popup-blocked')) return 'Popup blocked — allow popups for this site and try again.'
  if (code.includes('network-request-failed')) return 'Network error — check your connection and try again.'
  if (code.includes('unauthorized-domain')) return 'This domain is not authorised for sign-in yet.'
  return err?.message?.replace('Firebase: ', '') || 'Something went wrong. Please try again.'
}

const perks = [
  { icon: CalendarCheck, text: 'Register for workshops, talks and hackathons' },
  { icon: Ticket, text: 'Track every registration in one dashboard' },
  { icon: UserCircle2, text: 'Keep your chapter profile up to date' },
]

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signInWithGoogle, isAuthed, loading: authLoading, isLive } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/dashboard'

  // Already signed in (or the session restores while sitting here) — move on.
  useEffect(() => {
    if (!authLoading && isAuthed) navigate(redirectTo, { replace: true })
  }, [authLoading, isAuthed, navigate, redirectTo])

  async function handleGoogle() {
    setError('')
    setLoading(true)
    try {
      await signInWithGoogle()
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(friendlyError(err))
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
          <Link to="/" className="w-fit [&_span]:!text-white [&_.text-neutral-400]:!text-neutral-500">
            <Logo />
          </Link>
          <div>
            <Sparkles className="h-8 w-8 text-acm-400" />
            <h2 className="mt-6 max-w-sm text-3xl font-bold leading-tight tracking-tight">
              One account for every ACM TKMCE event.
            </h2>
            <ul className="mt-8 grid gap-3">
              {perks.map((p) => (
                <li key={p.text} className="flex items-center gap-3 text-sm text-neutral-300">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-acm-400">
                    <p.icon className="h-4 w-4" />
                  </span>
                  {p.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <ShieldCheck className="h-4 w-4 text-acm-400" /> Secured with Google Authentication
          </div>
        </div>
      </div>

      {/* Right — sign in */}
      <div className="relative flex items-center justify-center px-5 py-16 sm:px-8">
        {/* The global navbar is hidden here, so this route carries its own way back. */}
        <Link
          to="/"
          className="absolute left-5 top-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900 sm:left-8 dark:text-neutral-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to site
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Link to="/" className="inline-block">
              <Logo />
            </Link>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Sign in to ACM TKMCE</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Continue with your Google account. New here? Signing in creates your chapter profile automatically.
          </p>

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

          <Button
            variant="outline"
            size="lg"
            onClick={handleGoogle}
            disabled={loading}
            className="mt-8 w-full"
          >
            <GoogleIcon className="h-5 w-5" />
            {loading ? 'Opening Google…' : 'Continue with Google'}
          </Button>

          <p className="mt-6 text-center text-xs leading-relaxed text-neutral-400">
            By continuing you agree to take part in {chapter.name} activities under the chapter code of conduct.
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

import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Linkedin, Instagram, Send, CheckCircle2, ArrowUpRight, LogIn, ShieldCheck, AlertCircle } from 'lucide-react'
import { SectionHeading } from '../SectionHeading'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { LazyBackdrop } from '../ui/LazyBackdrop'
import Threads from '../reactbits/Threads'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { createMessage } from '../../services/firestore'
import { avatarDataUri } from '../../lib/avatar'
import { chapter } from '../../data/mock'

const channels = [
  { label: 'Email', value: chapter.socials.email, href: `mailto:${chapter.socials.email}`, Icon: Mail },
  { label: 'LinkedIn', value: '/company/acm-tkmce', href: chapter.socials.linkedin, Icon: Linkedin },
  { label: 'Instagram', value: '@acm_tkmce', href: chapter.socials.instagram, Icon: Instagram },
]

export function Contact() {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const { theme } = useTheme()
  const { user, isAuthed, loading } = useAuth()
  const { pathname } = useLocation()
  // White threads read on the dark canvas; brand blue on light.
  const threadColor = theme === 'dark' ? [1, 1, 1] : [0.12, 0.28, 0.96]

  async function onSubmit(e) {
    e.preventDefault()
    if (!user) return
    const data = Object.fromEntries(new FormData(e.currentTarget))
    const body = data.message.trim()
    if (!body) return
    setError('')
    setSending(true)
    try {
      // Identity is taken from the session, never from the form — the Firestore
      // rules reject anything whose userEmail isn't the caller's own.
      await createMessage({
        uid: user.id,
        name: user.name || 'ACM Member',
        email: user.email,
        subject: data.subject?.trim(),
        body,
      })
      e.target.reset()
      setSent(true)
      setTimeout(() => setSent(false), 6000)
    } catch (err) {
      setError(err?.message?.replace('Firebase: ', '') || 'Could not send your message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section id="contact" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-28">
      {/* Flowing threads that bend toward the cursor */}
      <LazyBackdrop className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] opacity-40 dark:opacity-55">
        <Threads amplitude={1} distance={0} enableMouseInteraction color={threadColor} />
      </LazyBackdrop>

      <div className="section-shell relative">
        <SectionHeading eyebrow="Contact" title="Let’s connect" description="Questions, collaborations, or want to join a team? Reach out — we reply fast." />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {/* Channels */}
          {/* Three channels: paired on tablet, a clean stack beside the form on desktop */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:content-start">
            {channels.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target={c.href.startsWith('http') ? '_blank' : undefined}
                rel="noreferrer"
                className="group flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5 transition-colors hover:border-acm-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-acm-500/40"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-neutral-200 bg-neutral-50 text-acm-600 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-acm-400">
                  <c.Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{c.label}</span>
                  <span className="block truncate text-sm text-neutral-500 dark:text-neutral-400">{c.value}</span>
                </span>
                <ArrowUpRight className="ml-auto h-4 w-4 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-acm-500" />
              </a>
            ))}
          </div>

          {/* Message form — sign-in gated so every message has a verified sender */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 dark:border-neutral-800 dark:bg-neutral-900">
            {loading ? (
              <div className="grid h-64 place-items-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-neutral-200 border-t-acm-600 dark:border-neutral-800 dark:border-t-acm-500" />
              </div>
            ) : !isAuthed ? (
              <div className="flex h-full flex-col items-center justify-center py-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-neutral-200 bg-neutral-50 text-acm-500 dark:border-neutral-800 dark:bg-neutral-800/60">
                  <LogIn className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-bold tracking-tight">Sign in to send a message</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                  We ask you to sign in with Google so every message carries a verified email we can actually reply to.
                </p>
                <Button as={Link} to="/auth" state={{ from: pathname }} size="lg" className="mt-6">
                  Continue with Google <Send className="h-4 w-4" />
                </Button>
                <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-neutral-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> We never post anything on your behalf.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="grid gap-4">
                {/* Verified sender — read-only, straight from the session */}
                <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-800/40">
                  <img
                    src={user.avatar || avatarDataUri(user.name || 'ACM Member')}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{user.name || 'ACM Member'}</p>
                    <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{user.email}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </span>
                </div>

                <Input label="Subject" name="subject" placeholder="What's this about?" maxLength={120} />

                <div>
                  <label htmlFor="c-msg" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Message
                  </label>
                  <textarea
                    id="c-msg"
                    name="message"
                    rows={5}
                    required
                    maxLength={4000}
                    placeholder="How can we help?"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-acm-500 focus:outline-none focus:ring-4 focus:ring-acm-500/10 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2 overflow-hidden text-sm text-rose-500"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <Button type="submit" size="lg" className="w-full" disabled={sending || sent}>
                  {sent ? (
                    <motion.span initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Message sent
                    </motion.span>
                  ) : (
                    <>
                      {sending ? 'Sending…' : 'Send message'} <Send className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-neutral-400">
                  {sent
                    ? 'The team will reply to your email address.'
                    : `We'll reply to ${user.email}.`}
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

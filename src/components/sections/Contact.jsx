import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Linkedin, Github, Instagram, Send, CheckCircle2, ArrowUpRight } from 'lucide-react'
import { SectionHeading } from '../SectionHeading'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { LazyBackdrop } from '../ui/LazyBackdrop'
import Threads from '../reactbits/Threads'
import { useTheme } from '../../context/ThemeContext'
import { chapter } from '../../data/mock'

const channels = [
  { label: 'Email', value: chapter.socials.email, href: `mailto:${chapter.socials.email}`, Icon: Mail },
  { label: 'LinkedIn', value: '/acmtkmce', href: chapter.socials.linkedin, Icon: Linkedin },
  { label: 'GitHub', value: '/acmtkmce', href: chapter.socials.github, Icon: Github },
  { label: 'Instagram', value: '@acmtkmce', href: chapter.socials.instagram, Icon: Instagram },
]

export function Contact() {
  const [sent, setSent] = useState(false)
  const { theme } = useTheme()
  // White threads read on the dark canvas; brand blue on light.
  const threadColor = theme === 'dark' ? [1, 1, 1] : [0.12, 0.28, 0.96]

  function onSubmit(e) {
    e.preventDefault()
    setSent(true)
    setTimeout(() => setSent(false), 4000)
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
          <div className="grid gap-3 sm:grid-cols-2 lg:content-start">
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

          {/* Form */}
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="grid gap-4">
              <Input label="Name" name="name" placeholder="Your name" required />
              <Input label="Email" name="email" type="email" placeholder="you@example.com" required />
              <div>
                <label htmlFor="c-msg" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Message
                </label>
                <textarea
                  id="c-msg"
                  name="message"
                  rows={4}
                  required
                  placeholder="How can we help?"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-acm-500 focus:outline-none focus:ring-4 focus:ring-acm-500/10 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={sent}>
                {sent ? (
                  <motion.span initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Message sent
                  </motion.span>
                ) : (
                  <>
                    Send message <Send className="h-4 w-4" />
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-neutral-400">This is a demo form — submissions aren’t stored.</p>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}

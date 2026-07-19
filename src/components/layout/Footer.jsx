import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowUpRight, ArrowUp, Mail } from 'lucide-react'
import { Logo } from '../Logo'
import { SocialLinks } from '../SocialLinks'
import { Magnetic } from '../ui/Magnetic'
import { scrollToTop } from '../../lib/smoothScroll'
import { chapter } from '../../data/mock'

const cols = [
  {
    title: 'Explore',
    links: [
      { label: 'About', to: '/#about' },
      { label: 'Goals', to: '/#goals' },
      { label: 'Execom', to: '/#execom' },
      { label: 'Events', to: '/events' },
    ],
  },
  {
    title: 'Engage',
    links: [
      { label: 'Testimonials', to: '/#testimonials' },
      { label: 'Contact', to: '/#contact' },
      { label: 'Login / Sign Up', to: '/auth' },
      { label: 'Dashboard', to: '/dashboard' },
    ],
  },
]

function FooterLink({ to, children }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-1 text-sm text-neutral-600 transition-all duration-300 hover:translate-x-1 hover:text-acm-600 dark:text-neutral-400 dark:hover:text-acm-400"
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
    </Link>
  )
}

export function Footer() {
  const ref = useRef(null)
  // Wordmark drifts sideways and lifts as the footer scrolls into view.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] })
  const markX = useTransform(scrollYProgress, [0, 1], [60, -30])
  const markOpacity = useTransform(scrollYProgress, [0, 0.6], [0, 1])

  return (
    <footer ref={ref} className="relative overflow-hidden border-t border-neutral-200 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/40">
      {/* Gradient hairline along the top edge */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-acm-500/60 to-transparent" />

      <div className="section-shell relative py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              {chapter.tagline}
            </p>
            <div className="mt-5 flex">
              <Magnetic strength={4}>
                <SocialLinks />
              </Magnetic>
            </div>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <FooterLink to={l.to}>{l.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Giant parallax wordmark */}
        <motion.div
          aria-hidden
          style={{ x: markX, opacity: markOpacity }}
          className="pointer-events-none mt-14 select-none whitespace-nowrap text-center text-[clamp(3.5rem,13vw,10rem)] font-extrabold leading-none tracking-tighter text-transparent [-webkit-text-stroke:1.5px_rgba(31,71,245,0.22)] dark:[-webkit-text-stroke:1.5px_rgba(89,142,255,0.25)]"
        >
          ACM TKMCE
        </motion.div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 pt-6 text-sm text-neutral-500 sm:flex-row dark:border-neutral-800">
          <p>© {new Date().getFullYear()} {chapter.name}. Est. {chapter.established}.</p>
          <div className="flex items-center gap-4">
            <a href={`mailto:${chapter.socials.email}`} className="inline-flex items-center gap-2 hover:text-acm-600 dark:hover:text-acm-400">
              <Mail className="h-4 w-4" /> {chapter.socials.email}
            </a>
            <Magnetic strength={6}>
              <motion.button
                onClick={() => scrollToTop()}
                aria-label="Back to top"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.92 }}
                className="grid h-10 w-10 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition-colors hover:border-acm-400 hover:text-acm-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-acm-500/50 dark:hover:text-acm-400"
              >
                <ArrowUp className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
              </motion.button>
            </Magnetic>
          </div>
        </div>
      </div>
    </footer>
  )
}

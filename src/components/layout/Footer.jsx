import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { Logo } from '../Logo'
import { SocialLinks } from '../SocialLinks'
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

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="section-shell py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              {chapter.tagline}
            </p>
            <SocialLinks className="mt-5" />
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="text-sm text-neutral-600 transition-colors hover:text-acm-600 dark:text-neutral-400 dark:hover:text-acm-400"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 pt-6 text-sm text-neutral-500 sm:flex-row dark:border-neutral-800">
          <p>© {new Date().getFullYear()} {chapter.name}. Est. {chapter.established}.</p>
          <a href={`mailto:${chapter.socials.email}`} className="inline-flex items-center gap-2 hover:text-acm-600 dark:hover:text-acm-400">
            <Mail className="h-4 w-4" /> {chapter.socials.email}
          </a>
        </div>
      </div>
    </footer>
  )
}

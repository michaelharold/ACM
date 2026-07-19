import { Megaphone } from 'lucide-react'
import { announcements } from '../data/mock'

// Slim infinite ticker of chapter updates, sitting between hero and about.
export function AnnouncementTicker() {
  const items = [...announcements, ...announcements]
  return (
    <div className="marquee-paused relative overflow-hidden border-y border-neutral-200 bg-neutral-50/80 py-3 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div style={{ '--marquee-duration': '36s' }} className="marquee-track flex w-max items-center gap-10 pr-10">
        {items.map((a, i) => (
          <span key={`${a.id}-${i}`} className="inline-flex items-center gap-2.5 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">
            <Megaphone className="h-3.5 w-3.5 text-acm-500" />
            <span className="rounded-full bg-acm-600/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-acm-600 dark:text-acm-400">
              {a.tag}
            </span>
            {a.text}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white to-transparent dark:from-neutral-950" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white to-transparent dark:from-neutral-950" />
    </div>
  )
}

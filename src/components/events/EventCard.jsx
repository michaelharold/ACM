import { motion } from 'framer-motion'
import { CalendarDays, MapPin, ArrowUpRight } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { fadeUp } from '../ui/Reveal'
import { statusMeta } from '../../data/mock'
import { formatDate } from '../../lib/format'

export function EventCard({ event, onOpen }) {
  const meta = statusMeta[event.status]
  return (
    <motion.button
      variants={fadeUp}
      layoutId={`event-${event.id}`}
      onClick={() => onOpen(event)}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left transition-colors hover:border-acm-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-acm-500/40"
    >
      {/* Poster */}
      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100 dark:bg-neutral-800">
        <img
          src={event.poster}
          alt={event.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3">
          <Badge tone={meta.tone} dot={event.status === 'open'} className="backdrop-blur bg-white/90 dark:bg-neutral-900/90">
            {meta.label}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="flex items-start justify-between gap-2 text-base font-semibold tracking-tight">
          {event.name}
          <ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-acm-500" />
        </h3>
        <p className="mt-2 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">{event.shortDescription}</p>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> {formatDate(event.date)} · {event.time}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {event.venue}
          </span>
        </div>
      </div>
    </motion.button>
  )
}

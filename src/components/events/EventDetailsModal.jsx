import { CalendarDays, Clock, MapPin, Wallet, Timer, CheckCircle2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { statusMeta } from '../../data/mock'
import { formatDateLong } from '../../lib/format'

function Fact({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-acm-600 shadow-sm dark:bg-neutral-800 dark:text-acm-400">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  )
}

export function EventDetailsModal({ event, open, onClose, onRegister, registered }) {
  if (!event) return null
  const meta = statusMeta[event.status]
  const canRegister = event.status === 'open' && !registered

  return (
    <Modal open={open} onClose={onClose} size="xl">
      {/* Banner */}
      <div className="relative aspect-[16/7] w-full overflow-hidden">
        <img src={event.poster} alt={event.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6">
          <div>
            <Badge tone={meta.tone} dot={event.status === 'open'} className="mb-3 bg-white/90 dark:bg-neutral-900/90">
              {meta.label}
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{event.name}</h2>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {/* Facts */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Fact icon={CalendarDays} label="Date" value={formatDateLong(event.date)} />
          <Fact icon={Clock} label="Time" value={event.time} />
          <Fact icon={MapPin} label="Venue" value={event.venue} />
          <Fact icon={Wallet} label="Fee" value={event.fee ? `₹${event.fee}` : 'Free'} />
        </div>

        {/* Description */}
        <section className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">About this event</h3>
          <p className="mt-3 text-pretty leading-relaxed text-neutral-600 dark:text-neutral-300">{event.description}</p>
        </section>

        {/* Speakers */}
        {event.speakers?.length > 0 && (
          <section className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Speakers & Mentors</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {event.speakers.map((s) => (
                <div key={s.name} className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                  <img src={s.photo} alt={s.name} className="h-11 w-11 rounded-full object-cover" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{s.name}</div>
                    <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {s.designation} · {s.organization}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Registration meta */}
        <section className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900/50">
          <span className="inline-flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
            <Timer className="h-4 w-4" /> Registration deadline: <strong className="text-neutral-800 dark:text-neutral-200">{formatDateLong(event.deadline)}</strong>
          </span>
        </section>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-neutral-200 bg-white/90 px-6 py-4 backdrop-blur sm:px-8 dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="text-sm">
          <div className="font-semibold">{event.fee ? `₹${event.fee}` : 'Free entry'}</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">{meta.label}</div>
        </div>
        {registered ? (
          <Button variant="outline" disabled className="!opacity-100">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Registered
          </Button>
        ) : (
          <Button disabled={!canRegister} onClick={() => onRegister?.(event)}>
            {event.status === 'open' ? 'Register Now' : meta.label}
          </Button>
        )}
      </div>
    </Modal>
  )
}

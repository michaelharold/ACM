import { CheckCircle2, CalendarDays, Clock, MapPin, Users, MessageCircle, ArrowUpRight } from 'lucide-react'
import { formatDate } from '../../lib/format'
import { paymentState, ticketCode } from '../../lib/manualPay'
import { whatsappLinkFor } from '../../lib/eventAccess'
import { useEventClock } from '../../lib/eventClock'
import { cn } from '../../lib/cn'

// A registration's event pass: ticket-shaped (notched sides + tear line) with a
// gold glow, and the holder's name in a green neon "Verified" box. Rendered
// only for registrations that are verified (paid) or free. `past` renders the
// pass from Events History: stamped "Event ended", without the WhatsApp prompt.
export function TicketCard({ reg, event, holderName, past = false }) {
  const verified = paymentState(reg) === 'verified'
  const code = ticketCode(reg.id)
  // Only while the event is upcoming, and only if an admin hasn't hidden it —
  // a hidden link leaves no trace on the ticket.
  const whatsapp = past ? '' : whatsappLinkFor(event)
  const { isLive, countdown } = useEventClock(event)
  return (
    <div className={cn('ticket-glow', past && 'opacity-90 saturate-[.7]')}>
      <div className="ticket-shape bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-600 p-[2px]">
        <div className="ticket-shape ticket-shape-inner relative overflow-hidden bg-neutral-950 text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-amber-400/15 blur-3xl" />
          {past && (
            <span className="pointer-events-none absolute right-4 top-11 rotate-[-10deg] rounded-md border-2 border-amber-300/70 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.25em] text-amber-200/90">
              Event ended
            </span>
          )}

          <div className="relative p-5">
            <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/90 sm:tracking-[0.25em]">
              <span className="min-w-0 truncate">ACM TKMCE · Event pass</span>
              <span className="shrink-0 whitespace-nowrap font-mono tracking-normal text-amber-200/80">{code}</span>
            </div>
            <h3 className={cn('mt-3 line-clamp-2 text-xl font-bold leading-tight tracking-tight', past && 'pr-24')}>{event.name}</h3>
            {!past && event.date && (isLive || countdown) && (
              <span className={cn(
                'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums',
                isLive ? 'bg-rose-500/15 text-rose-300' : 'bg-white/5 text-amber-200/90',
              )}>
                <span className={cn('h-1.5 w-1.5 rounded-full', isLive ? 'animate-pulse bg-rose-400' : 'bg-amber-300')} />
                {isLive ? 'Happening now' : `Starts in ${countdown}`}
              </span>
            )}

            <div className="mt-4 inline-flex max-w-full items-center gap-3 rounded-xl border border-emerald-400/80 bg-emerald-500/10 px-3.5 py-2.5 shadow-[0_0_14px_rgba(52,211,153,0.55),inset_0_0_12px_rgba(52,211,153,0.2)]">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/90">{verified ? 'Verified' : 'Confirmed'}</div>
                <div className="truncate font-semibold text-emerald-50 [text-shadow:0_0_10px_rgba(52,211,153,0.85)]">{holderName}</div>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <Detail icon={CalendarDays} label="Date" value={formatDate(event.date)} />
              <Detail icon={Clock} label="Time" value={event.time || '—'} />
              <Detail icon={MapPin} label="Venue" value={event.venue || '—'} className="col-span-2" />
              {reg.isTeam && <Detail icon={Users} label="Team" value={reg.teamName || 'Team'} className="col-span-2" />}
            </dl>

            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer noopener"
                className="group mt-5 flex items-center gap-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 transition-colors hover:border-emerald-300/80 hover:bg-emerald-500/15"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/20 text-emerald-300">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] leading-snug text-neutral-300">To get more updates, join the event’s WhatsApp group</span>
                  <span className="mt-0.5 block text-sm font-semibold text-emerald-200">Join WhatsApp group</span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            )}
          </div>

          {/* Tear line — sits exactly on the notches (91px above the bottom). */}
          <div className="relative mx-5 border-t-2 border-dashed border-white/15" />
          <div className="relative flex h-[89px] items-center justify-between gap-4 px-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-400">
                {reg.isTeam ? `Team of ${reg.teamSize || reg.members?.length || 1}` : 'Admit one'}
              </div>
              <div className="mt-1 font-mono text-lg font-bold tracking-wider text-amber-200">{code}</div>
            </div>
            <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
              {past ? 'Completed' : verified ? 'Paid · Verified' : 'Free entry'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Detail({ icon: Icon, label, value, className }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
        <Icon className="h-3 w-3" /> {label}
      </dt>
      <dd className="mt-0.5 truncate font-medium text-neutral-100">{value}</dd>
    </div>
  )
}

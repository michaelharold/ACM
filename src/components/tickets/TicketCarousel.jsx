import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Ticket } from 'lucide-react'
import { TicketCard } from './TicketCard'
import { cn } from '../../lib/cn'

// Swipeable row of event passes (scroll-snap), with arrows on wider screens and
// dots tracking whichever ticket is centred.
export function TicketCarousel({ items, holderName }) {
  const track = useRef(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const el = track.current
    if (!el) return
    const onScroll = () => {
      const mid = el.scrollLeft + el.clientWidth / 2
      let best = 0
      let bestDist = Infinity
      ;[...el.children].forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid)
        if (d < bestDist) { bestDist = d; best = i }
      })
      setActive(best)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [items.length])

  function go(i) {
    const el = track.current
    const card = el?.children[Math.max(0, Math.min(items.length - 1, i))]
    if (!card) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' })
  }

  if (!items.length) return null
  const many = items.length > 1

  return (
    <section className="mt-10" aria-label="My tickets">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Ticket className="h-5 w-5 text-amber-500" /> My tickets
        </h2>
        {many && (
          <div className="hidden gap-1.5 sm:flex">
            <button onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous ticket" className="grid h-9 w-9 place-items-center rounded-full border border-neutral-200 transition-colors hover:border-amber-400 disabled:opacity-30 dark:border-neutral-800">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => go(active + 1)} disabled={active === items.length - 1} aria-label="Next ticket" className="grid h-9 w-9 place-items-center rounded-full border border-neutral-200 transition-colors hover:border-amber-400 disabled:opacity-30 dark:border-neutral-800">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={track}
        className="relative -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map(({ reg, event }) => (
          <div key={reg.id} className="w-[86%] max-w-[380px] shrink-0 snap-center sm:w-[360px]">
            <TicketCard reg={reg} event={event} holderName={holderName} />
          </div>
        ))}
      </div>

      {many && (
        <div className="mt-1 flex justify-center gap-1.5">
          {items.map(({ reg }, i) => (
            <button
              key={reg.id}
              onClick={() => go(i)}
              aria-label={`Ticket ${i + 1}`}
              className={cn('h-1.5 rounded-full transition-all', i === active ? 'w-5 bg-amber-500' : 'w-1.5 bg-neutral-300 dark:bg-neutral-700')}
            />
          ))}
        </div>
      )}
    </section>
  )
}

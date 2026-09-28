import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'
import { ChevronLeft, ChevronRight, Ticket } from 'lucide-react'
import { TicketCard } from './TicketCard'
import { cn } from '../../lib/cn'
import { project, rubberband, nearest } from '../../lib/motion'

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// scrollLeft that centres each card — the carousel's snap points.
const snapPoints = (el) => [...el.children].map((c) => Math.max(0, Math.min(el.scrollWidth - el.clientWidth, c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2)))

// Glide the track to `to`, starting at the hand's speed (a spring on
// scrollLeft); scroll-snap stays off until it lands exactly on a snap point.
function glide(el, to, velocity = 0) {
  if (reducedMotion()) {
    el.scrollLeft = to
    return
  }
  el.style.scrollSnapType = 'none'
  return animate(el.scrollLeft, to, {
    type: 'spring',
    bounce: 0,
    duration: 0.55,
    velocity,
    onUpdate: (v) => { el.scrollLeft = v },
    onComplete: () => { el.style.scrollSnapType = '' },
  })
}

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

  // Mouse drag with momentum (touch already swipes natively): tracks 1:1 after
  // a 6px dead zone — so a click on a ticket's link still works — rubber-bands
  // at the ends, and on release projects the flick forward to the nearest
  // ticket, handing the hand's speed to the glide.
  useEffect(() => {
    const el = track.current
    if (!el) return
    let start = null
    let dragged = false
    let glideAnim = null
    const history = []
    const max = () => el.scrollWidth - el.clientWidth

    const down = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      glideAnim?.stop()
      start = { x: e.clientX, scroll: el.scrollLeft, id: e.pointerId }
      dragged = false
      history.length = 0
    }
    const move = (e) => {
      if (!start || e.pointerId !== start.id) return
      const dx = e.clientX - start.x
      if (!dragged) {
        if (Math.abs(dx) < 6) return
        dragged = true
        el.setPointerCapture(e.pointerId)
        el.style.scrollSnapType = 'none'
        el.style.cursor = 'grabbing'
      }
      const want = start.scroll - dx
      const over = want < 0 ? want : want > max() ? want - max() : 0
      el.scrollLeft = Math.max(0, Math.min(max(), want))
      el.style.transform = over ? `translateX(${-rubberband(over, el.clientWidth)}px)` : ''
      history.push({ x: e.clientX, t: e.timeStamp })
      while (history.length > 1 && e.timeStamp - history[0].t > 100) history.shift()
    }
    const up = (e) => {
      if (!start || e.pointerId !== start.id) return
      start = null
      el.style.cursor = ''
      if (!dragged) return
      // Spring the rubber-banded edge back into place.
      if (el.style.transform) {
        el.style.transition = 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)'
        el.style.transform = ''
        setTimeout(() => { el.style.transition = '' }, 360)
      }
      const a = history[0]
      const b = history[history.length - 1]
      const dt = b && a && b.t > a.t ? (b.t - a.t) / 1000 : 0
      const velocity = dt ? -(b.x - a.x) / dt : 0 // scroll px/s
      const target = nearest(snapPoints(el), el.scrollLeft + project(velocity, 0.995))
      glideAnim = glide(el, target, velocity)
    }
    // A drag must not also count as a click on whatever ticket is under it.
    const click = (e) => {
      if (dragged) {
        e.preventDefault()
        e.stopPropagation()
        dragged = false
      }
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('click', click, true)
    return () => {
      glideAnim?.stop()
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('click', click, true)
    }
  }, [items.length])

  function go(i) {
    const el = track.current
    if (!el) return
    const points = snapPoints(el)
    const to = points[Math.max(0, Math.min(points.length - 1, i))]
    if (to != null) glide(el, to)
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
            <button onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous ticket" className="grid h-9 w-9 place-items-center rounded-full border border-neutral-200 transition-[border-color,transform] duration-150 hover:border-amber-400 active:scale-90 disabled:opacity-30 dark:border-neutral-800">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => go(active + 1)} disabled={active === items.length - 1} aria-label="Next ticket" className="grid h-9 w-9 place-items-center rounded-full border border-neutral-200 transition-[border-color,transform] duration-150 hover:border-amber-400 active:scale-90 disabled:opacity-30 dark:border-neutral-800">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={track}
        className="relative -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 py-5 [scrollbar-width:none] sm:cursor-grab [&::-webkit-scrollbar]:hidden [&_a]:cursor-pointer"
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

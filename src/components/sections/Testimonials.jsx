import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react'
import { SectionHeading } from '../SectionHeading'
import { useData } from '../../context/DataContext'
import { cn } from '../../lib/cn'

const variants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -60 : 60 }),
}

export function Testimonials() {
  const { testimonials } = useData()
  const [[index, dir], setState] = useState([0, 0])
  const [paused, setPaused] = useState(false)
  const count = testimonials.length
  const active = testimonials[index] || testimonials[0]

  const go = useCallback(
    (next) => setState(([i]) => [((next % count) + count) % count, next > i ? 1 : -1]),
    [count],
  )

  useEffect(() => {
    if (paused || count === 0) return
    const t = setInterval(() => setState(([i]) => [(i + 1) % count, 1]), 5500)
    return () => clearInterval(t)
  }, [paused, count])

  // Nothing added yet — hide the section rather than render an empty carousel.
  if (count === 0) return null

  return (
    <section
      id="testimonials"
      className="scroll-mt-24 border-y border-neutral-200 bg-neutral-50/60 py-24 sm:py-28 dark:border-neutral-800 dark:bg-neutral-900/30"
    >
      <div className="section-shell">
        <SectionHeading
          eyebrow="Testimonials"
          title="Where our alumni landed"
          description="Graduates who cut their teeth at ACM TKMCE — now building at some of the best teams in the world."
        />

        <div
          className="relative mx-auto mt-14 max-w-3xl"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-8 sm:p-12 dark:border-neutral-800 dark:bg-neutral-900">
            <Quote className="absolute right-8 top-8 h-16 w-16 text-neutral-100 dark:text-neutral-800" />
            <div className="relative min-h-[190px]">
              <AnimatePresence mode="wait" custom={dir}>
                <motion.figure
                  key={active.id}
                  custom={dir}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.25}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -70) go(index + 1)
                    else if (info.offset.x > 70) go(index - 1)
                  }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <blockquote className="text-pretty text-lg font-medium leading-relaxed text-neutral-800 sm:text-xl dark:text-neutral-100">
                    “{active.quote}”
                  </blockquote>
                  <figcaption className="mt-8 flex items-center gap-4">
                    <img src={active.photo} alt={active.name} className="h-12 w-12 rounded-full object-cover ring-2 ring-white dark:ring-neutral-800" />
                    <div>
                      <div className="font-semibold tracking-tight">{active.name}</div>
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">
                        {active.designation} · <span className="text-acm-600 dark:text-acm-400">{active.organization}</span>
                      </div>
                    </div>
                  </figcaption>
                </motion.figure>
              </AnimatePresence>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={() => go(index - 1)}
              aria-label="Previous"
              className="grid h-10 w-10 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition-colors hover:border-acm-400 hover:text-acm-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  aria-label={`Go to testimonial ${i + 1}`}
                  className={cn(
                    'h-2 rounded-full transition-all duration-300',
                    i === index ? 'w-6 bg-acm-600' : 'w-2 bg-neutral-300 hover:bg-neutral-400 dark:bg-neutral-700',
                  )}
                />
              ))}
            </div>
            <button
              onClick={() => go(index + 1)}
              aria-label="Next"
              className="grid h-10 w-10 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition-colors hover:border-acm-400 hover:text-acm-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

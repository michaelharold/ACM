import { useState } from 'react'
import { motion } from 'framer-motion'
import { SectionHeading } from '../SectionHeading'
import { Reveal, Item } from '../ui/Reveal'
import { LazyBackdrop } from '../ui/LazyBackdrop'
import MagicRings from '../reactbits/MagicRings'
import { iconMap } from '../../lib/icons'
import { goals } from '../../data/mock'
import { cn } from '../../lib/cn'

export function Goals() {
  const [active, setActive] = useState(0)

  return (
    <section id="goals" className="relative scroll-mt-24 overflow-hidden border-y border-neutral-200 bg-neutral-50/60 py-24 sm:py-28 dark:border-neutral-800 dark:bg-neutral-900/30">
      {/* Concentric magic rings radiating behind the three pillars */}
      <LazyBackdrop className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-70">
        <MagicRings
          color="#1f47f5"
          colorTwo="#8a5cff"
          ringCount={6}
          speed={0.85}
          attenuation={10}
          lineThickness={2}
          baseRadius={0.35}
          radiusStep={0.1}
          scaleRate={0.1}
          opacity={1}
          blur={0}
          noiseAmount={0.06}
          rotation={0}
          ringGap={1.5}
          fadeIn={0.7}
          fadeOut={0.5}
          followMouse
          mouseInfluence={0.18}
          hoverScale={1.15}
          parallax={0.05}
          clickBurst
        />
      </LazyBackdrop>

      <div className="section-shell relative">
        <SectionHeading
          eyebrow="Our Goals"
          title="What we point every event toward"
          description="Three pillars keep the chapter honest — a clear picture of where we’re going, how we get there, and what we refuse to compromise on."
        />

        <Reveal className="mt-14 grid gap-4 md:grid-cols-3" amount={0.15}>
          {goals.map((g, i) => {
            const Icon = iconMap[g.icon]
            const isActive = active === i
            return (
              <Item key={g.key}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className={cn(
                    'group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border p-7 text-left',
                    // The hovered pillar lifts and grows out of the row; z-10 keeps
                    // it above its neighbours while it does.
                    'transition-[transform,box-shadow,border-color,background-color] duration-300 ease-out will-change-transform',
                    isActive
                      ? 'z-10 scale-[1.04] border-acm-300 bg-white shadow-xl shadow-acm-900/5 dark:border-acm-500/40 dark:bg-neutral-900 dark:shadow-black/40'
                      : 'scale-100 border-neutral-200 bg-white/60 shadow-none dark:border-neutral-800 dark:bg-neutral-900/50',
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="goal-accent"
                      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                      className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-acm-600 to-acm-400"
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <div
                      className={cn(
                        'grid h-12 w-12 place-items-center rounded-xl border transition-colors duration-300',
                        isActive
                          ? 'border-acm-200 bg-acm-50 text-acm-600 dark:border-acm-500/30 dark:bg-acm-500/10 dark:text-acm-400'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-800/60',
                      )}
                    >
                      {Icon && <Icon className="h-6 w-6" />}
                    </div>
                    <span className="text-5xl font-extrabold tracking-tighter text-neutral-100 transition-colors group-hover:text-acm-100 dark:text-neutral-800 dark:group-hover:text-acm-500/20">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-bold tracking-tight">{g.key}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{g.text}</p>
                </button>
              </Item>
            )
          })}
        </Reveal>
      </div>
    </section>
  )
}

import { motion } from 'framer-motion'
import { ArrowUpRight, CalendarClock } from 'lucide-react'
import { SectionHeading } from '../SectionHeading'
import { TiltCard } from '../ui/Card'
import { Reveal, Item } from '../ui/Reveal'
import { LazyBackdrop } from '../ui/LazyBackdrop'
import ColorBends from '../reactbits/ColorBends'
import ScrollFloat from '../reactbits/ScrollFloat'
import { useCountUp } from '../../lib/useCountUp'
import { iconMap } from '../../lib/icons'
import { useData } from '../../context/DataContext'
import { chapter } from '../../data/mock'

function StatCard({ stat }) {
  const [ref, value] = useCountUp(stat.value)
  return (
    <Item
      ref={ref}
      // Translucent so the shared colour-bend field reads through the cards
      // instead of the section looking like patches over a background.
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/50 p-6 text-center backdrop-blur-md"
    >
      <div className="text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl dark:text-white">
        {value}
        <span className="text-acm-500">{stat.suffix}</span>
      </div>
      <div className="mt-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">{stat.label}</div>
    </Item>
  )
}

export function About() {
  // Stats, establishment year and the "why join" cards are admin-editable.
  const { content } = useData()
  const stats = content.stats
  const established = content.established
  const whyJoin = content.whyJoin
  return (
    <section id="about" className="relative scroll-mt-24 overflow-hidden">
      {/* One colour-bend field spans the whole section — the "Think. Build. Ship."
          band and the about content below it now share this single background
          instead of each carrying its own. */}
      <LazyBackdrop className="pointer-events-none absolute inset-0">
        <ColorBends
          // Brand palette: acm-600 core, acm-400 light, and the violet already
          // used by MagicRings and the Explore cards as the secondary accent.
          colors={['#1f47f5', '#598eff', '#8a5cff']}
          rotation={90}
          speed={0.2}
          scale={1}
          frequency={1}
          warpStrength={1}
          mouseInfluence={0.9}
          noise={0.15}
          parallax={2}
          iterations={1}
          intensity={1.5}
          bandWidth={6}
          transparent
        />
      </LazyBackdrop>
      {/* Scrim: keeps body copy legible over the moving colour without hiding it */}
      <div className="pointer-events-none absolute inset-0 bg-neutral-950/55" />
      {/* Feather the seams into the sections above and below */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-neutral-950 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-neutral-950 to-transparent" />

      {/* Merged band — the headline that used to be its own Lightfall section */}
      <div className="relative z-10 flex min-h-[300px] items-center justify-center px-5 pb-4 pt-20 sm:min-h-[360px]">
        <ScrollFloat
          animationDuration={1}
          ease="back.inOut(2)"
          scrollStart="center bottom+=50%"
          scrollEnd="bottom bottom-=40%"
          stagger={0.03}
          containerClassName="text-center"
          textClassName="text-white"
        >
          Think. Build. Ship.
        </ScrollFloat>
      </div>

      <div className="section-shell relative z-10 pb-24 sm:pb-28">
        <SectionHeading
          eyebrow="About"
          title={content.aboutTitle}
          description={`${chapter.fullName}. Since ${established}, we’ve turned curious first-years into confident engineers through relentless hands-on learning.`}
        />

        {/* Establishment + statistics */}
        <Reveal className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" amount={0.2}>
          <Item className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-acm-500/40 bg-gradient-to-br from-acm-600/85 to-acm-800/85 p-6 text-white backdrop-blur-md sm:col-span-2 lg:col-span-1">
            <CalendarClock className="h-6 w-6 opacity-80" />
            <div className="mt-8">
              <div className="text-4xl font-extrabold tracking-tight">{established}</div>
              <div className="mt-1 text-sm text-acm-100">Year of establishment</div>
            </div>
          </Item>
          {stats.map((s) => (
            <StatCard key={s.label} stat={s} />
          ))}
        </Reveal>

        {/* Why Join ACM? */}
        <div className="mt-20">
          <SectionHeading align="left" title="Why join Us?" />
          <Reveal className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" amount={0.15}>
            {whyJoin.map((w) => {
              const Icon = iconMap[w.icon]
              return (
                <Item key={w.title}>
                  <TiltCard className="h-full border-white/10 !bg-neutral-950/50 p-6 backdrop-blur-md">
                    <div className="flex h-full flex-col [transform:translateZ(28px)]">
                      <div className="grid h-11 w-11 place-items-center rounded-xl border border-neutral-200 bg-neutral-50 text-acm-600 transition-colors group-hover:border-acm-300 group-hover:bg-acm-50 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-acm-400">
                        {Icon && <Icon className="h-5 w-5" />}
                      </div>
                      <h3 className="mt-5 flex items-center gap-1 font-semibold tracking-tight">
                        {w.title}
                        <ArrowUpRight className="h-4 w-4 text-neutral-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-acm-500" />
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{w.body}</p>
                    </div>
                  </TiltCard>
                </Item>
              )
            })}
          </Reveal>
        </div>
      </div>
    </section>
  )
}

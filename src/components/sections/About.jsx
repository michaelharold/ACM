import { motion } from 'framer-motion'
import { ArrowUpRight, CalendarClock } from 'lucide-react'
import { SectionHeading } from '../SectionHeading'
import { TiltCard } from '../ui/Card'
import { Reveal, Item } from '../ui/Reveal'
import { useCountUp } from '../../lib/useCountUp'
import { iconMap } from '../../lib/icons'
import { useData } from '../../context/DataContext'
import { chapter, whyJoin } from '../../data/mock'

function StatCard({ stat }) {
  const [ref, value] = useCountUp(stat.value)
  return (
    <Item
      ref={ref}
      className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-900"
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
  // Stats + establishment year are admin-editable site content.
  const { content } = useData()
  const stats = content.stats
  const established = content.established
  return (
    <section id="about" className="scroll-mt-24 py-24 sm:py-28">
      <div className="section-shell">
        <SectionHeading
          eyebrow="About"
          title="Built by students, for builders"
          description={`${chapter.fullName}. Since ${established}, we’ve turned curious first-years into confident engineers through relentless hands-on learning.`}
        />

        {/* Establishment + statistics */}
        <Reveal className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" amount={0.2}>
          <Item className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-acm-200 bg-gradient-to-br from-acm-600 to-acm-800 p-6 text-white sm:col-span-2 lg:col-span-1 dark:border-acm-500/30">
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
                  <TiltCard className="h-full p-6">
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

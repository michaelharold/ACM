import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, CalendarDays, Users, MessageSquare } from 'lucide-react'
import { SectionHeading } from '../SectionHeading'
import { Reveal, Item } from '../ui/Reveal'
import { useData } from '../../context/DataContext'

// The three sections that live on their own routes. Everything else on the home
// page is a scroll target; these are the doors out of it.
export function ExploreMore() {
  const { events, execomGroups } = useData()

  const memberCount = execomGroups.reduce((n, g) => n + (g.members?.length || 0), 0)
  const openCount = events.filter((e) => e.status === 'open').length

  const cards = [
    {
      to: '/events',
      icon: CalendarDays,
      title: 'Events',
      copy: 'Workshops, talks and hackathons — browse what’s open, what’s coming and what we’ve run.',
      meta: openCount > 0 ? `${openCount} open for registration` : `${events.length} in the catalogue`,
      accent: 'from-acm-600 to-acm-400',
    },
    {
      to: '/execom',
      icon: Users,
      title: 'Execom',
      copy: 'The students who plan, build and run everything — organised department by department.',
      meta: `${memberCount} members across ${execomGroups.length} teams`,
      accent: 'from-violet-600 to-violet-400',
    },
    {
      to: '/contact',
      icon: MessageSquare,
      title: 'Contact',
      copy: 'Questions, collaborations, or want to join a team? Every channel, plus a direct message form.',
      meta: 'We reply fast',
      accent: 'from-cyan-600 to-cyan-400',
    },
  ]

  return (
    <section id="explore" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-28">
      <div className="section-shell relative">
        <SectionHeading
          eyebrow="Explore"
          title="Go deeper"
          description="Three corners of the chapter big enough to deserve their own space."
        />

        <Reveal className="mt-14 grid gap-5 md:grid-cols-3" amount={0.15}>
          {cards.map((c) => (
            <Item key={c.to}>
              <Link
                to={c.to}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-acm-500/40 hover:bg-neutral-900 hover:shadow-2xl hover:shadow-black/40"
              >
                {/* Accent bar wipes in on hover */}
                <span
                  className={`absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r ${c.accent} transition-transform duration-500 group-hover:scale-x-100`}
                />

                <span className="grid h-12 w-12 place-items-center rounded-xl border border-neutral-800 bg-neutral-800/60 text-acm-400 transition-colors duration-300 group-hover:border-acm-500/30 group-hover:bg-acm-500/10">
                  <c.icon className="h-6 w-6" />
                </span>

                <h3 className="mt-6 text-xl font-bold tracking-tight">{c.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">{c.copy}</p>

                <span className="mt-6 flex items-center justify-between border-t border-neutral-800 pt-4 text-sm">
                  <span className="text-xs uppercase tracking-wider text-neutral-500">{c.meta}</span>
                  <motion.span
                    aria-hidden
                    className="inline-flex items-center gap-1.5 font-medium text-acm-400"
                  >
                    Open
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </motion.span>
                </span>
              </Link>
            </Item>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

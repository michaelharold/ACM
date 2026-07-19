import { motion } from 'framer-motion'
import { SectionHeading } from '../SectionHeading'
import { Reveal, Item } from '../ui/Reveal'
import { useData } from '../../context/DataContext'
import { iconMap, initials, gradientFor } from '../../lib/icons'
import { cn } from '../../lib/cn'

// Monogram avatar — clean, consistent identity per member.
function Avatar({ name, size = 'md' }) {
  const dims = size === 'lg' ? 'h-20 w-20 text-2xl' : 'aspect-square w-full text-3xl'
  return (
    <div
      className={cn(
        'grid place-items-center rounded-2xl bg-gradient-to-br font-bold tracking-tight text-white shadow-sm transition-transform duration-500 group-hover:scale-[1.03]',
        gradientFor(name),
        dims,
      )}
    >
      {initials(name)}
    </div>
  )
}

function MemberCard({ m }) {
  const isHead = m.role === 'Head'
  return (
    <Item>
      <div className="group text-center">
        <div className="relative">
          <Avatar name={m.name} />
          {isHead && (
            <span className="absolute -right-1.5 -top-1.5 rounded-full border border-acm-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-acm-600 shadow-sm dark:border-acm-500/30 dark:bg-neutral-900 dark:text-acm-400">
              Head
            </span>
          )}
        </div>
        <h4 className="mt-3.5 text-sm font-semibold leading-tight tracking-tight text-neutral-900 dark:text-white">
          {m.name}
        </h4>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{m.role}</p>
      </div>
    </Item>
  )
}

// Standalone leadership row (Secretary / Junior Representative).
function LeadRow({ group }) {
  const Icon = iconMap[group.icon]
  const m = group.members[0]
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="group mx-auto flex max-w-md items-center gap-5 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <Avatar name={m.name} size="lg" />
      <div className="text-left">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-acm-600 dark:text-acm-400">
          {Icon && <Icon className="h-3.5 w-3.5" />} {group.team}
        </span>
        <h4 className="mt-1 text-lg font-bold tracking-tight">{m.name}</h4>
      </div>
    </motion.div>
  )
}

export function Execom() {
  const { execomGroups } = useData()
  return (
    <section id="execom" className="scroll-mt-24 py-24 sm:py-28">
      <div className="section-shell">
        <SectionHeading
          eyebrow="Execom"
          title="The team behind ACM TKMCE"
          description="The students who plan, build and run everything — organised department by department, in order of responsibility."
        />

        <div className="mt-16 space-y-14">
          {execomGroups.map((group, gi) => {
            if (group.lead) return <LeadRow key={group.team} group={group} />

            const Icon = iconMap[group.icon]
            return (
              <div key={group.team}>
                {/* Department title */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  className="mb-7 flex items-center gap-3.5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-neutral-200 bg-neutral-50 text-acm-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-acm-400">
                    {Icon && <Icon className="h-[18px] w-[18px]" />}
                  </span>
                  <h3 className="text-lg font-bold tracking-tight sm:text-xl">{group.team}</h3>
                  <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                  <span className="text-xs font-medium text-neutral-400">{String(gi).padStart(2, '0')}</span>
                </motion.div>

                {/* Members — Heads first (data is pre-ordered) */}
                <Reveal className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4" amount={0.1}>
                  {group.members.map((m) => (
                    <MemberCard key={m.name} m={m} />
                  ))}
                </Reveal>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

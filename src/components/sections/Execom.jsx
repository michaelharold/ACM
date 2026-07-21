import { useState } from 'react'
import { motion } from 'framer-motion'
import { SectionHeading } from '../SectionHeading'
import { MemberDetail } from './MemberDetail'
import { Reveal, Item } from '../ui/Reveal'
import TiltedCard from '../reactbits/TiltedCard'
import DotField from '../reactbits/DotField'
import { LazyBackdrop } from '../ui/LazyBackdrop'
import { useData } from '../../context/DataContext'
import { iconMap, initials, gradientFor } from '../../lib/icons'
import { avatarDataUri } from '../../lib/avatar'
import { cn } from '../../lib/cn'

// Monogram avatar — used by the leadership row.
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

function MemberCard({ m, size = 'md', onOpen }) {
  const isHead = m.role === 'Head'
  // Fixed widths keep every card in a row on the same grid; heads sit one step
  // larger so the leadership row still reads as the lead.
  const width = size === 'lg' ? 'w-64 sm:w-72' : 'w-[10.5rem] sm:w-56 lg:w-60'
  const height = size === 'lg' ? '260px' : '224px'
  return (
    <Item className={cn('shrink-0', width)}>
      <button
        type="button"
        onClick={() => onOpen?.(m)}
        aria-label={`View ${m.name}'s profile`}
        className="block w-full cursor-pointer rounded-[15px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acm-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
      >
      <TiltedCard
        imageSrc={m.photo || avatarDataUri(m.name)}
        altText={m.name}
        captionText={`${m.name} · ${m.role}`}
        containerHeight={height}
        containerWidth="100%"
        imageHeight={height}
        imageWidth="100%"
        rotateAmplitude={12}
        scaleOnHover={1.07}
        showMobileWarning={false}
        showTooltip
        displayOverlayContent
        overlayContent={
          <div className="flex h-full w-full flex-col justify-end rounded-[15px] bg-gradient-to-t from-black/65 via-black/10 to-transparent p-4 text-left">
            {isHead && (
              <span className="mb-1.5 w-fit rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-acm-700">
                Head
              </span>
            )}
            <h4 className="text-sm font-semibold leading-tight tracking-tight text-white">{m.name}</h4>
            <p className="mt-0.5 text-xs text-white/70">{m.role}</p>
          </div>
        }
      />
      </button>
    </Item>
  )
}

// Standalone leadership row (Secretary / Junior Representative).
function LeadRow({ group, onOpen }) {
  const Icon = iconMap[group.icon]
  const m = group.members[0]
  return (
    <motion.button
      type="button"
      onClick={() => onOpen?.({ ...m, team: group.team })}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="group mx-auto flex w-full max-w-md items-center gap-5 rounded-2xl border border-neutral-200 bg-white p-5 text-left transition-colors hover:border-acm-400/60 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-acm-500/50"
    >
      {m.photo ? (
        <img src={m.photo} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
      ) : (
        <Avatar name={m.name} size="lg" />
      )}
      <div className="text-left">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-acm-600 dark:text-acm-400">
          {Icon && <Icon className="h-3.5 w-3.5" />} {group.team}
        </span>
        <h4 className="mt-1 text-lg font-bold tracking-tight">{m.name}</h4>
      </div>
    </motion.button>
  )
}

export function Execom() {
  const { execomGroups } = useData()
  const [selected, setSelected] = useState(null)

  return (
    <section id="execom" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-28">
      {/* Dot field — the grid bulges away from the cursor and settles back */}
      <LazyBackdrop className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(110%_70%_at_50%_40%,#000_35%,transparent_80%)]">
        <DotField
          dotRadius={2.5}
          dotSpacing={30}
          bulgeStrength={94}
          glowRadius={400}
          sparkle
          waveAmplitude={3}
          cursorRadius={550}
          gradientFrom="#0c29e8"
          gradientTo="#0b109c"
        />
      </LazyBackdrop>

      <div className="section-shell relative">
        <SectionHeading
          eyebrow="Execom"
          title="The team behind ACM TKMCE"
          description="The students who plan, build and run everything — organised department by department, in order of responsibility."
        />

        <div className="mt-16 space-y-20">
          {execomGroups.map((group) => {
            if (group.lead) return <LeadRow key={group.team} group={group} onOpen={setSelected} />

            const Icon = iconMap[group.icon]
            const heads = group.members.filter((m) => m.role === 'Head')
            const members = group.members.filter((m) => m.role !== 'Head')
            return (
              <div key={group.team}>
                {/* Centered department title */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  className="mb-10 flex flex-col items-center gap-3 text-center"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-neutral-200 bg-neutral-50 text-acm-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-acm-400">
                    {Icon && <Icon className="h-5 w-5" />}
                  </span>
                  <h3 className="text-xl font-bold tracking-tight sm:text-2xl">{group.team}</h3>
                  <span className="h-1 w-10 rounded-full bg-gradient-to-r from-acm-600 to-acm-400" />
                </motion.div>

                {/* Heads first — centered on their own row */}
                {heads.length > 0 && (
                  <Reveal className="flex flex-wrap items-stretch justify-center gap-6" amount={0.1}>
                    {heads.map((m) => (
                      <MemberCard key={m.name} m={{ ...m, team: group.team }} size="lg" onOpen={setSelected} />
                    ))}
                  </Reveal>
                )}

                {/* Members below — even rows, centred, last row included */}
                {members.length > 0 && (
                  <Reveal className="mt-10 flex flex-wrap items-stretch justify-center gap-x-6 gap-y-8" amount={0.1}>
                    {members.map((m) => (
                      <MemberCard key={m.name} m={{ ...m, team: group.team }} onOpen={setSelected} />
                    ))}
                  </Reveal>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <MemberDetail member={selected} open={!!selected} onClose={() => setSelected(null)} />
    </section>
  )
}

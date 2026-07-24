import { useMemo, useState } from 'react'
import ScrollFloat from '../reactbits/ScrollFloat'
import SoftAurora from '../reactbits/SoftAurora'
import { LazyBackdrop } from '../ui/LazyBackdrop'
import { GalleryLightbox } from './GalleryLightbox'
import { cn } from '../../lib/cn'
import { shuffle } from '../../lib/imagePrep'
import { useData } from '../../context/DataContext'

// Each card is ~320px + 16px gap at the widest breakpoint. The track scrolls by
// exactly -50%, so one half has to be at least as wide as the viewport or a gap
// opens up at the wrap point. Repeat the set until it is, then double it.
const CARD_SPAN = 336

function useFilledTrack(items) {
  return useMemo(() => {
    if (!items.length) return []
    const viewport = typeof window === 'undefined' ? 1920 : window.innerWidth
    const needed = Math.ceil((viewport + CARD_SPAN) / (items.length * CARD_SPAN))
    const half = Array.from({ length: Math.max(needed, 1) }, () => items).flat()
    return [...half, ...half] // the -50% animation consumes exactly one half
  }, [items])
}

function Row({ items, reverse = false, duration = '46s', onOpen }) {
  const track = useFilledTrack(items)
  if (!track.length) return null
  return (
    <div className="marquee-paused group/row relative overflow-hidden">
      <div
        style={{ '--marquee-duration': duration }}
        className={cn('marquee-track flex w-max gap-4 pr-4', reverse && 'reverse')}
      >
        {track.map((g, i) => (
          <button
            type="button"
            key={`${g.id}-${i}`}
            onClick={() => onOpen?.(g)}
            aria-label={g.caption ? `View ${g.caption}` : 'View photo'}
            className={cn(
              'group relative h-44 w-64 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-white/10 sm:h-52 sm:w-80',
              // Neighbours recede while one card is hovered, so the focused
              // photo reads clearly instead of everything staying flat.
              'transition-all duration-500 ease-out group-hover/row:opacity-55 hover:!opacity-100',
              'hover:z-10 hover:!scale-[1.06] hover:border-acm-400/50 hover:shadow-2xl hover:shadow-acm-950/50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acm-400/70',
            )}
          >
            <img
              src={g.image}
              alt={g.caption || 'Gallery photo'}
              loading="lazy"
              draggable={false}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            />
            {/* Permanent bottom scrim so captions stay readable as they slide */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
            {/* Title only when one has been set — otherwise no caption at all */}
            {g.caption && (
              <span className="pointer-events-none absolute inset-x-0 bottom-0 block translate-y-2 px-4 pb-3 text-left text-sm font-medium text-white opacity-0 transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                {g.caption}
              </span>
            )}
          </button>
        ))}
      </div>
      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-neutral-950 to-transparent sm:w-28" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-neutral-950 to-transparent sm:w-28" />
    </div>
  )
}

// Two counter-scrolling photo marquees; hover pauses a row and reveals captions.
export function GalleryStrip() {
  const { gallery, content } = useData()
  const [active, setActive] = useState(null)
  // Reshuffled once per mount, so newly uploaded photos surface in different
  // positions on each visit rather than always landing at the end.
  const shuffled = useMemo(() => shuffle(gallery), [gallery])

  if (shuffled.length === 0) return null

  // With only a handful of photos a second row would just mirror the first,
  // so run a single row until there are enough to make two distinct ones.
  const twoRows = shuffled.length >= 6
  const half = Math.ceil(shuffled.length / 2)

  return (
    <section id="gallery" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-28">
      {/* Aurora wash behind the reel */}
      <LazyBackdrop className="pointer-events-none absolute inset-0">
        <SoftAurora
          speed={0.6}
          scale={1.2}
          brightness={1.3}
          color1="#0e7ade"
          color2="#0d08e0"
          noiseFrequency={2.5}
          noiseAmplitude={1.0}
          bandHeight={0.5}
          bandSpread={1.0}
          octaveDecay={0.23}
          layerOffset={0}
          colorSpeed={1.6}
          enableMouseInteraction
          mouseInfluence={0.35}
        />
      </LazyBackdrop>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-neutral-950 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-neutral-950 to-transparent" />

      <div className="section-shell relative z-10 text-center">
        <span className="eyebrow">Gallery</span>
        <ScrollFloat
          animationDuration={1}
          ease="back.inOut(2)"
          scrollStart="center bottom+=40%"
          scrollEnd="bottom bottom-=30%"
          stagger={0.03}
          containerClassName="mt-2"
          textClassName="!text-3xl sm:!text-4xl !font-bold tracking-tight !leading-tight"
        >
          {content.galleryTitle}
        </ScrollFloat>
        <p className="mx-auto mt-3 max-w-2xl text-pretty leading-relaxed text-neutral-400">
          {content.galleryBlurb}
        </p>
      </div>
      <div className="relative z-10 mt-14 space-y-4">
        <Row items={twoRows ? shuffled.slice(0, half) : shuffled} duration="52s" onOpen={setActive} />
        {twoRows && <Row items={shuffled.slice(half)} reverse duration="60s" onOpen={setActive} />}
      </div>

      {/* Click a photo → it pops out of the reel as an interactive 3D card */}
      <GalleryLightbox item={active} open={!!active} onClose={() => setActive(null)} />
    </section>
  )
}

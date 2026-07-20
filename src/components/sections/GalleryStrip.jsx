import ScrollFloat from '../reactbits/ScrollFloat'
import { cn } from '../../lib/cn'
import { gallery } from '../../data/mock'

function Row({ items, reverse = false, duration = '46s' }) {
  return (
    <div className="marquee-paused relative overflow-hidden">
      <div
        style={{ '--marquee-duration': duration }}
        className={cn('marquee-track flex w-max gap-4 pr-4', reverse && 'reverse')}
      >
        {[...items, ...items].map((g, i) => (
          <figure
            key={`${g.id}-${i}`}
            className="group relative h-44 w-64 shrink-0 overflow-hidden rounded-2xl border border-neutral-200 sm:h-52 sm:w-80 dark:border-neutral-800"
          >
            <img
              src={g.image}
              alt={g.caption}
              loading="lazy"
              draggable={false}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <figcaption className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 text-sm font-medium text-white transition-transform duration-300 group-hover:translate-y-0">
              {g.caption}
            </figcaption>
          </figure>
        ))}
      </div>
      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent sm:w-28 dark:from-neutral-950" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent sm:w-28 dark:from-neutral-950" />
    </div>
  )
}

// Two counter-scrolling photo marquees; hover pauses a row and reveals captions.
export function GalleryStrip() {
  const half = Math.ceil(gallery.length / 2)
  return (
    <section id="gallery" className="scroll-mt-24 overflow-hidden py-24 sm:py-28">
      <div className="section-shell text-center">
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
          Life at the chapter
        </ScrollFloat>
        <p className="mx-auto mt-3 max-w-2xl text-pretty leading-relaxed text-neutral-500 dark:text-neutral-400">
          Hack nights, workshops, mentor circles — a running reel of what we get up to.
        </p>
      </div>
      <div className="mt-14 space-y-4">
        <Row items={gallery.slice(0, half)} duration="52s" />
        <Row items={gallery.slice(half)} reverse duration="60s" />
      </div>
    </section>
  )
}

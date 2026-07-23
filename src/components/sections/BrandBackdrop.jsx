import ColorBends from '../reactbits/ColorBends'
import { LazyBackdrop } from '../ui/LazyBackdrop'
import { cn } from '../../lib/cn'

// The chapter's shared section backdrop: deep indigo colour bends under a dark
// scrim. Defined once so About and Events stay identical — changing the look in
// one place changes it everywhere it's used.
export function BrandBackdrop({ className, scrim = 'bg-neutral-950/68', feather = true }) {
  return (
    <>
      <LazyBackdrop className={cn('pointer-events-none absolute inset-0', className)}>
        <ColorBends
          // Dark end of the brand palette — acm-950/900 with an indigo mid, so
          // the field reads as texture on a dark canvas, not a light source.
          colors={['#151d57', '#1c2f8f', '#312e81']}
          rotation={90}
          speed={0.2}
          scale={1}
          frequency={1}
          warpStrength={1}
          mouseInfluence={0.9}
          noise={0.15}
          parallax={2}
          iterations={1}
          // Intensity is the glow control: above ~1.2 the bands sum past white
          // where they overlap and blow out.
          intensity={0.95}
          bandWidth={6}
          transparent
        />
      </LazyBackdrop>
      <div className={cn('pointer-events-none absolute inset-0', scrim)} />
      {feather && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-neutral-950 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-neutral-950 to-transparent" />
        </>
      )}
    </>
  )
}

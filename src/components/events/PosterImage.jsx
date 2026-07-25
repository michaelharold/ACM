import { cn } from '../../lib/cn'

// Shows an event poster in FULL (object-contain, never cropped) for any aspect
// ratio — Instagram-story 9:16, square or landscape. A blurred, zoomed copy of
// the same poster fills the letterbox area so there are no empty bars.
export function PosterImage({ src, alt, className, imgClassName, children }) {
  return (
    <div className={cn('relative overflow-hidden bg-neutral-950', className)}>
      <img
        src={src}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl"
      />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn('relative z-10 h-full w-full object-contain', imgClassName)}
      />
      {children}
    </div>
  )
}

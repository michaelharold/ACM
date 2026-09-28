import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { SPRING, SHEET_SPRING, project, useMediaQuery } from '../../lib/motion'

const widths = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' }

// Dialog surface. On phones it's a bottom sheet you can pull down to dismiss —
// it tracks the finger 1:1, rubber-bands if pulled up, and a flick throws it
// away (the release velocity is projected forward, as iOS does). On larger
// screens it scales in from the centre. Either way it leaves the way it came.
export function Modal({ open, onClose, children, className, size = 'lg' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && <Sheet onClose={onClose} className={className} size={size}>{children}</Sheet>}
    </AnimatePresence>,
    document.body,
  )
}

function Sheet({ onClose, className, size, children }) {
  const desktop = useMediaQuery('(min-width: 640px)')
  const reduce = useReducedMotion()
  const panel = useRef(null)
  const y = useMotionValue(0)
  const drag = useDragControls()
  // The backdrop lightens as the sheet is pulled down — a hint that letting
  // go will dismiss it.
  const scrim = useTransform(y, [0, 420], [1, 0.25])

  // Move focus into the dialog so keyboard and screen-reader users land in it.
  useEffect(() => {
    const prev = document.activeElement
    panel.current?.focus({ preventScroll: true })
    return () => prev?.focus?.({ preventScroll: true })
  }, [])

  const motionProps = desktop
    ? {
        initial: { opacity: 0, scale: 0.96, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.96, y: 10 },
        transition: SPRING,
      }
    : {
        // Reduced motion keeps a fade instead of the slide.
        initial: { y: '100%', opacity: reduce ? 0 : 1 },
        animate: { y: 0, opacity: 1 },
        exit: { y: '100%', opacity: reduce ? 0 : 1 },
        transition: SHEET_SPRING,
      }

  function onDragEnd(_, info) {
    const height = panel.current?.offsetHeight || 600
    const restingAt = y.get() + project(info.velocity.y, 0.99)
    if (restingAt > height * 0.45 || info.velocity.y > 900) onClose?.()
    // Otherwise the drag constraints spring it home, carrying the release velocity.
  }

  return (
    // data-lenis-prevent: without it the Lenis smooth-scroll layer keeps
    // scrolling the page underneath instead of the modal's own content.
    <div data-lenis-prevent className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="absolute inset-0"
      >
        <motion.div style={{ opacity: scrim }} className="glass-scrim absolute inset-0 bg-neutral-950/55 backdrop-blur-sm" />
      </motion.div>
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        {...motionProps}
        style={{ y }}
        drag={desktop ? false : 'y'}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.06, bottom: 1 }}
        dragMomentum={false}
        dragTransition={{ bounceStiffness: 420, bounceDamping: 38 }}
        onDragEnd={onDragEnd}
        className={cn(
          'relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-neutral-200 bg-white shadow-2xl outline-none sm:rounded-3xl dark:border-neutral-800 dark:bg-neutral-950',
          widths[size],
          className,
        )}
      >
        {!desktop && (
          // Grab handle — the drag starts here, so scrolling the content
          // underneath never fights with pulling the sheet.
          <div
            onPointerDown={(e) => drag.start(e)}
            // z-30: above content such as an event's poster, so the press lands here.
            className="sticky top-0 z-30 -mb-7 flex h-7 cursor-grab touch-none items-start justify-center pt-2.5 active:cursor-grabbing"
            aria-hidden
          >
            <span className="h-1.5 w-10 rounded-full bg-neutral-300/95 shadow-[0_0_0_1px_rgba(0,0,0,0.18)] dark:bg-neutral-500/90" />
          </div>
        )}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-40 rounded-full border border-neutral-200 bg-white/80 p-2 text-neutral-500 backdrop-blur transition-[color,transform] hover:text-neutral-900 active:scale-90 dark:border-neutral-800 dark:bg-neutral-900/80 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </motion.div>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { X } from 'lucide-react'

const spring = { damping: 26, stiffness: 140, mass: 1 }

// A clicked gallery photo pops out of the reel and floats as an interactive 3D
// card: it tilts toward the cursor and lifts slightly on hover — the same small
// zoom the reel has, now in full focus and separated from the rest of the list.
export function GalleryLightbox({ item, open, onClose }) {
  const ref = useRef(null)

  // Pointer position → tilt. Springs keep the motion smooth and self-settling.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [12, -12]), spring)
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-14, 14]), spring)
  const scale = useSpring(1, spring)

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

  function handleMove(e) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    px.set((e.clientX - rect.left) / rect.width - 0.5)
    py.set((e.clientY - rect.top) / rect.height - 0.5)
  }
  function reset() {
    px.set(0)
    py.set(0)
    scale.set(1)
  }

  return createPortal(
    <AnimatePresence>
      {open && item && (
        <div data-lenis-prevent className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-neutral-950/70 backdrop-blur-md"
          />

          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-5 top-5 z-20 grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Perspective wrapper — the card tilts inside it in 3D space */}
          <div className="relative z-10 w-full max-w-2xl" style={{ perspective: 1200 }}>
            <motion.div
              ref={ref}
              onMouseMove={handleMove}
              onMouseEnter={() => scale.set(1.05)}
              onMouseLeave={reset}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              style={{ rotateX, rotateY, scale, transformStyle: 'preserve-3d' }}
              className="relative overflow-hidden rounded-2xl border border-white/15 shadow-2xl shadow-black/60"
            >
              <img
                src={item.image}
                alt={item.caption || 'Gallery photo'}
                draggable={false}
                className="block max-h-[78vh] w-full select-none object-contain"
              />
              {item.caption && (
                <div
                  style={{ transform: 'translateZ(40px)' }}
                  className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-6 pb-5 pt-16"
                >
                  <p className="text-lg font-semibold tracking-tight text-white">{item.caption}</p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

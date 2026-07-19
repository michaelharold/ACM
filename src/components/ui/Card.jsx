import { useRef } from 'react'
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { cn } from '../../lib/cn'

// Base surface card.
export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/60',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// Premium card: 3D pointer tilt + cursor-tracking glare and border spotlight.
export function TiltCard({ className, children, intensity = 8, glare = true, ...props }) {
  const ref = useRef(null)
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rx = useSpring(useTransform(py, [0, 1], [intensity, -intensity]), { stiffness: 200, damping: 25 })
  const ry = useSpring(useTransform(px, [0, 1], [-intensity, intensity]), { stiffness: 200, damping: 25 })

  // Cursor position as % for the glare / spotlight gradients.
  const gx = useTransform(px, (v) => `${v * 100}%`)
  const gy = useTransform(py, (v) => `${v * 100}%`)
  const glareBg = useMotionTemplate`radial-gradient(420px circle at ${gx} ${gy}, rgba(89, 142, 255, 0.14), transparent 65%)`
  const spotBorder = useMotionTemplate`radial-gradient(240px circle at ${gx} ${gy}, rgba(31, 71, 245, 0.55), transparent 70%)`

  function handleMove(e) {
    const rect = ref.current.getBoundingClientRect()
    px.set((e.clientX - rect.left) / rect.width)
    py.set((e.clientY - rect.top) / rect.height)
  }
  function reset() {
    px.set(0.5)
    py.set(0.5)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={cn(
        'group relative rounded-2xl border border-neutral-200 bg-white transition-colors duration-300 hover:border-acm-400/60 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-acm-500/50',
        '[transform-style:preserve-3d]',
        className,
      )}
      {...props}
    >
      {glare && (
        <>
          {/* Border spotlight — a gradient ring revealed only near the cursor. */}
          <motion.span
            aria-hidden
            style={{ background: spotBorder }}
            className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] [mask-composite:exclude] [padding:1.5px]"
          />
          {/* Soft interior glare following the cursor. */}
          <motion.span
            aria-hidden
            style={{ background: glareBg }}
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        </>
      )}
      {children}
    </motion.div>
  )
}

import { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
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

// Premium card with subtle 3D pointer tilt + border-illumination on hover.
export function TiltCard({ className, children, intensity = 8, ...props }) {
  const ref = useRef(null)
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rx = useSpring(useTransform(py, [0, 1], [intensity, -intensity]), { stiffness: 200, damping: 25 })
  const ry = useSpring(useTransform(px, [0, 1], [-intensity, intensity]), { stiffness: 200, damping: 25 })

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
      {children}
    </motion.div>
  )
}

import { useRef } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

// Wraps children in a subtle magnetic pull toward the cursor.
// `strength` is the max translation in px at the element's edge.
export function Magnetic({ children, strength = 5, className }) {
  const ref = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.5 })
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.5 })

  function onMove(e) {
    const rect = ref.current.getBoundingClientRect()
    x.set(((e.clientX - rect.left) / rect.width - 0.5) * strength * 2)
    y.set(((e.clientY - rect.top) / rect.height - 0.5) * strength * 2)
  }
  function onLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

// Trailing cursor ring (desktop, fine-pointer only). The native cursor stays;
// the ring lags behind on a spring and swells over interactive elements.
export function Cursor() {
  const [enabled, setEnabled] = useState(false)
  const [hot, setHot] = useState(false)
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const rx = useSpring(x, { stiffness: 250, damping: 22, mass: 0.6 })
  const ry = useSpring(y, { stiffness: 250, damping: 22, mass: 0.6 })

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduced) return
    setEnabled(true)
    function onMove(e) {
      x.set(e.clientX)
      y.set(e.clientY)
      setHot(!!e.target.closest?.('a, button, [role="button"], input, select, textarea, label'))
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [x, y])

  if (!enabled) return null

  return (
    <motion.div
      aria-hidden
      style={{ x: rx, y: ry }}
      className="pointer-events-none fixed left-0 top-0 z-[70] hidden lg:block"
    >
      <motion.span
        animate={{ scale: hot ? 1.9 : 1, opacity: hot ? 0.9 : 0.55 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="block h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-acm-500/70"
      />
    </motion.div>
  )
}

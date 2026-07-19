import { motion, useScroll, useSpring } from 'framer-motion'

// Thin gradient bar pinned to the very top, tracking page scroll.
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 })
  return (
    <motion.div
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-acm-700 via-acm-500 to-acm-300"
    />
  )
}

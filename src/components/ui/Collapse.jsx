import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SPRING } from '../../lib/motion'

// Smoothly opens and closes a section to its natural height. Content is only
// clipped while it's moving, so tooltips and dropdowns inside aren't cut off
// once it has settled.
export function Collapse({ open, children, className }) {
  const [moving, setMoving] = useState(false)
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="collapse"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={SPRING}
          onAnimationStart={() => setMoving(true)}
          onAnimationComplete={() => setMoving(false)}
          style={{ overflow: moving ? 'hidden' : 'visible' }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

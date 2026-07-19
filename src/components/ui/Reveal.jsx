import { forwardRef } from 'react'
import { motion } from 'framer-motion'

// Shared entrance animation — subtle vertical stagger with spring damping (~28).
export const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 28 } },
}

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

// Wrap a section — children marked with `variants={fadeUp}` stagger in on scroll.
export function Reveal({ children, className, as = 'div', once = true, amount = 0.2, ...props }) {
  const Tag = motion[as] || motion.div
  return (
    <Tag
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount }}
      className={className}
      {...props}
    >
      {children}
    </Tag>
  )
}

export const Item = forwardRef(function Item({ children, className, as = 'div', ...props }, ref) {
  const Tag = motion[as] || motion.div
  return (
    <Tag ref={ref} variants={fadeUp} className={className} {...props}>
      {children}
    </Tag>
  )
})

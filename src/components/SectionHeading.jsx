import { motion } from 'framer-motion'
import { cn } from '../lib/cn'

export function SectionHeading({ eyebrow, title, description, align = 'center', className }) {
  const centered = align === 'center'
  return (
    <div className={cn(centered ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl', className)}>
      {eyebrow && (
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          className="eyebrow"
        >
          {eyebrow}
        </motion.span>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.05 }}
        className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl"
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.1 }}
          className={cn(
            'mt-4 text-pretty leading-relaxed text-neutral-500 dark:text-neutral-400',
            centered && 'mx-auto',
          )}
        >
          {description}
        </motion.p>
      )}
    </div>
  )
}

import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'

const variants = {
  primary:
    'bg-acm-600 text-white hover:bg-acm-700 border border-acm-600 hover:border-acm-700 shadow-sm',
  secondary:
    'bg-neutral-900 text-white hover:bg-neutral-800 border border-neutral-900 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 dark:border-white',
  outline:
    'bg-transparent text-neutral-900 border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 dark:text-neutral-100 dark:border-neutral-800 dark:hover:border-neutral-600 dark:hover:bg-neutral-900',
  ghost:
    'bg-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-transparent dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800',
}

const sizes = {
  sm: 'h-9 px-3.5 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-5 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-base rounded-xl gap-2',
}

export const Button = forwardRef(function Button(
  { as: Tag = 'button', variant = 'primary', size = 'md', className, children, ...props },
  ref,
) {
  const MotionTag = motion(Tag)
  return (
    <MotionTag
      ref={ref}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'inline-flex items-center justify-center font-medium tracking-tight transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acm-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </MotionTag>
  )
})

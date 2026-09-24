import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'

const ON = {
  acm: 'bg-acm-600',
  violet: 'bg-gradient-to-r from-violet-500 to-fuchsia-500',
  sky: 'bg-gradient-to-r from-sky-500 to-blue-500',
  emerald: 'bg-gradient-to-r from-emerald-500 to-green-500',
}

export function Switch({ on, onClick, tone = 'acm', disabled = false, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50', on ? ON[tone] || ON.acm : 'bg-neutral-200 dark:bg-neutral-700')}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm', on ? 'left-[22px]' : 'left-0.5')}
      />
    </button>
  )
}

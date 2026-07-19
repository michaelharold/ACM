import { cn } from '../../lib/cn'

const tones = {
  green:
    'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/20',
  red: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/20',
  amber:
    'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/20',
  blue: 'text-acm-700 bg-acm-50 border-acm-200 dark:text-acm-300 dark:bg-acm-500/10 dark:border-acm-500/20',
  neutral:
    'text-neutral-600 bg-neutral-100 border-neutral-200 dark:text-neutral-300 dark:bg-neutral-800 dark:border-neutral-700',
}

const dotTones = {
  green: 'bg-emerald-500',
  red: 'bg-rose-500',
  amber: 'bg-amber-500',
  blue: 'bg-acm-500',
  neutral: 'bg-neutral-400',
}

export function Badge({ tone = 'neutral', dot = false, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full', dotTones[tone])}>
          {tone === 'green' && (
            <span className={cn('block h-1.5 w-1.5 animate-ping rounded-full', dotTones[tone], 'opacity-75')} />
          )}
        </span>
      )}
      {children}
    </span>
  )
}

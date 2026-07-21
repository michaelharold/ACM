import { cn } from '../lib/cn'

// The official chapter mark. It ships with a transparent background, so it sits
// on light and dark surfaces without a plate behind it.
const sizes = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
}

export function Logo({ className, showText = true, size = 'md' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src="/acm-logo.png"
        alt="ACM TKMCE Student Chapter"
        width={311}
        height={311}
        className={cn('shrink-0 object-contain', sizes[size] || sizes.md)}
      />
      {showText && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight text-neutral-900 dark:text-white">ACM TKMCE</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-400">Student Chapter</span>
        </span>
      )}
    </span>
  )
}

import { cn } from '../lib/cn'

export function Logo({ className, showText = true }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-acm-600 shadow-sm">
        <svg viewBox="0 0 64 64" className="h-5 w-5" fill="none">
          <path d="M20 44 L32 20 L44 44" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M25 44 A9 9 0 1 0 25 31" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.55" />
        </svg>
      </span>
      {showText && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight text-neutral-900 dark:text-white">ACM TKMCE</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-400">Student Chapter</span>
        </span>
      )}
    </span>
  )
}

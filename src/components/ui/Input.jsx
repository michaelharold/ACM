import { forwardRef, useId } from 'react'
import { cn } from '../../lib/cn'

export const Input = forwardRef(function Input(
  { label, hint, icon: Icon, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id || autoId
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors',
            'focus:border-acm-500 focus:outline-none focus:ring-4 focus:ring-acm-500/10',
            'dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-acm-500',
            Icon && 'pl-10',
            className,
          )}
          {...props}
        />
      </div>
      {hint && <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
    </div>
  )
})

export const Select = forwardRef(function Select({ label, children, className, id, ...props }, ref) {
  const autoId = useId()
  const selectId = id || autoId
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          'h-11 w-full appearance-none rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 transition-colors',
          'focus:border-acm-500 focus:outline-none focus:ring-4 focus:ring-acm-500/10',
          'dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  )
})

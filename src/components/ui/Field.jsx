import { useState } from 'react'
import { Info } from 'lucide-react'
import { cn } from '../../lib/cn'

// A small "i" icon that reveals a short explanation on hover/tap — for admin
// form fields where the label alone doesn't say what the field controls or
// what it affects elsewhere on the site.
export function InfoHint({ text }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <span
      className="relative inline-flex shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o) }}
        aria-label="More info"
        className="grid h-3.5 w-3.5 place-items-center rounded-full text-neutral-400 transition-colors hover:text-acm-500"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-1.5 w-56 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white p-2.5 text-[11px] font-normal leading-relaxed text-neutral-600 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
        >
          {text}
        </span>
      )}
    </span>
  )
}

// Consistent label + optional info-hint wrapper for a raw form control. Not
// tied to any particular input styling — just standardises the label row.
export function Field({ label, hint, className, children }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
        {label}
        <InfoHint text={hint} />
      </span>
      {children}
    </label>
  )
}

// A titled section card — the building block for a well-organised admin
// form: an icon + heading (with its own optional hint) at the top, fields
// beneath, on a background that actually contrasts with the page.
export function FormSection({ icon: Icon, title, hint, description, children, className }) {
  return (
    <div className={cn('rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900', className)}>
      <div className="mb-3.5 flex items-center gap-2">
        {Icon && (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-acm-500/10 text-acm-600 dark:text-acm-400">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <h4 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          {title}
          <InfoHint text={hint} />
        </h4>
      </div>
      {description && <p className="-mt-2 mb-3.5 text-xs text-neutral-400">{description}</p>}
      <div className="grid gap-3.5 sm:grid-cols-2">{children}</div>
    </div>
  )
}

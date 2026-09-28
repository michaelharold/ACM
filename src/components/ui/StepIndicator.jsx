import { Fragment } from 'react'
import { motion } from 'framer-motion'

// Step progress in the style of React Bits' Stepper: numbered circles joined
// by lines that fill as you advance; finished steps draw a check, the current
// one glows. Purely a display — the form still owns navigation/validation.
export function StepIndicator({ steps, current }) {
  return (
    <ol className="flex items-start" aria-label="Progress">
      {steps.map((label, i) => {
        const state = i < current ? 'complete' : i === current ? 'active' : 'inactive'
        return (
          <Fragment key={label}>
            <li className="flex w-14 shrink-0 flex-col items-center gap-1.5 text-center" aria-current={state === 'active' ? 'step' : undefined}>
              <motion.span
                initial={false}
                animate={state}
                variants={{
                  inactive: { backgroundColor: '#262626', color: '#a3a3a3', boxShadow: '0 0 0 0 rgba(31,71,245,0)' },
                  active: { backgroundColor: '#1f47f5', color: '#ffffff', boxShadow: '0 0 0 4px rgba(31,71,245,0.22), 0 0 16px rgba(63,107,255,0.55)' },
                  complete: { backgroundColor: '#1f47f5', color: '#ffffff', boxShadow: '0 0 0 0 rgba(31,71,245,0)' },
                }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="grid h-8 w-8 place-items-center rounded-full text-xs font-semibold"
              >
                {state === 'complete' ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden>
                    <motion.path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.12, duration: 0.4, ease: 'easeOut' }} />
                  </svg>
                ) : state === 'active' ? (
                  <motion.span layoutId="step-dot" className="h-2.5 w-2.5 rounded-full bg-white" transition={{ type: 'spring', bounce: 0, duration: 0.5 }} />
                ) : (
                  i + 1
                )}
              </motion.span>
              <span className={`text-[11px] leading-tight ${state === 'active' ? 'font-medium text-neutral-800 dark:text-neutral-200' : 'text-neutral-400'}`}>{label}</span>
            </li>
            {i < steps.length - 1 && (
              <span className="mx-0.5 mt-4 h-0.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700" aria-hidden>
                <motion.span
                  className="block h-full rounded-full bg-gradient-to-r from-acm-600 to-acm-400"
                  initial={false}
                  animate={{ width: current > i ? '100%' : '0%' }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
            )}
          </Fragment>
        )
      })}
    </ol>
  )
}

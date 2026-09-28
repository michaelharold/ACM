// Adapted from React Bits' SpringCheck (reactbits.dev/micro/spring-check):
// just the box — one spring fills it from the centre, overshoots into a small
// swell and draws the tick. A real (invisible) checkbox sits on top, so
// labels, keyboard, forms and screen readers behave exactly as before.
//   <label><SpringBox checked={x} onChange={(e) => …} /> Text</label>
import { useEffect, useLayoutEffect, useRef } from 'react'
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'

const SWELL = 0.35
const clamp01 = (v) => Math.min(1, Math.max(0, v))

export function SpringBox({ checked = false, size = 18, className, ...inputProps }) {
  const reduce = useReducedMotion()
  const t = useMotionValue(checked ? 1 : 0)
  const box = useRef(null)
  const fill = useRef(null)
  const tick = useRef(null)

  const write = (v) => {
    if (fill.current) fill.current.style.transform = `scale(${Math.max(v, 0)})`
    if (box.current) box.current.style.transform = `scale(${1 + SWELL * Math.max(0, v - 1)})`
    if (tick.current) tick.current.style.strokeDashoffset = String(1 - clamp01(v))
  }
  useMotionValueEvent(t, 'change', write)
  useLayoutEffect(() => { write(t.get()) })

  useEffect(() => {
    const target = checked ? 1 : 0
    if (reduce) { t.jump(target); return undefined }
    if (t.get() === target) return undefined
    // Slow enough to see the tick draw; the bounce gives the brief swell.
    const controls = animate(t, target, { type: 'spring', visualDuration: 0.34, bounce: 0.5 })
    return () => controls.stop()
  }, [checked, reduce, t])

  return (
    <span className={cn('relative inline-grid shrink-0', className)} style={{ width: size, height: size }}>
      <input
        type="checkbox"
        checked={checked}
        className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...inputProps}
      />
      <span
        ref={box}
        aria-hidden="true"
        className={cn(
          'pointer-events-none relative grid h-full w-full place-items-center overflow-hidden rounded-[5px] ring-[1.5px] ring-inset transition-[box-shadow,--tw-ring-color] duration-300',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-acm-500/70 peer-disabled:opacity-50',
          checked ? 'shadow-[0_0_12px_rgba(31,71,245,0.5)] ring-acm-500' : 'ring-neutral-400/60 peer-hover:ring-neutral-300 dark:ring-neutral-600 dark:peer-hover:ring-neutral-400',
        )}
      >
        <span ref={fill} className="absolute inset-0 rounded-[inherit] bg-acm-600" />
        <svg viewBox="0 0 24 24" className="relative h-[74%] w-[74%] overflow-visible" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path ref={tick} d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} strokeDasharray={1} />
        </svg>
      </span>
    </span>
  )
}

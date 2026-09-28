// Motion building blocks shared across the site, after Apple's "Designing
// Fluid Interfaces" (WWDC18): springs described by bounce (≈ 1 − damping
// ratio) and duration (≈ response), momentum projection for flicks, and
// rubber-banding at edges. Pure functions — tests/unit/motion.test.mjs.
import { useEffect, useState } from 'react'

// Critically damped: the default for anything that isn't thrown.
export const SPRING = { type: 'spring', bounce: 0, duration: 0.48 }
// Sheets and drawers (damping ≈ 0.8) — a hint of life after a flick.
export const SHEET_SPRING = { type: 'spring', bounce: 0.16, duration: 0.42 }

// Where a flick would come to rest, the way scrolling decelerates:
// velocity in px/s, decelerationRate ≈ 0.998 (normal) or 0.99 (snappier).
export function project(velocity, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

// Progressive resistance past a boundary instead of a hard stop.
export function rubberband(overshoot, dimension, constant = 0.55) {
  if (!dimension) return 0
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

// The snap point nearest to a (projected) position.
export function nearest(points, value) {
  return points.reduce((best, p) => (Math.abs(p - value) < Math.abs(best - value) ? p : best), points[0] ?? 0)
}

// Live media-query match (e.g. '(min-width: 640px)').
export function useMediaQuery(query) {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches
  const [match, setMatch] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

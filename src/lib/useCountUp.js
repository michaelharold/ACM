import { useEffect, useRef, useState } from 'react'

// Animates 0 → target once the element scrolls into view.
export function useCountUp(target, { duration = 1400 } = {}) {
  const ref = useRef(null)
  const [value, setValue] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return
        started.current = true
        const start = performance.now()
        const tick = (now) => {
          const p = Math.min((now - start) / duration, 1)
          // easeOutExpo for a premium settle
          const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
          setValue(Math.round(eased * target))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [target, duration])

  return [ref, value]
}

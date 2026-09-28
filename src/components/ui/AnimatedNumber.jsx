import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

// A number that springs from what it showed before to its new value — so a
// stat that loads (or changes) counts to it instead of blinking over.
export function AnimatedNumber({ value, format = (n) => n.toLocaleString('en-IN'), className }) {
  const target = Number(value) || 0
  const reduce = useReducedMotion()
  const current = useRef(0)
  const [shown, setShown] = useState(reduce ? target : 0)

  useEffect(() => {
    if (reduce) {
      current.current = target
      setShown(target)
      return undefined
    }
    const controls = animate(current.current, target, {
      type: 'spring',
      bounce: 0,
      duration: 0.9,
      onUpdate: (v) => {
        current.current = v
        setShown(v)
      },
    })
    return () => controls.stop()
  }, [target, reduce])

  return <span className={className ? `tabular-nums ${className}` : 'tabular-nums'}>{format(Math.round(shown))}</span>
}

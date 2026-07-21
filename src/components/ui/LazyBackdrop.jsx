import { useEffect, useRef, useState } from 'react'

// Heavy WebGL/canvas backdrops mount only once their section nears the viewport,
// and never for reduced-motion users — so the page doesn't spin up every GPU
// context at load. Once mounted it stays mounted to avoid re-init flicker.
export function LazyBackdrop({ children, className, rootMargin = '300px' }) {
  const ref = useRef(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])

  return (
    <div ref={ref} aria-hidden className={className}>
      {show && children}
    </div>
  )
}

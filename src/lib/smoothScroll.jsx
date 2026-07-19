import { useEffect } from 'react'
import Lenis from 'lenis'

let lenis = null

// Smooth-scroll to an element (or px offset). Falls back to native when Lenis
// is disabled (reduced motion) or not yet mounted.
export function scrollToEl(el, opts = {}) {
  if (!el) return
  if (lenis) lenis.scrollTo(el, { offset: -84, duration: 1.1, ...opts })
  else el.scrollIntoView({ behavior: 'smooth' })
}

export function scrollToId(id) {
  scrollToEl(document.getElementById(id))
}

export function scrollToTop(immediate = false) {
  if (lenis) lenis.scrollTo(0, { immediate })
  else window.scrollTo({ top: 0, behavior: immediate ? 'auto' : 'smooth' })
}

// Mount once near the app root. Drives Lenis inertial scrolling on its own
// rAF loop; no-ops entirely for users preferring reduced motion.
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    lenis = new Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 1 })
    let raf = requestAnimationFrame(function loop(time) {
      lenis?.raf(time)
      raf = requestAnimationFrame(loop)
    })
    return () => {
      cancelAnimationFrame(raf)
      lenis?.destroy()
      lenis = null
    }
  }, [])
  return null
}

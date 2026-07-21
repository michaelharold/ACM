import { useEffect } from 'react'
import Lenis from 'lenis'

let lenis = null

// Smooth-scroll to an element. Clearance below the fixed navbar comes from the
// section's own `scroll-mt-*` class, which Lenis honours — passing an extra
// offset here would stack on top of it and drop the section below the fold.
export function scrollToEl(el, opts = {}) {
  if (!el) return
  if (lenis) lenis.scrollTo(el, { duration: 1.1, ...opts })
  else el.scrollIntoView({ behavior: 'smooth' })
}

// Scroll to a section by id, waiting for it to exist. Route transitions mount
// the incoming page a few hundred ms late, so a section link fired from another
// route has no target yet — retry across frames instead of racing a timeout.
export function scrollToId(id, retries = 60) {
  if (!id) return
  let left = retries
  const tick = () => {
    const el = document.getElementById(id)
    if (el) {
      lenis?.resize()
      return scrollToEl(el)
    }
    if (left-- > 0) requestAnimationFrame(tick)
  }
  tick()
}

export function scrollToTop(immediate = false) {
  if (lenis) lenis.scrollTo(0, { immediate, force: true })
  else window.scrollTo({ top: 0, behavior: immediate ? 'auto' : 'smooth' })
}

// Reset scroll for a fresh route. The incoming page changes the document height
// after this fires, which leaves Lenis holding a stale limit and springing back
// to the old offset — so re-measure and re-pin over the next few frames.
export function resetScroll() {
  scrollToTop(true)
  let frames = 0
  const settle = () => {
    lenis?.resize()
    scrollToTop(true)
    if (frames++ < 3) setTimeout(settle, 120)
  }
  requestAnimationFrame(settle)
}

// Re-measure after content that changes page height (route swap, data load).
export function refreshScroll() {
  lenis?.resize()
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

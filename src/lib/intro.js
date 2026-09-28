import { useEffect, useState } from 'react'

// True once the intro loader in index.html has finished (or there isn't one),
// so an entrance animation can start as the page is revealed, not behind it.
export function useIntroDone() {
  const [done, setDone] = useState(() => typeof window === 'undefined' || !!window.__acmIntroDone || !document.getElementById('acm-loader'))
  useEffect(() => {
    if (done) return
    const on = () => setDone(true)
    window.addEventListener('acm:intro-done', on)
    // Safety net: never leave the page waiting on a loader that's gone.
    const t = setTimeout(on, 8000)
    return () => {
      window.removeEventListener('acm:intro-done', on)
      clearTimeout(t)
    }
  }, [done])
  return done
}

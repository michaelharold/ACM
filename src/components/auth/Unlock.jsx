import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'

// Sign-in success: the lock gives a little shake, the shackle snaps free in a
// burst of sparks and swings open, and the page glows "welcome in".
// Portalled to <body> so it's centred on the screen itself: inside the page's
// animated route wrapper, a transformed ancestor would make "fixed" relative
// to the page instead, and on a phone the lock would sit off-centre.
export function Unlock({ name }) {
  const reduce = useReducedMotion()
  const sparks = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2)
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[200] grid h-[100dvh] w-screen place-items-center bg-neutral-950/92 backdrop-blur-md"
      role="status"
      aria-label="Signed in"
    >
      <div className="flex flex-col items-center px-6">
        <motion.div
          className="relative h-32 w-28"
          initial={false}
          animate={reduce ? {} : { x: [0, -5, 5, -3, 3, 0], rotate: [0, -3, 3, -2, 1, 0] }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <div className="absolute inset-0 rounded-full bg-acm-500/30 blur-3xl" />
          <svg viewBox="0 0 112 128" className="relative h-full w-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id="lock-body" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#5b86ff" />
                <stop offset="1" stopColor="#1634b8" />
              </linearGradient>
            </defs>
            {/* Shackle: snaps up, then swings open on its right leg */}
            <motion.path
              d="M34 60 V38 a22 22 0 0 1 44 0 V60"
              fill="none"
              stroke="#c7d6ff"
              strokeWidth="10"
              strokeLinecap="round"
              style={{ transformOrigin: '78px 60px', transformBox: 'view-box' }}
              initial={{ y: 0, rotate: 0 }}
              animate={reduce ? { y: -10 } : { y: [0, 0, -16, -14], rotate: [0, 0, 0, 34] }}
              transition={{ duration: 0.85, times: [0, 0.3, 0.55, 1], ease: [0.3, 0.7, 0.2, 1] }}
            />
            <rect x="18" y="56" width="76" height="62" rx="14" fill="url(#lock-body)" />
            <rect x="18" y="56" width="76" height="62" rx="14" fill="none" stroke="#8fb0ff" strokeOpacity="0.5" />
            <circle cx="56" cy="82" r="7" fill="#0b1d6e" />
            <rect x="53" y="84" width="6" height="16" rx="3" fill="#0b1d6e" />
            {/* Sparks as it breaks free */}
            {!reduce && sparks.map((a, i) => (
              <motion.line
                key={i}
                x1={56 + Math.cos(a) * 26}
                y1={36 + Math.sin(a) * 26}
                x2={56 + Math.cos(a) * 34}
                y2={36 + Math.sin(a) * 34}
                stroke={i % 2 ? '#8fb0ff' : '#fbbf24'}
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ opacity: 0, pathLength: 0 }}
                animate={{ opacity: [0, 1, 0], pathLength: [0, 1, 1] }}
                transition={{ delay: 0.28, duration: 0.5, ease: 'easeOut' }}
              />
            ))}
          </svg>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.55, duration: 0.4 }}
          className="mt-4 text-center"
        >
          <div className="text-lg font-bold tracking-tight text-white">Welcome in{name ? `, ${name.split(' ')[0]}` : ''}</div>
          <div className="text-sm text-neutral-400">Unlocking your chapter space…</div>
        </motion.div>
      </div>
    </motion.div>,
    document.body,
  )
}

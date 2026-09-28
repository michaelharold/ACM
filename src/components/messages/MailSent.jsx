import { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { playSwoosh } from '../../lib/sound'

// "Sent" moment for a message: the letter drops into an envelope, the flap
// folds shut, and the envelope flies off with a swoosh — then a quiet
// confirmation. Covers its (relative) parent while it plays.
export function MailSent({ show, onDone, label = 'Message sent' }) {
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!show) return undefined
    const swoosh = setTimeout(() => playSwoosh(), reduce ? 0 : 620)
    const done = setTimeout(() => onDone?.(), reduce ? 1200 : 2200)
    return () => { clearTimeout(swoosh); clearTimeout(done) }
  }, [show, reduce, onDone])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="mail"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 z-20 grid place-items-center rounded-[inherit] bg-white/95 backdrop-blur-sm dark:bg-neutral-900/95"
          role="status"
        >
          <div className="flex flex-col items-center">
            <motion.div
              className="relative h-20 w-28"
              initial={false}
              animate={reduce ? { opacity: 1 } : { x: [0, 0, 0, 170], y: [0, 0, 0, -130], rotate: [0, 0, 0, -14], scale: [1, 1, 1, 0.55], opacity: [1, 1, 1, 0] }}
              transition={{ duration: 1.35, times: [0, 0.35, 0.5, 1], ease: [0.5, 0, 0.2, 1] }}
            >
              {/* Letter sliding in */}
              <motion.div
                className="absolute left-3 right-3 top-0 h-16 rounded-md bg-white shadow ring-1 ring-neutral-200 dark:ring-neutral-700"
                initial={reduce ? { y: 18 } : { y: -34 }}
                animate={{ y: 18 }}
                transition={{ duration: 0.45, ease: [0.3, 0.7, 0.3, 1] }}
              >
                <div className="mx-3 mt-3 h-1.5 rounded bg-acm-500/70" />
                <div className="mx-3 mt-1.5 h-1.5 w-2/3 rounded bg-neutral-300" />
              </motion.div>
              {/* Envelope body */}
              <svg viewBox="0 0 112 80" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
                <defs>
                  <linearGradient id="env" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#3f6bff" />
                    <stop offset="1" stopColor="#1634b8" />
                  </linearGradient>
                </defs>
                <path d="M2 28 L56 58 L110 28 L110 76 Q110 78 108 78 L4 78 Q2 78 2 76 Z" fill="url(#env)" />
                <path d="M2 76 L46 50 M110 76 L66 50" stroke="#8fb0ff" strokeOpacity="0.5" strokeWidth="2" />
              </svg>
              {/* Flap folding shut */}
              <motion.svg
                viewBox="0 0 112 40"
                className="absolute left-0 top-[26px] h-10 w-full overflow-visible"
                style={{ transformOrigin: '50% 2px', transformBox: 'fill-box' }}
                initial={reduce ? { rotateX: 0 } : { rotateX: 180 }}
                animate={{ rotateX: 0 }}
                transition={{ delay: reduce ? 0 : 0.42, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                aria-hidden
              >
                <path d="M2 2 L56 34 L110 2 Z" fill="#2a55f0" stroke="#8fb0ff" strokeOpacity="0.4" strokeWidth="1.5" />
              </motion.svg>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0.1 : 1.15, duration: 0.35 }}
              className="-mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle2 className="h-4 w-4" /> {label}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

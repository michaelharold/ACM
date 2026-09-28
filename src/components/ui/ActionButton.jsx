import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StatusMark from '../reactbits/StatusMark'
import { Button } from './Button'

// A button that shows its own outcome, GPay-style: the label gives way to a
// spinner while the action runs, a tick draws itself when it succeeds, then
// the label eases back. (A cross when it fails.)
//   <ActionButton onAction={save} doneLabel="Saved">Save changes</ActionButton>
// `onAction` may return false to mean "didn't happen" (validation) — the
// button just returns to its label. Or drive it yourself with `status`.
export function ActionButton({ onAction, status: controlled, busy, success, children, busyLabel, doneLabel = 'Done', errorLabel = 'Try again', holdMs = 1500, disabled, type = 'button', ...props }) {
  const [inner, setInner] = useState('idle')
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  // Driven by a parent's own state: `busy` while saving, and a tick whenever
  // `success` turns on (it then fades back to the label by itself).
  const [flash, setFlash] = useState(false)
  const wasSuccess = useRef(!!success)
  useEffect(() => {
    if (success && !wasSuccess.current) {
      setFlash(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setFlash(false), holdMs)
    }
    wasSuccess.current = !!success
  }, [success, holdMs])
  const status = controlled ?? (busy ? 'busy' : flash ? 'done' : inner)

  async function run(e) {
    if (!onAction || status === 'busy') return
    clearTimeout(timer.current)
    setInner('busy')
    try {
      const ok = await onAction(e)
      if (ok === false) { setInner('idle'); return }
      setInner('done')
    } catch {
      setInner('failed')
    }
    timer.current = setTimeout(() => setInner('idle'), holdMs)
  }

  const face =
    status === 'busy' ? { key: 'busy', mark: 'running', text: busyLabel ?? children }
      : status === 'done' ? { key: 'done', mark: 'done', text: doneLabel }
        : status === 'failed' ? { key: 'failed', mark: 'failed', text: errorLabel }
          : { key: 'idle', mark: null, text: children }

  return (
    <Button
      type={type}
      disabled={disabled || status === 'busy'}
      onClick={onAction && type !== 'submit' ? run : props.onClick}
      aria-live="polite"
      {...props}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={face.key}
          initial={{ opacity: 0, y: 6, filter: 'blur(2px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
          transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
          className="inline-flex items-center gap-1.5"
        >
          {face.mark && (
            <StatusMark status={face.mark} size={17} strokeWidth={2.4} color="currentColor" doneColor="currentColor" errorColor="currentColor" drawDuration={360} spinDuration={1000} fillOpacity={0.14} strike={false} />
          )}
          {face.text}
        </motion.span>
      </AnimatePresence>
    </Button>
  )
}

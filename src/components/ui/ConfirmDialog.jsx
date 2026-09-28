import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import HoldButton from '../reactbits/HoldButton'

// A confirm/cancel gate for destructive actions ("delete this team", "remove
// this member") — anything a misclick shouldn't be able to do silently.
// `hold`: for the riskiest actions, confirming means pressing and holding
// (React Bits HoldButton) — a stray tap can't do it.
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Delete', danger = true, hold = false, doneLabel = 'Done' }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function confirm() {
    setBusy(true)
    setErr('')
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setErr(e?.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} size="md">
      <div className="p-6 sm:p-8">
        <div className={`grid h-11 w-11 place-items-center rounded-2xl ${danger ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-acm-50 text-acm-600 dark:bg-acm-500/10 dark:text-acm-400'}`}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-lg font-bold tracking-tight">{title}</h3>
        {description && <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>}
        {err && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{err}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          {hold ? (
            <HoldButton
              onHold={confirm}
              disabled={busy}
              doneLabel={doneLabel}
              size="sm"
              radius={10}
              holdTime={1400}
              releaseTime={260}
              backgroundColor="#3f1d26"
              fillColor={danger ? '#e11d48' : '#1f47f5'}
              textColor="#fecdd3"
              fillTextColor="#ffffff"
              waveAmplitude={5}
              resetAfter={0}
            >
              Hold to {confirmLabel.toLowerCase()}
            </HoldButton>
          ) : (
            <Button
              size="sm"
              onClick={confirm}
              disabled={busy}
              className={danger ? '!bg-rose-600 hover:!bg-rose-500' : ''}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

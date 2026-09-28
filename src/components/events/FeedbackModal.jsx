// Rate an event you took part in and tell the chapter what you thought —
// remarks (what worked) and suggestions (what to change). Admins read it all
// per event in Analytics → Event success.
import { useId, useState } from 'react'
import { Lock } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ActionButton } from '../ui/ActionButton'
import PeekRating from '../reactbits/PeekRating'
import { RATING_LABELS, FEEDBACK_MAX } from '../../services/engagement'
import { formatDate } from '../../lib/format'

const areaCls =
  'w-full resize-y rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-acm-500 focus:ring-4 focus:ring-acm-500/10 dark:border-neutral-800 dark:bg-neutral-900 dark:placeholder:text-neutral-500'

function TextBox({ label, hint, value, onChange, placeholder }) {
  const id = useId()
  const left = FEEDBACK_MAX - value.length
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</label>
        <span className={`text-[11px] tabular-nums ${left < 100 ? 'text-amber-500' : 'text-neutral-400'}`}>{left < 200 ? `${left} left` : hint}</span>
      </div>
      <textarea
        id={id}
        rows={3}
        maxLength={FEEDBACK_MAX}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={areaCls}
      />
    </div>
  )
}

export function FeedbackModal({ open, onClose, event, initial, onSave }) {
  // The Modal mounts its content only while open, so the form starts fresh
  // from what they saved last time on every open — no empty first frame.
  return (
    <Modal open={open} onClose={onClose} size="md">
      <FeedbackForm key={event?.id} event={event} initial={initial} onSave={onSave} onClose={onClose} />
    </Modal>
  )
}

function FeedbackForm({ event, initial, onSave, onClose }) {
  const [rating, setRating] = useState(initial?.rating || 0)
  const [remarks, setRemarks] = useState(initial?.remarks || '')
  const [suggestions, setSuggestions] = useState(initial?.suggestions || '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    if (!rating || busy || saved) return
    setBusy(true)
    setError('')
    try {
      await onSave({ rating, remarks, suggestions })
      setSaved(true)
      setTimeout(onClose, 1300) // let the tick finish drawing
    } catch {
      setError('Couldn’t save that — check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="p-6 pt-7" aria-label="Event feedback">
      <p className="text-xs font-medium uppercase tracking-wider text-acm-600 dark:text-acm-400">Your feedback</p>
      <h2 className="mt-1 pr-10 text-xl font-semibold tracking-tight">{event?.name}</h2>
      {event?.date && <p className="mt-0.5 text-xs text-neutral-500">{formatDate(event.date)}{event.venue && event.venue !== '—' ? ` · ${event.venue}` : ''}</p>}

      <div className="mt-5 flex flex-col items-center rounded-2xl border border-neutral-200 px-4 pb-3 dark:border-neutral-800">
        <PeekRating
          value={rating}
          onChange={(v) => v && setRating(v)}
          labels={RATING_LABELS}
          ariaLabel={`Your rating for ${event?.name || 'this event'}`}
          allowClear={false}
          size={30}
          lift={16}
          magnify={1.2}
          riseDuration={600}
          popScale={1.6}
          activeColor="#f5b400"
          idleColor="#404040"
          tipColor="#171717"
          tipTextColor="#fafafa"
        />
        <p className="mt-1 text-xs text-neutral-500">{rating ? RATING_LABELS[rating - 1] : 'Tap a star to rate'}</p>
      </div>

      <div className="mt-5 space-y-4">
        <TextBox
          label="Remarks"
          hint="Optional"
          value={remarks}
          onChange={setRemarks}
          placeholder="What worked? What stood out for you?"
        />
        <TextBox
          label="Suggestions"
          hint="Optional"
          value={suggestions}
          onChange={setSuggestions}
          placeholder="What should we do differently next time?"
        />
      </div>

      <p className="mt-4 flex items-start gap-1.5 text-[11px] text-neutral-500">
        <Lock className="mt-px h-3 w-3 shrink-0" /> Only the ACM TKMCE team sees this, with your name. You can change it any time.
      </p>
      {error && <p className="mt-3 text-sm text-rose-500" role="alert">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <ActionButton type="submit" busy={busy} success={saved} busyLabel="Saving…" doneLabel="Saved" disabled={!rating}>
          Save feedback
        </ActionButton>
      </div>
    </form>
  )
}

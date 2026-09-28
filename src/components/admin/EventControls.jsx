import { useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2, MessageCircle, QrCode, MapPin, Save, AlertCircle, CheckCircle2, Radio, Flag, BellRing, Send } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ActionButton } from '../ui/ActionButton'
import { Switch } from '../ui/Switch'
import { Field } from '../ui/Field'
import { useData } from '../../context/DataContext'
import * as svc from '../../services/firestore'
import { fetchUpiAccounts } from '../../services/payments'
import { isRazorpayMode } from '../../lib/payments'
import { isEnded, isLiveNow, effectiveStatus } from '../../lib/eventClock'
import { fetchEventAlerts, sendEventAlerts } from '../../services/engagement'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/cn'

const inputCls =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800'

// A show/hide switch with a line explaining what each state means for users.
export function VisibilityRow({ label, shown, onToggle, onHint, offHint, className, busy = false }) {
  return (
    <div className={cn(
      'flex items-center justify-between gap-3 rounded-lg border p-3',
      shown
        ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-500/5'
        : 'border-amber-200 bg-amber-50/70 dark:border-amber-500/25 dark:bg-amber-500/10',
      className,
    )}>
      <div className="flex min-w-0 items-start gap-2.5">
        {shown
          ? <Eye className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          : <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />}
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}{shown ? '' : ' · hidden'}</div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{shown ? onHint : offHint}</p>
        </div>
      </div>
      {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" /> : <Switch on={shown} onClick={onToggle} tone="emerald" label={label} />}
    </div>
  )
}

// Where an event is in its life, for the admin list.
export function lifecycle(event, now = Date.now()) {
  if (!event?.date) return 'scheduled'
  if (isLiveNow(event, now)) return 'live'
  if (isEnded(event, now)) return 'ended'
  return 'scheduled'
}

// One-click visibility chips on an event row: WhatsApp link and payment QR.
// A click flips visibility straight away; with no link set yet, it opens the
// controls instead.
export function EventQuickChips({ event, onSave, onOpenControls }) {
  const [busy, setBusy] = useState('')
  if (event.external) return null
  const hasWa = !!(event.whatsappLink || event.whatsappHidden)
  const paid = Number(event.fee) > 0 && !isRazorpayMode

  async function flip(key) {
    setBusy(key)
    try {
      await onSave({ [key]: !event[key] })
    } catch (err) {
      alert(err?.message || 'Could not update — please try again.')
    } finally {
      setBusy('')
    }
  }

  const chip = (shown) => cn(
    'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors disabled:opacity-60',
    shown
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
      : 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
  )
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {hasWa ? (
        <button onClick={() => flip('whatsappHidden')} disabled={!!busy} className={chip(!event.whatsappHidden)} title={event.whatsappHidden ? 'Click to show the WhatsApp link' : 'Click to hide the WhatsApp link'}>
          {busy === 'whatsappHidden' ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
          WhatsApp {event.whatsappHidden ? 'hidden' : 'shown'}
        </button>
      ) : (
        <button onClick={onOpenControls} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-neutral-300 px-2.5 text-[11px] font-medium text-neutral-400 transition-colors hover:border-acm-300 hover:text-acm-600 dark:border-neutral-700">
          <MessageCircle className="h-3 w-3" /> Add WhatsApp link
        </button>
      )}
      {paid && (
        <button onClick={() => flip('qrHidden')} disabled={!!busy} className={chip(!event.qrHidden)} title={event.qrHidden ? 'Click to show the payment QR' : 'Click to hide the payment QR'}>
          {busy === 'qrHidden' ? <Loader2 className="h-3 w-3 animate-spin" /> : <QrCode className="h-3 w-3" />}
          QR {event.qrHidden ? 'hidden' : 'shown'}
        </button>
      )}
    </div>
  )
}

// Quick controls for a scheduled or ongoing event: the things that change on
// the day — venue, WhatsApp link, payment QR — without the full editor's
// checks on dates and windows getting in the way.
export function EventControlsModal({ event, open, onClose, onSave }) {
  const { content } = useData()
  const { user } = useAuth()
  // People who tapped "Notify me" on this event, and the send result.
  const [alerts, setAlerts] = useState(null)
  const [alerting, setAlerting] = useState(false)
  const [alertNote, setAlertNote] = useState('')
  const [draft, setDraft] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open || !event) return
    let alive = true
    setErr('')
    setSaved(false)
    setDraft({
      venue: event.venue || '',
      whatsappLink: event.whatsappLink || '',
      whatsappHidden: !!event.whatsappHidden,
      upiAccountId: event.upiAccountId || '',
      qrHidden: !!event.qrHidden,
    })
    svc.fetchEventWhatsapp(event.id).then((link) => {
      if (alive && link != null) setDraft((d) => ({ ...d, whatsappLink: link }))
    })
    fetchUpiAccounts().then((l) => alive && setAccounts((l || []).filter((a) => a.active !== false))).catch(() => {})
    setAlertNote('')
    setAlerts(null)
    if (!event.external) fetchEventAlerts(event.id).then((l) => alive && setAlerts(l)).catch(() => alive && setAlerts([]))
    return () => { alive = false }
    // Keyed to the event id: a save updates the event object, and that must not
    // reset the form mid-confirmation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id])

  if (!event || !draft) return <Modal open={false} onClose={onClose} />
  const paid = Number(event.fee) > 0 && !isRazorpayMode
  const stage = lifecycle(event)
  const defaultUpi = accounts.find((a) => a.id === content?.defaultUpiAccountId)

  async function save() {
    if (!draft.venue.trim()) { setErr('Enter a venue.'); return }
    setErr('')
    setSaving(true)
    try {
      await onSave({
        venue: draft.venue.trim(),
        ...(event.external ? {} : { whatsappLink: draft.whatsappLink.trim(), whatsappHidden: !!draft.whatsappHidden }),
        ...(paid ? { upiAccountId: draft.upiAccountId, qrHidden: !!draft.qrHidden } : {}),
      })
      setSaved(true)
      setTimeout(onClose, 700)
    } catch (ex) {
      setErr(ex?.message || 'Could not save — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="grid gap-4 p-6 sm:p-8">
        <div className="pr-8">
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
            stage === 'live' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : stage === 'ended' ? 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800' : 'bg-acm-500/10 text-acm-600 dark:text-acm-400',
          )}>
            {stage === 'live' ? <Radio className="h-3 w-3" /> : <Flag className="h-3 w-3" />} {stage === 'live' ? 'Happening now' : stage === 'ended' ? 'Ended' : 'Scheduled'}
          </span>
          <h3 className="mt-2 text-lg font-bold tracking-tight">Event controls</h3>
          <p className="mt-0.5 truncate text-sm text-neutral-500 dark:text-neutral-400">{event.name}</p>
        </div>

        <Field label="Venue" hint="Changes the venue on the event page and on every registrant's ticket straight away.">
          <div className="relative mt-1">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input aria-label="Venue" className={cn(inputCls, 'pl-9')} value={draft.venue} onChange={(e) => setDraft((d) => ({ ...d, venue: e.target.value }))} />
          </div>
        </Field>

        {!event.external && (
          <div className="grid gap-2.5">
            <Field label="WhatsApp group link">
              <input
                type="url"
                aria-label="WhatsApp group link"
                placeholder="https://chat.whatsapp.com/…"
                className={cn(inputCls, 'mt-1')}
                value={draft.whatsappLink}
                onChange={(e) => setDraft((d) => ({ ...d, whatsappLink: e.target.value }))}
              />
            </Field>
            {draft.whatsappLink.trim() && (
              <VisibilityRow
                label="Show link to registrants"
                shown={!draft.whatsappHidden}
                onToggle={() => setDraft((d) => ({ ...d, whatsappHidden: !d.whatsappHidden }))}
                onHint="Verified registrants see it on their ticket and dashboard."
                offHint="Hidden everywhere, as if it never existed. Your copy stays saved."
              />
            )}
          </div>
        )}

        {paid && (
          <div className="grid gap-2.5">
            <Field label="Payment QR (collect payment to)">
              <select aria-label="Payment QR account" className={cn(inputCls, 'mt-1')} value={draft.upiAccountId} onChange={(e) => setDraft((d) => ({ ...d, upiAccountId: e.target.value }))}>
                <option value="">Default account{defaultUpi ? ` (${defaultUpi.label})` : ' (not set yet)'}</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.label} · {a.upiId}</option>)}
              </select>
            </Field>
            <VisibilityRow
              label="Show payment QR"
              shown={!draft.qrHidden}
              onToggle={() => setDraft((d) => ({ ...d, qrHidden: !d.qrHidden }))}
              onHint="Payers see the QR and can register."
              offHint="Payers see “payments paused” until you show it again."
            />
          </div>
        )}

        {!event.external && alerts && (alerts.length > 0 || alertNote) && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-acm-300/40 bg-acm-500/5 p-3.5">
            <div className="flex min-w-0 items-start gap-2.5">
              <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-acm-500" />
              <div className="min-w-0 text-sm">
                <div className="font-medium">{alertNote || `${alerts.length} ${alerts.length === 1 ? 'person is' : 'people are'} waiting to hear when registration opens`}</div>
                {!alertNote && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {effectiveStatus(event) === 'open' ? 'Registration is open — let them know.' : 'Send it once registration opens.'}
                  </p>
                )}
              </div>
            </div>
            {alerts.length > 0 && (
              <Button
                size="sm"
                disabled={alerting}
                onClick={async () => {
                  setAlerting(true)
                  try {
                    const n = await sendEventAlerts({ event, alerts, fromName: user?.name })
                    setAlerts([])
                    setAlertNote(`Sent to ${n} ${n === 1 ? 'person' : 'people'} — it’s in their inbox.`)
                  } finally {
                    setAlerting(false)
                  }
                }}
              >
                {alerting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Notify them
              </Button>
            )}
          </div>
        )}

        {err && (
          <p className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
          </p>
        )}
        <div className="flex items-center gap-3">
          <ActionButton onClick={save} disabled={saved} busy={saving} success={saved} busyLabel="Saving…" doneLabel="Saved — live now" className="flex-1">
            <Save className="h-4 w-4" /> Save changes
          </ActionButton>
        </div>
        <p className="text-xs text-neutral-400">Dates, fees and everything else are in the full editor (the arrow on the event row).</p>
      </div>
    </Modal>
  )
}

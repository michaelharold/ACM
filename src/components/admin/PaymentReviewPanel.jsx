import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ReceiptText, Loader2, AlertCircle, RefreshCw, Inbox } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { ReceiptReviewModal } from '../payments/ReceiptReviewModal'
import { fetchPendingReviews, fetchUpiAccounts } from '../../services/payments'
import { cn } from '../../lib/cn'

const inputCls =
  'rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800'

const ago = (t) => {
  const ms = typeof t?.toMillis === 'function' ? t.toMillis() : Date.parse(t) || 0
  if (!ms) return ''
  const mins = Math.round((Date.now() - ms) / 60000)
  if (mins < 60) return `${Math.max(1, mins)} min ago`
  const hrs = Math.round(mins / 60)
  return hrs < 48 ? `${hrs} h ago` : `${Math.round(hrs / 24)} days ago`
}

// The verification queue: every submitted receipt waiting for a decision,
// oldest first. Editors only see the kinds they may verify.
export function PaymentReviewPanel({ canEvents, canMembership, reviewerName, onChanged }) {
  const [items, setItems] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [loadErr, setLoadErr] = useState('')
  const [kind, setKind] = useState('all') // all | event | membership
  const [eventId, setEventId] = useState('all')
  const [open, setOpen] = useState(null)
  // The parent passes a fresh callback every render; keep the latest in a ref
  // so it isn't a dependency of `load` (which would reload in a loop).
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged

  const load = useCallback(async () => {
    setLoadErr('')
    setItems(null)
    try {
      const list = await fetchPendingReviews({ events: canEvents, membership: canMembership })
      setItems(list)
      onChangedRef.current?.(list.length)
    } catch (err) {
      setLoadErr(err?.code === 'permission-denied' ? 'Your account can’t read the payment queue.' : 'Could not load the payment queue.')
      setItems([])
    }
  }, [canEvents, canMembership])

  useEffect(() => {
    load()
    fetchUpiAccounts().then((l) => setAccounts(l || [])).catch(() => {})
  }, [load])

  const eventOptions = useMemo(() => {
    const m = new Map()
    ;(items || []).forEach((i) => { if (i.kind === 'event') m.set(i.eventId, i.title) })
    return [...m.entries()]
  }, [items])

  const filtered = (items || []).filter((i) => {
    if (kind !== 'all' && i.kind !== kind) return false
    if (eventId !== 'all' && i.eventId !== eventId) return false
    return true
  })

  function done() {
    const next = (items || []).filter((i) => i !== open)
    setItems(next)
    onChangedRef.current?.(next.length)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <ReceiptText className="h-5 w-5 text-acm-500" /> Verify payments
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            {items ? `${items.length} receipt${items.length === 1 ? '' : 's'} waiting` : 'Loading…'} · Match each UTR and amount against the account’s statement before approving.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={items === null}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {canEvents && canMembership && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-10 items-center rounded-lg border border-neutral-200 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-800">
            {[['all', 'All'], ['event', 'Events'], ['membership', 'Membership']].map(([k, label]) => (
              <button
                key={k}
                onClick={() => { setKind(k); if (k === 'membership') setEventId('all') }}
                className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  kind === k ? 'bg-acm-600 text-white' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200')}
              >
                {label}
              </button>
            ))}
          </div>
          {kind !== 'membership' && eventOptions.length > 1 && (
            <select className={cn(inputCls, 'h-10 py-0')} value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="all">All events</option>
              {eventOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
        </div>
      )}

      {items === null ? (
        <div className="grid h-40 place-items-center rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <Loader2 className="h-6 w-6 animate-spin text-acm-500" />
        </div>
      ) : loadErr ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {loadErr}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-200 p-12 text-center text-sm text-neutral-500 dark:border-neutral-800">
          <Inbox className="h-6 w-6 text-neutral-300" /> All caught up — no receipts waiting.
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {filtered.map((i) => (
            <button
              key={`${i.kind}-${i.record.id}`}
              onClick={() => setOpen(i)}
              className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{i.personName}</span>
                  <Badge tone={i.kind === 'membership' ? 'blue' : 'neutral'}>{i.kind === 'membership' ? 'Membership' : i.title}</Badge>
                </div>
                <div className="mt-0.5 truncate text-xs text-neutral-400">
                  {i.personEmail} · UTR <code>{i.record.utr}</code> · {ago(i.record.receiptSubmittedAt)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold">₹{i.record.amountDue ?? '—'}</div>
                <div className="text-xs font-medium text-acm-600 dark:text-acm-400">Review →</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <ReceiptReviewModal
        open={!!open}
        onClose={() => setOpen(null)}
        kind={open?.kind}
        record={open?.record}
        title={open?.title}
        personName={open?.personName}
        personEmail={open?.personEmail}
        reviewerName={reviewerName}
        canAct
        canCheckMember={canMembership}
        accounts={accounts}
        onDone={done}
      />
    </motion.div>
  )
}

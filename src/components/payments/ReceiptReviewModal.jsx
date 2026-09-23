import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, XCircle, AlertCircle, ZoomIn, ZoomOut, ImageOff } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { fetchReceipt, findMemberByMembershipId, approvePayment, rejectPayment } from '../../services/payments'
import { paymentState, PAYMENT_STATE_META } from '../../lib/manualPay'
import { cn } from '../../lib/cn'

const fmt = (t) => {
  const d = typeof t === 'string' ? new Date(t) : t?.toDate?.()
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
}

// One receipt, full size, with everything needed to decide: who, for what, how
// much was owed, which account it should have gone to, and the UTR to match
// against the bank statement. Approve / Reject (reason required) when allowed.
export function ReceiptReviewModal({ open, onClose, kind, record, title, personName, personEmail, reviewerName, canAct = false, canCheckMember = false, accounts = [], onDone }) {
  const [receipt, setReceipt] = useState(null) // null loading · false missing · object
  const [zoom, setZoom] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [member, setMember] = useState(undefined) // undefined n/a · null not found · { name }

  useEffect(() => {
    if (!open || !record) return
    setReceipt(null)
    setZoom(false)
    setRejecting(false)
    setReason('')
    setErr('')
    setMember(undefined)
    let alive = true
    if (record.receiptId) {
      fetchReceipt(record.receiptId).then((r) => alive && setReceipt(r || false)).catch(() => alive && setReceipt(false))
    } else {
      setReceipt(false)
    }
    const claimed = record.membershipId || record.claimedMembershipId
    if (canCheckMember && claimed) {
      findMemberByMembershipId(claimed).then((m) => alive && setMember(m)).catch(() => {})
    }
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record?.id, record?.receiptId])

  if (!record) return null
  const state = paymentState(record)
  const meta = PAYMENT_STATE_META[state]
  const account = accounts.find((a) => a.id === record.upiAccountId)
  const canDecide = canAct && state === 'review'

  async function run(fn) {
    setBusy(true)
    setErr('')
    try {
      const patch = await fn()
      onDone?.(patch)
      onClose()
    } catch (ex) {
      setErr(ex?.message || 'That didn’t go through — please try again.')
    } finally {
      setBusy(false)
    }
  }

  const approve = () => run(() => approvePayment({ kind, record, reviewer: reviewerName }))
  const reject = () => {
    if (!reason.trim()) { setErr('Add a reason — the payer sees it and can fix the problem.'); return }
    run(() => rejectPayment({ kind, record, reviewer: reviewerName, reason }))
  }

  const rows = [
    ['Payer', `${personName || '—'}${personEmail ? ` · ${personEmail}` : ''}`],
    ['For', title],
    ['Amount due', record.amountDue != null ? `₹${record.amountDue}` : '—'],
    ['Paid to', account ? `${account.label} · ${account.upiId}` : (record.upiAccountId ? 'Account since removed' : 'Default account')],
    ['UTR', record.utr || receipt?.utr || '—'],
    ['Submitted', fmt(record.receiptSubmittedAt)],
    ...(record.reviewedBy ? [['Reviewed', `${record.reviewedBy} · ${fmt(record.reviewedAt)}`]] : []),
  ]

  return (
    <Modal open={open} onClose={() => !busy && onClose()} size="xl">
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3 pr-8">
            <h3 className="text-lg font-bold tracking-tight">Payment receipt</h3>
            {receipt && (
              <button onClick={() => setZoom((z) => !z)} className="inline-flex items-center gap-1.5 text-xs font-medium text-acm-600 dark:text-acm-400">
                {zoom ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />} {zoom ? 'Fit' : 'Actual size'}
              </button>
            )}
          </div>
          <div className={cn('rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900', zoom ? 'max-h-[70vh] overflow-auto' : 'grid place-items-center')}>
            {receipt === null ? (
              <div className="grid h-80 w-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-acm-500" /></div>
            ) : receipt === false ? (
              <div className="flex h-60 flex-col items-center justify-center gap-2 text-sm text-neutral-400">
                <ImageOff className="h-6 w-6" /> {record.receiptId ? 'Receipt image not found.' : 'No receipt uploaded.'}
              </div>
            ) : (
              <img src={receipt.image} alt="Payment receipt" className={zoom ? 'max-w-none' : 'max-h-[70vh] w-auto object-contain'} />
            )}
          </div>
        </div>

        <div className="grid content-start gap-4">
          <div className="flex items-center gap-2"><Badge tone={meta.tone} dot={state === 'verified'}>{meta.label}</Badge></div>
          <dl className="grid gap-2.5 text-sm">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-neutral-400">{k}</dt>
                <dd className={cn('break-words font-medium', k === 'UTR' && 'font-mono')}>{v}</dd>
              </div>
            ))}
            {(record.membershipId || record.claimedMembershipId) && (
              <div>
                <dt className="text-xs text-neutral-400">{record.membershipId ? 'Membership ID (verified at registration)' : 'Claimed membership ID (not verified)'}</dt>
                <dd className="font-medium">
                  {record.membershipId || record.claimedMembershipId}
                  {member === null && <span className="ml-1.5 text-rose-600 dark:text-rose-400">✗ no member with this ID</span>}
                  {member && <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">✓ {member.name || 'member found'}</span>}
                </dd>
              </div>
            )}
            {state === 'rejected' && record.rejectReason && (
              <div>
                <dt className="text-xs text-neutral-400">Rejection reason</dt>
                <dd className="font-medium text-rose-600 dark:text-rose-400">{record.rejectReason}</dd>
              </div>
            )}
          </dl>

          {canDecide && (
            <div className="grid gap-2.5 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              {rejecting ? (
                <>
                  <textarea
                    autoFocus
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why? e.g. Amount doesn’t match / screenshot unreadable / UTR not found in statement"
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 dark:border-neutral-700 dark:bg-neutral-800"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setRejecting(false)} disabled={busy}>Back</Button>
                    <Button className="flex-1 !border-rose-600 !bg-rose-600 hover:!border-rose-700 hover:!bg-rose-700" onClick={reject} disabled={busy}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Reject
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Button className="!border-emerald-600 !bg-emerald-600 hover:!border-emerald-700 hover:!bg-emerald-700" onClick={approve} disabled={busy || receipt === null}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve payment
                  </Button>
                  <Button variant="outline" onClick={() => setRejecting(true)} disabled={busy}>
                    <XCircle className="h-4 w-4" /> Reject…
                  </Button>
                </>
              )}
              <p className="text-[11px] text-neutral-400">
                {kind === 'membership'
                  ? 'Approving makes them an ACM member; assign their Membership ID in the Membership tab.'
                  : 'Approving issues their ticket. Rejecting frees their seat and lets them upload a new receipt.'}
              </p>
            </div>
          )}

          {err && (
            <p className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}

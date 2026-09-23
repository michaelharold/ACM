import { useState } from 'react'
import { Loader2, Send, AlertCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { PayToCard } from './PayToCard'
import { ReceiptUploader } from './ReceiptUploader'
import { useUpiAccount } from './useUpiAccount'
import { receiptReady } from '../../lib/manualPay'

// Upload — or re-upload — the receipt for an existing registration or
// membership: a team leader whose receipt didn't go through, or anyone whose
// receipt was rejected. `onSubmit(receipt)` performs the write and may throw a
// readable error, which is shown here.
export function ReceiptUploadModal({ open, onClose, title, amount, upiAccountId, note, rejectReason, onSubmit }) {
  const [receipt, setReceipt] = useState({ image: '', utr: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const { account, loading } = useUpiAccount(upiAccountId || '', open)

  function close() {
    if (busy) return
    setReceipt({ image: '', utr: '' })
    setErr('')
    onClose()
  }

  async function submit() {
    setBusy(true)
    setErr('')
    try {
      await onSubmit(receipt)
      setReceipt({ image: '', utr: '' })
      onClose()
    } catch (ex) {
      setErr(ex?.message || 'Couldn’t submit your receipt. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={close} size="md">
      <div className="grid gap-4 p-6 sm:p-8">
        <div className="pr-8">
          <span className="text-xs font-medium uppercase tracking-wide text-acm-600 dark:text-acm-400">Payment receipt</span>
          <h3 className="mt-1 text-lg font-bold tracking-tight">{title}</h3>
        </div>
        {rejectReason && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
            <strong>Previous receipt rejected:</strong> {rejectReason}
          </p>
        )}
        <PayToCard account={account} amount={amount} note={note} loading={loading} />
        <ReceiptUploader value={receipt} onChange={setReceipt} disabled={busy} />
        {err && (
          <p className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
          </p>
        )}
        <Button onClick={submit} disabled={busy || !account || !receiptReady(receipt)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit receipt
        </Button>
      </div>
    </Modal>
  )
}

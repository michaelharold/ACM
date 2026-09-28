import { useRef, useState } from 'react'
import { ImageUp, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Input } from '../ui/Input'
import { prepareReceipt } from '../../lib/imagePrep'
import { isValidUtr, normalizeUtr } from '../../lib/manualPay'

// Collects the proof of payment: a screenshot (compressed in the browser so it
// fits a Firestore document) and the 12-digit UPI transaction ID. Controlled:
// `value` is { image, utr } and `onChange` receives the next value.
export function ReceiptUploader({ value, onChange, disabled = false }) {
  const fileRef = useRef(null)
  // The latest value, so a screenshot that finishes processing after the
  // payer has typed the transaction ID doesn't wipe what they typed.
  const latest = useRef(value)
  latest.current = value
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const utr = value?.utr || ''
  const utrBad = utr.trim().length > 0 && !isValidUtr(utr)

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr('')
    setBusy(true)
    try {
      const image = await prepareReceipt(file)
      onChange({ ...latest.current, image })
    } catch (ex) {
      setErr(ex?.message || 'Couldn’t read that image. Try another screenshot.')
    } finally {
      setBusy(false)
    }
  }

  const openPicker = () => fileRef.current?.click()

  return (
    <div className="grid gap-3.5">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Payment screenshot</span>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} disabled={disabled} />
        {value?.image ? (
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 p-2.5 dark:border-neutral-800">
            <img src={value.image} alt="Your payment screenshot" className="h-20 w-16 shrink-0 rounded-lg bg-neutral-100 object-contain dark:bg-neutral-800" />
            <p className="min-w-0 flex-1 text-xs text-neutral-500 dark:text-neutral-400">
              Screenshot attached. Make sure the amount and transaction ID are readable.
            </p>
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled || busy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-acm-300 disabled:opacity-50 dark:border-neutral-700"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Change
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled || busy}
            className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500 transition-colors hover:border-acm-300 hover:text-acm-600 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-400 dark:hover:text-acm-400"
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImageUp className="h-6 w-6" />}
            {busy ? 'Preparing…' : 'Upload payment screenshot'}
          </button>
        )}
        {err && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
          </p>
        )}
      </div>
      <div>
        <Input
          label="UPI transaction ID (UTR)"
          inputMode="numeric"
          autoComplete="off"
          maxLength={16}
          placeholder="12-digit number, e.g. 412345678901"
          value={utr}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, utr: e.target.value.replace(/[^\d\s]/g, '') })}
          hint="In your UPI app, open this payment’s details — it’s called “UPI Ref No.”, “UTR” or “Transaction ID”."
        />
        {utrBad && (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">
            A UPI transaction ID is exactly 12 digits ({normalizeUtr(utr).length} entered).
          </p>
        )}
      </div>
    </div>
  )
}

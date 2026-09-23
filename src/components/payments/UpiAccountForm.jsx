import { useRef, useState } from 'react'
import { ImageUp, Loader2, Save, AlertCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { prepareQr } from '../../lib/imagePrep'
import { isValidUpiId } from '../../lib/manualPay'
import { createUpiAccount, updateUpiAccount } from '../../services/payments'

const inputCls =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800'

// Add or edit one UPI/QR account. Shared by the Payments tab and the event
// editor's "+ Add new QR account" shortcut. onSaved(account) gets the saved
// record, id included.
export function UpiAccountForm({ initial, onSaved, onCancel }) {
  const [draft, setDraft] = useState({
    label: initial?.label || '',
    payeeName: initial?.payeeName || '',
    upiId: initial?.upiId || '',
    qrImage: initial?.qrImage || '',
  })
  const [busy, setBusy] = useState(false)
  const [qrBusy, setQrBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }))

  async function pickQr(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setQrBusy(true)
    setErr('')
    try {
      const qrImage = await prepareQr(file)
      setDraft((d) => ({ ...d, qrImage }))
    } catch (ex) {
      setErr(ex?.message || 'Couldn’t read that image.')
    } finally {
      setQrBusy(false)
    }
  }

  async function save() {
    if (!draft.label.trim()) return setErr('Give the account a label, e.g. “ACM Main”.')
    if (!isValidUpiId(draft.upiId)) return setErr('Enter a valid UPI ID, e.g. acmtkmce@okicici.')
    if (!draft.qrImage) return setErr('Upload the account’s UPI QR code.')
    setBusy(true)
    setErr('')
    try {
      const clean = { label: draft.label.trim(), payeeName: draft.payeeName.trim(), upiId: draft.upiId.trim(), qrImage: draft.qrImage }
      let saved
      if (initial?.id) {
        await updateUpiAccount(initial.id, clean)
        saved = { ...initial, ...clean }
      } else {
        saved = await createUpiAccount(clean)
      }
      onSaved(saved)
    } catch (ex) {
      setErr(ex?.message || 'Couldn’t save the account — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[132px_1fr]">
      <div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickQr} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="grid aspect-square w-full place-items-center overflow-hidden rounded-xl border-2 border-dashed border-neutral-200 bg-white text-xs text-neutral-400 transition-colors hover:border-acm-300 dark:border-neutral-700 dark:bg-neutral-800"
        >
          {qrBusy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : draft.qrImage ? (
            <img src={draft.qrImage} alt="QR code preview" className="h-full w-full bg-white object-contain p-1" />
          ) : (
            <span className="flex flex-col items-center gap-1 px-2 text-center"><ImageUp className="h-5 w-5" /> Upload QR</span>
          )}
        </button>
        {draft.qrImage && <p className="mt-1 text-center text-[11px] text-neutral-400">Click to replace</p>}
      </div>
      <div className="grid content-start gap-2.5">
        <input className={inputCls} placeholder="Label (e.g. ACM Main)" value={draft.label} onChange={set('label')} />
        <input className={inputCls} placeholder="Payee name shown to payers (optional)" value={draft.payeeName} onChange={set('payeeName')} />
        <input className={inputCls} placeholder="UPI ID (e.g. acmtkmce@okicici)" value={draft.upiId} onChange={set('upiId')} autoCapitalize="none" spellCheck={false} />
        {err && (
          <p className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
          </p>
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={busy || qrBusy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {initial?.id ? 'Save changes' : 'Add account'}
          </Button>
          {onCancel && <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>}
        </div>
      </div>
    </div>
  )
}

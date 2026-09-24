import { useState } from 'react'
import { Copy, Check, Smartphone, AlertCircle, QrCode, PauseCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { upiLink } from '../../lib/manualPay'

// "Pay here" block for the manual flow: the UPI account's QR, payee, UPI ID and
// the exact amount, plus a deep link that opens the payer's UPI app on phones.
// With no account configured it says so plainly instead of guessing.
export function PayToCard({ account, amount, note, loading = false, paused = false }) {
  const [copied, setCopied] = useState(false)

  // An admin hid this event's QR (e.g. while switching accounts).
  if (paused) return <PaymentsPaused />

  if (loading) return <div className="h-44 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800/60" />

  if (!account) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        Payment details aren’t set up for this yet. Please contact the organisers before paying.
      </p>
    )
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(account.upiId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked — the ID is on screen to copy by hand */ }
  }

  const payee = account.payeeName || account.label
  return (
    <div className="grid gap-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 sm:grid-cols-[160px_1fr] dark:border-neutral-800 dark:bg-neutral-900/50">
      {account.qrImage ? (
        <img
          src={account.qrImage}
          alt={`UPI QR code for ${payee}`}
          className="mx-auto aspect-square w-44 rounded-lg bg-white object-contain p-1.5 sm:w-full"
        />
      ) : (
        <div className="mx-auto grid aspect-square w-44 place-items-center rounded-lg bg-white text-neutral-300 sm:w-full dark:bg-neutral-800">
          <QrCode className="h-10 w-10" />
        </div>
      )}
      <div className="min-w-0 text-sm">
        <div className="text-xs uppercase tracking-wide text-neutral-400">Pay exactly</div>
        <div className="text-2xl font-extrabold tracking-tight">₹{amount}</div>
        <div className="mt-2 text-neutral-500 dark:text-neutral-400">
          to <span className="font-medium text-neutral-800 dark:text-neutral-200">{payee}</span>
        </div>
        <button
          type="button"
          onClick={copyId}
          className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 font-mono text-xs transition-colors hover:border-acm-300 dark:border-neutral-700 dark:bg-neutral-800"
        >
          <span className="truncate">{account.upiId}</span>
          {copied ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 shrink-0 text-neutral-400" />}
        </button>
        <Button
          as="a"
          href={upiLink({ upiId: account.upiId, payeeName: payee, amount, note })}
          size="sm"
          className="mt-3 w-full sm:hidden"
        >
          <Smartphone className="h-4 w-4" /> Pay with UPI app
        </Button>
        <p className="mt-3 text-xs text-neutral-400">
          Scan with any UPI app (GPay, PhonePe, Paytm…), pay ₹{amount}, then upload the payment screenshot below.
        </p>
      </div>
    </div>
  )
}

export function PaymentsPaused() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-500/25 dark:bg-amber-500/10">
      <PauseCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
      <div>
        <div className="font-semibold text-amber-900 dark:text-amber-100">Payments are paused for this event</div>
        <p className="mt-0.5 text-amber-800/80 dark:text-amber-200/80">The organisers have taken the payment QR down for a moment. Please check back shortly — nothing is lost.</p>
      </div>
    </div>
  )
}

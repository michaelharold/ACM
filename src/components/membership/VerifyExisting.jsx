import { useState } from 'react'
import { motion } from 'framer-motion'
import { Hourglass, ShieldCheck, Loader2, AlertCircle, XCircle, Fingerprint, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { requestVerification, cancelVerification } from '../../services/membership'
import { cn } from '../../lib/cn'

const when = (t) => {
  const d = typeof t === 'string' ? new Date(t) : t?.toDate?.()
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}

// "Already a member?" — the member types the ID they got before this website
// existed. A roster match makes them a member instantly; otherwise the request
// waits for an admin. `onResult` receives requestVerification's result.
export function VerifyExistingForm({ user, membership, request, onResult, className }) {
  const [id, setId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      onResult(await requestVerification({ user, membershipId: id, membership, request }))
    } catch (ex) {
      setErr(ex?.message || 'We couldn’t send your request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={submit}
      className={cn('rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 dark:border-neutral-800 dark:bg-neutral-900', className)}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-acm-500/10 text-acm-600 dark:text-acm-400">
          <Fingerprint className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold tracking-tight">Already an ACM member?</h3>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            Joined the chapter before this website? Enter your membership ID to unlock every member benefit, including event discounts.
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input label="ACM Membership ID" value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. 1234567" autoComplete="off" />
        </div>
        <Button type="submit" disabled={busy || !id.trim()} className="sm:w-auto">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {busy ? 'Verifying…' : 'Verify'}
        </Button>
      </div>
      {err && (
        <p className="mt-3 flex items-start gap-2 text-xs text-rose-600 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
        </p>
      )}
      <p className="mt-4 text-xs text-neutral-400">
        We check the ID against the chapter’s member list for <strong className="font-medium text-neutral-500 dark:text-neutral-300">{user.email}</strong>. If it can’t be matched automatically, the team verifies it by hand.
      </p>
    </motion.form>
  )
}

// The yellow-glow "Pending approval" card, in the same neon style as the green
// "Verified" box on event passes.
export function PendingVerification({ request, onCancelled, compact = false }) {
  const [busy, setBusy] = useState(false)
  async function cancel() {
    setBusy(true)
    try {
      await cancelVerification(request.userId || request.id)
      onCancelled?.()
    } catch {
      setBusy(false)
    }
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-amber-400/80 bg-amber-400/10 shadow-[0_0_18px_rgba(251,191,36,0.45),inset_0_0_14px_rgba(251,191,36,0.18)] dark:bg-amber-500/10',
        compact ? 'p-3.5' : 'p-6 sm:p-7',
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/25 blur-3xl" />
      <div className="relative flex items-start gap-3">
        <span className={cn('relative grid shrink-0 place-items-center rounded-xl bg-amber-400/20 text-amber-600 dark:text-amber-300', compact ? 'h-8 w-8' : 'h-11 w-11')}>
          <Hourglass className={cn('drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]', compact ? 'h-4 w-4' : 'h-5 w-5')} />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-amber-400" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">Membership verification</div>
          <div className={cn('font-bold text-amber-800 [text-shadow:0_0_12px_rgba(251,191,36,0.55)] dark:text-amber-100', compact ? 'text-sm' : 'text-lg')}>
            Pending approval
          </div>
          <p className={cn('mt-1 text-amber-900/80 dark:text-amber-100/80', compact ? 'text-xs' : 'text-sm')}>
            ID <span className="font-mono font-semibold">{request.membershipId}</span>
            {when(request.createdAt) ? ` · sent ${when(request.createdAt)}` : ''}
            {compact ? '' : '. The team will verify it shortly; you’ll get every member benefit as soon as it’s approved.'}
          </p>
          {!compact && onCancelled && (
            <Button variant="ghost" size="sm" className="mt-3 -ml-2 text-amber-800 hover:bg-amber-400/15 dark:text-amber-200" onClick={cancel} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Withdraw request
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function DeniedVerification({ request, className }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm dark:border-rose-500/25 dark:bg-rose-500/10', className)}>
      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
      <div className="min-w-0">
        <div className="font-semibold text-rose-800 dark:text-rose-200">We couldn’t verify membership ID {request.membershipId}</div>
        <p className="mt-0.5 text-rose-700/90 dark:text-rose-300/90">
          {request.denyReason ? `${request.denyReason} ` : ''}Check the ID and try again, or join the chapter below.
        </p>
      </div>
    </div>
  )
}

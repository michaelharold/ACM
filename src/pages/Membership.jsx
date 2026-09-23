import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BadgeCheck, CreditCard, ShieldCheck, AlertCircle, Mail, Fingerprint, Loader2, UserCog, GraduationCap, Clock, Upload } from 'lucide-react'
import { SectionHeading } from '../components/SectionHeading'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { fetchMembership, createMembership, probeWritable } from '../services/firestore'
import { payFor, isRazorpayMode, PAYMENT_MODE } from '../lib/payments'
import { createMembershipWithReceipt, attachReceipt } from '../services/payments'
import { paymentState, hasTicket, needsReceipt, receiptReady, PAYMENT_STATE_META } from '../lib/manualPay'
import { PayToCard } from '../components/payments/PayToCard'
import { ReceiptUploader } from '../components/payments/ReceiptUploader'
import { ReceiptUploadModal } from '../components/payments/ReceiptUploadModal'
import { useUpiAccount } from '../components/payments/useUpiAccount'
import { cn } from '../lib/cn'
import { avatarDataUri } from '../lib/avatar'
import { isProfileComplete } from '../lib/profile'
import { isTkmCollege } from '../lib/orgData'

const fullName = (m) => [m.firstName, m.middleName, m.lastName].filter(Boolean).join(' ')

export default function Membership() {
  const { user, loading } = useAuth()
  const { content, departments } = useData()
  const navigate = useNavigate()
  const membershipFee = Number(content?.membershipFee) || 0
  // A fee is collected in either payment mode; `manual` = UPI QR + receipt.
  const manual = !isRazorpayMode
  const chargesFee = membershipFee > 0 && (PAYMENT_MODE === 'manual' || isRazorpayMode)

  // phase: 'loading' | 'incomplete-profile' | 'not-tkm' | 'form' | 'status' | 'blocked'
  const [phase, setPhase] = useState('loading')
  const [membership, setMembership] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false) // captured but not yet verified

  // Signed-out visitors are sent to sign in, then bounced straight back here.
  useEffect(() => {
    if (!loading && !user) navigate('/auth', { replace: true, state: { from: '/membership' } })
  }, [user, loading, navigate])

  // Load any existing application; otherwise confirm the backend can accept a
  // write before we let them fill the form out.
  useEffect(() => {
    if (!user) return
    // Membership needs a real, complete profile first — same bar as event
    // registration (name, phone, department, year, college, gender) — and
    // then it's TKM-only: the site can only vouch for its own chapter's roster.
    if (!isProfileComplete(user)) { setPhase('incomplete-profile'); return }
    if (!isTkmCollege(user.college)) { setPhase('not-tkm'); return }
    let alive = true
    ;(async () => {
      try {
        const existing = await fetchMembership(user.id)
        if (!alive) return
        if (existing) {
          setMembership(existing)
          setPhase('status')
          return
        }
        await probeWritable(user.id)
        if (alive) setPhase('form')
      } catch {
        if (alive) setPhase('blocked')
      }
    })()
    return () => { alive = false }
  }, [user])

  async function handleSubmit(e, { receipt, accountId } = {}) {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget))
    setError('')
    setSubmitting(true)
    const data = {
      googleName: user.googleName || user.name || '',
      firstName: f.firstName.trim(),
      middleName: f.middleName.trim(),
      lastName: f.lastName.trim(),
      email: f.email.trim(),
      phone: f.phone.trim(),
      department: f.department,
      className: f.className.trim(),
    }

    // Manual payment: the application, its receipt and the UTR are written
    // together. Errors here (e.g. a reused transaction ID) are the payer's to
    // fix, so show them inline rather than the "service unavailable" screen.
    if (manual && chargesFee) {
      try {
        const created = await createMembershipWithReceipt(
          user.id,
          { ...data, amountDue: membershipFee, upiAccountId: accountId || '' },
          { ...receipt, amount: membershipFee },
        )
        setMembership(created)
        setPhase('status')
      } catch (err) {
        setError(err?.message || 'We couldn’t submit your application. Please try again.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    let created
    try {
      created = await createMembership(user.id, {
        ...data,
        amountDue: chargesFee ? membershipFee : 0,
        // Only 'pending' when a fee will actually be collected online — otherwise
        // there's nothing to pay, so it's 'free' (avoids a misleading "Pending").
        paymentStatus: chargesFee ? 'pending' : 'free',
      })
    } catch {
      setPhase('blocked')
      setSubmitting(false)
      return
    }
    // Razorpay mode: collect the fee if one is configured. A cancel/failure here
    // does NOT lose the application — it stays recorded as 'pending' and can be
    // paid later from the status screen (the server flips it to 'paid').
    if (chargesFee) {
      try {
        const result = await payFor({
          type: 'membership',
          refId: user.id,
          prefill: { name: fullName(created) || user.name, email: created.email || user.email, contact: created.phone },
        })
        if (result.status === 'paid') created = { ...created, paymentStatus: 'paid' }
        else if (result.status === 'pending_confirmation') setConfirming(true) // money taken, webhook finalises
      } catch (err) {
        setError(err?.message || 'Payment was not completed — you can pay from the next screen.')
      }
    }
    setMembership(created)
    setPhase('status')
    setSubmitting(false)
  }

  // Manual mode: upload a receipt after a rejection (or for an older
  // application that never had one).
  async function handleResubmit(receipt) {
    const applied = await attachReceipt({
      kind: 'membership',
      refId: user.id,
      userId: user.id,
      ...receipt,
      amount: membership.amountDue || membershipFee,
    })
    setMembership((m) => ({ ...m, ...applied }))
  }

  // Retry payment from the status screen when an application is still unpaid.
  // Returns the result so the status card can reflect a "confirming" outcome.
  async function handlePayNow() {
    setError('')
    const result = await payFor({
      type: 'membership',
      refId: user.id,
      prefill: { name: fullName(membership) || user.name, email: membership.email || user.email, contact: membership.phone },
    })
    if (result.status === 'paid') setMembership((m) => ({ ...m, paymentStatus: 'paid' }))
    else if (result.status === 'pending_confirmation') setConfirming(true)
    return result
  }

  if (loading || phase === 'loading' || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-acm-500" />
      </div>
    )
  }

  return (
    <div className="pt-28">
      <div className="section-shell max-w-3xl py-12">
        <SectionHeading
          eyebrow="Membership"
          title="Join ACM TKMCE"
          description="Become a member of the chapter — get member discounts on events and workshops, and a spot in the community."
        />

        {phase === 'incomplete-profile' && <IncompleteProfile />}
        {phase === 'not-tkm' && <NotTkm />}
        {phase === 'blocked' && <Blocked />}

        {phase === 'form' && (
          <MembershipForm user={user} onSubmit={handleSubmit} submitting={submitting} error={error} fee={membershipFee} chargesFee={chargesFee} manual={manual} upiAccountId={content?.membershipUpiAccountId || ''} departments={departments} />
        )}

        {phase === 'status' && membership && (
          <StatusCard membership={membership} user={user} chargesFee={chargesFee} fee={membershipFee} onPay={handlePayNow} error={error} confirming={confirming} manual={manual} onResubmit={handleResubmit} upiAccountId={content?.membershipUpiAccountId || ''} />
        )}
      </div>
    </div>
  )
}

function MembershipForm({ user, onSubmit, submitting, error, fee, chargesFee, manual, upiAccountId, departments }) {
  const collectsReceipt = manual && chargesFee
  const [receipt, setReceipt] = useState({ image: '', utr: '' })
  const { account, loading: accountLoading } = useUpiAccount(upiAccountId, collectsReceipt)
  return (
    <motion.form
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={(e) => onSubmit(e, { receipt, accountId: account?.id })}
      className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="First name" name="firstName" required placeholder="First" />
        <Input label="Middle name" name="middleName" placeholder="(if any)" />
        <Input label="Last name" name="lastName" required placeholder="Last" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input label="Email" name="email" type="email" required defaultValue={user.email || ''} placeholder="you@tkmce.ac.in" />
        <Input label="Phone number" name="phone" type="tel" placeholder="+91 …" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Select label="Department" name="department" defaultValue={user.department || ''} required>
          <option value="">Select department</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
        <Input label="Class" name="className" placeholder="e.g. R5B" />
      </div>

      {collectsReceipt && (
        <div className="mt-7 grid gap-4 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <div>
            <h3 className="text-sm font-semibold">Membership fee</h3>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">Pay ₹{fee} by UPI, then attach the receipt — the team verifies it and assigns your Membership ID.</p>
          </div>
          <PayToCard account={account} loading={accountLoading} amount={fee} note="ACM TKMCE membership" />
          <ReceiptUploader value={receipt} onChange={setReceipt} disabled={submitting} />
        </div>
      )}

      {error && (
        <p className="mt-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      <div className="mt-7 flex flex-col gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <Button type="submit" size="lg" disabled={submitting || (collectsReceipt && (!account || !receiptReady(receipt)))} className="w-full sm:w-auto">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {submitting ? 'Submitting…' : collectsReceipt ? 'Submit application & receipt' : chargesFee ? `Proceed to Pay ₹${fee}` : 'Submit application'}
        </Button>
        <p className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          {collectsReceipt
            ? 'Your Membership ID is assigned once the team verifies your payment.'
            : chargesFee
              ? 'Paid securely via Razorpay. Your Membership ID is assigned by the team once your payment is confirmed.'
              : 'Your details are saved now; your Membership ID follows once it’s confirmed.'}
        </p>
      </div>
    </motion.form>
  )
}

function StatusCard({ membership, user, chargesFee, fee, onPay, error, confirming, manual, onResubmit, upiAccountId }) {
  const [paying, setPaying] = useState(false)
  const [payErr, setPayErr] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const isPaid = membership.paymentStatus === 'paid'
  const assigned = membership.membershipId && membership.membershipId.trim()
  const state = paymentState(membership)
  // Manual mode: a member once verified (or free). Razorpay mode: the old rule.
  const isMember = manual ? hasTicket(membership) : !(chargesFee && !isPaid && !confirming)

  async function pay() {
    setPayErr('')
    setPaying(true)
    try {
      await onPay()
    } catch (e) {
      setPayErr(e?.message || 'Payment was not completed.')
    } finally {
      setPaying(false)
    }
  }
  const rows = [
    { label: 'Name', value: fullName(membership) || user.name },
    { label: 'Email', value: membership.email || user.email },
    { label: 'Phone', value: membership.phone || '—' },
    { label: 'Department', value: membership.department || '—' },
    { label: 'Class', value: membership.className || '—' },
    // Show a real payment state: Paid if paid, Confirming if the money was taken
    // but not yet verified, Pending only when a fee is actually collectable right
    // now, otherwise there's no charge → Free.
    { label: 'Payment', value: manual ? PAYMENT_STATE_META[state].label : (isPaid ? 'Paid' : confirming ? 'Confirming…' : chargesFee ? 'Pending' : 'Free') },
  ]
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-10 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex items-center gap-4 border-b border-neutral-100 bg-gradient-to-r from-acm-600/10 to-transparent p-6 dark:border-neutral-800">
        <img src={user.avatar || avatarDataUri(user.name || 'ACM Member')} alt="" className="h-14 w-14 rounded-2xl object-cover" />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold tracking-tight">{fullName(membership) || user.name}</h3>
          {isMember ? (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-acm-500/10 px-2.5 py-1 text-xs font-semibold text-acm-600 dark:text-acm-400">
              <BadgeCheck className="h-3.5 w-3.5" /> ACM Member
            </span>
          ) : (
            <span className={cn(
              'mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              state === 'rejected' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
            )}>
              <CreditCard className="h-3.5 w-3.5" /> {manual ? `Payment ${PAYMENT_STATE_META[state].label.toLowerCase()}` : 'Payment pending'}
            </span>
          )}
        </div>
      </div>

      <dl className="grid gap-x-8 gap-y-3 p-6 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 border-b border-neutral-100 py-1.5 text-sm dark:border-neutral-800/60">
            <dt className="text-neutral-500 dark:text-neutral-400">{r.label}</dt>
            <dd className="truncate text-right font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>

      {confirming && !isPaid && (
        <div className="m-6 mt-0 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/25 dark:bg-blue-500/10">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-500" />
          <div className="text-sm">
            <div className="font-semibold">Payment received — confirming</div>
            <div className="text-neutral-500 dark:text-neutral-400">Your payment went through; this will update to Paid shortly.</div>
          </div>
        </div>
      )}

      {!manual && chargesFee && !isPaid && !confirming && (
        <div className="m-6 mt-0 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/25 dark:bg-amber-500/10">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold">Membership fee pending</div>
              <div className="text-neutral-500 dark:text-neutral-400">Complete your ₹{fee} payment to finish joining.</div>
            </div>
            <Button size="sm" onClick={pay} disabled={paying}>
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {paying ? 'Processing…' : `Pay ₹${fee}`}
            </Button>
          </div>
          {(payErr || error) && (
            <p className="mt-2.5 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {payErr || error}
            </p>
          )}
        </div>
      )}

      {manual && state === 'review' && (
        <div className="m-6 mt-0 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/25 dark:bg-blue-500/10">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
          <div className="text-sm">
            <div className="font-semibold">Receipt submitted — under review</div>
            <div className="text-neutral-500 dark:text-neutral-400">
              The team is verifying your payment{membership.utr ? ` (UTR ${membership.utr})` : ''}. You’ll be a member as soon as it’s approved.
            </div>
          </div>
        </div>
      )}

      {manual && needsReceipt(membership) && (
        <div className={cn(
          'm-6 mt-0 rounded-xl border p-4',
          state === 'rejected'
            ? 'border-rose-200 bg-rose-50 dark:border-rose-500/25 dark:bg-rose-500/10'
            : 'border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10',
        )}>
          <div className="flex flex-wrap items-center gap-3">
            <AlertCircle className={cn('h-5 w-5 shrink-0', state === 'rejected' ? 'text-rose-500' : 'text-amber-500')} />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold">{state === 'rejected' ? 'Your receipt was rejected' : 'Membership fee pending'}</div>
              <div className="text-neutral-600 dark:text-neutral-300">
                {state === 'rejected'
                  ? (membership.rejectReason || 'Please upload a clearer receipt.')
                  : `Pay ₹${membership.amountDue || fee} and upload the receipt to finish joining.`}
              </div>
            </div>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Upload receipt
            </Button>
          </div>
        </div>
      )}

      <div className="m-6 mt-0 flex items-center gap-3 rounded-xl border border-acm-200 bg-acm-50/60 p-4 dark:border-acm-500/25 dark:bg-acm-500/5">
        <Fingerprint className="h-5 w-5 shrink-0 text-acm-500" />
        <div className="text-sm">
          <div className="font-semibold">Membership ID</div>
          <div className="text-neutral-500 dark:text-neutral-400">
            {assigned
              ? membership.membershipId
              : !isMember
                ? (manual ? 'Assigned once your payment is verified.' : 'Assigned once your payment is confirmed.')
                : 'Will be updated soon.'}
          </div>
        </div>
      </div>
      {manual && (
        <ReceiptUploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          title="ACM Membership"
          amount={membership.amountDue || fee}
          upiAccountId={membership.upiAccountId || upiAccountId}
          note="ACM TKMCE membership"
          rejectReason={state === 'rejected' ? membership.rejectReason : ''}
          onSubmit={onResubmit}
        />
      )}
    </motion.div>
  )
}

function IncompleteProfile() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-10 flex flex-col items-center rounded-2xl border border-neutral-200 bg-white p-10 text-center dark:border-neutral-800 dark:bg-neutral-900"
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-acm-500/10 text-acm-600 dark:text-acm-400">
        <UserCog className="h-6 w-6" />
      </span>
      <h3 className="mt-5 text-lg font-bold tracking-tight">Complete your profile first</h3>
      <p className="mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-300">
        We need your phone, college, department, year and gender on file before you can join — it's the same profile
        events use, so you only fill it in once.
      </p>
      <Button as={Link} to="/dashboard" state={{ completeProfile: true, from: '/membership' }} size="lg" className="mt-6">
        <UserCog className="h-4 w-4" /> Complete your profile
      </Button>
    </motion.div>
  )
}

function NotTkm() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-10 flex flex-col items-center rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center dark:border-amber-500/25 dark:bg-amber-500/10"
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-amber-500 shadow-sm dark:bg-neutral-900">
        <GraduationCap className="h-6 w-6" />
      </span>
      <h3 className="mt-5 text-lg font-bold tracking-tight">Please contact your college ACM student chapter</h3>
      <p className="mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-300">
        The membership service on this site is available for TKM College of Engineering students only.
      </p>
    </motion.div>
  )
}

function Blocked() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-10 flex flex-col items-center rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center dark:border-amber-500/25 dark:bg-amber-500/10"
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-amber-500 shadow-sm dark:bg-neutral-900">
        <AlertCircle className="h-6 w-6" />
      </span>
      <h3 className="mt-5 text-lg font-bold tracking-tight">Registration is temporarily unavailable</h3>
      <p className="mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-300">
        We couldn't reach the membership service right now. Please send us a message and the team will get you registered.
      </p>
      <Button as={Link} to="/contact" size="lg" className="mt-6">
        <Mail className="h-4 w-4" /> Send us a message
      </Button>
    </motion.div>
  )
}

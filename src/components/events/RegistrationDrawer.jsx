import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2, PartyPopper, BadgeCheck, CreditCard, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Input, Select } from '../ui/Input'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/format'
import { payFor, validateMembership, isPaymentConfigured } from '../../lib/payments'
import { cn } from '../../lib/cn'

const steps = ['Your details', 'Eligibility', 'Confirm']

const slide = {
  enter: (d) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0 },
  exit: (d) => ({ opacity: 0, x: d > 0 ? -40 : 40 }),
}

export function RegistrationDrawer({ event, open, onClose, onComplete, onPaid, onCancelPay }) {
  const { user } = useAuth()
  const [[step, dir], setStep] = useState([0, 0])
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [payError, setPayError] = useState('')
  const [pendingConfirm, setPendingConfirm] = useState(false)
  // ACM membership verification: null until checked; then the server's verdict.
  const [memberCheck, setMemberCheck] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyErr, setVerifyErr] = useState('')
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    college: 'TKM College of Engineering',
    department: user?.department || '',
    year: user?.year || '',
    isMember: user?.acmMember || false,
    membershipId: '',
    agree: false,
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const go = (next) => setStep([next, next > step ? 1 : -1])

  // Membership verification is only possible with the backend deployed. Without
  // it, the ID stays a free-text, informational field (the old behaviour).
  const canVerify = isPaymentConfigured
  // Editing the id (or toggling the checkbox) invalidates any prior verdict.
  const setMemberId = (e) => { setMemberCheck(null); setVerifyErr(''); setForm((f) => ({ ...f, membershipId: e.target.value })) }
  const toggleMember = (e) => { setMemberCheck(null); setVerifyErr(''); setForm((f) => ({ ...f, isMember: e.target.checked })) }

  async function verify() {
    const id = form.membershipId.trim()
    if (!id) return
    setVerifying(true)
    setVerifyErr('')
    try {
      const res = await validateMembership({ eventId: event.id, membershipId: id })
      setMemberCheck(res)
    } catch (err) {
      setVerifyErr(err?.message || 'Couldn’t verify right now. Try again.')
    } finally {
      setVerifying(false)
    }
  }

  const stepValid = useMemo(() => {
    if (step === 0) return form.name && form.email && form.phone && form.department && form.year
    if (step === 1) {
      if (!form.isMember) return true
      if (!canVerify) return form.membershipId.trim().length > 0 // no backend → old behaviour
      return memberCheck?.valid === true // must verify a real member (used or not)
    }
    if (step === 2) return form.agree
    return true
  }, [step, form, canVerify, memberCheck])

  if (!event) return null

  // The member discount applies only to a verified, unused id.
  const discountEligible = !!(memberCheck?.valid && !memberCheck?.alreadyUsed && memberCheck?.discount > 0)
  const payable = discountEligible ? memberCheck.effectiveFee : (Number(event.fee) || 0)
  const claimedId = memberCheck?.valid && !memberCheck?.alreadyUsed ? form.membershipId.trim() : ''
  const paid = payable > 0 && isPaymentConfigured

  async function submit() {
    setPayError('')
    setSubmitting(true)

    // 1) Save the registration FIRST. If this write fails (backend/quota/rules
    // trouble), stop here and say so clearly — we must never take a payment for
    // a registration that didn't persist.
    let created
    try {
      // Only a verified, unused id is claimed — the server re-checks it and
      // applies the discount, so an unverified/used id gets no benefit.
      created = await onComplete?.(event, { ...form, membershipId: claimedId, isMember: form.isMember, chargeAmount: payable })
    } catch {
      setPayError('We couldn’t save your registration — the service may be temporarily unavailable. Please try again in a moment, or reach us from the Contact page.')
      setSubmitting(false)
      return
    }

    // 2) Collect payment if there's a fee. A cancel/failure leaves the record
    // 'pending'; a capture we couldn't confirm is treated as "received".
    try {
      if (paid && created?.id) {
        const result = await payFor({
          type: 'event',
          refId: created.id,
          prefill: { name: form.name, email: form.email, contact: form.phone },
        })
        if (result.status === 'paid') onPaid?.(created.id)
        else if (result.status === 'pending_confirmation') setPendingConfirm(true)
      }
      setDone(true)
    } catch (err) {
      // Payment cancelled/failed (no money taken) → remove the just-created
      // pending registration so the user isn't shown as "Registered" without
      // having paid. They can retry from a clean slate.
      if (paid && created?.id) onCancelPay?.(created.id)
      setPayError(err?.message || 'Could not complete the payment.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    onClose()
    // reset after close animation
    setTimeout(() => {
      setStep([0, 0])
      setDone(false)
      setPayError('')
      setPendingConfirm(false)
      setMemberCheck(null)
      setVerifyErr('')
    }, 250)
  }

  return (
    <Modal open={open} onClose={handleClose} size="md">
      {done ? (
        <div className="p-8 text-center sm:p-10">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
          >
            <PartyPopper className="h-8 w-8" />
          </motion.div>
          <h3 className="mt-6 text-xl font-bold tracking-tight">
            {pendingConfirm ? 'Payment received' : "You're registered!"}
          </h3>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {pendingConfirm ? (
              <>Your payment for <strong className="text-neutral-800 dark:text-neutral-200">{event.name}</strong> went through — we’re just confirming it, and your registration will update to paid shortly.</>
            ) : (
              <>A confirmation for <strong className="text-neutral-800 dark:text-neutral-200">{event.name}</strong> has been recorded.</>
            )}
          </p>
          <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 text-left text-sm dark:border-neutral-800 dark:bg-neutral-900/50">
            <Row label="Event" value={event.name} />
            <Row label="Date" value={`${formatDate(event.date)} · ${event.time}`} />
            <Row label="Name" value={form.name} />
            {claimedId && <Row label="ACM Member" value={claimedId} />}
          </div>
          <Button className="mt-6 w-full" onClick={handleClose}>
            Done
          </Button>
        </div>
      ) : (
        <div className="p-6 sm:p-8">
          {/* Header + progress */}
          <div className="pr-8">
            <span className="text-xs font-medium uppercase tracking-wide text-acm-600 dark:text-acm-400">Register</span>
            <h3 className="mt-1 text-lg font-bold tracking-tight">{event.name}</h3>
          </div>
          <div className="mt-5 flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex flex-1 flex-col gap-1.5">
                <div className={cn('h-1 rounded-full transition-colors', i <= step ? 'bg-acm-600' : 'bg-neutral-200 dark:bg-neutral-800')} />
                <span className={cn('text-[11px]', i === step ? 'font-medium text-neutral-700 dark:text-neutral-300' : 'text-neutral-400')}>{s}</span>
              </div>
            ))}
          </div>

          {/* Steps */}
          <div className="relative mt-6 min-h-[280px]">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              >
                {step === 0 && (
                  <div className="grid gap-3.5">
                    <Input label="Full name" value={form.name} onChange={set('name')} placeholder="Your name" />
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="you@tkmce.ac.in" />
                      <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="+91 …" />
                    </div>
                    <Input label="College" value={form.college} onChange={set('college')} />
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <Input label="Department" value={form.department} onChange={set('department')} placeholder="e.g. CSE" />
                      <Select label="Year of study" value={form.year} onChange={set('year')}>
                        <option value="">Select…</option>
                        <option>1st Year</option>
                        <option>2nd Year</option>
                        <option>3rd Year</option>
                        <option>4th Year</option>
                      </Select>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="grid gap-4">
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                      <input type="checkbox" checked={form.isMember} onChange={toggleMember} className="mt-0.5 h-4 w-4 accent-acm-600" />
                      <span>
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <BadgeCheck className="h-4 w-4 text-acm-500" /> I'm an ACM member
                        </span>
                        <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                          {event.acmDiscount > 0
                            ? `Verify your membership ID to get ₹${event.acmDiscount} off.`
                            : 'Verify your membership ID.'}
                        </span>
                      </span>
                    </label>
                    <AnimatePresence initial={false}>
                      {form.isMember && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <Input label="ACM Membership ID" value={form.membershipId} onChange={setMemberId} placeholder="e.g. 1234567" />
                            </div>
                            {canVerify && (
                              <Button type="button" variant="outline" onClick={verify} disabled={verifying || !form.membershipId.trim()}>
                                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify
                              </Button>
                            )}
                          </div>

                          {/* Verdict */}
                          {verifyErr && (
                            <p className="mt-2 flex items-start gap-2 text-xs text-rose-600 dark:text-rose-300">
                              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {verifyErr}
                            </p>
                          )}
                          {memberCheck && !memberCheck.valid && (
                            <p className="mt-2 flex items-start gap-2 text-xs text-rose-600 dark:text-rose-300">
                              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> This membership ID wasn’t found. Check it, or uncheck the box to register as a non-member.
                            </p>
                          )}
                          {memberCheck?.valid && memberCheck.alreadyUsed && (
                            <p className="mt-2 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-300">
                              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> This ID has already been used for this event, so the member discount won’t apply.
                            </p>
                          )}
                          {discountEligible && (
                            <p className="mt-2 flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-300">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Verified{memberCheck.memberName ? ` — ${memberCheck.memberName}` : ''}. ₹{memberCheck.discount} member discount applied.
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900/50">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500 dark:text-neutral-400">Registration fee</span>
                        <span className="font-semibold">
                          {discountEligible && (
                            <span className="mr-2 font-normal text-neutral-400 line-through">₹{event.fee}</span>
                          )}
                          {payable > 0 ? `₹${payable}` : 'Free'}
                        </span>
                      </div>
                      {event.fee > 0 && (
                        <p className="mt-2 text-xs text-neutral-400">
                          {isPaymentConfigured
                            ? 'Paid securely via Razorpay when you submit.'
                            : 'Payment is collected separately by the organisers.'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid gap-4">
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900/50">
                      <Row label="Event" value={event.name} />
                      <Row label="Date" value={`${formatDate(event.date)} · ${event.time}`} />
                      <Row label="Name" value={form.name} />
                      <Row label="Email" value={form.email} />
                      <Row label="Department" value={`${form.department} · ${form.year}`} />
                      <Row label="Membership" value={claimedId ? `Member · ${claimedId}` : (form.isMember ? 'Member' : 'Non-member')} />
                      <Row label="Fee" value={payable > 0 ? `₹${payable}${discountEligible ? ` (₹${memberCheck.discount} off)` : ''}` : 'Free'} last />
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <input type="checkbox" checked={form.agree} onChange={set('agree')} className="mt-0.5 h-4 w-4 accent-acm-600" />
                      <span className="text-neutral-600 dark:text-neutral-300">
                        I agree to the event guidelines and code of conduct.
                      </span>
                    </label>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {payError && (
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {payError}
            </p>
          )}

          {/* Footer nav */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" disabled={submitting} onClick={() => (step === 0 ? handleClose() : go(step - 1))}>
              <ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            {step < 2 ? (
              <Button disabled={!stepValid} onClick={() => go(step + 1)}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button disabled={!stepValid || submitting} onClick={submit}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {paid ? 'Processing…' : 'Submitting…'}</>
                ) : paid ? (
                  <><CreditCard className="h-4 w-4" /> Pay ₹{payable} & register</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Submit registration</>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

function Row({ label, value, last }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-1.5', !last && 'border-b border-neutral-100 dark:border-neutral-800')}>
      <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  )
}

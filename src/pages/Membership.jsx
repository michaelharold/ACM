import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BadgeCheck, CreditCard, ShieldCheck, AlertCircle, Mail, Fingerprint, Loader2 } from 'lucide-react'
import { SectionHeading } from '../components/SectionHeading'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { departments } from '../lib/orgData'
import { fetchMembership, createMembership, probeWritable } from '../services/firestore'
import { payFor, isPaymentConfigured } from '../lib/payments'
import { avatarDataUri } from '../lib/avatar'

const fullName = (m) => [m.firstName, m.middleName, m.lastName].filter(Boolean).join(' ')

export default function Membership() {
  const { user, loading, saveProfile } = useAuth()
  const { content } = useData()
  const navigate = useNavigate()
  const membershipFee = Number(content?.membershipFee) || 0
  const chargesFee = membershipFee > 0 && isPaymentConfigured

  // phase: 'loading' | 'form' | 'status' | 'blocked'
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

  async function handleSubmit(e) {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget))
    setError('')
    setSubmitting(true)
    let created
    try {
      created = await createMembership(user.id, {
        firstName: f.firstName.trim(),
        middleName: f.middleName.trim(),
        lastName: f.lastName.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        department: f.department,
        className: f.className.trim(),
        // Only 'pending' when a fee will actually be collected online — otherwise
        // there's nothing to pay, so it's 'free' (avoids a misleading "Pending").
        paymentStatus: chargesFee ? 'pending' : 'free',
      })
      await saveProfile({ acmMember: true })
    } catch {
      setPhase('blocked')
      setSubmitting(false)
      return
    }
    // Collect the fee if one is configured. A cancel/failure here does NOT lose
    // the application — it stays recorded as 'pending' and can be paid later
    // from the status screen (the server flips it to 'paid' once verified).
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
          description="Become a member of the chapter — unlock member-only events, workshops and a spot in the community."
        />

        {phase === 'blocked' && <Blocked />}

        {phase === 'form' && (
          <MembershipForm user={user} onSubmit={handleSubmit} submitting={submitting} error={error} fee={membershipFee} chargesFee={chargesFee} />
        )}

        {phase === 'status' && membership && (
          <StatusCard membership={membership} user={user} chargesFee={chargesFee} fee={membershipFee} onPay={handlePayNow} error={error} confirming={confirming} />
        )}
      </div>
    </div>
  )
}

function MembershipForm({ user, onSubmit, submitting, error, fee, chargesFee }) {
  return (
    <motion.form
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={onSubmit}
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

      {error && (
        <p className="mt-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      <div className="mt-7 flex flex-col gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {submitting ? 'Processing…' : chargesFee ? `Proceed to Pay ₹${fee}` : 'Submit application'}
        </Button>
        <p className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          {chargesFee
            ? 'Paid securely via Razorpay. Your Membership ID is assigned by the team once your payment is confirmed.'
            : 'Your details are saved now; your Membership ID follows once it’s confirmed.'}
        </p>
      </div>
    </motion.form>
  )
}

function StatusCard({ membership, user, chargesFee, fee, onPay, error, confirming }) {
  const [paying, setPaying] = useState(false)
  const [payErr, setPayErr] = useState('')
  const isPaid = membership.paymentStatus === 'paid'
  const assigned = membership.membershipId && membership.membershipId.trim()

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
    { label: 'Payment', value: isPaid ? 'Paid' : confirming ? 'Confirming…' : chargesFee ? 'Pending' : 'Free' },
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
          {chargesFee && !isPaid && !confirming ? (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <CreditCard className="h-3.5 w-3.5" /> Payment pending
            </span>
          ) : (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-acm-500/10 px-2.5 py-1 text-xs font-semibold text-acm-600 dark:text-acm-400">
              <BadgeCheck className="h-3.5 w-3.5" /> ACM Member
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

      {chargesFee && !isPaid && !confirming && (
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

      <div className="m-6 mt-0 flex items-center gap-3 rounded-xl border border-acm-200 bg-acm-50/60 p-4 dark:border-acm-500/25 dark:bg-acm-500/5">
        <Fingerprint className="h-5 w-5 shrink-0 text-acm-500" />
        <div className="text-sm">
          <div className="font-semibold">Membership ID</div>
          <div className="text-neutral-500 dark:text-neutral-400">
            {assigned
              ? membership.membershipId
              : chargesFee && !isPaid && !confirming
                ? 'Assigned once your payment is confirmed.'
                : 'Will be updated soon.'}
          </div>
        </div>
      </div>
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

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2, PartyPopper, BadgeCheck } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Input, Select } from '../ui/Input'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/format'
import { cn } from '../../lib/cn'

const steps = ['Your details', 'Eligibility', 'Confirm']

const slide = {
  enter: (d) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0 },
  exit: (d) => ({ opacity: 0, x: d > 0 ? -40 : 40 }),
}

export function RegistrationDrawer({ event, open, onClose, onComplete }) {
  const { user } = useAuth()
  const [[step, dir], setStep] = useState([0, 0])
  const [done, setDone] = useState(false)
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

  const stepValid = useMemo(() => {
    if (step === 0) return form.name && form.email && form.phone && form.department && form.year
    if (step === 1) return !form.isMember || form.membershipId.trim().length > 0
    if (step === 2) return form.agree
    return true
  }, [step, form])

  if (!event) return null

  function submit() {
    onComplete?.(event, form)
    setDone(true)
  }

  function handleClose() {
    onClose()
    // reset after close animation
    setTimeout(() => {
      setStep([0, 0])
      setDone(false)
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
          <h3 className="mt-6 text-xl font-bold tracking-tight">You're registered!</h3>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            A confirmation for <strong className="text-neutral-800 dark:text-neutral-200">{event.name}</strong> has been recorded.
          </p>
          <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 text-left text-sm dark:border-neutral-800 dark:bg-neutral-900/50">
            <Row label="Event" value={event.name} />
            <Row label="Date" value={`${formatDate(event.date)} · ${event.time}`} />
            <Row label="Name" value={form.name} />
            {form.isMember && <Row label="ACM Member" value={form.membershipId || 'Verified'} />}
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
                      <input type="checkbox" checked={form.isMember} onChange={set('isMember')} className="mt-0.5 h-4 w-4 accent-acm-600" />
                      <span>
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <BadgeCheck className="h-4 w-4 text-acm-500" /> I'm an ACM member
                        </span>
                        <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                          Verify your membership to unlock discounted or member-only registration.
                        </span>
                      </span>
                    </label>
                    <AnimatePresence initial={false}>
                      {form.isMember && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <Input label="ACM Membership ID" value={form.membershipId} onChange={set('membershipId')} placeholder="e.g. 1234567" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900/50">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500 dark:text-neutral-400">Registration fee</span>
                        <span className="font-semibold">{event.fee ? `₹${event.fee}` : 'Free'}</span>
                      </div>
                      {event.fee > 0 && (
                        <p className="mt-2 text-xs text-neutral-400">Payment is collected on-site / via UPI (demo — not processed here).</p>
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
                      <Row label="Membership" value={form.isMember ? (form.membershipId || 'Member') : 'Non-member'} />
                      <Row label="Fee" value={event.fee ? `₹${event.fee}` : 'Free'} last />
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

          {/* Footer nav */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={() => (step === 0 ? handleClose() : go(step - 1))}>
              <ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            {step < 2 ? (
              <Button disabled={!stepValid} onClick={() => go(step + 1)}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button disabled={!stepValid} onClick={submit}>
                <CheckCircle2 className="h-4 w-4" /> Submit registration
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

import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarDays, MapPin, LogOut, Compass, BadgeCheck, Mail, GraduationCap, Building2, Ticket, Pencil, Save, X, Fingerprint, Phone, AlertCircle, ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input, Select } from '../components/ui/Input'
import { Reveal, Item } from '../components/ui/Reveal'
import { EventDetailsModal } from '../components/events/EventDetailsModal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useRegistrations } from '../context/RegistrationsContext'
import { avatarDataUri } from '../lib/avatar'
import { formatDate } from '../lib/format'
import { years } from '../lib/orgData'
import { isValidPhone, isProfileComplete } from '../lib/profile'
import { isPhoneOtpEnabled, sendPhoneOtp, confirmPhoneOtp, clearRecaptcha } from '../lib/phoneAuth'
import { fetchMembership } from '../services/firestore'

export default function Dashboard() {
  const { user, loading, logout, saveProfile } = useAuth()
  const { events, departments } = useData()
  const { regs } = useRegistrations()
  const navigate = useNavigate()
  const location = useLocation()
  // Arriving here from a "register" click on an incomplete profile: open the
  // editor and show a prompt, then return to that event once it's complete.
  const needProfile = !!location.state?.completeProfile
  const returnTo = location.state?.from
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(needProfile)
  const [saving, setSaving] = useState(false)
  const [membership, setMembership] = useState(null)
  const [membershipLoaded, setMembershipLoaded] = useState(false)
  const [formErr, setFormErr] = useState('')
  // Phone verification (controlled, so OTP state and the number stay in sync).
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneVerifiedLocal, setPhoneVerifiedLocal] = useState(false)
  const [otp, setOtp] = useState({ confirmation: null, sent: false, code: '', busy: false, err: '' })

  // Seed the phone editor from the profile whenever the form opens.
  useEffect(() => {
    if (!editing) return
    setPhoneInput(user?.phone || '')
    setPhoneVerifiedLocal(!!user?.phoneVerified)
    setOtp({ confirmation: null, sent: false, code: '', busy: false, err: '' })
    return () => clearRecaptcha()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  // Editing the number always invalidates a prior verification.
  function onPhoneChange(v) {
    setPhoneInput(v)
    setPhoneVerifiedLocal(!!user?.phoneVerified && v.replace(/\D/g, '') === String(user?.phone || '').replace(/\D/g, ''))
    setOtp((o) => ({ ...o, sent: false, confirmation: null, code: '', err: '' }))
  }

  async function handleSendOtp() {
    if (!isValidPhone(phoneInput)) { setOtp((o) => ({ ...o, err: 'Enter a valid 10-digit phone number.' })); return }
    setOtp((o) => ({ ...o, busy: true, err: '' }))
    try {
      const confirmation = await sendPhoneOtp(phoneInput, 'recaptcha-container')
      setOtp((o) => ({ ...o, confirmation, sent: true, busy: false }))
    } catch (err) {
      clearRecaptcha()
      setOtp((o) => ({ ...o, busy: false, err: err?.message || 'Could not send the code. Try again.' }))
    }
  }

  async function handleConfirmOtp() {
    setOtp((o) => ({ ...o, busy: true, err: '' }))
    try {
      await confirmPhoneOtp(otp.confirmation, otp.code.trim())
      setPhoneVerifiedLocal(true)
      setOtp((o) => ({ ...o, busy: false, sent: false }))
    } catch {
      setOtp((o) => ({ ...o, busy: false, err: 'That code didn’t match. Check it and try again.' }))
    }
  }

  useEffect(() => {
    if (!loading && !user) navigate('/auth', { replace: true, state: { from: '/dashboard' } })
  }, [user, loading, navigate])

  // The membership document is the single source of truth for member status:
  // if it's removed (e.g. deleted from the Firebase console) this reflects that
  // on the next load, instead of trusting a cached flag on the user profile.
  useEffect(() => {
    if (!user) return
    let alive = true
    fetchMembership(user.id)
      .then((m) => { if (alive) setMembership(m) })
      .catch(() => {})
      .finally(() => { if (alive) setMembershipLoaded(true) })
    return () => { alive = false }
  }, [user])

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-acm-600 dark:border-neutral-800 dark:border-t-acm-500" />
      </div>
    )
  if (!user) return null

  // Google accounts without a photo (and mock users) have no avatar URL — fall
  // back to the same monogram the execom cards use instead of a broken image.
  const displayName = user.name || 'ACM Member'
  const avatar = user.avatar || avatarDataUri(displayName)

  async function handleSave(e) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget))
    const phone = String(phoneInput || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '')
    if (!isValidPhone(phone)) { setFormErr('Enter a valid 10-digit phone number.'); return }
    // With OTP on, the number must be verified; with OTP off (free default), a
    // valid number is accepted as verified so registration isn't blocked.
    const verified = isPhoneOtpEnabled ? phoneVerifiedLocal : true
    if (isPhoneOtpEnabled && !verified) { setFormErr('Verify your phone number with the OTP first.'); return }
    if (!data.department?.trim()) { setFormErr('Select your department.'); return }
    if (!data.year) { setFormErr('Select your year.'); return }
    setFormErr('')
    const next = { name: data.name.trim() || displayName, phone, phoneVerified: verified, department: data.department.trim(), year: data.year }
    setSaving(true)
    try {
      await saveProfile(next)
      setEditing(false)
      // If they were sent here to finish registering, return to that event now
      // that the profile is complete.
      if (returnTo && isProfileComplete({ ...user, ...next })) navigate(returnTo)
    } finally {
      setSaving(false)
    }
  }

  const eventsById = Object.fromEntries(events.map((e) => [e.id, e]))
  const myEvents = regs.map((r) => ({
    reg: r,
    event: eventsById[r.eventId] || {
      id: r.eventId,
      name: r.eventName || 'Event',
      poster: '',
      date: r.date,
      venue: '—',
    },
  }))

  const profileRows = [
    { icon: Mail, label: 'Email', value: user.email },
    { icon: Phone, label: 'Phone', value: user.phone },
    { icon: Building2, label: 'Department', value: user.department },
    { icon: GraduationCap, label: 'Year', value: user.year },
  ]

  return (
    <div className="pt-28">
      <div className="section-shell py-12">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={avatar} alt="" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white shadow-sm dark:ring-neutral-800" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Hi, {displayName.split(' ')[0]} 👋</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Here's your ACM TKMCE space.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button as={Link} to="/events" variant="outline" size="sm">
              <Compass className="h-4 w-4" /> Browse events
            </Button>
            <Button onClick={() => { logout(); navigate('/') }} variant="ghost" size="sm">
              <LogOut className="h-4 w-4" /> Log out
            </Button>
          </div>
        </motion.div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Profile */}
          <motion.aside
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="h-fit rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex items-center gap-4">
              <img src={avatar} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
              <div className="min-w-0">
                <h2 className="truncate font-semibold tracking-tight">{displayName}</h2>
                {membership && (
                  <Badge tone="blue" className="mt-1">
                    <BadgeCheck className="h-3.5 w-3.5" /> ACM Member
                  </Badge>
                )}
              </div>
            </div>

            {editing ? (
              <form onSubmit={handleSave} className="mt-6 grid gap-4">
                {needProfile && (
                  <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Complete your profile to register for events — we need a valid phone, department and year.
                  </p>
                )}
                <Input label="Full name" name="name" defaultValue={user.name || ''} required />
                {/* Email is fixed to the signed-in Google account — shown read-only. */}
                <Input label="Email" name="email" type="email" defaultValue={user.email || ''} disabled readOnly className="cursor-not-allowed opacity-70" />

                {/* Phone — 10-digit; verified via OTP when phone auth is enabled. */}
                <div>
                  <Input
                    label="Phone (10-digit)"
                    type="tel"
                    inputMode="numeric"
                    value={phoneInput}
                    onChange={(e) => onPhoneChange(e.target.value)}
                    placeholder="9876543210"
                  />
                  {isPhoneOtpEnabled && (
                    <div className="mt-2">
                      {phoneVerifiedLocal ? (
                        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Phone verified
                        </p>
                      ) : otp.sent ? (
                        <div className="flex items-end gap-2">
                          <Input label="Enter OTP" inputMode="numeric" value={otp.code} onChange={(e) => setOtp((o) => ({ ...o, code: e.target.value }))} placeholder="6-digit code" />
                          <Button type="button" size="sm" onClick={handleConfirmOtp} disabled={otp.busy || !otp.code.trim()}>
                            {otp.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify
                          </Button>
                        </div>
                      ) : (
                        <Button type="button" size="sm" variant="outline" onClick={handleSendOtp} disabled={otp.busy || !isValidPhone(phoneInput)}>
                          {otp.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Send OTP
                        </Button>
                      )}
                      {otp.err && <p className="mt-1.5 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {otp.err}</p>}
                      {/* Invisible reCAPTCHA mount point for Firebase Phone Auth. */}
                      <div id="recaptcha-container" />
                    </div>
                  )}
                </div>

                <Select label="Department" name="department" defaultValue={user.department || ''}>
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </Select>
                <Select label="Year" name="year" defaultValue={user.year || ''}>
                  <option value="">Select year</option>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
                {formErr && (
                  <p className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-300">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {formErr}
                  </p>
                )}
                <div className="mt-1 flex gap-2">
                  <Button type="submit" size="sm" disabled={saving} className="flex-1">
                    <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setFormErr('') }} disabled={saving}>
                    <X className="h-4 w-4" /> Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <dl className="mt-6 space-y-3">
                  {profileRows.map((r) => (
                    <div key={r.label} className="flex items-center gap-3 text-sm">
                      <r.icon className="h-4 w-4 shrink-0 text-neutral-400" />
                      <dt className="sr-only">{r.label}</dt>
                      <dd className="truncate text-neutral-600 dark:text-neutral-300">
                        {r.value || <span className="text-neutral-400">Not set</span>}
                      </dd>
                    </div>
                  ))}
                </dl>

                {/* Membership status — driven by the live membership doc, so it
                    stays in sync with the backend (incl. console deletions). */}
                <div className="mt-5 rounded-xl border border-neutral-200 p-3.5 dark:border-neutral-800">
                  {!membershipLoaded ? (
                    <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                  ) : membership ? (
                    <div className="flex items-start gap-2.5">
                      <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-acm-500" />
                      <div className="min-w-0 text-sm">
                        <div className="font-semibold">ACM Membership ID</div>
                        <div className="text-neutral-500 dark:text-neutral-400">
                          {membership?.membershipId?.trim()
                            ? membership.membershipId
                            : membership?.paymentStatus === 'pending'
                              ? 'Assigned once your payment is confirmed.'
                              : 'Will be updated soon.'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm">
                      <div className="font-semibold">Not a member yet</div>
                      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                        Join the chapter to unlock member-only events.
                      </p>
                      <Button as={Link} to="/membership" size="sm" className="mt-3 w-full">
                        <BadgeCheck className="h-4 w-4" /> Join ACM
                      </Button>
                    </div>
                  )}
                </div>

                <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" /> Edit profile
                </Button>
              </>
            )}
          </motion.aside>

          {/* Registered events */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Ticket className="h-5 w-5 text-acm-500" /> Registered events
              </h2>
              <span className="text-sm text-neutral-400">{myEvents.length} total</span>
            </div>

            {myEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 p-12 text-center dark:border-neutral-800">
                <p className="text-sm text-neutral-500">You haven't registered for any events yet.</p>
                <Button as={Link} to="/events" size="sm" className="mt-4">Explore events</Button>
              </div>
            ) : (
              <Reveal className="grid gap-4 sm:grid-cols-2" amount={0.1}>
                {myEvents.map(({ reg, event }) => (
                  <Item key={reg.id}>
                    <button
                      onClick={() => setSelected(event)}
                      className="group flex w-full gap-4 rounded-2xl border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-acm-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-acm-500/40"
                    >
                      <img
                        src={event.poster || avatarDataUri(event.name || 'Event')}
                        alt=""
                        className="h-20 w-20 shrink-0 rounded-xl object-cover"
                      />
                      <div className="min-w-0 flex-1 py-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate font-semibold tracking-tight">{event.name}</h3>
                        </div>
                        <div className="mt-1.5 space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                          <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(event.date)}</p>
                          <p className="flex items-center gap-1.5 truncate"><MapPin className="h-3.5 w-3.5 shrink-0" /> {event.venue}</p>
                        </div>
                        <Badge tone={reg.status === 'Attended' ? 'neutral' : 'green'} dot={reg.status === 'Confirmed'} className="mt-2">
                          {reg.status}
                        </Badge>
                      </div>
                    </button>
                  </Item>
                ))}
              </Reveal>
            )}
          </div>
        </div>
      </div>

      <EventDetailsModal event={selected} open={!!selected} onClose={() => setSelected(null)} registered />
    </div>
  )
}

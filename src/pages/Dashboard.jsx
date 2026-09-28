import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarDays, MapPin, LogOut, Compass, BadgeCheck, Mail, GraduationCap, Building2, Ticket, Pencil, Save, X, Fingerprint, Phone, AlertCircle, ShieldCheck, CheckCircle2, Loader2, MessageSquare, Users, ChevronDown, School, UserRound, MessageCircle, ExternalLink, Upload, History, Trophy } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input, Select } from '../components/ui/Input'
import { Reveal, Item } from '../components/ui/Reveal'
import { Modal } from '../components/ui/Modal'
import { ThreadView, when } from '../components/messages/Thread'
import { EventDetailsModal } from '../components/events/EventDetailsModal'
import { useAuth } from '../context/AuthContext'
import { useData, useText } from '../context/DataContext'
import { GlobalMembershipButton } from '../components/membership/GlobalMembershipButton'
import { useRegistrations } from '../context/RegistrationsContext'
import { avatarDataUri } from '../lib/avatar'
import { cn } from '../lib/cn'
import { formatDate } from '../lib/format'
import { years, genders, TKM_COLLEGE, isTkmCollege } from '../lib/orgData'
import { isValidPhone, isProfileComplete } from '../lib/profile'
import { isPhoneOtpEnabled, sendPhoneOtp, confirmPhoneOtp, clearRecaptcha } from '../lib/phoneAuth'
import { fetchMembership, fetchUserMessages, markThreadRead } from '../services/firestore'
import { TicketCarousel } from '../components/tickets/TicketCarousel'
import { TicketCard } from '../components/tickets/TicketCard'
import { ReceiptUploadModal } from '../components/payments/ReceiptUploadModal'
import { paymentState, hasTicket, needsReceipt, PAYMENT_STATE_META, ticketCode } from '../lib/manualPay'
import { useNow } from '../lib/eventClock'
import { splitByEventEnd, whatsappLinkFor, isQrHidden } from '../lib/eventAccess'
import { fetchMyVerification } from '../services/membership'
import { PendingVerification } from '../components/membership/VerifyExisting'
import PeekRating from '../components/reactbits/PeekRating'
import { fetchMyRatings, rateEvent, RATING_LABELS } from '../services/engagement'

export default function Dashboard() {
  const { user, loading, logout, saveProfile } = useAuth()
  const { events, departments } = useData()
  const t = useText()
  const { regs, refetch: refetchRegs, resubmitReceipt } = useRegistrations()
  const navigate = useNavigate()
  const location = useLocation()
  // Arriving here from a "register" click on an incomplete profile: open the
  // editor and show a prompt, then return to that event once it's complete.
  const needProfile = !!location.state?.completeProfile
  const returnTo = location.state?.from
  const [selected, setSelected] = useState(null)
  const [openTeams, setOpenTeams] = useState(() => new Set())
  const toggleTeam = (id) => setOpenTeams((s) => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })
  const [editing, setEditing] = useState(needProfile)
  const [saving, setSaving] = useState(false)
  const [membership, setMembership] = useState(null)
  const [membershipLoaded, setMembershipLoaded] = useState(false)
  // "Already a member?" request, shown as a yellow-glow pending status.
  const [verification, setVerification] = useState(null)
  // A past event's pass, opened from Events History.
  const [pastTicket, setPastTicket] = useState(null)
  // { eventId: 1–5 } — the stars this person gave events they attended.
  const [ratings, setRatings] = useState({})
  const [ratingSaved, setRatingSaved] = useState('')
  // Re-evaluated every minute, so a ticket moves to Events History by itself
  // once its event ends while the page is open.
  const now = useNow(60000)
  const [formErr, setFormErr] = useState('')
  // Profile inbox — messages from the chapter, with a red dot when unread.
  const [inbox, setInbox] = useState([])
  const [openMsg, setOpenMsg] = useState(null)
  // Registration whose receipt the user is (re)uploading: { reg, event }.
  const [uploadFor, setUploadFor] = useState(null)
  // Phone verification (controlled, so OTP state and the number stay in sync).
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneVerifiedLocal, setPhoneVerifiedLocal] = useState(false)
  const [otp, setOtp] = useState({ confirmation: null, sent: false, code: '', busy: false, err: '' })
  // College — a dropdown of TKM vs "Other" (+ free text when Other is picked).
  const [collegeChoice, setCollegeChoice] = useState('')
  const [otherCollege, setOtherCollege] = useState('')

  // Load the member's inbox threads.
  useEffect(() => {
    if (!user) return
    let alive = true
    fetchUserMessages(user.id).then((m) => { if (alive) setInbox(m) }).catch(() => {})
    return () => { alive = false }
  }, [user])

  const unreadInbox = inbox.filter((m) => m.unreadForUser).length

  async function openThread(m) {
    setOpenMsg(m)
    if (m.unreadForUser) {
      try { await markThreadRead(m.id, 'user') } catch { /* ignore */ }
      setInbox((list) => list.map((x) => (x.id === m.id ? { ...x, unreadForUser: false } : x)))
    }
  }

  function onThreadReplied(reply) {
    if (!openMsg) return
    const id = openMsg.id
    setInbox((list) => list.map((x) => (x.id === id ? { ...x, replies: [...(x.replies || []), reply] } : x)))
    setOpenMsg((o) => (o ? { ...o, replies: [...(o.replies || []), reply] } : o))
  }

  // Seed the phone editor from the profile whenever the form opens.
  useEffect(() => {
    if (!editing) return
    setPhoneInput(user?.phone || '')
    setPhoneVerifiedLocal(!!user?.phoneVerified)
    setOtp({ confirmation: null, sent: false, code: '', busy: false, err: '' })
    // College is a two-part choice (TKM / Other) — seed both from whatever's
    // already on the profile, whichever the value actually is.
    setCollegeChoice(isTkmCollege(user?.college) ? 'tkm' : (user?.college ? 'other' : ''))
    setOtherCollege(isTkmCollege(user?.college) ? '' : (user?.college || ''))
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
    Promise.all([
      fetchMembership(user.id).then((m) => { if (alive) setMembership(m) }).catch(() => {}),
      fetchMyVerification(user.id).then((v) => { if (alive) setVerification(v) }).catch(() => {}),
    ]).finally(() => { if (alive) setMembershipLoaded(true) })
    return () => { alive = false }
  }, [user])

  useEffect(() => {
    if (!user) return
    let alive = true
    fetchMyRatings(user.id).then((r) => { if (alive) setRatings(r) }).catch(() => {})
    return () => { alive = false }
  }, [user])

  async function rate(reg, event, value) {
    if (!value) return
    const prev = ratings[event.id]
    setRatings((r) => ({ ...r, [event.id]: value }))
    try {
      await rateEvent({ uid: user.id, event, reg, rating: value })
      setRatingSaved(event.id)
      setTimeout(() => setRatingSaved((id) => (id === event.id ? '' : id)), 2200)
    } catch {
      setRatings((r) => ({ ...r, [event.id]: prev }))
    }
  }

  // Random Grouping can turn a solo registration into a team registration in
  // the background (daily cron), so a tab left open across that window won't
  // see it until something refetches — do that whenever the user comes back
  // to this tab, not just on the initial page load.
  useEffect(() => {
    if (!user) return
    const onFocus = () => { if (document.visibilityState !== 'hidden') refetchRegs?.() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [user, refetchRegs])

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
    if (!data.college?.trim()) { setFormErr(collegeChoice === 'other' ? 'Enter your college name.' : 'Select your college.'); return }
    if (!data.department?.trim()) { setFormErr('Select your department.'); return }
    if (!data.year) { setFormErr('Select your year.'); return }
    if (!data.gender) { setFormErr('Select your gender.'); return }
    setFormErr('')
    const next = {
      name: data.name.trim() || displayName, phone, phoneVerified: verified,
      college: data.college.trim(), department: data.department.trim(), year: data.year, gender: data.gender,
    }
    setSaving(true)
    try {
      await saveProfile(next)
      setEditing(false)
      // If they were sent here to finish registering, return to that event now
      // that the profile is complete.
      if (returnTo && isProfileComplete({ ...user, ...next })) navigate(returnTo)
    } catch (err) {
      setFormErr(err?.message || 'Could not save your profile — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const eventsById = Object.fromEntries(events.map((e) => [e.id, e]))
  const myEvents = regs.map((r) => ({
    reg: r,
    // An event an admin has since deleted: keep the record, file it as history.
    event: eventsById[r.eventId] || {
      id: r.eventId,
      name: r.eventName || 'Event',
      poster: '',
      date: '',
      venue: '—',
      missing: true,
    },
  }))

  // Upcoming/ongoing events stay up front; once an event ends its registration
  // moves to Events History.
  const { active: activeEvents, history: pastEvents } = splitByEventEnd(myEvents, now)
  const participated = pastEvents.filter(({ reg }) => hasTicket(reg)).length
  // Verified (or free) registrations for events that haven't ended get a ticket.
  const ticketItems = activeEvents.filter(({ reg }) => hasTicket(reg))
  const memberVerified = !!membership && hasTicket(membership)
  const memState = membership ? paymentState(membership) : null

  const profileRows = [
    { icon: Mail, label: 'Email', value: user.email },
    { icon: Phone, label: 'Phone', value: user.phone },
    { icon: School, label: 'College', value: user.college },
    { icon: Building2, label: 'Department', value: user.department },
    { icon: GraduationCap, label: 'Year', value: user.year },
    { icon: UserRound, label: 'Gender', value: user.gender },
  ]

  return (
    <div className="pt-28">
      <div className="section-shell py-12">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={avatar} alt="" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white shadow-sm dark:ring-neutral-800" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Hi, {displayName.split(' ')[0]}</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('profile.subtitle')}</p>
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

        <TicketCarousel items={ticketItems} holderName={displayName} />

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
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
                {memberVerified && (
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
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Complete your profile to register for events — we need your college, department, year, gender and a verified phone number.
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

                <div>
                  <Select label="College" value={collegeChoice} onChange={(e) => setCollegeChoice(e.target.value)}>
                    <option value="">Select college</option>
                    <option value="tkm">{TKM_COLLEGE}</option>
                    <option value="other">Other</option>
                  </Select>
                  {collegeChoice === 'tkm' && <input type="hidden" name="college" value={TKM_COLLEGE} />}
                  {collegeChoice === 'other' && (
                    <div className="mt-2">
                      <Input
                        name="college"
                        value={otherCollege}
                        onChange={(e) => setOtherCollege(e.target.value)}
                        placeholder="Enter your college name"
                      />
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
                <Select label="Gender" name="gender" defaultValue={user.gender || ''}>
                  <option value="">Select gender</option>
                  {genders.map((g) => (
                    <option key={g} value={g}>{g}</option>
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
                  ) : verification?.status === 'pending' ? (
                    <PendingVerification request={verification} compact />
                  ) : membership ? (
                    <div className="flex items-start gap-2.5">
                      <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-acm-500" />
                      <div className="min-w-0 text-sm">
                        <div className="font-semibold">ACM Membership ID</div>
                        <div className="text-neutral-500 dark:text-neutral-400">
                          {membership?.membershipId?.trim()
                            ? membership.membershipId
                            : memState === 'review'
                              ? 'Your payment is under review — the ID is assigned once it’s verified.'
                              : memState === 'rejected'
                                ? <>Payment rejected{membership.rejectReason ? `: ${membership.rejectReason}` : ''}. <Link to="/membership" className="font-medium text-acm-600 underline dark:text-acm-400">Upload a new receipt</Link></>
                                : memState === 'awaiting'
                                  ? <>Payment pending. <Link to="/membership" className="font-medium text-acm-600 underline dark:text-acm-400">Upload your receipt</Link></>
                                  : 'Will be updated soon.'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm">
                      <div className="font-semibold">Not a member yet</div>
                      {verification?.status === 'denied' ? (
                        <p className="mt-0.5 text-xs text-rose-600 dark:text-rose-300">
                          We couldn’t verify membership ID {verification.membershipId}{verification.denyReason ? ` — ${verification.denyReason}` : ''}.
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                          {t('profile.notMember')}
                        </p>
                      )}
                      {/* A plain link rather than <Button>: the full chapter name
                          needs to wrap inside this narrow card. */}
                      <Link
                        to="/membership"
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-acm-600 bg-acm-600 px-3 py-2 text-center text-sm font-medium text-white shadow-sm transition-colors hover:bg-acm-700"
                      >
                        <BadgeCheck className="h-4 w-4 shrink-0" /> {t('cta.join')}
                      </Link>
                      <Link
                        to="/membership"
                        state={{ verify: true }}
                        className="mt-2 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-acm-600 transition-colors hover:bg-acm-50 dark:text-acm-400 dark:hover:bg-acm-500/10"
                      >
                        <Fingerprint className="h-3.5 w-3.5" /> {t('membership.verifyLabel')}
                      </Link>
                      <GlobalMembershipButton block className="mt-2 [&_a]:px-3 [&_a]:py-2 [&_a]:text-xs" />
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
              <span className="text-sm text-neutral-400">{activeEvents.length} upcoming</span>
            </div>

            {activeEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 p-12 text-center dark:border-neutral-800">
                <p className="text-sm text-neutral-500">
                  {pastEvents.length ? 'No upcoming events on your list — your past events are in Events History below.' : 'You haven\'t registered for any events yet.'}
                </p>
                <Button as={Link} to="/events" size="sm" className="mt-4">Explore events</Button>
              </div>
            ) : (
              <Reveal className="grid grid-cols-1 gap-4 sm:grid-cols-2" amount={0.1}>
                {activeEvents.map(({ reg, event }) => {
                  const teamOpen = openTeams.has(reg.id)
                  return (
                  <Item key={reg.id}>
                    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                      <button
                        onClick={() => setSelected(event)}
                        className="group flex w-full gap-4 p-3 text-left transition-[background-color,transform] duration-150 hover:bg-neutral-50 active:scale-[0.99] dark:hover:bg-neutral-800/40"
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
                            {reg.isTeam && (
                              <p className="flex items-center gap-1.5 truncate text-acm-600 dark:text-acm-400">
                                <Users className="h-3.5 w-3.5 shrink-0" /> Team “{reg.teamName || 'Team'}”
                                {reg.randomlyGrouped ? ' · auto-grouped' : (reg.userId && reg.userId !== user.id && reg.userName ? ` · by ${reg.userName}` : '')}
                              </p>
                            )}
                          </div>
                          {hasTicket(reg) ? (
                            <Badge tone={reg.status === 'Attended' ? 'neutral' : 'green'} dot={reg.status === 'Confirmed'} className="mt-2">
                              {reg.status}
                            </Badge>
                          ) : (
                            <Badge tone={PAYMENT_STATE_META[paymentState(reg)].tone} className="mt-2">
                              {PAYMENT_STATE_META[paymentState(reg)].label}
                            </Badge>
                          )}
                        </div>
                      </button>

                      {!hasTicket(reg) && (
                        <div className={cn(
                          'flex items-center justify-between gap-3 border-t px-3.5 py-2.5 text-xs',
                          paymentState(reg) === 'rejected'
                            ? 'border-rose-100 bg-rose-50/70 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300'
                            : 'border-amber-100 bg-amber-50/70 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
                        )}>
                          <span className="min-w-0">
                            {paymentState(reg) === 'review'
                              ? 'Payment under review — your ticket appears once it’s verified.'
                              : paymentState(reg) === 'rejected'
                                ? `Receipt rejected: ${reg.rejectReason || 'please upload a clearer receipt.'}`
                                : reg.userId === user.id
                                  ? 'Upload your payment receipt to complete registration.'
                                  : 'Waiting for your team leader to upload the payment receipt.'}
                          </span>
                          {needsReceipt(reg) && reg.userId === user.id && (
                            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setUploadFor({ reg, event })}>
                              <Upload className="h-3.5 w-3.5" /> Upload
                            </Button>
                          )}
                        </div>
                      )}

                      {reg.isTeam && reg.members?.length > 0 && (
                        <div className="border-t border-neutral-100 dark:border-neutral-800">
                          <button
                            onClick={() => toggleTeam(reg.id)}
                            className="flex w-full items-center justify-between px-3.5 py-2 text-xs font-medium text-acm-600 transition-colors hover:bg-neutral-50 dark:text-acm-400 dark:hover:bg-neutral-800/50"
                          >
                            {teamOpen ? 'Hide teammates' : 'View teammates'}
                            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', teamOpen && 'rotate-180')} />
                          </button>
                          {teamOpen && (
                            <div className="space-y-2.5 border-t border-neutral-100 px-3.5 py-3 dark:border-neutral-800">
                              {reg.members.map((m, i) => (
                                <div key={i} className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-800/30">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                                    {m.name || '—'}
                                    {m.uid === user.id && <span className="rounded-full bg-acm-500/10 px-1.5 py-0.5 text-[10px] font-medium text-acm-600 dark:text-acm-400">You</span>}
                                  </div>
                                  <div className="mt-1.5 grid gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                                    <span className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 shrink-0" /> {m.email || '—'}</span>
                                    <span className="flex items-center gap-1.5 truncate"><Building2 className="h-3 w-3 shrink-0" /> {m.department || '—'}</span>
                                    {m.college && <span className="flex items-center gap-1.5 truncate"><School className="h-3 w-3 shrink-0" /> {m.college}</span>}
                                    {m.year && <span className="flex items-center gap-1.5 truncate"><GraduationCap className="h-3 w-3 shrink-0" /> {m.year}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {whatsappLinkFor(event) && hasTicket(reg) && (
                        <a
                          href={whatsappLinkFor(event)}
                          target="_blank"
                          rel="noreferrer noopener"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 border-t border-neutral-100 px-3.5 py-2 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50 dark:border-neutral-800 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> Event WhatsApp group <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </Item>
                  )
                })}
              </Reveal>
            )}
          </div>
        </div>

        {/* Events History — every registration whose event has ended. */}
        {pastEvents.length > 0 && (
          <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Events History">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <History className="h-5 w-5 text-acm-500" /> Events History
              </h2>
              {participated > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <Trophy className="h-3.5 w-3.5" /> {participated} event{participated === 1 ? '' : 's'} taken part in
                </span>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {pastEvents.map(({ reg, event }) => {
                const took = hasTicket(reg)
                return (
                  <div key={reg.id} className="overflow-hidden rounded-xl border border-neutral-200 transition-colors hover:border-acm-300 dark:border-neutral-800 dark:hover:border-acm-500/40">
                  <button
                    onClick={() => setPastTicket({ reg, event })}
                    className="group flex w-full min-w-0 items-center gap-3 rounded-xl p-3 text-left transition-transform duration-150 active:scale-[0.98]"
                  >
                    <img
                      src={event.poster || avatarDataUri(event.name || 'Event')}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover grayscale-[35%] transition group-hover:grayscale-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{event.name}</div>
                      <div className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {event.date ? formatDate(event.date) : 'Event removed'}{event.venue && event.venue !== '—' ? ` · ${event.venue}` : ''}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone={took ? 'green' : 'neutral'}>{took ? 'Participated' : 'Not completed'}</Badge>
                        <span className="font-mono text-[11px] text-neutral-400">{ticketCode(reg.id)}</span>
                      </div>
                    </div>
                  </button>
                    {took && !event.missing && (
                      <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-3 pb-1.5 dark:border-neutral-800">
                        <span className="pt-5 text-xs text-neutral-500 dark:text-neutral-400">
                          {ratingSaved === event.id ? 'Thanks for rating!' : ratings[event.id] ? 'Your rating' : 'How was it?'}
                        </span>
                        <PeekRating
                          value={ratings[event.id] || 0}
                          onChange={(v) => rate(reg, event, v)}
                          labels={RATING_LABELS}
                          ariaLabel={`Rate ${event.name}`}
                          allowClear={false}
                          size={20}
                          lift={5}
                          magnify={1.18}
                          riseDuration={380}
                          activeColor="#fbbf24"
                          idleColor="#404040"
                          tipColor="#171717"
                          tipTextColor="#fafafa"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Message inbox — replies and messages from the chapter */}
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2">
            <span className="relative">
              <MessageSquare className="h-5 w-5 text-acm-500" />
              {unreadInbox > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 dark:border-neutral-900" />}
            </span>
            <h2 className="text-lg font-semibold tracking-tight">Inbox</h2>
            {unreadInbox > 0 && <Badge tone="red" className="ml-1">{unreadInbox} new</Badge>}
          </div>

          {inbox.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">No messages yet. Replies from the chapter will appear here.</p>
          ) : (
            <div className="mt-4 grid gap-2">
              {inbox.map((m) => (
                <button
                  key={m.id}
                  onClick={() => openThread(m)}
                  className={cn(
                    'flex w-full min-w-0 items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
                    m.unreadForUser
                      ? 'border-acm-200 bg-acm-50/50 hover:border-acm-300 dark:border-acm-500/30 dark:bg-acm-500/5'
                      : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700',
                  )}
                >
                  {m.unreadForUser && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('truncate text-sm', m.unreadForUser ? 'font-bold' : 'font-semibold')}>{m.subject || 'Message'}</span>
                      <span className="ml-auto shrink-0 text-xs text-neutral-400">{when(m.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {(m.replies?.length ? m.replies[m.replies.length - 1].body : m.body) || ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ReceiptUploadModal
        open={!!uploadFor}
        onClose={() => setUploadFor(null)}
        title={uploadFor?.event.name || 'Event'}
        amount={uploadFor ? (uploadFor.reg.amountDue ?? (Number(uploadFor.event.fee) || 0)) : 0}
        upiAccountId={uploadFor?.reg.upiAccountId || uploadFor?.event.upiAccountId || ''}
        note={uploadFor?.event.name}
        rejectReason={uploadFor && paymentState(uploadFor.reg) === 'rejected' ? uploadFor.reg.rejectReason : ''}
        paused={!!uploadFor && isQrHidden(uploadFor.event)}
        onSubmit={(receipt) => resubmitReceipt(uploadFor.reg, receipt, uploadFor.event)}
      />

      <Modal open={!!pastTicket} onClose={() => setPastTicket(null)} size="md">
        {pastTicket && <PastTicket reg={pastTicket.reg} event={pastTicket.event} holderName={displayName} userId={user.id} />}
      </Modal>

      <EventDetailsModal event={selected} open={!!selected} onClose={() => setSelected(null)} registered />

      <Modal open={!!openMsg} onClose={() => setOpenMsg(null)} size="lg">
        {openMsg && (
          <div className="p-6 sm:p-8">
            <h3 className="text-lg font-bold tracking-tight">{openMsg.subject || 'Message'}</h3>
            <div className="mt-5">
              <ThreadView message={openMsg} side="user" meName={displayName} onReplied={onThreadReplied} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// A past event's pass (stamped "Event ended") with the registration details.
function PastTicket({ reg, event, holderName, userId }) {
  const took = hasTicket(reg)
  const state = paymentState(reg)
  const registeredOn = (() => {
    const c = reg.createdAt
    const d = typeof c === 'string' ? new Date(c) : c?.toDate?.()
    if (d && !Number.isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    return reg.date ? formatDate(reg.date) : '—'
  })()
  const rows = [
    { label: 'Registered on', value: registeredOn },
    { label: 'Payment', value: state === 'free' ? 'Free entry' : `${PAYMENT_STATE_META[state].label}${reg.amountDue ? ` · ₹${reg.amountDue}` : ''}` },
    reg.utr ? { label: 'UPI transaction ID', value: reg.utr } : null,
    reg.membershipId ? { label: 'Member discount', value: `ACM ID ${reg.membershipId}` } : null,
    reg.isTeam ? { label: 'Team', value: `${reg.teamName || 'Team'}${reg.userId && reg.userId !== userId && reg.userName ? ` · by ${reg.userName}` : ''}` } : null,
  ].filter(Boolean)
  return (
    <div className="p-6 sm:p-8">
      <span className="text-xs font-medium uppercase tracking-wide text-acm-600 dark:text-acm-400">Events History</span>
      <h3 className="mt-1 pr-8 text-lg font-bold tracking-tight">{event.name}</h3>
      {took ? (
        <div className="relative mt-5">
          <TicketCard reg={reg} event={event} holderName={holderName} past />
        </div>
      ) : (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
          This registration wasn’t completed — the payment was never verified before the event ended.
        </p>
      )}
      <dl className="mt-5 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 py-2">
            <dt className="text-neutral-500 dark:text-neutral-400">{r.label}</dt>
            <dd className="truncate text-right font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>
      {reg.isTeam && reg.members?.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Teammates</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reg.members.map((m, i) => (
              <span key={i} className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs dark:border-neutral-800">{m.name || m.email || '—'}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserCheck, Upload, Download, FileText, Loader2, CheckCircle2, XCircle, AlertTriangle, Sparkles, ChevronDown,
  Mail, Phone, School, GraduationCap, Building2, ShieldCheck, Trash2, Search, Hourglass, BookUser,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Modal } from '../ui/Modal'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import * as ms from '../../services/membership'
import { parseRosterRows, textToRows, maskEmail } from '../../lib/memberRoster'
import { readDocx, buildDocx } from '../../lib/docx'
import { avatarDataUri } from '../../lib/avatar'
import { cn } from '../../lib/cn'

const inputCls =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800'

const when = (t) => {
  const d = typeof t === 'string' ? new Date(t) : t?.toDate?.()
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ''
}
const millis = (t) => (typeof t === 'string' ? Date.parse(t) : t?.toMillis?.()) || 0

const ROSTER_STEPS = [
  'Use a Word document (.docx) with one table.',
  'Row 1 is the heading row: Membership ID | Email | Name (Name is optional).',
  'Then one member per row. Use the email the member signs in to this website with — a Google account match is verified instantly.',
  'Rows with a missing ID or an invalid email are skipped and listed, so you can fix and re-upload them.',
  'Re-uploading is safe: members are matched by ID, and a corrected row replaces the old one.',
  'The sample rows (example.com) are ignored. A .csv or .txt export with the same three columns also works.',
]

function downloadTemplate() {
  const bytes = buildDocx({
    title: 'ACM TKMCE — Member roster',
    lines: [
      'Fill in the table below, then upload this file from Admin → Member verification → Upload roster.',
      ...ROSTER_STEPS.map((l, i) => `${i + 1}. ${l}`),
    ],
    header: ['Membership ID', 'Email', 'Name'],
    rows: [
      ['1234567', 'first.member@example.com', 'Sample member (replace me)'],
      ['7654321', 'second.member@example.com', 'Sample member (replace me)'],
    ],
  })
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'acm-member-roster-template.docx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Reads an uploaded roster file: Word tables first, else its paragraphs, else
// plain text.
async function readRosterFile(file) {
  if (/\.docx$/i.test(file.name)) {
    const { tableRows, paragraphs } = await readDocx(await file.arrayBuffer())
    return parseRosterRows(tableRows.length ? tableRows : textToRows(paragraphs.join('\n')))
  }
  if (/\.doc$/i.test(file.name)) throw new Error('That’s an old .doc file. Open it in Word and use Save As → Word Document (.docx), then upload that.')
  return parseRosterRows(textToRows(await file.text()))
}

export function MemberVerificationPanel({ canEdit = true, adminName, onChanged }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [rosterCount, setRosterCount] = useState(null)
  const [view, setView] = useState('pending') // pending | approved | denied
  const [q, setQ] = useState('')
  const [autoNote, setAutoNote] = useState('')
  const [showHow, setShowHow] = useState(false)
  const [preview, setPreview] = useState(null) // { fileName, entries, skipped }
  const [importing, setImporting] = useState(false)
  const [fileErr, setFileErr] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const fileRef = useRef(null)

  async function load({ reconcile = false } = {}) {
    try {
      let list = await ms.fetchVerificationRequests()
      // Hybrid: anything the roster vouches for is approved automatically, so it
      // never needs a manual look.
      if (reconcile && canEdit && list.some((r) => r.status === 'pending')) {
        const n = await ms.autoApproveFromRoster(list)
        if (n > 0) {
          setAutoNote(`${n} request${n === 1 ? '' : 's'} matched the roster and ${n === 1 ? 'was' : 'were'} verified automatically.`)
          list = await ms.fetchVerificationRequests()
        }
      }
      setRequests(list)
      setLoadErr('')
      onChanged?.(list.filter((r) => r.status === 'pending').length)
    } catch (err) {
      setLoadErr(err?.code === 'permission-denied' ? 'Your account cannot read membership verification requests.' : 'Could not load verification requests.')
    } finally {
      setLoading(false)
    }
    ms.fetchRosterCount().then(setRosterCount).catch(() => setRosterCount(null))
  }

  useEffect(() => {
    load({ reconcile: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const counts = useMemo(() => ({
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    denied: requests.filter((r) => r.status === 'denied').length,
  }), [requests])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return requests
      .filter((r) => r.status === view)
      .filter((r) => !needle || [r.name, r.email, r.membershipId, r.phone, r.department].some((f) => String(f || '').toLowerCase().includes(needle)))
      .sort((a, b) => (view === 'pending' ? millis(a.createdAt) - millis(b.createdAt) : millis(b.reviewedAt) - millis(a.reviewedAt)))
  }, [requests, view, q])

  async function pickFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileErr('')
    try {
      const parsed = await readRosterFile(file)
      if (!parsed.entries.length && !parsed.skipped.length) {
        setFileErr('No members found in that file. Put them in a table with the headings Membership ID | Email | Name — download the template to see the format.')
        return
      }
      setPreview({ fileName: file.name, ...parsed })
    } catch (err) {
      setFileErr(err?.message || 'Could not read that file.')
    }
  }

  async function importRoster() {
    setImporting(true)
    try {
      await ms.saveRosterEntries(preview.entries, adminName)
      setPreview(null)
      setAutoNote(`Roster updated with ${preview.entries.length} member${preview.entries.length === 1 ? '' : 's'}.`)
      await load({ reconcile: true })
    } catch (err) {
      setFileErr(err?.message || 'Could not save the roster — please try again.')
      setPreview(null)
    } finally {
      setImporting(false)
    }
  }

  async function clearRoster() {
    await ms.clearRoster()
    setRosterCount(0)
    setAutoNote('Roster cleared. Existing members keep their membership.')
  }

  const patchRequest = (uid, patch) => {
    setRequests((rs) => {
      const next = rs.map((r) => ((r.userId || r.id) === uid ? { ...r, ...patch } : r))
      onChanged?.(next.filter((r) => r.status === 'pending').length)
      return next
    })
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <UserCheck className="h-5 w-5 text-acm-500" /> Member verification
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            “Already a member?” requests from people who joined before the website. Roster matches are verified automatically; the rest wait here.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {autoNote && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200"
          >
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{autoNote}</span>
            <button onClick={() => setAutoNote('')} className="text-xs font-medium underline-offset-2 hover:underline">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Roster */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-acm-500/10 text-acm-600 dark:text-acm-400">
              <BookUser className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold tracking-tight">Member roster</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {rosterCount == null ? 'Checking…' : rosterCount === 0 ? 'Empty — upload one to switch on automatic verification.' : `${rosterCount} existing member${rosterCount === 1 ? '' : 's'} on file`}
              </div>
            </div>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept=".docx,.csv,.txt,.doc" className="hidden" onChange={pickFile} />
              <Button size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Upload roster
              </Button>
              <Button size="sm" variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4" /> Template (.docx)
              </Button>
              {rosterCount > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)} aria-label="Clear roster">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
        <button onClick={() => setShowHow((v) => !v)} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-acm-600 dark:text-acm-400">
          <FileText className="h-3.5 w-3.5" /> How to format the roster
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showHow && 'rotate-180')} />
        </button>
        <AnimatePresence initial={false}>
          {showHow && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-neutral-600 dark:text-neutral-300">
                {ROSTER_STEPS.map((l) => <li key={l}>{l}</li>)}
              </ol>
              <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200 text-xs dark:border-neutral-700">
                <div className="grid grid-cols-3 bg-neutral-50 font-semibold dark:bg-neutral-800">
                  {['Membership ID', 'Email', 'Name'].map((h) => <div key={h} className="px-3 py-2">{h}</div>)}
                </div>
                <div className="grid grid-cols-3 border-t border-neutral-200 font-mono text-neutral-500 dark:border-neutral-700">
                  <div className="px-3 py-2">1234567</div><div className="truncate px-3 py-2">asha@tkmce.ac.in</div><div className="px-3 py-2 font-sans">Asha K</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {fileErr && (
          <p className="mt-3 flex items-start gap-2 text-xs text-rose-600 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {fileErr}
          </p>
        )}
      </div>

      {/* Requests */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-10 items-center rounded-lg border border-neutral-200 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-800">
          {[
            { k: 'pending', label: 'Pending', n: counts.pending },
            { k: 'approved', label: 'Approved', n: counts.approved },
            { k: 'denied', label: 'Denied', n: counts.denied },
          ].map((o) => (
            <button
              key={o.k}
              onClick={() => setView(o.k)}
              className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                view === o.k ? 'bg-acm-600 text-white' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200')}
            >
              {o.label} <span className="opacity-70">{o.n}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input className={cn(inputCls, 'h-10 py-0 pl-9')} placeholder="Search name / email / ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <Loader2 className="h-6 w-6 animate-spin text-acm-500" />
        </div>
      ) : loadErr ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{loadErr}</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 p-12 text-center dark:border-neutral-800">
          <p className="text-sm text-neutral-500">
            {view === 'pending' ? 'Nothing waiting — every request has been handled.' : `No ${view} requests${q ? ' match that search' : ' yet'}.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {shown.map((r) => (
            <RequestCard
              key={r.userId || r.id}
              request={r}
              canEdit={canEdit}
              reviewer={adminName}
              onDecided={(patch) => patchRequest(r.userId || r.id, patch)}
            />
          ))}
        </div>
      )}

      <Modal open={!!preview} onClose={() => !importing && setPreview(null)} size="md">
        {preview && (
          <div className="grid gap-4 p-6 sm:p-8">
            <div className="pr-8">
              <span className="text-xs font-medium uppercase tracking-wide text-acm-600 dark:text-acm-400">Roster import</span>
              <h3 className="mt-1 truncate text-lg font-bold tracking-tight">{preview.fileName}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10">
                <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">{preview.entries.length}</div>
                <div className="text-xs text-emerald-700/80 dark:text-emerald-300/80">members ready to import</div>
              </div>
              <div className={cn('rounded-xl border p-4', preview.skipped.length ? 'border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10' : 'border-neutral-200 dark:border-neutral-800')}>
                <div className={cn('text-2xl font-extrabold', preview.skipped.length ? 'text-amber-700 dark:text-amber-300' : 'text-neutral-400')}>{preview.skipped.length}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">rows skipped</div>
              </div>
            </div>
            {preview.entries.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-neutral-200 text-xs dark:border-neutral-800">
                {preview.entries.slice(0, 50).map((e) => (
                  <div key={e.rosterId} className="flex items-center gap-3 border-b border-neutral-100 px-3 py-1.5 last:border-0 dark:border-neutral-800">
                    <span className="w-24 shrink-0 font-mono font-semibold">{e.membershipId}</span>
                    <span className="min-w-0 flex-1 truncate text-neutral-500">{e.email}</span>
                    <span className="hidden truncate text-neutral-400 sm:block">{e.name}</span>
                  </div>
                ))}
                {preview.entries.length > 50 && <div className="px-3 py-1.5 text-neutral-400">…and {preview.entries.length - 50} more</div>}
              </div>
            )}
            {preview.skipped.length > 0 && (
              <details className="rounded-lg border border-amber-200 p-3 text-xs dark:border-amber-500/25">
                <summary className="cursor-pointer font-medium text-amber-700 dark:text-amber-300">Why rows were skipped</summary>
                <ul className="mt-2 space-y-1 text-neutral-500 dark:text-neutral-400">
                  {preview.skipped.slice(0, 30).map((s) => (
                    <li key={s.line}><span className="font-medium">Row {s.line}:</span> {s.reason} — <span className="font-mono">{s.text}</span></li>
                  ))}
                </ul>
              </details>
            )}
            <Button onClick={importRoster} disabled={importing || !preview.entries.length}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? 'Importing…' : `Import ${preview.entries.length} member${preview.entries.length === 1 ? '' : 's'}`}
            </Button>
            <p className="text-xs text-neutral-400">Waiting requests that match are verified straight after the import.</p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearRoster}
        title="Clear the member roster?"
        description="Automatic verification stops until you upload a new roster. Members already verified keep their membership."
        confirmLabel="Clear roster"
      />
    </motion.div>
  )
}

const VERDICT = {
  match: { tone: 'green', label: 'Matches the roster' },
  'email-mismatch': { tone: 'amber', label: 'ID on roster, different email' },
  'not-found': { tone: 'neutral', label: 'Not on the roster' },
}

function RequestCard({ request, canEdit, reviewer, onDecided }) {
  const pending = request.status === 'pending'
  const [check, setCheck] = useState(null)
  const [id, setId] = useState(request.membershipId || '')
  const [denying, setDenying] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!pending) return
    let alive = true
    ms.checkRequest(request).then((c) => alive && setCheck(c)).catch(() => {})
    return () => { alive = false }
  }, [request, pending])

  async function approve() {
    setBusy('approve')
    setErr('')
    try {
      onDecided(await ms.approveVerification({ request, membershipId: id, reviewer }))
    } catch (ex) {
      setErr(ex?.message || 'Could not approve — please try again.')
    } finally {
      setBusy('')
    }
  }

  async function deny() {
    setBusy('deny')
    setErr('')
    try {
      onDecided(await ms.denyVerification({ request, reason, reviewer }))
    } catch (ex) {
      setErr(ex?.message || 'Could not deny — please try again.')
    } finally {
      setBusy('')
    }
  }

  const details = [
    { icon: Mail, value: request.email },
    { icon: Phone, value: request.phone },
    { icon: School, value: request.college },
    { icon: Building2, value: request.department },
    { icon: GraduationCap, value: [request.year, request.gender].filter(Boolean).join(' · ') },
  ].filter((d) => d.value)
  const v = check ? VERDICT[check.verdict] : null

  return (
    <motion.div layout className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-start gap-4">
        <img src={avatarDataUri(request.name || 'Member')} alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{request.name || '—'}</span>
            {request.emailVerified
              ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-3 w-3" /> verified email</span>
              : <span className="text-[11px] text-amber-600 dark:text-amber-400">email not verified</span>}
          </div>
          <div className="mt-1.5 grid gap-1 text-xs text-neutral-500 sm:grid-cols-2 dark:text-neutral-400">
            {details.map((d, i) => (
              <span key={i} className="flex min-w-0 items-center gap-1.5 truncate"><d.icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{d.value}</span></span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-neutral-400">Claimed ID</div>
          <div className="font-mono text-lg font-bold">{request.membershipId}</div>
          <div className="text-[11px] text-neutral-400">{when(request.createdAt)}</div>
        </div>
      </div>

      {pending && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!check ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking the roster…</span>
          ) : (
            <>
              <Badge tone={v.tone}>{v.label}</Badge>
              {check.verdict === 'email-mismatch' && <span className="text-xs text-neutral-500">Roster has {maskEmail(check.entry.email)}</span>}
              {check.entry?.name && <span className="text-xs text-neutral-500">Roster name: {check.entry.name}</span>}
              {check.takenBy && (
                <Badge tone="red"><AlertTriangle className="h-3 w-3" /> ID already held by {check.takenBy.name || 'another member'}</Badge>
              )}
            </>
          )}
        </div>
      )}

      {pending && canEdit && (
        <div className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
          {denying ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className={inputCls} placeholder="Reason (shown to the member) — e.g. ID not found in our records" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDenying(false)} disabled={!!busy}>Back</Button>
                <Button size="sm" onClick={deny} disabled={!!busy} className="bg-rose-600 hover:bg-rose-700 border-rose-600 hover:border-rose-700">
                  {busy === 'deny' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Deny
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex flex-1 items-center gap-2 text-xs text-neutral-500">
                <span className="shrink-0">Assign ID</span>
                <input className={cn(inputCls, 'max-w-[200px] font-mono')} value={id} onChange={(e) => setId(e.target.value)} />
              </label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDenying(true)} disabled={!!busy}>
                  <XCircle className="h-4 w-4" /> Deny…
                </Button>
                <Button size="sm" onClick={approve} disabled={!!busy || !id.trim()}>
                  {busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {check?.takenBy ? 'Approve anyway' : 'Approve'}
                </Button>
              </div>
            </div>
          )}
          {err && <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{err}</p>}
        </div>
      )}

      {!pending && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          {request.status === 'approved' ? (
            <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Approved · {request.approvedMembershipId || request.membershipId}</Badge>
          ) : (
            <Badge tone="red"><XCircle className="h-3 w-3" /> Denied</Badge>
          )}
          {request.verifiedVia === 'roster' && <Badge tone="blue"><Sparkles className="h-3 w-3" /> Auto (roster)</Badge>}
          <span>{request.reviewedBy ? `by ${request.reviewedBy}` : ''} {when(request.reviewedAt)}</span>
          {request.denyReason && <span className="italic">“{request.denyReason}”</span>}
        </div>
      )}
      {pending && !canEdit && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-400"><Hourglass className="h-3.5 w-3.5" /> Waiting for an admin.</p>
      )}
    </motion.div>
  )
}

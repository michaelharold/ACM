import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Fingerprint, Search, Download, Check, Loader2, AlertCircle, BadgeCheck } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { departments } from '../../lib/orgData'
import { downloadCsv } from '../../lib/csv'
import * as svc from '../../services/firestore'
import { cn } from '../../lib/cn'

const inputCls =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800'

const fullName = (m) => [m.firstName, m.middleName, m.lastName].filter(Boolean).join(' ') || '—'
const appliedOn = (m) => {
  const c = m.createdAt
  const d = typeof c === 'string' ? new Date(c) : c?.toDate?.()
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}
const hasId = (m) => !!(m.membershipId && m.membershipId.trim())

export function MembershipPanel({ canEdit = true }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [drafts, setDrafts] = useState({}) // uid -> edited membershipId
  const [savingId, setSavingId] = useState(null)

  const [dept, setDept] = useState('all')
  const [klass, setKlass] = useState('')
  const [assign, setAssign] = useState('all') // all | assigned | unassigned
  const [q, setQ] = useState('')

  useEffect(() => {
    let alive = true
    svc.fetchAllMemberships()
      .then((list) => {
        if (!alive) return
        setRows(list || [])
        setLoading(false)
      })
      .catch((err) => {
        if (!alive) return
        setLoadError(err?.code === 'permission-denied'
          ? 'Your account cannot read the membership list.'
          : 'Could not load memberships.')
        setLoading(false)
      })
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const kl = klass.trim().toLowerCase()
    const out = rows.filter((m) => {
      if (dept !== 'all' && m.department !== dept) return false
      if (kl && !(m.className || '').toLowerCase().includes(kl)) return false
      if (assign === 'assigned' && !hasId(m)) return false
      if (assign === 'unassigned' && hasId(m)) return false
      if (needle && ![fullName(m), m.email, m.phone, m.membershipId].some((f) => (f || '').toLowerCase().includes(needle)))
        return false
      return true
    })
    // Members still waiting for an ID float to the top.
    return out.sort((a, b) => (hasId(a) ? 1 : 0) - (hasId(b) ? 1 : 0))
  }, [rows, dept, klass, assign, q])

  async function saveId(m) {
    const value = (drafts[m.id] ?? m.membershipId ?? '').trim()
    setSavingId(m.id)
    try {
      await svc.updateMembership(m.id, { membershipId: value })
      setRows((rs) => rs.map((r) => (r.id === m.id ? { ...r, membershipId: value } : r)))
      setDrafts((d) => { const n = { ...d }; delete n[m.id]; return n })
    } finally {
      setSavingId(null)
    }
  }

  function exportCsv() {
    downloadCsv('acm-members', filtered, [
      { label: 'Name', value: fullName },
      { label: 'Email', value: (m) => m.email || '' },
      { label: 'Phone', value: (m) => m.phone || '' },
      { label: 'Department', value: (m) => m.department || '' },
      { label: 'Class', value: (m) => m.className || '' },
      { label: 'Payment', value: (m) => (m.paymentStatus === 'paid' ? 'Paid' : 'Pending') },
      { label: 'Membership ID', value: (m) => m.membershipId || '' },
      { label: 'Applied on', value: appliedOn },
    ])
  }

  const unassignedCount = rows.filter((m) => !hasId(m)).length

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Fingerprint className="h-5 w-5 text-acm-500" /> ACM Members
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            {rows.length} total{unassignedCount > 0 && ` · ${unassignedCount} awaiting an ID`}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters — one consistent-height row that wraps gracefully */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={cn(inputCls, 'h-10 w-full py-0 sm:w-auto sm:min-w-[190px]')} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="all">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input className={cn(inputCls, 'h-10 w-full py-0 sm:w-[130px]')} placeholder="Class e.g. R5B" value={klass} onChange={(e) => setKlass(e.target.value)} />
        <div className="inline-flex h-10 shrink-0 items-center rounded-lg border border-neutral-200 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-800">
          {[
            { k: 'all', label: 'All' },
            { k: 'assigned', label: 'Assigned ID' },
            { k: 'unassigned', label: 'Yet to assign' },
          ].map((o) => (
            <button
              key={o.k}
              onClick={() => setAssign(o.k)}
              className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                assign === o.k ? 'bg-acm-600 text-white' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200')}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input className={cn(inputCls, 'h-10 w-full py-0 pl-9')} placeholder="Search name / email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <Loader2 className="h-6 w-6 animate-spin text-acm-500" />
        </div>
      ) : loadError ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {loadError}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 p-12 text-center dark:border-neutral-800">
          <p className="text-sm text-neutral-500">{rows.length ? 'No members match these filters.' : 'No membership applications yet.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-neutral-400">
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Dept · Class</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Membership ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="px-4 py-3">
                    <div className="font-medium">{fullName(m)}</div>
                    <div className="text-xs text-neutral-400">{m.email}{m.phone ? ` · ${m.phone}` : ''}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                    <div className="truncate">{m.department || '—'}</div>
                    <div className="text-xs text-neutral-400">{m.className || '—'} · {appliedOn(m)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={m.paymentStatus === 'paid' ? 'green' : 'amber'} dot={m.paymentStatus === 'paid'}>
                      {m.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          className={cn(inputCls, 'max-w-[150px] py-1.5')}
                          placeholder="Assign ID…"
                          value={drafts[m.id] ?? m.membershipId ?? ''}
                          onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && saveId(m)}
                        />
                        <button
                          onClick={() => saveId(m)}
                          disabled={savingId === m.id || (drafts[m.id] ?? m.membershipId ?? '') === (m.membershipId ?? '')}
                          aria-label="Save membership ID"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-acm-600 hover:bg-acm-50 disabled:opacity-30 dark:hover:bg-acm-500/10"
                        >
                          {savingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                      </div>
                    ) : hasId(m) ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-acm-600 dark:text-acm-400">
                        <BadgeCheck className="h-4 w-4" /> {m.membershipId}
                      </span>
                    ) : (
                      <span className="text-neutral-400">Yet to assign</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  )
}

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Wallet, Plus, Trash2, Loader2, Info, KeyRound, Save, Power, AlertCircle, Star, Pencil, QrCode, ChevronDown } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { UpiAccountForm } from '../payments/UpiAccountForm'
import { useData } from '../../context/DataContext'
import { isRazorpayMode } from '../../lib/payments'
import * as svc from '../../services/firestore'
import * as pay from '../../services/payments'
import { cn } from '../../lib/cn'

const inputCls =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800'

// Admin-only payment setup. Payers scan a UPI QR, upload their receipt, and an
// admin verifies it in "Verify payments". This tab manages the QR accounts
// (one is the default), the membership fee, and — kept for later — Razorpay.
export function PaymentsPanel() {
  const { content, updateContent } = useData()
  const [upi, setUpi] = useState([])
  const [upiLoading, setUpiLoading] = useState(true)

  useEffect(() => {
    let alive = true
    pay.fetchUpiAccounts()
      .then((list) => alive && setUpi(list || []))
      .catch(() => {})
      .finally(() => alive && setUpiLoading(false))
    return () => { alive = false }
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Wallet className="h-5 w-5 text-acm-500" /> Payments
        </h2>
        <p className="mt-1 text-xs text-neutral-400">
          Payers scan a UPI QR, pay, and upload their receipt — you approve or reject it under “Verify payments”.
          Events use the default account unless you pick another one in the event’s settings.
        </p>
      </div>

      <UpiAccountsSection
        accounts={upi}
        setAccounts={setUpi}
        loading={upiLoading}
        defaultId={content.defaultUpiAccountId || ''}
        onSetDefault={(id) => updateContent({ defaultUpiAccountId: id })}
      />
      <MembershipPaymentSection accounts={upi} defaultId={content.defaultUpiAccountId || ''} />
      <RazorpaySection />
    </motion.div>
  )
}

function UpiAccountsSection({ accounts, setAccounts, loading, defaultId, onSetDefault }) {
  const [editing, setEditing] = useState(null) // null | 'new' | account
  const [err, setErr] = useState('')

  async function saved(acc) {
    setAccounts((list) => (list.some((a) => a.id === acc.id) ? list.map((a) => (a.id === acc.id ? acc : a)) : [acc, ...list]))
    setEditing(null)
    // The first account becomes the default automatically — there's nothing
    // else to choose between yet.
    if (!defaultId) {
      try { await onSetDefault(acc.id) } catch { /* can still be set by hand */ }
    }
  }

  async function toggleActive(acc) {
    const next = acc.active === false
    if (!next && acc.id === defaultId) {
      setErr('The default account can’t be switched off — make another account the default first.')
      return
    }
    setErr('')
    setAccounts((list) => list.map((a) => (a.id === acc.id ? { ...a, active: next } : a)))
    try {
      await pay.updateUpiAccount(acc.id, { active: next })
    } catch (ex) {
      setAccounts((list) => list.map((a) => (a.id === acc.id ? { ...a, active: !next } : a)))
      setErr(ex?.message || `Could not update “${acc.label}”.`)
    }
  }

  async function remove(acc) {
    if (acc.id === defaultId) {
      setErr('This is the default account. Make another account the default before deleting it.')
      return
    }
    if (!confirm(`Delete “${acc.label}”? Events using it will fall back to the default account.`)) return
    setErr('')
    const prev = accounts
    setAccounts((list) => list.filter((a) => a.id !== acc.id))
    try {
      await pay.deleteUpiAccount(acc.id)
    } catch (ex) {
      setAccounts(prev)
      setErr(ex?.message || `Could not delete “${acc.label}”.`)
    }
  }

  async function makeDefault(acc) {
    setErr('')
    try {
      await onSetDefault(acc.id)
    } catch (ex) {
      setErr(ex?.message || 'Could not change the default account.')
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 p-4 dark:border-neutral-800">
        <div>
          <h3 className="text-sm font-semibold">UPI / QR accounts</h3>
          <p className="text-xs text-neutral-400">The ★ default receives every payment unless an event picks another account.</p>
        </div>
        {editing !== 'new' && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Add QR account
          </Button>
        )}
      </div>

      {editing === 'new' && (
        <div className="border-b border-neutral-100 p-4 dark:border-neutral-800">
          <UpiAccountForm onSaved={saved} onCancel={() => setEditing(null)} />
        </div>
      )}

      {loading ? (
        <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-acm-500" /></div>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {accounts.length === 0 && editing !== 'new' && (
            <p className="p-4 text-sm text-neutral-500">No QR accounts yet — add one so people can pay.</p>
          )}
          {accounts.map((acc) =>
            editing?.id === acc.id ? (
              <div key={acc.id} className="p-4">
                <UpiAccountForm initial={acc} onSaved={saved} onCancel={() => setEditing(null)} />
              </div>
            ) : (
              <div key={acc.id} className="flex items-center gap-3 p-4">
                {acc.qrImage ? (
                  <img src={acc.qrImage} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain p-0.5" />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-400 dark:bg-neutral-800"><QrCode className="h-5 w-5" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{acc.label}</span>
                    {acc.id === defaultId && <Badge tone="blue"><Star className="h-3 w-3" /> Default</Badge>}
                    <Badge tone={acc.active !== false ? 'green' : 'neutral'} dot={acc.active !== false}>{acc.active !== false ? 'Active' : 'Off'}</Badge>
                  </div>
                  <div className="truncate text-xs text-neutral-400">
                    {acc.payeeName ? `${acc.payeeName} · ` : ''}<code>{acc.upiId}</code>
                  </div>
                </div>
                {acc.id !== defaultId && acc.active !== false && (
                  <button onClick={() => makeDefault(acc)} title="Make default" aria-label="Make default" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-amber-500 dark:hover:bg-neutral-800">
                    <Star className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => setEditing(acc)} title="Edit" aria-label="Edit account" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => toggleActive(acc)} title={acc.active !== false ? 'Switch off' : 'Switch on'} aria-label="Toggle active" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <Power className="h-4 w-4" />
                </button>
                <button onClick={() => remove(acc)} title="Delete" aria-label="Delete account" className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ),
          )}
        </div>
      )}

      {err && (
        <p className="flex items-start gap-1.5 border-t border-neutral-100 p-4 text-xs text-rose-600 dark:border-neutral-800 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
        </p>
      )}
    </div>
  )
}

function MembershipPaymentSection({ accounts, defaultId }) {
  const { content, updateContent } = useData()
  const [fee, setFee] = useState(content.membershipFee ?? 0)
  const [acct, setAcct] = useState(content.membershipUpiAccountId || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const defaultLabel = accounts.find((a) => a.id === defaultId)?.label

  const dirty = (content.membershipFee ?? 0) !== (Number(fee) || 0) || (content.membershipUpiAccountId || '') !== acct

  async function save() {
    setSaving(true)
    setErr('')
    try {
      await updateContent({ membershipFee: Math.max(0, Number(fee) || 0), membershipUpiAccountId: acct })
    } catch (ex) {
      setErr(ex?.message || 'Could not save — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="text-sm font-semibold">Membership payment</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs text-neutral-400">Membership fee (₹) — 0 for free</span>
          <input type="number" min="0" className={inputCls} value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-neutral-400">Collect to</span>
          <select className={inputCls} value={acct} onChange={(e) => setAcct(e.target.value)}>
            <option value="">Default account{defaultLabel ? ` (${defaultLabel})` : ' (not set yet)'}</option>
            {accounts.filter((a) => a.active !== false).map((a) => <option key={a.id} value={a.id}>{a.label} · {a.upiId}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {dirty ? 'Save' : 'Saved'}
        </Button>
        {err && (
          <p className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
          </p>
        )}
      </div>
    </div>
  )
}

// Razorpay account profiles — unchanged from the Razorpay integration, folded
// away while PAYMENT_MODE is 'manual' so it's ready the day Razorpay is approved.
function RazorpaySection() {
  const { content, updateContent } = useData()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ label: '', keyId: '', description: '' })
  const [adding, setAdding] = useState(false)
  const [acctErr, setAcctErr] = useState('')
  const [memAcct, setMemAcct] = useState(content.membershipPaymentAccountId || '')
  const [savingMem, setSavingMem] = useState(false)

  useEffect(() => {
    let alive = true
    svc.fetchPaymentAccounts()
      .then((list) => alive && setAccounts(list || []))
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  async function addAccount() {
    if (!draft.label.trim() || !draft.keyId.trim()) return
    setAdding(true)
    setAcctErr('')
    try {
      const created = await svc.createPaymentAccount(draft)
      setAccounts((a) => [created, ...a])
      setDraft({ label: '', keyId: '', description: '' })
    } catch (err) {
      setAcctErr(err?.message || 'Could not add that account — please try again.')
    } finally {
      setAdding(false)
    }
  }

  // Optimistic, but reverted with an error if the write fails — otherwise a
  // failed toggle would silently leave the UI showing a state Firestore
  // never actually recorded.
  async function toggleActive(acc) {
    const next = !acc.active
    setAcctErr('')
    setAccounts((a) => a.map((x) => (x.id === acc.id ? { ...x, active: next } : x)))
    try {
      await svc.updatePaymentAccount(acc.id, { active: next })
    } catch (err) {
      setAccounts((a) => a.map((x) => (x.id === acc.id ? { ...x, active: !next } : x)))
      setAcctErr(err?.message || `Could not ${next ? 'activate' : 'deactivate'} "${acc.label}" — please try again.`)
    }
  }

  async function remove(acc) {
    if (!confirm(`Delete “${acc.label}”? Events using it will fall back to the default account.`)) return
    setAcctErr('')
    const prev = accounts
    setAccounts((a) => a.filter((x) => x.id !== acc.id))
    try {
      await svc.deletePaymentAccount(acc.id)
    } catch (err) {
      setAccounts(prev)
      setAcctErr(err?.message || `Could not delete "${acc.label}" — please try again.`)
    }
  }

  async function saveMemAcct() {
    setSavingMem(true)
    try { await updateContent({ membershipPaymentAccountId: memAcct }) } finally { setSavingMem(false) }
  }

  return (
    <details className="group rounded-2xl border border-neutral-200 dark:border-neutral-800">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold">
            Razorpay {!isRazorpayMode && <Badge tone="neutral">Switched off</Badge>}
          </span>
          <span className="block text-xs text-neutral-400">
            Kept for later — set <code>PAYMENT_MODE</code> to <code>'razorpay'</code> in <code>src/lib/payments.js</code> once the account is approved.
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-4 border-t border-neutral-100 p-4 dark:border-neutral-800">
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-800 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p><strong>Key Secrets are never stored here.</strong> Add each account's <em>Key ID</em> below; put its matching <em>Key Secret</em> in the server env var <code className="rounded bg-blue-100 px-1 dark:bg-blue-500/20">RAZORPAY_KEYS</code> as <code className="rounded bg-blue-100 px-1 dark:bg-blue-500/20">{'{"<keyId>":"<secret>"}'}</code>. See PAYMENTS.md.</p>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800">
          {loading ? (
            <div className="grid h-20 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-acm-500" /></div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {accounts.length === 0 && <p className="p-4 text-sm text-neutral-500">No Razorpay accounts yet.</p>}
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center gap-3 p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-acm-500/10 text-acm-600 dark:text-acm-400">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{acc.label}</span>
                      <Badge tone={acc.active ? 'green' : 'neutral'} dot={acc.active}>{acc.active ? 'Active' : 'Off'}</Badge>
                    </div>
                    <div className="truncate text-xs text-neutral-400">
                      <code>{acc.keyId}</code>{acc.description ? ` · ${acc.description}` : ''}
                    </div>
                  </div>
                  <button onClick={() => toggleActive(acc)} aria-label="Toggle active" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    <Power className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(acc)} aria-label="Delete account" className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-2.5 border-t border-neutral-100 p-4 dark:border-neutral-800 sm:grid-cols-[1fr_1fr_auto]">
            <input className={inputCls} placeholder="Label (e.g. ACM Main)" value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
            <input className={inputCls} placeholder="Razorpay Key ID (rzp_…)" value={draft.keyId} onChange={(e) => setDraft((d) => ({ ...d, keyId: e.target.value }))} />
            <Button onClick={addAccount} disabled={adding || !draft.label.trim() || !draft.keyId.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
            </Button>
            <input className={cn(inputCls, 'sm:col-span-3')} placeholder="Description (optional)" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            {acctErr && (
              <p className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300 sm:col-span-3">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {acctErr}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[220px] flex-1">
            <span className="mb-1.5 block text-xs text-neutral-400">Razorpay account for membership</span>
            <select className={inputCls} value={memAcct} onChange={(e) => setMemAcct(e.target.value)}>
              <option value="">Default account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>
          <Button size="sm" variant="outline" onClick={saveMemAcct} disabled={savingMem || (content.membershipPaymentAccountId || '') === memAcct}>
            {savingMem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </Button>
        </div>
      </div>
    </details>
  )
}

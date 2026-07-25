import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Wallet, Plus, Trash2, Loader2, Info, KeyRound, Save, Power } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { useData } from '../../context/DataContext'
import { isPaymentConfigured } from '../../lib/payments'
import * as svc from '../../services/firestore'
import { cn } from '../../lib/cn'

const inputCls =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800'

// Admin-only management of Razorpay "payment account profiles". Only the
// non-secret half (label + Key ID) is stored; each account's Key SECRET lives in
// the server env (RAZORPAY_KEYS), so there is nothing sensitive here to leak.
export function PaymentsPanel() {
  const { content, updateContent } = useData()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ label: '', keyId: '', description: '' })
  const [adding, setAdding] = useState(false)

  const [fee, setFee] = useState(content.membershipFee ?? 0)
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
    try {
      const created = await svc.createPaymentAccount(draft)
      setAccounts((a) => [created, ...a])
      setDraft({ label: '', keyId: '', description: '' })
    } finally {
      setAdding(false)
    }
  }

  async function toggleActive(acc) {
    const next = !acc.active
    setAccounts((a) => a.map((x) => (x.id === acc.id ? { ...x, active: next } : x)))
    await svc.updatePaymentAccount(acc.id, { active: next })
  }

  async function remove(acc) {
    if (!confirm(`Delete “${acc.label}”? Events using it will fall back to the default account.`)) return
    setAccounts((a) => a.filter((x) => x.id !== acc.id))
    await svc.deletePaymentAccount(acc.id)
  }

  async function saveMembership() {
    setSavingMem(true)
    try {
      await updateContent({ membershipFee: Math.max(0, Number(fee) || 0), membershipPaymentAccountId: memAcct })
    } finally {
      setSavingMem(false)
    }
  }

  const memDirty = (content.membershipFee ?? 0) !== (Number(fee) || 0) || (content.membershipPaymentAccountId || '') !== memAcct

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Wallet className="h-5 w-5 text-acm-500" /> Payments
        </h2>
        <p className="mt-1 text-xs text-neutral-400">
          Create Razorpay account profiles, then assign one to each event (in the Events tab) and to membership below.
        </p>
      </div>

      {/* How-it-works / server-secret notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-800 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p><strong>Key Secrets are never stored here.</strong> Add each account's <em>Key ID</em> below; put its matching <em>Key Secret</em> in the server env var <code className="rounded bg-blue-100 px-1 dark:bg-blue-500/20">RAZORPAY_KEYS</code> as <code className="rounded bg-blue-100 px-1 dark:bg-blue-500/20">{'{"<keyId>":"<secret>"}'}</code>. See PAYMENTS.md.</p>
          {!isPaymentConfigured && (
            <p className="font-medium text-amber-700 dark:text-amber-300">Payments are not live yet on this site — deploy with keys to activate. You can still set everything up here.</p>
          )}
        </div>
      </div>

      {/* Account profiles */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <div className="border-b border-neutral-100 p-4 dark:border-neutral-800">
          <h3 className="text-sm font-semibold">Account profiles</h3>
        </div>

        {loading ? (
          <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-acm-500" /></div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {accounts.length === 0 && (
              <p className="p-4 text-sm text-neutral-500">No accounts yet — add one below.</p>
            )}
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

        {/* Add form */}
        <div className="grid gap-2.5 border-t border-neutral-100 p-4 dark:border-neutral-800 sm:grid-cols-[1fr_1fr_auto]">
          <input className={inputCls} placeholder="Label (e.g. ACM Main)" value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
          <input className={inputCls} placeholder="Razorpay Key ID (rzp_…)" value={draft.keyId} onChange={(e) => setDraft((d) => ({ ...d, keyId: e.target.value }))} />
          <Button onClick={addAccount} disabled={adding || !draft.label.trim() || !draft.keyId.trim()}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
          </Button>
          <input className={cn(inputCls, 'sm:col-span-3')} placeholder="Description (optional)" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
        </div>
      </div>

      {/* Membership payment */}
      <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="text-sm font-semibold">Membership payment</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs text-neutral-400">Membership fee (₹) — 0 for free</span>
            <input type="number" min="0" className={inputCls} value={fee} onChange={(e) => setFee(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-neutral-400">Credit payments to</span>
            <select className={inputCls} value={memAcct} onChange={(e) => setMemAcct(e.target.value)}>
              <option value="">Default account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3">
          <Button size="sm" onClick={saveMembership} disabled={savingMem || !memDirty}>
            {savingMem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {memDirty ? 'Save' : 'Saved'}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

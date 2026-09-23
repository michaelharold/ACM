import { useEffect, useState } from 'react'
import { useData } from '../../context/DataContext'
import { fetchUpiAccounts } from '../../services/payments'
import { resolveUpiAccount } from '../../lib/manualPay'

// Loads UPI accounts on demand — they carry QR images, so they're not part of
// the app-wide data load — and resolves the one that applies. `preferredId` is
// an event's upiAccountId or the membership account; '' means the site default.
export function useUpiAccount(preferredId, enabled = true) {
  const { content } = useData()
  const [accounts, setAccounts] = useState(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    fetchUpiAccounts()
      .then((list) => alive && setAccounts(list || []))
      .catch(() => alive && setAccounts([]))
    return () => { alive = false }
  }, [enabled])
  return {
    loading: enabled && accounts === null,
    account: resolveUpiAccount(accounts || [], preferredId, content?.defaultUpiAccountId),
  }
}

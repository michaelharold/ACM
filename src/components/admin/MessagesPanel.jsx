import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, MailOpen, Search, Inbox, AlertCircle } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Modal } from '../ui/Modal'
import { ThreadView, when } from '../messages/Thread'
import { avatarDataUri } from '../../lib/avatar'
import { cn } from '../../lib/cn'
import * as svc from '../../services/firestore'

const statusTone = { new: 'blue', read: 'neutral', replied: 'green' }

// Old threads predate the unread flag, so fall back to the legacy 'new' status.
const isUnread = (m) => m.unreadForAdmin ?? (m.status === 'new')

export function MessagesPanel({ adminName }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const [q, setQ] = useState('')

  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let alive = true
    svc.fetchMessages()
      .then((m) => { if (alive) { setRows(m); setLoading(false) } })
      .catch((err) => {
        if (!alive) return
        setLoadError(err?.code === 'permission-denied'
          ? 'Your account does not have permission to read the inbox.'
          : 'Could not load messages.')
        setLoading(false)
      })
    return () => { alive = false }
  }, [])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((m) =>
      [m.userName, m.userEmail, m.subject, m.body].some((f) => (f || '').toLowerCase().includes(needle)),
    )
  }, [rows, q])

  const unread = rows.filter(isUnread).length

  async function openMessage(m) {
    setOpen(m)
    if (isUnread(m)) {
      const wasNew = m.status === 'new'
      try {
        await svc.markThreadRead(m.id, 'admin', { wasNew })
        setRows((r) => r.map((x) => (x.id === m.id ? { ...x, unreadForAdmin: false, status: wasNew ? 'read' : x.status } : x)))
      } catch {
        // Non-critical — the thread still opens and reads fine; the unread
        // dot just won't clear until a retry succeeds. Don't block the modal.
      }
    }
  }

  function onReplied(id, reply) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status: 'replied', unreadForAdmin: false, replies: [...(x.replies || []), reply] } : x)))
    setOpen((o) => (o && o.id === id ? { ...o, status: 'replied', replies: [...(o.replies || []), reply] } : o))
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Inbox className="h-5 w-5 text-acm-500" /> Messages
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            {rows.length} total{unread > 0 && ` · ${unread} unread`}
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search messages"
            className="h-9 w-56 rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-200 border-t-acm-600 dark:border-neutral-800 dark:border-t-acm-500" />
        </div>
      ) : loadError ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {loadError}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 p-12 text-center dark:border-neutral-800">
          <p className="text-sm text-neutral-500">{q ? 'No messages match that search.' : 'No messages yet.'}</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {list.map((m) => (
            <button
              key={m.id}
              onClick={() => openMessage(m)}
              className={cn(
                // min-w-0: grid items default to min-width:auto, which lets a long
                // message body stretch the row past the panel instead of truncating.
                'group flex w-full min-w-0 items-start gap-3.5 rounded-xl border p-4 text-left transition-colors',
                isUnread(m)
                  ? 'border-acm-200 bg-acm-50/50 hover:border-acm-300 dark:border-acm-500/30 dark:bg-acm-500/5 dark:hover:border-acm-500/50'
                  : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700',
              )}
            >
              <span className="relative shrink-0">
                <img
                  src={avatarDataUri(m.userName || 'Member')}
                  alt=""
                  className="h-9 w-9 rounded-lg object-cover"
                />
                {/* Red unread dot */}
                {isUnread(m) && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-red-500 dark:border-neutral-900" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('truncate text-sm', isUnread(m) ? 'font-bold' : 'font-semibold')}>
                    {m.userName}
                  </span>
                  <Badge tone={statusTone[m.status] || 'neutral'} className="shrink-0">
                    {m.status}
                  </Badge>
                  <span className="ml-auto shrink-0 text-xs text-neutral-400">{when(m.createdAt)}</span>
                </div>
                <p className="mt-0.5 truncate text-sm font-medium text-neutral-700 dark:text-neutral-300">{m.subject}</p>
                <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">{m.body}</p>
              </div>
              {isUnread(m) ? (
                <Mail className="mt-1 h-4 w-4 shrink-0 text-acm-500" />
              ) : (
                <MailOpen className="mt-1 h-4 w-4 shrink-0 text-neutral-300 dark:text-neutral-600" />
              )}
            </button>
          ))}
        </div>
      )}

      <MessageDetail message={open} onClose={() => setOpen(null)} adminName={adminName} onReplied={onReplied} />
    </motion.div>
  )
}

function MessageDetail({ message, onClose, adminName, onReplied }) {
  if (!message) return <Modal open={false} onClose={onClose} />
  return (
    <Modal open={!!message} onClose={onClose} size="lg">
      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <img src={avatarDataUri(message.userName || 'Member')} alt="" className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold tracking-tight">{message.subject}</h3>
            <p className="mt-0.5 truncate text-sm text-neutral-500 dark:text-neutral-400">
              {message.userName} · <span className="text-acm-500">{message.userEmail}</span>
            </p>
          </div>
        </div>
        <div className="mt-6">
          <ThreadView message={message} side="admin" meName={adminName || 'ACM TKMCE'} onReplied={(reply) => onReplied(message.id, reply)} />
        </div>
      </div>
    </Modal>
  )
}

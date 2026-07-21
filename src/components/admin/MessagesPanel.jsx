import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, MailOpen, CornerUpLeft, Send, Search, Inbox, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Modal } from '../ui/Modal'
import { avatarDataUri } from '../../lib/avatar'
import { cn } from '../../lib/cn'
import * as svc from '../../services/firestore'

const statusTone = { new: 'blue', read: 'neutral', replied: 'green' }

const when = (iso) => {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso.toDate?.() || new Date()
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 60) return `${Math.max(mins, 1)}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

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

  const unread = rows.filter((m) => m.status === 'new').length

  async function openMessage(m) {
    setOpen(m)
    if (m.status === 'new') {
      await svc.markMessageRead(m.id)
      setRows((r) => r.map((x) => (x.id === m.id ? { ...x, status: 'read' } : x)))
    }
  }

  function onReplied(id, reply) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status: 'replied', replies: [...(x.replies || []), reply] } : x)))
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
                m.status === 'new'
                  ? 'border-acm-200 bg-acm-50/50 hover:border-acm-300 dark:border-acm-500/30 dark:bg-acm-500/5 dark:hover:border-acm-500/50'
                  : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700',
              )}
            >
              <img
                src={avatarDataUri(m.userName || 'Member')}
                alt=""
                className="h-9 w-9 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('truncate text-sm', m.status === 'new' ? 'font-bold' : 'font-semibold')}>
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
              {m.status === 'new' ? (
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
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    setBody('')
    setResult(null)
  }, [message?.id])

  if (!message) return <Modal open={false} onClose={onClose} />

  const subject = `Re: ${message.subject}`

  async function submit(e) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setSending(true)
    setResult(null)
    try {
      const { queued, reply } = await svc.sendReply({
        messageId: message.id,
        to: message.userEmail,
        subject,
        body: text,
        fromName: adminName || 'ACM TKMCE',
      })
      onReplied(message.id, reply)
      setBody('')
      setResult({ ok: true, queued })
    } catch (err) {
      setResult({ ok: false, error: err?.message || 'Could not queue the reply.' })
    } finally {
      setSending(false)
    }
  }

  const mailto = `mailto:${message.userEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

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
            <p className="mt-0.5 text-xs text-neutral-400">{when(message.createdAt)}</p>
          </div>
        </div>

        <div className="mt-6 whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-700 dark:border-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300">
          {message.body}
        </div>

        {message.replies?.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Replies sent</p>
            {message.replies.map((r, i) => (
              <div
                key={i}
                className="whitespace-pre-wrap rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-sm text-neutral-700 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-neutral-300"
              >
                {r.body}
                <span className="mt-1.5 block text-xs text-neutral-400">— {r.byName}, {when(r.sentAt)}</span>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
          <label htmlFor="reply" className="mb-1.5 flex items-center gap-2 text-sm font-medium">
            <CornerUpLeft className="h-4 w-4 text-acm-500" /> Reply to {message.userName}
          </label>
          <textarea
            id="reply"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Write your reply — it goes to ${message.userEmail}`}
            className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm outline-none transition-colors focus:border-acm-500 focus:ring-4 focus:ring-acm-500/10 dark:border-neutral-800 dark:bg-neutral-900"
          />

          {result && (
            <p
              className={cn(
                'mt-3 flex items-start gap-2 text-sm',
                result.ok ? 'text-emerald-500' : 'text-rose-500',
              )}
            >
              {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              {result.ok
                ? result.queued
                  ? `Reply queued for delivery to ${message.userEmail}.`
                  : 'Reply recorded (demo mode — no email was actually sent).'
                : result.error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit" disabled={sending || !body.trim()}>
              <Send className="h-4 w-4" /> {sending ? 'Sending…' : 'Send reply'}
            </Button>
            <Button as="a" href={mailto} variant="outline" type="button">
              <ExternalLink className="h-4 w-4" /> Open in email client
            </Button>
          </div>
          <p className="mt-3 text-xs text-neutral-400">
            Replies are delivered by the Firebase “Trigger Email” extension. If it isn’t installed yet, use “Open in
            email client” — the reply is still recorded on this thread either way.
          </p>
        </form>
      </div>
    </Modal>
  )
}

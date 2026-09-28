import { useState } from 'react'
import { Send, Mail, Loader2, CornerUpLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { cn } from '../../lib/cn'
import * as svc from '../../services/firestore'
import { MailSent } from './MailSent'

export const when = (iso) => {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso?.toDate?.() || new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 60) return `${Math.max(mins, 1)}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

// Flatten a thread into ordered entries so both sides render identically.
function entries(message) {
  const first = {
    from: message.initiatedBy === 'admin' ? 'admin' : 'user',
    body: message.body,
    byName: message.initiatedBy === 'admin' ? (message.byName || 'ACM TKMCE') : (message.userName || 'Member'),
    sentAt: message.createdAt,
  }
  return [first, ...(message.replies || [])]
}

// One conversation, reusable from the admin inbox (side='admin') and a member's
// profile inbox (side='user'). Renders the full back-and-forth and an in-app
// reply box; the admin side also offers a prefilled mailto.
export function ThreadView({ message, side, meName, onReplied }) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')

  if (!message) return null
  const items = entries(message)

  const [flown, setFlown] = useState(false)
  async function send() {
    const text = body.trim()
    if (!text) return
    setSending(true)
    setErr('')
    try {
      const reply = await svc.replyInApp({ messageId: message.id, from: side, body: text, byName: meName })
      setBody('')
      setFlown(true) // envelope + swoosh over the reply box
      onReplied?.(reply)
    } catch (e) {
      setErr(e?.message || 'Could not send. Try again.')
    } finally {
      setSending(false)
    }
  }

  // Admin's email fallback: a friendly, prefilled reply to the member's address.
  const mailBody = `Hey ${message.userName || 'there'},\n\nThis message is from the ACM TKMCE Student Chapter, in response to your message:\n"${message.body}"\n\n${body}`
  const mailto = `mailto:${message.userEmail}?subject=${encodeURIComponent(`Re: ${message.subject || 'Your message'}`)}&body=${encodeURIComponent(mailBody)}`

  return (
    <div>
      <div className="space-y-2.5">
        {items.map((e, i) => {
          const mine = e.from === side
          return (
            <div key={i} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                  e.from === 'admin'
                    ? 'bg-acm-600 text-white'
                    : 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200',
                )}
              >
                {e.body}
                <span className={cn('mt-1 block text-[11px]', e.from === 'admin' ? 'text-white/70' : 'text-neutral-400')}>
                  {e.byName} · {when(e.sentAt)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="relative mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <MailSent show={flown} onDone={() => setFlown(false)} label="Reply sent" />
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
          <CornerUpLeft className="h-4 w-4 text-acm-500" />
          {side === 'admin' ? `Reply to ${message.userName || 'member'}` : 'Reply'}
        </label>
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm outline-none transition-colors focus:border-acm-500 focus:ring-4 focus:ring-acm-500/10 dark:border-neutral-800 dark:bg-neutral-900"
        />
        {err && <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={send} disabled={sending || !body.trim()} size="sm">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send in app
          </Button>
          {side === 'admin' && (
            <Button as="a" href={mailto} variant="outline" size="sm" type="button">
              <Mail className="h-4 w-4" /> Reply by email
            </Button>
          )}
        </div>
        {side === 'admin' && (
          <p className="mt-2 text-xs text-neutral-400">
            “Send in app” lands in the member’s profile inbox instantly. “Reply by email” opens your mail app, prefilled.
          </p>
        )}
      </div>
    </div>
  )
}

// Admin composes a brand-new message to a specific member (from Membership /
// Registrations rows). It appears in that member's profile inbox.
export function ComposeMessageModal({ open, onClose, toUid, toName, toEmail, fromName, onSent }) {
  const [body, setBody] = useState('')
  const [subject, setSubject] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    setErr('')
    try {
      await svc.sendAdminMessage({ toUid, toName, toEmail, subject: subject.trim() || 'Message from ACM TKMCE', body: body.trim(), fromName })
      setDone(true) // envelope + swoosh; the window closes when it has flown
      onSent?.()
    } catch (e2) {
      setErr(e2?.message || 'Could not send the message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <form onSubmit={submit} className="relative p-6 sm:p-8">
        <MailSent show={done} onDone={() => { onClose(); setDone(false); setBody(''); setSubject('') }} />
        <h3 className="text-lg font-bold tracking-tight">Message {toName || 'member'}</h3>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Sent to their profile inbox{toEmail ? ` (${toEmail})` : ''}.
        </p>
        {done ? (
          <p className="mt-6 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Message sent.
          </p>
        ) : (
          <>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (optional)"
              className="mt-5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm outline-none focus:border-acm-500 dark:border-neutral-800 dark:bg-neutral-900"
            />
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              className="mt-3 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-acm-500 focus:ring-4 focus:ring-acm-500/10 dark:border-neutral-800 dark:bg-neutral-900"
            />
            {err && <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={sending}>Cancel</Button>
              <Button type="submit" size="sm" disabled={sending || !body.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
              </Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}

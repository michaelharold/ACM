import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Save, ImageUp, ChevronUp, ChevronDown, Users, AlertCircle, CheckCircle2, Loader2, Pencil, Crown, UserRound } from 'lucide-react'
import { Button } from '../ui/Button'
import { InfoHint } from '../ui/Field'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { useData } from '../../context/DataContext'
import { iconMap } from '../../lib/icons'
import { avatarDataUri } from '../../lib/avatar'
import { cropToPortrait } from '../../lib/imagePrep'
import { cn } from '../../lib/cn'

const inputCls =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800'

const iconNames = Object.keys(iconMap)

// Red "delete" buttons, spelled out rather than layered on <Button>'s outline
// variant, whose neutral colours would otherwise compete with these.
const dangerBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white font-medium text-rose-600 transition-colors hover:border-rose-400 hover:bg-rose-50 dark:border-rose-500/40 dark:bg-transparent dark:text-rose-400 dark:hover:bg-rose-500/10'
const roles = ['Head', 'Member', 'Secretary', 'Joint Secretary', 'Treasurer', 'Junior Representative']

// Move an item within an array; returns a new array.
const moveItem = (arr, from, to) => {
  if (to < 0 || to >= arr.length) return arr
  const out = [...arr]
  const [item] = out.splice(from, 1)
  out.splice(to, 0, item)
  return out
}

export function ExecomPanel() {
  const { execomGroups, updateExecom } = useData()
  const [draft, setDraft] = useState(execomGroups)
  const [dirty, setDirty] = useState(false)
  const [open, setOpen] = useState(() => new Set([0]))
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  // When a team is added we scroll it into view — the new team lands at the
  // bottom of a long list, so without this you'd stay at the top and think
  // nothing happened.
  const teamRefs = useRef({})
  const [scrollTo, setScrollTo] = useState(null)
  // Team (index) waiting for delete confirmation — a whole team is too much to
  // lose to one stray click.
  const [confirmTeam, setConfirmTeam] = useState(null)
  const totalMembers = draft.reduce((n, g) => n + (g.members?.length || 0), 0)

  useEffect(() => {
    if (scrollTo == null) return
    const el = teamRefs.current[scrollTo]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setScrollTo(null)
  }, [scrollTo])

  const mark = (next) => {
    setDraft(next)
    setDirty(true)
  }
  const toggle = (i) =>
    setOpen((s) => {
      const n = new Set(s)
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })

  // ── Team level ──────────────────────────────────────────────
  const setTeam = (gi, p) => mark(draft.map((g, i) => (i === gi ? { ...g, ...p } : g)))
  const addTeam = () => {
    const at = draft.length
    mark([...draft, { team: 'New Team', icon: 'Star', members: [] }])
    setOpen((s) => new Set([...s, at]))
    setScrollTo(at) // jump to the freshly added team at the bottom
  }
  const removeTeam = (gi) => mark(draft.filter((_, i) => i !== gi))
  const moveTeam = (gi, dir) => mark(moveItem(draft, gi, gi + dir))
  // Jump a team straight to a chosen position (1-based) — quicker than clicking
  // the arrows repeatedly when reordering a long roster.
  const reorderTeam = (gi, toHuman) => {
    const to = Math.max(0, Math.min(draft.length - 1, Number(toHuman) - 1))
    if (Number.isNaN(to) || to === gi) return
    mark(moveItem(draft, gi, to))
    setScrollTo(to)
  }

  // ── Member level ────────────────────────────────────────────
  const setMember = (gi, mi, p) =>
    mark(draft.map((g, i) => (i !== gi ? g : { ...g, members: g.members.map((m, j) => (j !== mi ? m : { ...m, ...p })) })))
  const addMember = (gi) =>
    mark(draft.map((g, i) => (i !== gi ? g : { ...g, members: [...g.members, { name: 'New Member', role: 'Member', bio: '' }] })))
  const removeMember = (gi, mi) =>
    mark(draft.map((g, i) => (i !== gi ? g : { ...g, members: g.members.filter((_, j) => j !== mi) })))
  const moveMember = (gi, mi, dir) =>
    mark(draft.map((g, i) => (i !== gi ? g : { ...g, members: moveItem(g.members, mi, mi + dir) })))

  // Photos are cropped and recompressed before they go anywhere near state.
  // Several members share one Firestore document (1 MB cap), and a raw phone
  // photo is megabytes once base64-encoded — storing it uncompressed made the
  // save fail, so the picture survived until the next reload and then vanished.
  const uploadPhoto = (gi, mi) => async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus(null)
    try {
      setMember(gi, mi, { photo: await cropToPortrait(file) })
    } catch (err) {
      setStatus({ ok: false, msg: err?.message || 'Could not read that image.' })
    } finally {
      e.target.value = ''
    }
  }

  // Awaited and caught — an unhandled rejection here is what made a failed
  // save look successful.
  async function save() {
    setSaving(true)
    setStatus(null)
    try {
      await updateExecom(draft)
      setDirty(false)
      setStatus({ ok: true, msg: 'Saved — changes are live on the site.' })
    } catch (err) {
      const m = err?.message || ''
      // Only call it a size problem when the error actually is one — an
      // invalid-argument can just as easily be a bad field, so don't guess.
      const isSize = /longer than|1048487|exceeds|too large|maximum/i.test(m)
      setStatus({
        ok: false,
        msg: isSize
          ? 'A team is too large to save — try removing or re-uploading its largest photos.'
          : err?.code === 'permission-denied'
            ? 'You don’t have permission to edit the Execom — ask an admin to grant access.'
            : m || 'Could not save. Your changes are still here; try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 p-5 dark:border-neutral-800">
        <div>
          <h3 className="flex items-center gap-2 font-semibold tracking-tight">
            <Users className="h-4 w-4 text-acm-500" /> Execom
            <InfoHint text="The team roster shown on the Execom page — grouped by team, in the order set here." />
          </h3>
          <p className="mt-1 text-xs text-neutral-400">
            Add teams and members, write their bios, and use the arrows or the position number to set the order they appear in on the site.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-acm-500/10 px-3 py-1 font-semibold text-acm-600 dark:text-acm-300">
              <Users className="h-3.5 w-3.5" /> {draft.length} team{draft.length === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
              <UserRound className="h-3.5 w-3.5" /> {totalMembers} member{totalMembers === 1 ? '' : 's'} in total
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="md" variant="outline" onClick={addTeam}>
            <Plus className="h-4 w-4" /> Add team
          </Button>
          <Button size="md" disabled={!dirty || saving} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </Button>
        </div>
      </div>

      {status && (
        <div
          className={cn(
            'flex items-start gap-2 border-b px-5 py-3 text-sm',
            status.ok
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-400',
          )}
        >
          {status.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          {status.msg}
        </div>
      )}

      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {draft.map((g, gi) => {
          const Icon = iconMap[g.icon]
          const isOpen = open.has(gi)
          const heads = g.members.filter((m) => /head|chair|secretary|treasurer/i.test(m.role || '')).length
          return (
            <div key={gi} ref={(el) => { teamRefs.current[gi] = el }} className="p-4 sm:p-5">
              {/* Team header — order controls, name and icon on the first line;
                  counts and the big Edit / Delete buttons on the second. */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => moveTeam(gi, -1)}
                    disabled={gi === 0}
                    aria-label="Move team up"
                    title="Move up"
                    className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:border-acm-300 hover:text-acm-500 disabled:opacity-25 dark:border-neutral-700"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  {/* Pick the exact position — faster than the arrows on a long roster. */}
                  <select
                    value={gi + 1}
                    onChange={(e) => reorderTeam(gi, e.target.value)}
                    aria-label={`Position of ${g.team || 'team'}`}
                    title="Set team position"
                    className="h-9 w-14 rounded-lg border border-neutral-200 bg-white px-1 text-center text-sm font-semibold tabular-nums outline-none focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    {draft.map((_, i) => (
                      <option key={i} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => moveTeam(gi, 1)}
                    disabled={gi === draft.length - 1}
                    aria-label="Move team down"
                    title="Move down"
                    className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:border-acm-300 hover:text-acm-500 disabled:opacity-25 dark:border-neutral-700"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-neutral-200 text-acm-500 dark:border-neutral-700">
                  {Icon && <Icon className="h-5 w-5" />}
                </span>

                <input
                  className={cn(inputCls, 'h-10 min-w-[160px] flex-1 font-semibold')}
                  aria-label="Team name"
                  value={g.team}
                  onChange={(e) => setTeam(gi, { team: e.target.value })}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold',
                    g.members.length ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                  )}
                  title={`${heads} head${heads === 1 ? '' : 's'}, ${g.members.length - heads} other member${g.members.length - heads === 1 ? '' : 's'}`}
                >
                  <Users className="h-4 w-4" />
                  {g.members.length} member{g.members.length === 1 ? '' : 's'}
                  {heads > 0 && <span className="font-normal opacity-80">· {heads} head{heads === 1 ? '' : 's'}</span>}
                </span>

                <select
                  className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800"
                  aria-label="Team icon"
                  value={g.icon || 'Star'}
                  onChange={(e) => setTeam(gi, { icon: e.target.value })}
                >
                  {iconNames.map((n) => (
                    <option key={n} value={n}>Icon: {n}</option>
                  ))}
                </select>

                <label className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-3 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={!!g.lead}
                    onChange={(e) => setTeam(gi, { lead: e.target.checked })}
                    className="h-4 w-4 rounded border-neutral-300 text-acm-600 dark:border-neutral-700 dark:bg-neutral-800"
                  />
                  <Crown className="h-4 w-4 text-amber-500" /> Lead row
                  <InfoHint text="Shows this team as a standalone leadership row (like Chair or Secretary) instead of a team card with members." />
                </label>

                <span className="ml-auto flex shrink-0 items-center gap-2">
                  <Button size="md" variant={isOpen ? 'secondary' : 'outline'} onClick={() => toggle(gi)} aria-expanded={isOpen}>
                    <Pencil className="h-4 w-4" /> {isOpen ? 'Close editor' : 'Edit members'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setConfirmTeam({ gi, name: g.team, count: g.members.length })}
                    aria-label={`Delete ${g.team}`}
                    className={cn(dangerBtn, 'h-11 px-4 text-sm')}
                  >
                    <Trash2 className="h-4 w-4" /> Delete team
                  </button>
                </span>
              </div>

              {/* Members */}
              {isOpen && (
                <div className="mt-5 space-y-4 rounded-xl bg-neutral-50 p-3 sm:p-4 dark:bg-neutral-950/40">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    <span>Members of {g.team || 'this team'}</span>
                    <span>{g.members.length} total</span>
                  </div>
                  {g.members.map((m, mi) => (
                    <div key={mi} className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                      <div className="flex flex-wrap items-start gap-4">
                        <div className="flex shrink-0 flex-col items-center gap-2">
                          <label className="group relative cursor-pointer" title="Upload photo">
                            <img
                              src={m.photo || avatarDataUri(m.name)}
                              alt=""
                              className="h-20 w-20 rounded-xl object-cover"
                            />
                            <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                              <ImageUp className="h-5 w-5 text-white" />
                            </span>
                            <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto(gi, mi)} />
                          </label>
                          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-acm-600 hover:bg-acm-50 dark:text-acm-400 dark:hover:bg-acm-500/10">
                            <ImageUp className="h-3.5 w-3.5" /> Change photo
                            <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto(gi, mi)} />
                          </label>
                        </div>

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <input
                              className={cn(inputCls, 'h-10 min-w-[160px] flex-1')}
                              aria-label="Full name"
                              placeholder="Full name"
                              value={m.name}
                              onChange={(e) => setMember(gi, mi, { name: e.target.value })}
                            />
                            <input
                              className={cn(inputCls, 'h-10 w-44')}
                              aria-label="Role"
                              placeholder="Role"
                              list={`roles-${gi}-${mi}`}
                              value={m.role}
                              onChange={(e) => setMember(gi, mi, { role: e.target.value })}
                            />
                            <datalist id={`roles-${gi}-${mi}`}>
                              {roles.map((r) => <option key={r} value={r} />)}
                            </datalist>
                          </div>
                          <textarea
                            rows={2}
                            className={cn(inputCls, 'resize-y')}
                            placeholder="Short bio — shown when someone opens this member's card"
                            value={m.bio || ''}
                            onChange={(e) => setMember(gi, mi, { bio: e.target.value })}
                          />
                        </div>

                      </div>

                      {/* Row actions — big, labelled, well apart from each other */}
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                        <Button size="sm" variant="outline" onClick={() => moveMember(gi, mi, -1)} disabled={mi === 0} aria-label={`Move ${m.name || 'member'} up`}>
                          <ChevronUp className="h-4 w-4" /> Up
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => moveMember(gi, mi, 1)} disabled={mi === g.members.length - 1} aria-label={`Move ${m.name || 'member'} down`}>
                          <ChevronDown className="h-4 w-4" /> Down
                        </Button>
                        <span className="text-xs text-neutral-400">Position {mi + 1} of {g.members.length}</span>
                        <button
                          type="button"
                          onClick={() => removeMember(gi, mi)}
                          aria-label={`Remove ${m.name || 'member'}`}
                          className={cn(dangerBtn, 'ml-auto h-9 px-3.5 text-sm')}
                        >
                          <Trash2 className="h-4 w-4" /> Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  <Button size="md" variant="outline" className="w-full border-dashed" onClick={() => addMember(gi)}>
                    <Plus className="h-4 w-4" /> Add member to {g.team || 'this team'}
                  </Button>
                </div>
              )}
            </div>
          )
        })}

        {draft.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-sm text-neutral-500">No teams yet — add one to get started.</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmTeam != null}
        onClose={() => setConfirmTeam(null)}
        onConfirm={() => removeTeam(confirmTeam.gi)}
        title={`Delete “${confirmTeam?.name || 'this team'}”?`}
        description={`This removes the team and its ${confirmTeam?.count || 0} member${confirmTeam?.count === 1 ? '' : 's'} from the list. Nothing changes on the site until you press Save changes.`}
        confirmLabel="Delete team"
      />
    </motion.div>
  )
}

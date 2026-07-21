import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Save, ImageUp, ChevronUp, ChevronDown, Users, GripVertical } from 'lucide-react'
import { Button } from '../ui/Button'
import { useData } from '../../context/DataContext'
import { iconMap } from '../../lib/icons'
import { avatarDataUri } from '../../lib/avatar'
import { cn } from '../../lib/cn'

const inputCls =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800'

const iconNames = Object.keys(iconMap)
const roles = ['Head', 'Member', 'Secretary', 'Joint Secretary', 'Treasurer', 'Junior Representative']

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })

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
    mark([...draft, { team: 'New Team', icon: 'Star', members: [] }])
    setOpen((s) => new Set([...s, draft.length]))
  }
  const removeTeam = (gi) => mark(draft.filter((_, i) => i !== gi))
  const moveTeam = (gi, dir) => mark(moveItem(draft, gi, gi + dir))

  // ── Member level ────────────────────────────────────────────
  const setMember = (gi, mi, p) =>
    mark(draft.map((g, i) => (i !== gi ? g : { ...g, members: g.members.map((m, j) => (j !== mi ? m : { ...m, ...p })) })))
  const addMember = (gi) =>
    mark(draft.map((g, i) => (i !== gi ? g : { ...g, members: [...g.members, { name: 'New Member', role: 'Member', bio: '' }] })))
  const removeMember = (gi, mi) =>
    mark(draft.map((g, i) => (i !== gi ? g : { ...g, members: g.members.filter((_, j) => j !== mi) })))
  const moveMember = (gi, mi, dir) =>
    mark(draft.map((g, i) => (i !== gi ? g : { ...g, members: moveItem(g.members, mi, mi + dir) })))

  const uploadPhoto = (gi, mi) => async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMember(gi, mi, { photo: await fileToDataUrl(file) })
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 p-5 dark:border-neutral-800">
        <div>
          <h3 className="flex items-center gap-2 font-semibold tracking-tight">
            <Users className="h-4 w-4 text-acm-500" /> Execom
          </h3>
          <p className="mt-1 text-xs text-neutral-400">
            Add teams and members, write their bios, and drag the arrows to set the order they appear in on the site.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addTeam}>
            <Plus className="h-4 w-4" /> Add team
          </Button>
          <Button size="sm" disabled={!dirty} onClick={() => { updateExecom(draft); setDirty(false) }}>
            <Save className="h-4 w-4" /> {dirty ? 'Save changes' : 'Saved'}
          </Button>
        </div>
      </div>

      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {draft.map((g, gi) => {
          const Icon = iconMap[g.icon]
          const isOpen = open.has(gi)
          return (
            <div key={gi} className="p-4 sm:p-5">
              {/* Team header — order controls, name, icon */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex shrink-0 flex-col">
                  <button
                    onClick={() => moveTeam(gi, -1)}
                    disabled={gi === 0}
                    aria-label="Move team up"
                    className="grid h-5 w-6 place-items-center rounded text-neutral-400 hover:text-acm-500 disabled:opacity-25"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveTeam(gi, 1)}
                    disabled={gi === draft.length - 1}
                    aria-label="Move team down"
                    className="grid h-5 w-6 place-items-center rounded text-neutral-400 hover:text-acm-500 disabled:opacity-25"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-neutral-200 text-acm-500 dark:border-neutral-700">
                  {Icon && <Icon className="h-4 w-4" />}
                </span>

                <input
                  className={cn(inputCls, 'min-w-0 flex-1 font-semibold sm:max-w-[240px]')}
                  value={g.team}
                  onChange={(e) => setTeam(gi, { team: e.target.value })}
                />

                <select
                  className={cn(inputCls, 'max-w-[150px]')}
                  value={g.icon || 'Star'}
                  onChange={(e) => setTeam(gi, { icon: e.target.value })}
                >
                  {iconNames.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>

                <label className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <input
                    type="checkbox"
                    checked={!!g.lead}
                    onChange={(e) => setTeam(gi, { lead: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-neutral-300 text-acm-600 dark:border-neutral-700 dark:bg-neutral-800"
                  />
                  Lead row
                </label>

                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => toggle(gi)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {g.members.length} member{g.members.length === 1 ? '' : 's'} · {isOpen ? 'Hide' : 'Edit'}
                  </button>
                  <button
                    onClick={() => removeTeam(gi)}
                    aria-label={`Delete ${g.team}`}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-neutral-200 text-neutral-400 transition-colors hover:border-rose-300 hover:text-rose-500 dark:border-neutral-800"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>

              {/* Members */}
              {isOpen && (
                <div className="mt-4 space-y-3 border-l-2 border-neutral-100 pl-3 dark:border-neutral-800">
                  {g.members.map((m, mi) => (
                    <div key={mi} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="flex items-start gap-3">
                        <div className="flex shrink-0 flex-col pt-1 text-neutral-300 dark:text-neutral-600">
                          <button
                            onClick={() => moveMember(gi, mi, -1)}
                            disabled={mi === 0}
                            aria-label="Move member up"
                            className="grid h-5 w-5 place-items-center rounded hover:text-acm-500 disabled:opacity-25"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <GripVertical className="h-3.5 w-3.5 opacity-40" />
                          <button
                            onClick={() => moveMember(gi, mi, 1)}
                            disabled={mi === g.members.length - 1}
                            aria-label="Move member down"
                            className="grid h-5 w-5 place-items-center rounded hover:text-acm-500 disabled:opacity-25"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <label className="group relative shrink-0 cursor-pointer" title="Upload photo">
                          <img
                            src={m.photo || avatarDataUri(m.name)}
                            alt=""
                            className="h-16 w-16 rounded-xl object-cover"
                          />
                          <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                            <ImageUp className="h-5 w-5 text-white" />
                          </span>
                          <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto(gi, mi)} />
                        </label>

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <input
                              className={cn(inputCls, 'min-w-0 flex-1')}
                              placeholder="Full name"
                              value={m.name}
                              onChange={(e) => setMember(gi, mi, { name: e.target.value })}
                            />
                            <input
                              className={cn(inputCls, 'max-w-[170px]')}
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

                        <button
                          onClick={() => removeMember(gi, mi)}
                          aria-label="Remove member"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-neutral-200 text-neutral-400 transition-colors hover:border-rose-300 hover:text-rose-500 dark:border-neutral-800"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <Button size="sm" variant="outline" onClick={() => addMember(gi)}>
                    <Plus className="h-4 w-4" /> Add member to {g.team}
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
    </motion.div>
  )
}

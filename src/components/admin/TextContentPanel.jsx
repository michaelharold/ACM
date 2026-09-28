import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Type, Save, Loader2, AlertCircle, CheckCircle2, Search, RotateCcw, Plus, Trash2, ChevronUp, ChevronDown, ExternalLink,
  Home, Info, Target, Images, Compass, CalendarDays, Users, Mail, BadgeCheck, PanelTop, LogIn, FileQuestion, Megaphone, Building2, Hash, Globe2,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { ActionButton } from '../ui/ActionButton'
import { Switch } from '../ui/Switch'
import { useData } from '../../context/DataContext'
import { TEXT_SECTIONS, TEXT_FIELDS, NONE, savedText, validateText, searchFields } from '../../lib/siteText'
import { iconMap } from '../../lib/icons'
import { departments as builtInDepartments } from '../../lib/orgData'
import { cn } from '../../lib/cn'

const inputCls =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800'

const iconNames = Object.keys(iconMap)

// Sub-sections: the text registry's sections plus the structured editors.
const NAV = [
  { id: 'home', icon: Home, page: '/' },
  { id: 'ticker', title: 'Announcement ticker', icon: Megaphone, page: '/', blurb: 'The scrolling strip under the home-page headline. Remove every line to hide it.' },
  { id: 'about', icon: Hash, page: '/#about' },
  { id: 'goals', icon: Target, page: '/#goals' },
  { id: 'gallery', icon: Images, page: '/#gallery' },
  { id: 'explore', icon: Compass, page: '/#explore' },
  { id: 'events', icon: CalendarDays, page: '/events' },
  { id: 'execom', icon: Users, page: '/execom' },
  { id: 'contact', icon: Mail, page: '/contact' },
  { id: 'membership', icon: BadgeCheck, page: '/membership' },
  { id: 'chrome', icon: PanelTop, page: '/' },
  { id: 'signin', icon: LogIn, page: '/auth' },
  { id: 'notfound', icon: FileQuestion, page: '/this-page-does-not-exist' },
  { id: 'departments', title: 'Departments list', icon: Building2, blurb: 'The department options people pick in their profile and when registering for events.' },
].map((n) => {
  const s = TEXT_SECTIONS.find((x) => x.id === n.id)
  return { ...n, title: n.title || s?.title, blurb: n.blurb || s?.blurb, fields: s?.fields || [] }
})

// What the editor starts from: every editable part of site content.
function initialDraft(content) {
  // The editor holds what the site actually says (override, else default), so
  // an admin edits real text — and can empty a box while retyping it.
  const texts = {}
  for (const [key, f] of Object.entries(TEXT_FIELDS)) {
    const saved = savedText(content, key)
    texts[key] = f.optional && saved === NONE ? NONE : (saved.trim() ? saved : f.default)
  }
  return {
    texts,
    established: content.established ?? '',
    stats: (content.stats || []).map((s) => ({ ...s })),
    whyJoin: (content.whyJoin || []).map((w) => ({ ...w })),
    goals: (content.goals || []).map((g) => ({ ...g })),
    announcements: (content.announcements || []).map((a) => ({ ...a })),
    departments: Array.isArray(content.departments) && content.departments.length ? [...content.departments] : [...builtInDepartments],
    globalMembershipEnabled: content.globalMembershipEnabled !== false,
  }
}

const moveItem = (arr, from, to) => {
  if (to < 0 || to >= arr.length) return arr
  const out = [...arr]
  const [x] = out.splice(from, 1)
  out.splice(to, 0, x)
  return out
}

export function TextContentPanel() {
  const { content, updateContent } = useData()
  const [draft, setDraft] = useState(() => initialDraft(content))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [active, setActive] = useState('home')
  const [q, setQ] = useState('')

  const mark = (fn) => {
    setDraft((d) => fn(d))
    setDirty(true)
    setStatus(null)
  }
  const setText = (key, value) => mark((d) => ({ ...d, texts: { ...d.texts, [key]: value } }))

  // Every text field's problems, so Save can refuse a broken link or email.
  const errors = useMemo(() => {
    const out = {}
    for (const [key, value] of Object.entries(draft.texts)) {
      const e = validateText(key, value)
      if (e) out[key] = e
    }
    return out
  }, [draft.texts])

  const results = searchFields(q)
  const section = NAV.find((n) => n.id === active)
  const editedCount = (fields) => fields.filter((f) => {
    const v = draft.texts[f.key]
    return v && v.trim() && v.trim() !== f.default
  }).length

  async function save() {
    const bad = Object.keys(errors)
    if (bad.length) {
      setStatus({ ok: false, msg: `Fix ${bad.length === 1 ? 'the highlighted field' : `${bad.length} highlighted fields`} first — ${TEXT_FIELDS[bad[0]].label}: ${errors[bad[0]]}` })
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      // Anything equal to its default is stored blank, so a later change to the
      // built-in default still reaches fields nobody customised.
      const texts = {}
      const top = {}
      for (const [key, raw] of Object.entries(draft.texts)) {
        const f = TEXT_FIELDS[key]
        const v = String(raw || '').trim()
        const stored = v === f.default || (v === NONE && !f.optional) ? '' : v
        if (f.contentKey) top[f.contentKey] = stored
        else texts[key] = stored
      }
      await updateContent({
        ...top,
        texts,
        established: String(draft.established).trim(),
        stats: draft.stats
          .filter((s) => String(s.label || '').trim())
          .map((s) => ({ label: s.label.trim(), value: Math.max(0, Number(s.value) || 0), suffix: String(s.suffix || '').trim() })),
        whyJoin: draft.whyJoin.filter((w) => String(w.title || '').trim()).map((w) => ({ title: w.title.trim(), body: String(w.body || '').trim(), icon: w.icon || 'Star' })),
        goals: draft.goals.filter((g) => String(g.key || '').trim()).map((g) => ({ key: g.key.trim(), text: String(g.text || '').trim(), icon: g.icon || 'Star' })),
        announcements: draft.announcements.filter((a) => String(a.text || '').trim()).map((a) => ({ id: a.id, tag: String(a.tag || '').trim(), text: a.text.trim() })),
        departments: [...new Set(draft.departments.map((d) => d.trim()).filter(Boolean))],
        globalMembershipEnabled: !!draft.globalMembershipEnabled,
      })
      setDirty(false)
      setStatus({ ok: true, msg: 'Saved — the site shows the new text now.' })
    } catch (err) {
      setStatus({ ok: false, msg: err?.message || 'Could not save — your edits are still here; try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      {/* Header — stays in view while scrolling long sections */}
      <div className="sticky top-20 z-20 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-neutral-100 bg-white/95 p-5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-semibold tracking-tight">
            <Type className="h-4 w-4 text-acm-500" /> Modify text content
          </h3>
          <p className="mt-1 text-xs text-neutral-400">
            Every heading, paragraph, button, number and link on the site. Edit, then Save — no code needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span>}
          <ActionButton size="sm" disabled={!dirty} onClick={save} busy={saving} success={status?.ok} busyLabel="Saving…" doneLabel="Saved">
            <Save className="h-4 w-4" /> {dirty ? 'Save changes' : 'Saved'}
          </ActionButton>
        </div>
        {status && (
          <p className={cn('flex w-full items-start gap-1.5 text-xs', status.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-300')}>
            {status.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />} {status.msg}
          </p>
        )}
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[210px_minmax(0,1fr)]">
        {/* Sub-sections */}
        <div className="min-w-0">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input className={cn(inputCls, 'pl-9')} placeholder="Find any text…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search text" />
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Text sections">
            {NAV.map((n) => {
              const count = editedCount(n.fields)
              const on = !results && active === n.id
              return (
                <button
                  key={n.id}
                  onClick={() => { setActive(n.id); setQ('') }}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    on ? 'bg-acm-600 text-white' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
                  )}
                >
                  <n.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 whitespace-nowrap">{n.title}</span>
                  {count > 0 && <span className={cn('rounded-full px-1.5 text-[10px] font-semibold', on ? 'bg-white/20' : 'bg-acm-500/10 text-acm-600 dark:text-acm-400')}>{count}</span>}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Fields */}
        <div className="min-w-0">
          {results ? (
            <div className="space-y-4">
              <p className="text-xs text-neutral-500">{results.length} match{results.length === 1 ? '' : 'es'} for “{q}”</p>
              {results.map((f) => (
                <div key={f.key}>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{f.section}</div>
                  <TextField field={f} value={draft.texts[f.key]} error={errors[f.key]} onChange={(v) => setText(f.key, v)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold tracking-tight">{section.title}</h4>
                  {section.blurb && <p className="mt-0.5 max-w-xl text-xs text-neutral-500 dark:text-neutral-400">{section.blurb}</p>}
                </div>
                {section.page && (
                  <a href={section.page} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-acm-600 hover:underline dark:text-acm-400">
                    View on site <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {active === 'membership' && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-400/40 bg-sky-500/5 p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
                    <div>
                      <div className="text-sm font-semibold">Show the “Get ACM Global Membership” button</div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {draft.globalMembershipEnabled ? 'Shown under every Join button — home page, header menu, membership page and profile.' : 'Hidden everywhere.'}
                      </p>
                    </div>
                  </div>
                  <Switch tone="sky" label="Show Global Membership button" on={draft.globalMembershipEnabled} onClick={() => mark((d) => ({ ...d, globalMembershipEnabled: !d.globalMembershipEnabled }))} />
                </div>
              )}

              {section.fields.map((f) => (
                <TextField key={f.key} field={f} value={draft.texts[f.key]} error={errors[f.key]} onChange={(v) => setText(f.key, v)} />
              ))}

              {active === 'about' && <NumbersEditor draft={draft} mark={mark} />}
              {active === 'about' && <CardsEditor title="“Why join us” cards" items={draft.whyJoin} fields={['title', 'body']} labels={['Title', 'Text']} onChange={(whyJoin) => mark((d) => ({ ...d, whyJoin }))} blank={{ title: 'New reason', body: '', icon: 'Star' }} />}
              {active === 'goals' && <CardsEditor title="Vision · Mission · Values cards" items={draft.goals} fields={['key', 'text']} labels={['Heading', 'Text']} onChange={(goals) => mark((d) => ({ ...d, goals }))} blank={{ key: 'New pillar', text: '', icon: 'Star' }} />}
              {active === 'ticker' && <TickerEditor items={draft.announcements} onChange={(announcements) => mark((d) => ({ ...d, announcements }))} />}
              {active === 'departments' && <ListEditor items={draft.departments} onChange={(departments) => mark((d) => ({ ...d, departments }))} placeholder="Department name…" addLabel="Add department" />}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// One text field: shows what the site currently says, flags edits, resets to
// the built-in default, and for optional links offers a show/hide switch.
function TextField({ field, value, error, onChange }) {
  const hidden = field.optional && value === NONE
  const text = hidden ? '' : (value ?? '')
  const empty = !hidden && !text.trim()
  const edited = !hidden && !empty && text.trim() !== field.default
  const long = field.type === 'long'
  const Tag = long ? 'textarea' : 'input'
  const id = `txt-${field.key}`
  return (
    <div className={cn('rounded-xl border p-3.5 transition-colors', error ? 'border-rose-300 dark:border-rose-500/40' : edited ? 'border-acm-300/70 dark:border-acm-500/30' : 'border-neutral-200 dark:border-neutral-800')}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{field.label}</label>
        {edited && <span className="rounded-full bg-acm-500/10 px-2 py-0.5 text-[10px] font-semibold text-acm-600 dark:text-acm-400">Edited</span>}
        {hidden && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500 dark:bg-neutral-800">Hidden</span>}
        <span className="ml-auto flex items-center gap-2">
          {field.optional && (
            <span className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              Show
              <Switch tone="emerald" label={`Show ${field.label}`} on={!hidden} onClick={() => onChange(hidden ? field.default : NONE)} />
            </span>
          )}
          {(edited || empty) && (
            <button type="button" onClick={() => onChange(field.default)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200">
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </span>
      </div>
      <Tag
        id={id}
        {...(long ? { rows: 3 } : { type: field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : 'text' })}
        disabled={hidden}
        className={cn(inputCls, long && 'resize-y', hidden && 'opacity-50')}
        value={text}
        placeholder={field.default}
        onChange={(e) => onChange(e.target.value)}
      />
      {(field.hint || field.vars) && (
        <p className="mt-1.5 text-[11px] text-neutral-400">
          {field.hint}
          {field.vars && ` Use ${field.vars.map((v) => `{${v}}`).join(', ')} to insert the ${field.vars.join(', ')} automatically.`}
        </p>
      )}
      {empty && <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">Empty — the original text will be used when you save.</p>}
      {error && <p className="mt-1.5 flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-300"><AlertCircle className="h-3 w-3" /> {error}</p>}
    </div>
  )
}

function RowButtons({ i, n, onMove, onDelete, label }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" onClick={() => onMove(i, -1)} disabled={i === 0} aria-label={`Move ${label} up`} className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-500 hover:text-acm-500 disabled:opacity-30 dark:border-neutral-700">
        <ChevronUp className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => onMove(i, 1)} disabled={i === n - 1} aria-label={`Move ${label} down`} className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-500 hover:text-acm-500 disabled:opacity-30 dark:border-neutral-700">
        <ChevronDown className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => onDelete(i)} aria-label={`Delete ${label}`} className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-500 hover:border-rose-300 hover:text-rose-500 dark:border-neutral-700">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

// Year of establishment + the number tiles (label, number, suffix).
function NumbersEditor({ draft, mark }) {
  const setStat = (i, p) => mark((d) => ({ ...d, stats: d.stats.map((s, j) => (j === i ? { ...s, ...p } : s)) }))
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h5 className="text-sm font-semibold">Numbers</h5>
      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">The tiles in the About section — members, events conducted, workshops… Change the number, its label, or add your own.</p>
      <label className="mt-4 flex flex-wrap items-center gap-3">
        <span className="w-44 text-xs font-semibold text-neutral-700 dark:text-neutral-200">Year of establishment</span>
        <input className={cn(inputCls, 'max-w-[140px] tabular-nums')} inputMode="numeric" value={draft.established} onChange={(e) => mark((d) => ({ ...d, established: e.target.value }))} />
      </label>
      <div className="mt-4 space-y-2">
        {draft.stats.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-50 p-2 dark:bg-neutral-800/40">
            <input className={cn(inputCls, 'min-w-[140px] flex-1')} aria-label="Label" placeholder="Label, e.g. Workshops" value={s.label} onChange={(e) => setStat(i, { label: e.target.value })} />
            <input className={cn(inputCls, 'w-24 tabular-nums')} aria-label={`${s.label || 'Stat'} number`} type="number" min="0" value={s.value} onChange={(e) => setStat(i, { value: e.target.value })} />
            <input className={cn(inputCls, 'w-16')} aria-label={`${s.label || 'Stat'} suffix`} placeholder="+" value={s.suffix || ''} onChange={(e) => setStat(i, { suffix: e.target.value })} />
            <RowButtons
              i={i}
              n={draft.stats.length}
              label={s.label || 'number'}
              onMove={(at, dir) => mark((d) => ({ ...d, stats: moveItem(d.stats, at, at + dir) }))}
              onDelete={(at) => mark((d) => ({ ...d, stats: d.stats.filter((_, j) => j !== at) }))}
            />
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" className="mt-3" onClick={() => mark((d) => ({ ...d, stats: [...d.stats, { label: 'New number', value: 0, suffix: '+' }] }))}>
        <Plus className="h-4 w-4" /> Add a number
      </Button>
    </div>
  )
}

// Cards with a heading, a paragraph and an icon (Why join / Goals).
function CardsEditor({ title, items, fields, labels, onChange, blank }) {
  const set = (i, p) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)))
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h5 className="text-sm font-semibold">{title}</h5>
      <div className="mt-3 space-y-3">
        {items.map((it, i) => {
          const Icon = iconMap[it.icon]
          return (
            <div key={i} className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/40">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-neutral-200 text-acm-500 dark:border-neutral-700">
                  {Icon && <Icon className="h-4 w-4" />}
                </span>
                <input className={cn(inputCls, 'min-w-[160px] flex-1 font-semibold')} aria-label={labels[0]} value={it[fields[0]] || ''} onChange={(e) => set(i, { [fields[0]]: e.target.value })} />
                <select className={cn(inputCls, 'w-36')} aria-label="Icon" value={it.icon || 'Star'} onChange={(e) => set(i, { icon: e.target.value })}>
                  {iconNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <RowButtons i={i} n={items.length} label={it[fields[0]] || 'card'} onMove={(at, dir) => onChange(moveItem(items, at, at + dir))} onDelete={(at) => onChange(items.filter((_, j) => j !== at))} />
              </div>
              <textarea rows={3} className={cn(inputCls, 'mt-2 resize-y')} aria-label={labels[1]} value={it[fields[1]] || ''} onChange={(e) => set(i, { [fields[1]]: e.target.value })} />
            </div>
          )
        })}
      </div>
      <Button size="sm" variant="outline" className="mt-3" onClick={() => onChange([...items, { ...blank }])}>
        <Plus className="h-4 w-4" /> Add a card
      </Button>
    </div>
  )
}

function TickerEditor({ items, onChange }) {
  const set = (i, p) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)))
  return (
    <div className="space-y-2">
      {items.map((a, i) => (
        <div key={a.id || i} className="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-50 p-2 dark:bg-neutral-800/40">
          <input className={cn(inputCls, 'w-28')} aria-label="Tag" placeholder="Tag" value={a.tag} onChange={(e) => set(i, { tag: e.target.value })} />
          <input className={cn(inputCls, 'min-w-[180px] flex-1')} aria-label="Announcement" placeholder="Announcement text…" value={a.text} onChange={(e) => set(i, { text: e.target.value })} />
          <RowButtons i={i} n={items.length} label="announcement" onMove={(at, dir) => onChange(moveItem(items, at, at + dir))} onDelete={(at) => onChange(items.filter((_, j) => j !== at))} />
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...items, { id: `a_${Date.now()}`, tag: 'New', text: '' }])}>
        <Plus className="h-4 w-4" /> Add announcement
      </Button>
    </div>
  )
}

function ListEditor({ items, onChange, placeholder, addLabel }) {
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className={cn(inputCls, 'flex-1')} value={d} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Delete ${d || 'item'}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-neutral-200 text-neutral-500 hover:border-rose-300 hover:text-rose-500 dark:border-neutral-700">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" className="mt-3" onClick={() => onChange([...items, ''])}>
        <Plus className="h-4 w-4" /> {addLabel}
      </Button>
    </div>
  )
}

// Small, dependency-free charts for the admin Analytics tab. Colours come from
// the --viz-* tokens in index.css; text always uses ink tokens, never a series
// colour. Every chart has a hover/focus readout, and every value is also shown
// as a label, legend entry or table row, so nothing depends on hovering.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '../../../lib/cn'

export const fmtInt = (n) => (Number(n) || 0).toLocaleString('en-IN')
export const fmtMoney = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`
export const fmtPct = (x) => (x == null || Number.isNaN(x) ? '—' : `${Math.round(x * 100)}%`)

// Width of a container, kept in sync as it resizes.
function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// A clean axis maximum: 1, 2, 5 × 10^n at or above the data max.
function niceMax(v) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}

export function ChartCard({ title, subtitle, action, children, className }) {
  return (
    <div className={cn('viz rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// A headline number. `accent` is a --viz-* colour name used only for the icon
// chip and the soft glow behind it.
export function StatTile({ icon: Icon, label, value, sub, accent = 'bar' }) {
  return (
    <div className="viz relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-25 blur-2xl" style={{ background: `var(--viz-${accent})` }} />
      <div className="relative flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        {Icon && (
          <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, var(--viz-${accent}) 16%, transparent)`, color: `var(--viz-${accent})` }}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        {label}
      </div>
      <div className="relative mt-2 text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="relative mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{sub}</div>}
    </div>
  )
}

// Horizontal bars, one series. `highlight` (an item key) is drawn at full
// strength with a glow and the rest recede — "this event vs the others".
export function BarList({ items, highlight, onSelect, format = fmtInt, empty = 'No data yet.', max: forcedMax }) {
  const max = forcedMax ?? Math.max(1, ...items.map((i) => i.value))
  if (!items.length) return <p className="py-6 text-center text-sm text-neutral-400">{empty}</p>
  return (
    <ul className="space-y-2.5">
      {items.map((it) => {
        const on = highlight == null || it.key === highlight
        const pct = Math.max(it.value > 0 ? 2 : 0, (it.value / max) * 100)
        const Tag = onSelect ? 'button' : 'div'
        return (
          <li key={it.key}>
            <Tag
              {...(onSelect ? { type: 'button', onClick: () => onSelect(it.key) } : {})}
              title={`${it.label}: ${format(it.value)}${it.sub ? ` · ${it.sub}` : ''}`}
              className={cn('group block w-full text-left', onSelect && 'rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-acm-500/50')}
            >
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                <span className={cn('min-w-0 truncate', on ? 'font-medium text-neutral-800 dark:text-neutral-100' : 'text-neutral-500 dark:text-neutral-400')}>{it.label}</span>
                <span className="shrink-0 tabular-nums text-neutral-600 dark:text-neutral-300">
                  {format(it.value)}{it.sub ? <span className="ml-1.5 text-neutral-400">{it.sub}</span> : null}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full" style={{ background: 'color-mix(in srgb, var(--viz-grid) 70%, transparent)' }}>
                <div
                  className="h-2.5 rounded-full transition-all duration-500 group-hover:brightness-125"
                  style={{
                    width: `${pct}%`,
                    background: it.color ? `var(--viz-${it.color})` : 'var(--viz-bar)',
                    opacity: on ? 1 : 0.35,
                    boxShadow: on && highlight != null ? `0 0 12px color-mix(in srgb, var(--viz-${it.color || 'bar'}) 70%, transparent)` : 'none',
                  }}
                />
              </div>
            </Tag>
          </li>
        )
      })}
    </ul>
  )
}

// Share of a whole: a ring with 2px surface gaps, the total in the middle, and
// a legend carrying every value and percentage.
export function Donut({ segments, centerLabel = 'total', size = 150 }) {
  const [hover, setHover] = useState(null)
  const total = segments.reduce((n, s) => n + s.value, 0)
  const r = 54
  const c = 2 * Math.PI * r
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 2.5 : 0
  let offset = 0
  const shown = hover != null ? segments.find((s) => s.key === hover) : null
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--viz-grid)" strokeWidth="14" />
          {total > 0 && segments.map((s) => {
            const len = (s.value / total) * c
            const dash = Math.max(0, len - gap)
            const el = (
              <circle
                key={s.key}
                cx="70" cy="70" r={r} fill="none"
                stroke={`var(--viz-${s.color})`}
                strokeWidth={hover === s.key ? 17 : 14}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
                style={{ filter: `drop-shadow(0 0 5px color-mix(in srgb, var(--viz-${s.color}) 75%, transparent))`, transition: 'stroke-width .15s' }}
                onPointerEnter={() => setHover(s.key)}
                onPointerLeave={() => setHover(null)}
              />
            )
            offset += len
            return s.value > 0 ? el : null
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-xl font-bold tracking-tight">{fmtInt(shown ? shown.value : total)}</div>
            <div className="max-w-[90px] truncate text-[10px] uppercase tracking-wider text-neutral-400">{shown ? shown.label : centerLabel}</div>
          </div>
        </div>
      </div>
      <ul className="min-w-[140px] flex-1 space-y-2 text-xs">
        {segments.map((s) => (
          <li
            key={s.key}
            className={cn('flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors', hover === s.key && 'bg-neutral-100 dark:bg-neutral-800')}
            onPointerEnter={() => setHover(s.key)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: `var(--viz-${s.color})`, boxShadow: `0 0 6px var(--viz-${s.color})` }} />
            <span className="min-w-0 flex-1 truncate text-neutral-600 dark:text-neutral-300">{s.label}</span>
            <span className="tabular-nums font-semibold">{fmtInt(s.value)}</span>
            <span className="w-9 text-right tabular-nums text-neutral-400">{total ? fmtPct(s.value / total) : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// One stacked bar (parts of a whole in a fixed order), 2px gaps, legend below
// with each part's icon, label and count — for payment status.
export function StackedBar({ parts }) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  return (
    <div>
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full" style={{ background: 'var(--viz-grid)' }}>
        {total > 0 && parts.filter((p) => p.value > 0).map((p) => (
          <div
            key={p.key}
            title={`${p.label}: ${p.value}`}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(p.value / total) * 100}%`, background: `var(--viz-${p.color})`, boxShadow: `0 0 10px color-mix(in srgb, var(--viz-${p.color}) 60%, transparent)` }}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            {p.icon ? <p.icon className="h-3.5 w-3.5 shrink-0" style={{ color: `var(--viz-${p.color})` }} /> : <span className="h-2.5 w-2.5 rounded-sm" style={{ background: `var(--viz-${p.color})` }} />}
            <span className="min-w-0 truncate text-neutral-600 dark:text-neutral-300">{p.label}</span>
            <span className="ml-auto tabular-nums font-semibold">{fmtInt(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// A glowing line over time with a soft area wash. The crosshair snaps to the
// nearest point; arrow keys step through points when focused.
export function LineChart({ points, color = 'line', height = 200, format = fmtInt, label = 'Registrations' }) {
  const [wrap, width] = useWidth()
  const [idx, setIdx] = useState(null)
  const gid = useId().replace(/:/g, '')
  const pad = { l: 34, r: 12, t: 12, b: 24 }
  const w = Math.max(0, width)
  const iw = Math.max(1, w - pad.l - pad.r)
  const ih = height - pad.t - pad.b
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)))
  const x = (i) => pad.l + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw)
  const y = (v) => pad.t + ih - (v / max) * ih
  const path = useMemo(() => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(''), [points, w, max]) // eslint-disable-line react-hooks/exhaustive-deps
  const area = points.length ? `${path}L${x(points.length - 1).toFixed(1)},${pad.t + ih}L${x(0).toFixed(1)},${pad.t + ih}Z` : ''
  const ticks = [0, max / 2, max]
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 64))))

  function move(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    let best = 0
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i })
    setIdx(best)
  }
  function key(e) {
    if (!points.length) return
    if (e.key === 'ArrowRight') setIdx((i) => Math.min(points.length - 1, (i ?? -1) + 1))
    if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, (i ?? points.length) - 1))
  }

  if (!points.length) return <div ref={wrap}><p className="py-10 text-center text-sm text-neutral-400">No registrations in this period yet.</p></div>
  const cur = idx != null ? points[idx] : null
  return (
    <div ref={wrap} className="relative">
      {w > 0 && (
        <svg
          width={w}
          height={height}
          className="block touch-none outline-none"
          tabIndex={0}
          role="img"
          aria-label={`${label} over time`}
          onPointerMove={move}
          onPointerLeave={() => setIdx(null)}
          onKeyDown={key}
          onBlur={() => setIdx(null)}
        >
          <defs>
            <filter id={`glow-${gid}`} x="-10%" y="-30%" width="120%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id={`fill-${gid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={`var(--viz-${color})`} stopOpacity="0.22" />
              <stop offset="100%" stopColor={`var(--viz-${color})`} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} strokeWidth="1" />
              <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--viz-muted)" className="tabular-nums">{format(Math.round(t))}</text>
            </g>
          ))}
          {points.map((p, i) => (i % every === 0 || i === points.length - 1) && (
            <text key={p.t ?? i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize="10" fill="var(--viz-muted)">{p.label}</text>
          ))}
          <path d={area} fill={`url(#fill-${gid})`} />
          <path d={path} fill="none" stroke={`var(--viz-${color})`} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" filter={`url(#glow-${gid})`} />
          {(() => {
            const i = points.length - 1
            return <circle cx={x(i)} cy={y(points[i].value)} r="4" fill={`var(--viz-${color})`} stroke="var(--viz-surface)" strokeWidth="2" filter={`url(#glow-${gid})`} />
          })()}
          {cur && (
            <g>
              <line x1={x(idx)} x2={x(idx)} y1={pad.t} y2={pad.t + ih} stroke="var(--viz-axis)" strokeWidth="1" />
              <circle cx={x(idx)} cy={y(cur.value)} r="5" fill={`var(--viz-${color})`} stroke="var(--viz-surface)" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {cur && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          style={{ left: Math.min(Math.max(x(idx), 60), w - 60) }}
        >
          <div className="font-semibold tabular-nums">{format(cur.value)}</div>
          <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
            <span className="h-0.5 w-3 rounded" style={{ background: `var(--viz-${color})` }} /> {label} · {cur.label}
          </div>
        </div>
      )}
    </div>
  )
}

// A semicircle gauge for a 0–100 score, glowing in the bar hue.
export function Gauge({ value, label = 'Success score' }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  const r = 70
  const len = Math.PI * r
  return (
    <div className="viz relative mx-auto w-full max-w-[220px]">
      <svg viewBox="0 0 180 104" className="w-full" role="img" aria-label={`${label}: ${v} out of 100`}>
        <path d="M20,92 A70,70 0 0 1 160,92" fill="none" stroke="var(--viz-grid)" strokeWidth="12" strokeLinecap="round" />
        <path
          d="M20,92 A70,70 0 0 1 160,92"
          fill="none"
          stroke="var(--viz-bar)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * len} ${len}`}
          style={{ filter: 'drop-shadow(0 0 8px var(--viz-bar))', transition: 'stroke-dasharray .6s ease' }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="text-3xl font-bold tracking-tight">{v}</div>
        <div className="text-[10px] uppercase tracking-wider text-neutral-400">{label}</div>
      </div>
    </div>
  )
}

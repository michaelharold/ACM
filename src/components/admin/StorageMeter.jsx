import { useMemo } from 'react'
import { HardDrive, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useData } from '../../context/DataContext'
import {
  estimateImageBytes,
  storageStatus,
  formatBytes,
  STORAGE_BUDGET_BYTES,
  GALLERY_MAX_IMAGES,
} from '../../lib/storageBudget'

const TONE = {
  ok:       { bar: 'bg-emerald-500', ring: 'border-neutral-200 dark:border-neutral-800', Icon: CheckCircle2, iconCls: 'text-emerald-500' },
  warn:     { bar: 'bg-amber-500',   ring: 'border-amber-300 dark:border-amber-500/30',  Icon: AlertTriangle, iconCls: 'text-amber-500' },
  critical: { bar: 'bg-orange-500',  ring: 'border-orange-300 dark:border-orange-500/40', Icon: AlertTriangle, iconCls: 'text-orange-500' },
  full:     { bar: 'bg-rose-500',    ring: 'border-rose-300 dark:border-rose-500/40',     Icon: AlertTriangle, iconCls: 'text-rose-500' },
}

const MESSAGE = {
  ok: null,
  warn: 'Storage is filling up. Consider removing old gallery images before adding many more.',
  critical: 'Storage is almost full. Delete unused gallery images/posters now — new uploads may soon fail.',
  full: 'Storage budget reached. Remove images before uploading more, or the site may hit Firebase’s free-tier limit.',
}

// At-a-glance meter of how much of the free-tier storage budget the inline
// images use, so the team gets a warning long before anything breaks — no paid
// plan needed. `compact` renders a slim one-line version for the overview.
export function StorageMeter({ compact = false }) {
  const { gallery, events, execomGroups } = useData()

  const { bytes, status, pct } = useMemo(() => {
    const b = estimateImageBytes({ gallery, events, execomGroups })
    return { bytes: b, status: storageStatus(b), pct: Math.min(100, (b / STORAGE_BUDGET_BYTES) * 100) }
  }, [gallery, events, execomGroups])

  const t = TONE[status]
  const used = `${formatBytes(bytes)} of ${formatBytes(STORAGE_BUDGET_BYTES)}`

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <HardDrive className="h-4 w-4 shrink-0 text-neutral-400" />
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div className={`h-full rounded-full transition-all ${t.bar}`} style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-neutral-500">{pct.toFixed(0)}%</span>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border p-4 ${t.ring}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <HardDrive className="h-4 w-4 text-acm-500" /> Image storage
        </h3>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <t.Icon className={`h-4 w-4 ${t.iconCls}`} /> {pct.toFixed(1)}% used
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded-full transition-all ${t.bar}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>

      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        {used} · {gallery.length}/{GALLERY_MAX_IMAGES} gallery images
      </p>

      {MESSAGE[status] && (
        <p className={`mt-3 flex items-start gap-2 rounded-lg border p-2.5 text-xs ${t.ring} ${t.iconCls}`}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{MESSAGE[status]}</span>
        </p>
      )}
    </div>
  )
}

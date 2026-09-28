import { Globe2, ArrowUpRight } from 'lucide-react'
import { useData, useText } from '../../context/DataContext'
import { isWebUrl } from '../../lib/siteText'
import { cn } from '../../lib/cn'

// "Get ACM Global Membership" — sits under every Join button. The label, the
// link and whether it shows at all are set in Admin → Text Content → Membership.
export function GlobalMembershipButton({ className, block = false, note = false }) {
  const { content } = useData()
  const t = useText()
  const url = t('global.url')
  if (content?.globalMembershipEnabled === false || !isWebUrl(url)) return null
  return (
    <div className={cn(block ? 'w-full' : 'inline-flex flex-col items-center', className)}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'group inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/50 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-700 transition-all',
          'shadow-[0_0_14px_rgba(56,189,248,0.25)] hover:border-sky-300 hover:bg-sky-500/15 hover:shadow-[0_0_20px_rgba(56,189,248,0.45)] dark:text-sky-200',
          block && 'w-full',
        )}
      >
        <Globe2 className="h-4 w-4 shrink-0" />
        <span className="truncate">{t('global.label')}</span>
        <ArrowUpRight className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </a>
      {note && <span className="mt-1.5 text-center text-[11px] text-neutral-500 dark:text-neutral-400">{t('global.note')}</span>}
    </div>
  )
}

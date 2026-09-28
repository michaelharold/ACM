import { Instagram, Linkedin } from 'lucide-react'
import { useText } from '../context/DataContext'
import { isWebUrl } from '../lib/siteText'
import { cn } from '../lib/cn'

// The chapter's social icons. Links are set in Admin → Text Content → Contact;
// one switched off there disappears here too.
export function SocialLinks({ className, size = 'md' }) {
  const t = useText()
  const links = [
    { href: t('social.instagram'), label: 'Instagram', Icon: Instagram },
    { href: t('social.linkedin'), label: 'LinkedIn', Icon: Linkedin },
  ].filter((l) => isWebUrl(l.href))
  const dims = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'
  if (!links.length) return null
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {links.map(({ href, label, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          className={cn(
            'grid place-items-center rounded-lg border border-neutral-200 text-neutral-500 transition-all duration-200 hover:-translate-y-0.5 hover:border-acm-400 hover:text-acm-600 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-acm-500 dark:hover:text-acm-400',
            dims,
          )}
        >
          <Icon className={icon} />
        </a>
      ))}
    </div>
  )
}

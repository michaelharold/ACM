import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { LayoutDashboard, LogOut, User as UserIcon, ChevronDown, ShieldCheck, BadgePlus, LogIn } from 'lucide-react'
import { Logo } from '../Logo'
import { SocialLinks } from '../SocialLinks'
import { Button } from '../ui/Button'
import { Magnetic } from '../ui/Magnetic'
import { useAuth } from '../../context/AuthContext'
import { useText } from '../../context/DataContext'
import { GlobalMembershipButton } from '../membership/GlobalMembershipButton'
import { fetchUserMessages } from '../../services/firestore'
import { avatarDataUri } from '../../lib/avatar'
import { scrollToId, scrollToTop } from '../../lib/smoothScroll'
import { cn } from '../../lib/cn'

// Items without a `route` are scroll targets on the home page; the rest are
// dedicated routes. Labels are admin-editable (Text Content → Header).
const sections = [
  { id: 'about', label: 'nav.about' },
  { id: 'goals', label: 'nav.goals' },
  { id: 'gallery', label: 'nav.gallery' },
  { id: 'events', label: 'nav.events', route: '/events' },
  { id: 'execom', label: 'nav.execom', route: '/execom' },
  { id: 'contact', label: 'nav.contact', route: '/contact' },
]

// Red glowing Sign In / Sign Up — on every screen size, top of the page.
function SignInButton({ label, onClick }) {
  return (
    <Link
      to="/auth"
      onClick={onClick}
      className="signin-glow inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-rose-400/70 bg-rose-600 px-3 text-xs font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-rose-500 active:scale-95 sm:px-3.5 sm:text-sm"
    >
      <LogIn className="h-4 w-4 shrink-0" /> {label}
    </Link>
  )
}

const drawerItem = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('')
  const [menuUser, setMenuUser] = useState(false)
  const userMenuRef = useRef(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout, isAuthed, loading: authLoading } = useAuth()
  const t = useText()
  // Surface the two most-wanted shortcuts right in the bar: an admin/editor can
  // jump straight to their panel, and a signed-in non-member sees a Join ACM CTA.
  const isPrivileged = isAuthed && (user?.role === 'admin' || Object.values(user?.permissions || {}).some(Boolean))
  const isMember = !!user?.acmMember
  const onHome = pathname === '/'
  // Unread inbox count → a red dot on the account avatar so a member notices a
  // reply/message without opening the dashboard. Refreshes on route change.
  const [unreadInbox, setUnreadInbox] = useState(0)
  useEffect(() => {
    if (!user) { setUnreadInbox(0); return }
    let alive = true
    fetchUserMessages(user.id)
      .then((m) => { if (alive) setUnreadInbox(m.filter((x) => x.unreadForUser).length) })
      .catch(() => {})
    return () => { alive = false }
  }, [user, pathname])
  const { scrollY } = useScroll()

  // Hide when scrolling down past the hero, reveal instantly on any scroll up.
  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0
    setScrolled(y > 8)
    if (open || menuUser) return setHidden(false)
    setHidden(y > 140 && y > prev)
  })

  // Scroll-spy for active section on the home page.
  useEffect(() => {
    if (!onHome) return
    const els = sections
      .filter((s) => !s.route)
      .map((s) => document.getElementById(s.id))
      .filter(Boolean)
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => e.isIntersecting && setActive(e.target.id))
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [onHome])

  // Deep-link hashes (arriving at /#about from another route) are handled by
  // RouteScroll in App — it waits for the incoming page to mount before scrolling.

  // Never leave a menu hanging open across a route change.
  useEffect(() => {
    setOpen(false)
    setMenuUser(false)
  }, [pathname])

  // Dismiss the account menu on an outside click or Escape — mouse-leave alone
  // strands it open for keyboard and touch users.
  useEffect(() => {
    if (!menuUser) return
    const onDown = (e) => {
      if (!userMenuRef.current?.contains(e.target)) setMenuUser(false)
    }
    const onKey = (e) => e.key === 'Escape' && setMenuUser(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuUser])

  function goToSection(s) {
    setOpen(false)
    if (s.route) return navigate(s.route)
    // Already home: scroll directly, so re-clicking the current section still
    // works (navigating to an identical URL is a no-op React Router won't fire).
    if (onHome) return scrollToId(s.id)
    navigate(`/#${s.id}`)
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-5 sm:pt-4">
      <motion.nav
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: hidden ? -90 : 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        className={cn(
          'flex w-full max-w-6xl items-center justify-between gap-3 rounded-2xl border px-3 py-2 transition-all duration-300 sm:px-4',
          scrolled
            ? 'glass-surface border-neutral-200/80 bg-white/80 shadow-sm backdrop-blur-xl backdrop-saturate-150 dark:border-neutral-800/80 dark:bg-neutral-950/70'
            : 'border-transparent bg-transparent',
        )}
      >
        <Link
          to="/"
          onClick={(e) => {
            if (onHome) {
              e.preventDefault()
              scrollToTop()
            }
          }}
          className="shrink-0"
        >
          <Magnetic strength={3}>
            <Logo />
          </Magnetic>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-0.5 lg:flex">
          {sections.map((s) => {
            // Routed items (Events) stay lit while you're on their route.
            const isActive = s.route ? pathname.startsWith(s.route) : onHome && active === s.id
            return (
              <Magnetic key={s.id} strength={4}>
                <button
                  onClick={() => goToSection(s)}
                  className={cn(
                    'relative rounded-lg px-3 py-2 text-sm font-medium transition-[color,transform] duration-150 active:scale-95',
                    isActive
                      ? 'text-neutral-900 dark:text-white'
                      : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white',
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 -z-10 rounded-lg bg-neutral-100 dark:bg-neutral-800"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  {t(s.label)}
                </button>
              </Magnetic>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <SocialLinks className="hidden md:flex" size="sm" />
          <span className="mx-0.5 hidden h-5 w-px bg-neutral-200 md:block dark:bg-neutral-800" />

          {isPrivileged && (
            <Button as={Link} to="/admin" size="sm" variant="outline" className="hidden md:inline-flex">
              <ShieldCheck className="h-4 w-4" />
              {user.role === 'admin' ? 'Admin' : 'Editor'}
            </Button>
          )}
          {isAuthed && !isMember && !isPrivileged && (
            // The full "Join ACM TKMCE Student Chapter" only fits beside the
            // menu on wide screens (and not next to the Admin button); everyone
            // else has it in the profile menu and the drawer.
            <Button as={Link} to="/membership" size="sm" className="hidden whitespace-nowrap xl:inline-flex">
              <BadgePlus className="h-4 w-4" /> {t('cta.join')}
            </Button>
          )}

          {authLoading ? (
            // Session still restoring — show a placeholder, not "Sign In"
            // flashing up for someone who's actually signed in.
            <span className="block h-9 w-24 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
          ) : !isAuthed ? (
            <SignInButton label={t('nav.signIn')} />
          ) : (
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setMenuUser((v) => !v)}
                aria-label="Your profile"
                aria-expanded={menuUser}
                className="flex items-center gap-2 rounded-xl border border-neutral-200 py-1 pl-1 pr-2 transition-[border-color,transform] duration-150 hover:border-neutral-300 active:scale-95 dark:border-neutral-800 dark:hover:border-neutral-700"
              >
                <span className="relative">
                  <img
                    src={user.avatar || avatarDataUri(user.name || 'ACM Member')}
                    alt=""
                    className="h-7 w-7 rounded-lg object-cover"
                  />
                  {unreadInbox > 0 && (
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 dark:border-neutral-950" />
                  )}
                </span>
                <motion.span animate={{ rotate: menuUser ? 180 : 0 }}>
                  <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                </motion.span>
              </button>
              <AnimatePresence>
                {menuUser && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    onMouseLeave={() => setMenuUser(false)}
                    // Grows out of the avatar that opened it, and shrinks back into it.
                    style={{ transformOrigin: 'top right' }}
                    className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="px-2.5 py-2">
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                      <p className="truncate text-xs text-neutral-500">{user.email}</p>
                    </div>
                    <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                    <MenuItem to="/dashboard" icon={LayoutDashboard} onClick={() => setMenuUser(false)}>
                      My profile
                    </MenuItem>
                    {!isMember && (
                      <MenuItem to="/membership" icon={BadgePlus} onClick={() => setMenuUser(false)}>
                        {t('cta.join')}
                      </MenuItem>
                    )}
                    {(user.role === 'admin' || Object.values(user.permissions || {}).some(Boolean)) && (
                      <MenuItem to="/admin" icon={UserIcon} onClick={() => setMenuUser(false)}>
                        {user.role === 'admin' ? 'Admin Panel' : 'Editor Panel'}
                      </MenuItem>
                    )}
                    <button
                      onClick={() => {
                        logout()
                        setMenuUser(false)
                        navigate('/')
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      <LogOut className="h-4 w-4" /> Log out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Animated hamburger */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
            className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-600 transition-transform duration-150 active:scale-90 lg:hidden dark:border-neutral-800 dark:text-neutral-300"
          >
            <span className="relative block h-3.5 w-4.5" style={{ width: 18 }}>
              <motion.span
                animate={open ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className="absolute left-0 top-0 block h-[2px] w-full rounded-full bg-current"
              />
              <motion.span
                animate={open ? { opacity: 0, x: 6 } : { opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-[6px] block h-[2px] w-full rounded-full bg-current"
              />
              <motion.span
                animate={open ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className="absolute left-0 top-[12px] block h-[2px] w-full rounded-full bg-current"
              />
            </span>
          </button>
        </div>
      </motion.nav>

      {/* Mobile drawer — a dimmed backdrop you can tap to close, and a panel
          that grows out of the menu button and folds back into it. */}
      <AnimatePresence>
        {open && (
          <motion.button
            key="scrim"
            aria-label="Close menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="glass-scrim fixed inset-0 -z-10 cursor-default bg-neutral-950/40 backdrop-blur-[2px] lg:hidden"
          />
        )}
        {open && (
          <motion.div
            key="drawer"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            style={{ transformOrigin: 'top right' }}
            className="glass-surface absolute inset-x-3 top-[76px] z-40 rounded-2xl border border-neutral-200 bg-white/95 p-3 shadow-xl backdrop-blur-xl lg:hidden dark:border-neutral-800 dark:bg-neutral-950/95"
          >
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } }}
              className="grid gap-1"
            >
              {sections.map((s) => (
                <motion.button
                  key={s.id}
                  variants={drawerItem}
                  onClick={() => goToSection(s)}
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-[background-color,transform] duration-150 hover:bg-neutral-100 active:scale-[0.98] active:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-800"
                >
                  {t(s.label)}
                </motion.button>
              ))}
            </motion.div>
            {/* Account actions — mirrors the desktop avatar menu */}
            {isAuthed && (
              <div className="mt-3 grid gap-1 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <MenuItem to="/dashboard" icon={LayoutDashboard} onClick={() => setOpen(false)}>
                  My profile
                </MenuItem>
                {!isMember && (
                  <MenuItem to="/membership" icon={BadgePlus} onClick={() => setOpen(false)}>
                    {t('cta.join')}
                  </MenuItem>
                )}
                {isPrivileged && (
                  <MenuItem to="/admin" icon={ShieldCheck} onClick={() => setOpen(false)}>
                    {user.role === 'admin' ? 'Admin Panel' : 'Editor Panel'}
                  </MenuItem>
                )}
                <button
                  onClick={() => {
                    logout()
                    setOpen(false)
                    navigate('/')
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            )}

            <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
              <GlobalMembershipButton block />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <SocialLinks size="sm" />
              {!isAuthed && !authLoading && <SignInButton label={t('nav.signIn')} onClick={() => setOpen(false)} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function MenuItem({ to, icon: Icon, children, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-700 transition-[background-color,transform] duration-150 hover:bg-neutral-100 active:scale-[0.98] active:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-800"
    >
      <Icon className="h-4 w-4" /> {children}
    </Link>
  )
}

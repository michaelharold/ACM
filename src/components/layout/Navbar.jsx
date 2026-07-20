import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { LayoutDashboard, LogOut, User as UserIcon, ChevronDown } from 'lucide-react'
import { Logo } from '../Logo'
import { SocialLinks } from '../SocialLinks'
import { ThemeToggle } from '../ThemeToggle'
import { Button } from '../ui/Button'
import { Magnetic } from '../ui/Magnetic'
import { useAuth } from '../../context/AuthContext'
import { scrollToEl, scrollToTop } from '../../lib/smoothScroll'
import { cn } from '../../lib/cn'

const sections = [
  { id: 'about', label: 'About' },
  { id: 'goals', label: 'Goals' },
  { id: 'execom', label: 'Execom' },
  { id: 'events', label: 'Events', route: '/events' },
  // Hidden with the testimonials section — restore when alumni content returns.
  // { id: 'testimonials', label: 'Testimonials' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'contact', label: 'Contact' },
]

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
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const { user, logout, isAuthed } = useAuth()
  const onHome = pathname === '/'
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

  // Handle deep-link hashes (e.g. arriving at /#execom from another route).
  useEffect(() => {
    if (onHome && hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) setTimeout(() => scrollToEl(el), 80)
    }
  }, [onHome, hash])

  function goToSection(s) {
    setOpen(false)
    if (s.route) return navigate(s.route)
    if (onHome) {
      scrollToEl(document.getElementById(s.id))
    } else {
      navigate(`/#${s.id}`)
    }
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
            ? 'border-neutral-200/80 bg-white/80 shadow-sm backdrop-blur-xl dark:border-neutral-800/80 dark:bg-neutral-950/70'
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
            const isActive = onHome && active === s.id
            return (
              <Magnetic key={s.id} strength={4}>
                <button
                  onClick={() => goToSection(s)}
                  className={cn(
                    'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors',
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
                  {s.label}
                </button>
              </Magnetic>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <SocialLinks className="hidden md:flex" size="sm" />
          <span className="mx-0.5 hidden h-5 w-px bg-neutral-200 md:block dark:bg-neutral-800" />
          <ThemeToggle />

          {!isAuthed ? (
            <Button as={Link} to="/auth" size="sm" className="hidden sm:inline-flex">
              Login / Sign Up
            </Button>
          ) : (
            <div className="relative hidden sm:block">
              <button
                onClick={() => setMenuUser((v) => !v)}
                className="flex items-center gap-2 rounded-xl border border-neutral-200 py-1 pl-1 pr-2 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
              >
                <img src={user.avatar} alt="" className="h-7 w-7 rounded-lg object-cover" />
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
                    className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="px-2.5 py-2">
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                      <p className="truncate text-xs text-neutral-500">{user.email}</p>
                    </div>
                    <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                    <MenuItem to="/dashboard" icon={LayoutDashboard} onClick={() => setMenuUser(false)}>
                      Dashboard
                    </MenuItem>
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
            className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-600 lg:hidden dark:border-neutral-800 dark:text-neutral-300"
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

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute inset-x-3 top-[76px] z-40 rounded-2xl border border-neutral-200 bg-white/95 p-3 shadow-xl backdrop-blur-xl lg:hidden dark:border-neutral-800 dark:bg-neutral-950/95"
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
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  {s.label}
                </motion.button>
              ))}
            </motion.div>
            <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800">
              <SocialLinks size="sm" />
              {!isAuthed ? (
                <Button as={Link} to="/auth" size="sm" onClick={() => setOpen(false)}>
                  Login / Sign Up
                </Button>
              ) : (
                <Button as={Link} to="/dashboard" size="sm" variant="outline" onClick={() => setOpen(false)}>
                  Dashboard
                </Button>
              )}
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
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      <Icon className="h-4 w-4" /> {children}
    </Link>
  )
}

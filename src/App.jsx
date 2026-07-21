import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { ScrollProgress } from './components/ui/ScrollProgress'
import { SmoothScroll, resetScroll, scrollToId } from './lib/smoothScroll'
import Home from './pages/Home'
import Auth from './pages/Auth'
import Events from './pages/Events'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'

// Only the top-level route counts as a "page" — opening /events/:id keeps the
// list's scroll position and doesn't replay the page transition.
const baseRoute = (pathname) => pathname.split('/')[1] || ''

// The auth screen is its own full-bleed layout; the fixed navbar and the footer
// would otherwise sit on top of its brand panel.
const isBareRoute = (pathname) => pathname === '/auth'

function RouteScroll() {
  const { pathname, hash } = useLocation()
  const base = baseRoute(pathname)
  useEffect(() => {
    // A hash means the incoming route has its own scroll target; Navbar owns
    // that scroll, so don't fight it by yanking to the top first.
    if (hash) scrollToId(hash.slice(1))
    else resetScroll()
  }, [base, hash])
  return null
}

export default function App() {
  const location = useLocation()
  const bare = isBareRoute(location.pathname)

  return (
    <div className="flex min-h-screen flex-col">
      <SmoothScroll />
      <RouteScroll />
      {!bare && <ScrollProgress />}
      {!bare && <Navbar />}
      <main className="flex-1">
        {/*
          Deliberately NOT wrapped in <AnimatePresence mode="wait">. That gates
          mounting the incoming page on the outgoing one finishing its exit, and
          a redirect (e.g. /dashboard bouncing a signed-out visitor to /auth)
          changes the key mid-exit — which deadlocks it and leaves <main> empty
          until a hard refresh. A keyed enter-only transition mounts the new page
          synchronously and cannot get stuck.
        */}
        <motion.div
          key={baseRoute(location.pathname)}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="relative"
        >
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:eventId" element={<Events />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </motion.div>
      </main>
      {!bare && <Footer />}
    </div>
  )
}

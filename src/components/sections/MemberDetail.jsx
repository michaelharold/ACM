import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { avatarDataUri } from '../../lib/avatar'

const tiltSpring = { damping: 24, stiffness: 150, mass: 0.9 }

// Shortest circular distance from the active card, so the strip loops instead of
// hitting an end — the member two slots before the first appears just past the last.
function wrappedOffset(i, active, n) {
  let o = i - active
  if (o > n / 2) o -= n
  if (o < -n / 2) o += n
  return o
}

// Placement for a card at a given offset from centre. Flat and fully opaque —
// no tilt, no transparency — the focused card is simply the largest and the
// neighbours are smaller and set to the sides.
function placement(offset) {
  const abs = Math.abs(offset)
  if (abs > 2) return { hidden: true }
  const dir = Math.sign(offset)
  const x = [0, 68, 112][abs] * dir // % of the card's own width — sits beside the focus
  const scale = [1, 0.62, 0.46][abs] // focus is clearly the biggest
  const zIndex = 30 - abs * 10
  return { hidden: false, x, scale, zIndex }
}

// The focused card: image on one side, name / position / description on the other.
// Only the centred card gets the interactive tilt + drag-to-navigate; side cards
// stay flat and are advanced by clicking them.
function MemberFace({ member, interactive, onSwipe }) {
  const ref = useRef(null)
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [8, -8]), tiltSpring)
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-10, 10]), tiltSpring)

  function onMove(e) {
    if (!interactive) return
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
  }
  function reset() {
    px.set(0)
    py.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={interactive ? { rotateX, rotateY, transformStyle: 'preserve-3d' } : undefined}
      drag={interactive ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.35}
      onDragEnd={interactive ? (_e, info) => {
        if (info.offset.x < -60) onSwipe?.(1)
        else if (info.offset.x > 60) onSwipe?.(-1)
      } : undefined}
      className="flex h-full w-full cursor-grab flex-col overflow-hidden rounded-3xl bg-neutral-900 shadow-2xl shadow-black/60 active:cursor-grabbing sm:flex-row"
    >
      {/* Image side — full bleed */}
      <div className="relative h-1/2 w-full shrink-0 overflow-hidden sm:h-full sm:w-[46%]">
        <img
          src={member.photo || avatarDataUri(member.name)}
          alt={member.name}
          draggable={false}
          decoding="async"
          className="h-full w-full select-none object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-black/20" />
      </div>

      {/* Text side — centred */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center sm:p-8">
        <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
          {member.name}
        </h2>
        <p className="text-sm font-medium uppercase tracking-wide text-acm-300 sm:text-base">
          {member.role}
        </p>
        {member.bio && (
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-neutral-400 sm:text-sm">
            {member.bio}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// Full-screen member browser: a looping coverflow of one team's members with the
// team name pinned above it. `data` = { team, members, index }.
export function MemberDetail({ data, open, onClose }) {
  const members = data?.members || []
  const n = members.length
  const [active, setActive] = useState(0)
  const wheelLock = useRef(false)

  // Snap to the clicked member each time the browser is opened.
  useEffect(() => {
    if (open && data) setActive(data.index || 0)
  }, [open, data])

  const go = (dir) => setActive((a) => ((a + dir) % n + n) % n)

  // A scroll (wheel / trackpad, either axis) advances the focus one card at a
  // time, with a short cooldown so one gesture doesn't fly through the team.
  function onWheel(e) {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (wheelLock.current || Math.abs(d) < 8) return
    wheelLock.current = true
    go(d > 0 ? 1 : -1)
    setTimeout(() => { wheelLock.current = false }, 320)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, n])

  if (!open || !data) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div data-lenis-prevent className="fixed inset-0 z-[110] flex flex-col">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md"
          />

          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-5 top-5 z-30 grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Pinned team name — stays put while members scroll beneath it */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-20 pt-16 text-center sm:pt-20"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-acm-400">Team</span>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">{data.team}</h3>
          </motion.div>

          {/* Coverflow stage */}
          <div
            className="relative z-10 flex flex-1 items-center justify-center"
            style={{ perspective: '1600px' }}
            onWheel={onWheel}
          >
            {members.map((m, i) => {
              const offset = wrappedOffset(i, active, n)
              const p = placement(offset)
              if (p.hidden) return null
              const isCenter = offset === 0
              return (
                <div
                  key={`${m.name}-${i}`}
                  onClick={() => !isCenter && setActive(i)}
                  className="absolute left-1/2 top-1/2 h-[58vh] max-h-[400px] w-[86vw] max-w-[600px] transition-transform duration-500 ease-out"
                  style={{
                    transform: `translate(-50%, -50%) translateX(${p.x}%) scale(${p.scale})`,
                    zIndex: p.zIndex,
                    perspective: '1000px',
                    cursor: isCenter ? 'default' : 'pointer',
                  }}
                >
                  <MemberFace member={m} interactive={isCenter} onSwipe={go} />
                </div>
              )
            })}

            {/* Prev / next — only when the team has more than one member */}
            {n > 1 && (
              <>
                <button
                  onClick={() => go(-1)}
                  aria-label="Previous member"
                  className="absolute left-3 top-1/2 z-40 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 sm:left-6"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => go(1)}
                  aria-label="Next member"
                  className="absolute right-3 top-1/2 z-40 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 sm:right-6"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {/* Position dots */}
          {n > 1 && (
            <div className="relative z-20 flex items-center justify-center gap-2 pb-10 pt-2">
              {members.map((m, i) => (
                <button
                  key={m.name}
                  onClick={() => setActive(i)}
                  aria-label={`Go to ${m.name}`}
                  className={`h-2 rounded-full transition-all duration-300 ${i === active ? 'w-6 bg-acm-500' : 'w-2 bg-white/25 hover:bg-white/40'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

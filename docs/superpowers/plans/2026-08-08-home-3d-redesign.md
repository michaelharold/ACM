# Home 3D-Interactive Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Home page scroll-linked 3D depth on every section, pointer-tilt 3D on every card, a glassmorphism pass on the chrome, and a new `/welcome` route with a dramatic 3D-animated logo entrance.

**Architecture:** A new `DepthSection` wrapper (framer-motion `useScroll`/`useTransform`, mirroring the pattern already proven in `Hero.jsx`) drives scroll-linked `rotateX`/`translateZ`/`scale` on each Home section. The existing `TiltCard` primitive (pointer 3D tilt + glare, already used in `About.jsx`) is extended with an `as` prop and rolled out to Goals and ExploreMore's cards. `SectionHeading` gains an opt-in depth-layered mode that reads the enclosing `DepthSection`'s scroll progress via context. A new `/welcome` route renders a three.js scene (`LogoScene3D`) with the ACM logo as a lit, rotating mesh.

**Tech Stack:** React 18, `framer-motion` 11 (already the animation base for `Hero`/`TiltCard`/`Reveal`), `three.js` (already used by `LiquidEther`/`MagicRings`/`ColorBends`), `gsap` (already used by `ScrollFloat`), Tailwind CSS, React Router 6.

## Global Constraints

- No new colors — everything uses the existing `acm-*` scale (`acm-500 #3366ff` … `acm-950 #151d57`, `tailwind.config.js`) and existing neutrals/dark-mode tokens.
- New depth/glass surfaces introduced by this plan (Navbar glass, dropdown, drawer, ExploreMore card bg, `DepthSection` shadow/glow, `LogoScene3D` lighting/glow) use the deeper end of the scale — `acm-700`–`acm-950` — not the brighter `acm-500`/`acm-600` used elsewhere on Home for buttons/gradients. Pre-existing bright-blue usage is untouched.
- In scope: `Hero`, `AnnouncementTicker` (untouched — no card/heading to modify), `About`, `Goals`, `GalleryStrip`, `ExploreMore`, `SectionHeading`, `Navbar` (glass only), plus the new `/welcome` route. Out of scope: Events, Execom, Membership, Dashboard, Admin, Auth, Contact — do not touch.
- `prefers-reduced-motion: reduce` must collapse all new 3D/scroll transforms to plain opacity fades (existing pattern: `Hero.jsx`'s `matchMedia` check; `DepthSection` uses framer-motion's `useReducedMotion()`).
- This repo has no JS unit test runner (no vitest/jest in `package.json`). The established verification convention is manual QA via `npm run dev` plus `node scripts/verify.mjs`, which drives a real Playwright browser and asserts marker text per route (see `scripts/verify.mjs`). Every task's "test" step follows that convention — do not introduce a new test framework.
- Tailwind class-cascade note: when a Tailwind override class targets the same property as one of `TiltCard`'s default classes (`bg-white`, `dark:bg-neutral-900`, etc.), plain overrides aren't guaranteed to win the cascade — `About.jsx`'s existing `TiltCard` usage already works around this with `!bg-neutral-950/50`. Follow that precedent: use `!` (Tailwind "important") on any `bg-*` override passed into `TiltCard`.

---

### Task 1: Shared `motion` tag helper + `TiltCard` gets an `as` prop

**Files:**
- Create: `src/lib/motionTag.js`
- Modify: `src/components/ui/Button.jsx` (already has this exact caching logic inline — replace with the shared helper)
- Modify: `src/components/ui/Card.jsx` (`TiltCard` needs to render as `button`/`Link`/etc., not just `div`, so Goals and ExploreMore can wrap their existing interactive elements in it)

**Interfaces:**
- Produces: `motionTag(Tag)` — `src/lib/motionTag.js`, default export none, named export `motionTag(tagOrComponent) => MotionComponent`. Returns a cached `motion(Tag)` component so repeated calls with the same `Tag` don't remount it.
- Consumes (Task 4, 5): `TiltCard`'s new `as` prop (defaults to `'div'`, unchanged behavior for existing callers).

- [ ] **Step 1: Create the shared `motionTag` helper**

```js
// src/lib/motionTag.js
import { motion } from 'framer-motion'

// motion() returns a brand-new component type on every call, so building it
// inline would remount the tag (and anything like a react-router Link inside
// it) on every render. Cache the wrapped version per tag instead.
const cache = new Map()

export function motionTag(Tag) {
  if (!cache.has(Tag)) cache.set(Tag, motion(Tag))
  return cache.get(Tag)
}
```

- [ ] **Step 2: Point `Button.jsx` at the shared helper**

In `src/components/ui/Button.jsx`, remove the inline `motionCache`/`motionTag` block (lines 22–28) and the now-unused `motion` import, and import the shared helper instead:

```jsx
// top of src/components/ui/Button.jsx
import { forwardRef } from 'react'
import { cn } from '../../lib/cn'
import { motionTag } from '../../lib/motionTag'
```

The rest of `Button.jsx` (the `Button` component body, which already calls `motionTag(Tag)`) is unchanged.

- [ ] **Step 3: Give `TiltCard` an `as` prop**

In `src/components/ui/Card.jsx`, add the import and thread `as` through:

```jsx
import { useRef } from 'react'
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { cn } from '../../lib/cn'
import { motionTag } from '../../lib/motionTag'

// ... Card() unchanged ...

export function TiltCard({ as = 'div', className, children, intensity = 8, glare = true, ...props }) {
  const ref = useRef(null)
  const MotionTag = motionTag(as)
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rx = useSpring(useTransform(py, [0, 1], [intensity, -intensity]), { stiffness: 200, damping: 25 })
  const ry = useSpring(useTransform(px, [0, 1], [-intensity, intensity]), { stiffness: 200, damping: 25 })

  const gx = useTransform(px, (v) => `${v * 100}%`)
  const gy = useTransform(py, (v) => `${v * 100}%`)
  const glareBg = useMotionTemplate`radial-gradient(420px circle at ${gx} ${gy}, rgba(89, 142, 255, 0.14), transparent 65%)`
  const spotBorder = useMotionTemplate`radial-gradient(240px circle at ${gx} ${gy}, rgba(31, 71, 245, 0.55), transparent 70%)`

  function handleMove(e) {
    const rect = ref.current.getBoundingClientRect()
    px.set((e.clientX - rect.left) / rect.width)
    py.set((e.clientY - rect.top) / rect.height)
  }
  function reset() {
    px.set(0.5)
    py.set(0.5)
  }

  return (
    <MotionTag
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={cn(
        'group relative rounded-2xl border border-neutral-200 bg-white transition-colors duration-300 hover:border-acm-400/60 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-acm-500/50',
        '[transform-style:preserve-3d]',
        className,
      )}
      {...props}
    >
      {glare && (
        <>
          <motion.span
            aria-hidden
            style={{ background: spotBorder }}
            className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] [mask-composite:exclude] [padding:1.5px]"
          />
          <motion.span
            aria-hidden
            style={{ background: glareBg }}
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        </>
      )}
      {children}
    </MotionTag>
  )
}
```

(Only the `TiltCard` function signature/body changed — `Card` above it is untouched.)

- [ ] **Step 4: Verify no regression**

Run: `npm run dev`, open `http://localhost:5173/`.
Check: scroll to the About section's "Why join" cards — pointer-tilt + glare still work exactly as before (this is `TiltCard`'s existing, unchanged default path with `as='div'`).
Check: in the navbar, the admin/editor button (`Button as={Link} to="/admin"`, only visible when signed in as admin/editor — or just confirm any `Button as={Link}` in the app still navigates, e.g. the "Login / Sign Up" or "Join ACM" buttons) still navigates correctly — this exercises the refactored shared `motionTag` helper.

- [ ] **Step 5: Commit**

```bash
git add src/lib/motionTag.js src/components/ui/Button.jsx src/components/ui/Card.jsx
git commit -m "refactor: extract shared motionTag helper, give TiltCard an as prop"
```

---

### Task 2: `DepthSection` — scroll-linked 3D wrapper

**Files:**
- Create: `src/components/ui/DepthSection.jsx`

**Interfaces:**
- Produces: `DepthSection` component — props `{ as = 'section', intensity = 'subtle' | 'bold', className, children, ...props }` (all other props, e.g. `id`, pass through to the rendered tag). Also produces `useDepthScroll()` — returns `{ scrollYProgress: MotionValue<number> } | null`; `null` when called outside a `DepthSection`.
- Consumes (Task 4, 5, 6): rendered by About/Goals/GalleryStrip/ExploreMore as their outer `<section>` replacement; `useDepthScroll()` consumed by `SectionHeading`'s depth mode (Task 6).

- [ ] **Step 1: Create `DepthSection.jsx`**

```jsx
// src/components/ui/DepthSection.jsx
import { createContext, useContext, useRef } from 'react'
import { useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { cn } from '../../lib/cn'
import { motionTag } from '../../lib/motionTag'

const DepthScrollContext = createContext(null)

// Lets a descendant (SectionHeading's depth mode) derive its own scroll-driven
// offsets from the same progress this section is already tracking, instead of
// each piece of UI running its own separate useScroll.
export function useDepthScroll() {
  return useContext(DepthScrollContext)
}

const PRESETS = {
  bold: { angle: 10, z: -80, scaleFrom: 0.94 },
  subtle: { angle: 4, z: -24, scaleFrom: 0.98 },
}

// Scroll-linked 3D wrapper: the section rotates in from a slight tilt,
// levels out through the middle of the viewport, then tilts the other way
// leaving — the scroll equivalent of TiltCard's pointer-tilt math
// (transformPerspective + rotate on the same element), driven by scroll
// progress instead of the cursor.
export function DepthSection({ children, as = 'section', intensity = 'subtle', className, ...props }) {
  const ref = useRef(null)
  const reduceMotion = useReducedMotion()
  const { angle, z, scaleFrom } = PRESETS[intensity] || PRESETS.subtle
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })

  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], reduceMotion ? [0, 0, 0] : [angle, 0, -angle])
  const translateZ = useTransform(scrollYProgress, [0, 0.5, 1], reduceMotion ? [0, 0, 0] : [z, 0, z])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], reduceMotion ? [1, 1, 1] : [scaleFrom, 1, scaleFrom])

  const MotionTag = motionTag(as)

  return (
    <MotionTag
      ref={ref}
      style={{ rotateX, translateZ, scale, transformPerspective: 1400, transformStyle: 'preserve-3d' }}
      className={cn('will-change-transform', className)}
      {...props}
    >
      <DepthScrollContext.Provider value={{ scrollYProgress }}>{children}</DepthScrollContext.Provider>
    </MotionTag>
  )
}
```

- [ ] **Step 2: Sanity-check in isolation**

Run: `npm run dev`. `DepthSection` isn't wired into any page yet (that's Tasks 4–5), so there's nothing to see in the browser this step — instead, check the dev server console/terminal for build errors after saving the file (Vite HMR will report a syntax/import error immediately if there is one).
Expected: no errors printed, Vite reports the module compiled cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/DepthSection.jsx
git commit -m "feat: add DepthSection scroll-linked 3D wrapper"
```

---

### Task 3: Hero gets the bold scroll-3D treatment

**Files:**
- Modify: `src/components/sections/Hero.jsx:76-81` (the content wrapper `motion.div`)

**Interfaces:**
- Consumes: nothing new (Hero keeps its own existing `useScroll`/`useTransform` setup — it already tracks scroll via its own `ref`, so it doesn't get wrapped in `DepthSection`; it adopts the same "bold" magnitude by hand).

- [ ] **Step 1: Add bold rotateX/scale alongside the existing y/opacity parallax**

In `src/components/sections/Hero.jsx`, find the existing scroll setup (around line 36-38):

```jsx
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -120])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0])
```

Add two more transforms right after:

```jsx
  const contentRotateX = useTransform(scrollYProgress, [0, 1], [0, -14])
  const contentScale = useTransform(scrollYProgress, [0, 1], [1, 0.92])
```

Then update the content wrapper's `style` prop (currently `style={{ y: contentY, opacity: contentOpacity }}` around line 80) to:

```jsx
        style={{
          y: contentY,
          opacity: contentOpacity,
          rotateX: contentRotateX,
          scale: contentScale,
          transformPerspective: 1400,
        }}
```

- [ ] **Step 2: Verify**

Run: `npm run dev`, open `/`.
Check: scroll down through the Hero — the logo/headline/CTA block should now visibly tip back and shrink slightly (in addition to its existing upward drift and fade) as it scrolls out, reading as tipping away into depth rather than just sliding up.
Check: emulate `prefers-reduced-motion: reduce` in DevTools (Rendering tab → "Emulate CSS media feature prefers-reduced-motion") and reload — Hero's `LiquidEther` backdrop and the reveal stagger already skip when reduced motion is set (existing `mounted` check), confirm the page still renders sensibly (this task doesn't add its own reduced-motion gate since `contentRotateX`/`contentScale` are minor refinements on top of Hero's existing scroll-out, not a new dramatic effect — if it reads as too much motion under reduced-motion, note it for a follow-up rather than blocking this task).

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/Hero.jsx
git commit -m "feat: bold scroll-linked 3D tilt on Hero content"
```

---

### Task 4: About + Goals — DepthSection wrap, Goals pillars become TiltCard

**Files:**
- Modify: `src/components/sections/About.jsx` (wrap outer `<section>` in `DepthSection`)
- Modify: `src/components/sections/Goals.jsx` (wrap outer `<section>` in `DepthSection`; pillar buttons become `TiltCard as="button"`)

**Interfaces:**
- Consumes: `DepthSection` (Task 2), `TiltCard` with `as` prop (Task 1).

- [ ] **Step 1: Wrap About's section in `DepthSection`**

In `src/components/sections/About.jsx`, add the import:

```jsx
import { DepthSection } from '../ui/DepthSection'
```

Change the outer element (currently `<section id="about" className="relative scroll-mt-24 overflow-hidden">` … `</section>`) to:

```jsx
    <DepthSection as="section" id="about" intensity="subtle" className="relative scroll-mt-24 overflow-hidden">
```

...and its closing `</section>` to `</DepthSection>`. No other changes in this file for this step.

- [ ] **Step 2: Verify About renders unchanged (structurally) with the new wrapper**

Run: `npm run dev`, open `/`, scroll to the About section.
Check: layout is unchanged; the section now visibly tilts/settles as it scrolls into and out of view (subtle — small angle).
Check: `npm run verify` still passes for `/` (its About-section assertions, if any, are text-based and unaffected by the wrapper change).

- [ ] **Step 3: Wrap Goals' section in `DepthSection`**

In `src/components/sections/Goals.jsx`, add imports:

```jsx
import { DepthSection } from '../ui/DepthSection'
import { TiltCard } from '../ui/Card'
```

Change the outer element from:

```jsx
    <section id="goals" className="relative scroll-mt-24 overflow-hidden border-y border-neutral-200 bg-neutral-50/60 py-24 sm:py-28 dark:border-neutral-800 dark:bg-neutral-900/30">
```

to:

```jsx
    <DepthSection as="section" id="goals" intensity="subtle" className="relative scroll-mt-24 overflow-hidden border-y border-neutral-200 bg-neutral-50/60 py-24 sm:py-28 dark:border-neutral-800 dark:bg-neutral-900/30">
```

...and its closing `</section>` to `</DepthSection>`.

- [ ] **Step 4: Convert the Goals pillar buttons to `TiltCard`**

Replace the pillar's `<button>` block (the one mapped from `goals.map((g, i) => ...)`, currently a plain `<button>` with `onMouseEnter`/`onFocus`/`className`) with:

```jsx
              <Item key={g.key}>
                <TiltCard
                  as="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  intensity={6}
                  animate={{ scale: isActive ? 1.04 : 1 }}
                  className={cn(
                    'group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border p-7 text-left',
                    'transition-[box-shadow,border-color,background-color] duration-300 ease-out',
                    isActive
                      ? 'z-10 border-acm-300 !bg-white shadow-xl shadow-acm-900/5 dark:border-acm-500/40 dark:!bg-neutral-900 dark:shadow-black/40'
                      : 'border-neutral-200 !bg-white/60 shadow-none dark:border-neutral-800 dark:!bg-neutral-900/50',
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="goal-accent"
                      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                      className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-acm-600 to-acm-400"
                    />
                  )}
                  <div className="flex h-full flex-col [transform:translateZ(30px)]">
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          'grid h-12 w-12 place-items-center rounded-xl border transition-colors duration-300',
                          isActive
                            ? 'border-acm-200 bg-acm-50 text-acm-600 dark:border-acm-500/30 dark:bg-acm-500/10 dark:text-acm-400'
                            : 'border-neutral-200 bg-neutral-50 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-800/60',
                        )}
                      >
                        {Icon && <Icon className="h-6 w-6" />}
                      </div>
                      <span className="text-5xl font-extrabold tracking-tighter text-neutral-100 transition-colors group-hover:text-acm-100 dark:text-neutral-800 dark:group-hover:text-acm-500/20">
                        0{i + 1}
                      </span>
                    </div>
                    <h3 className="mt-6 text-xl font-bold tracking-tight">{g.key}</h3>
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{g.text}</p>
                  </div>
                </TiltCard>
              </Item>
```

Note this wraps the pillar in `Item` (from `../ui/Reveal`, already imported in this file) exactly like every other card in the codebase's `Reveal`-driven sections — the original code didn't have an `Item` wrapper here because the button itself carried the stagger implicitly via the parent `Reveal`; check the original `goals.map` loop for whether an `Item` wrapper already existed immediately around the `<button>` — if it did, keep this structure (one `Item` per pillar, `TiltCard` as its only child); if the original had no `Item` wrapper, drop the `<Item key={g.key}>...</Item>` wrapper here and put `key={g.key}` directly on `TiltCard` instead, so the stagger behavior isn't changed by this task.

The `isActive` and `Icon` variables, and the `goals.map((g, i) => { ... })` closure, are unchanged from the original — this is only the returned JSX for one pillar.

- [ ] **Step 5: Verify**

Run: `npm run dev`, open `/`, scroll to Goals.
Check: hovering a pillar still makes it "active" (accent bar + highlighted background), and now also tilts toward the cursor in 3D with a glare, same as About's cards.
Check: keyboard-focusing a pillar (Tab key) still sets it active (the `onFocus` handler is preserved).
Check: light and dark theme both look correct — the `!bg-white` / `!bg-white/60` / `dark:!bg-neutral-900` / `dark:!bg-neutral-900/50` overrides should win over `TiltCard`'s own default background classes (this is the `!important` precedent from `About.jsx`'s `TiltCard` usage — if a background still looks wrong, that's the first thing to check).

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/About.jsx src/components/sections/Goals.jsx
git commit -m "feat: scroll-3D depth on About/Goals sections, pointer-tilt on Goals pillars"
```

---

### Task 5: GalleryStrip + ExploreMore — DepthSection wrap, ExploreMore cards become TiltCard

**Files:**
- Modify: `src/components/sections/GalleryStrip.jsx` (wrap outer `<section>` in `DepthSection`, no card-level changes)
- Modify: `src/components/sections/ExploreMore.jsx` (wrap outer `<section>` in `DepthSection`; cards become `TiltCard as={Link}`)

**Interfaces:**
- Consumes: `DepthSection` (Task 2), `TiltCard` (Task 1).

- [ ] **Step 1: Wrap GalleryStrip's section**

In `src/components/sections/GalleryStrip.jsx`, add:

```jsx
import { DepthSection } from '../ui/DepthSection'
```

Change the outer element from `<section id="gallery" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-28">` to:

```jsx
    <DepthSection as="section" id="gallery" intensity="subtle" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-28">
```

...closing `</section>` becomes `</DepthSection>`. Cards inside the marquee rows are deliberately left untouched (pointer-tilt would fight the horizontal drag/marquee) — the section-level scroll-3D is the only depth cue here.

- [ ] **Step 2: Verify GalleryStrip**

Run: `npm run dev`, open `/`, scroll to Gallery.
Check: the marquee rows still scroll/hover exactly as before; the whole section now has a subtle scroll-in/out tilt.

- [ ] **Step 3: Convert ExploreMore's cards to `TiltCard as={Link}`**

In `src/components/sections/ExploreMore.jsx`, update imports — add `TiltCard` and `DepthSection`, and drop `motion` if it becomes unused (check: the original file imports `motion` only for the `motion.span` wrapping "Open" — that span is being replaced below, so `motion` becomes unused and its import should be removed):

```jsx
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Users, MessageSquare } from 'lucide-react'
import { SectionHeading } from '../SectionHeading'
import { Reveal, Item } from '../ui/Reveal'
import { TiltCard } from '../ui/Card'
import { DepthSection } from '../ui/DepthSection'
import { useData } from '../../context/DataContext'
```

Change the outer `<section id="explore" ...>` to:

```jsx
    <DepthSection as="section" id="explore" intensity="subtle" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-28">
```

...closing `</section>` becomes `</DepthSection>`. Add `depth` to the `SectionHeading` call:

```jsx
        <SectionHeading depth eyebrow="Explore" title="Go deeper" description="Three corners of the chapter big enough to deserve their own space." />
```

Replace the `cards.map((c) => ...)` block's returned JSX with:

```jsx
            <Item key={c.to}>
              <TiltCard
                as={Link}
                to={c.to}
                intensity={6}
                className="flex h-full flex-col overflow-hidden !bg-neutral-900/50 p-7 backdrop-blur-md border-neutral-800 hover:border-acm-500/40 hover:!bg-neutral-900"
              >
                <span
                  aria-hidden
                  className={`absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r ${c.accent} transition-transform duration-500 group-hover:scale-x-100`}
                />
                <div className="flex h-full flex-col [transform:translateZ(28px)]">
                  <span className="grid h-12 w-12 place-items-center rounded-xl border border-neutral-800 bg-neutral-800/60 text-acm-400 transition-colors duration-300 group-hover:border-acm-500/30 group-hover:bg-acm-500/10">
                    <c.icon className="h-6 w-6" />
                  </span>

                  <h3 className="mt-6 text-xl font-bold tracking-tight">{c.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-400">{c.copy}</p>

                  <span className="mt-6 flex items-center justify-between border-t border-neutral-800 pt-4 text-sm">
                    <span className="text-xs uppercase tracking-wider text-neutral-500">{c.meta}</span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-acm-400">
                      Open
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </span>
                </div>
              </TiltCard>
            </Item>
```

Note the accent `<span>` is a **direct child of `TiltCard`**, a sibling of the `translateZ` wrapper div — not nested inside it. `translateZ(28px)` on the inner wrapper creates its own CSS containing block, which would break the accent bar's `absolute inset-x-0 top-0` (it would sit 28px/`p-7` inset from the card's real top edge instead of flush with it) if nested inside. Keeping it as a sibling positions it correctly against `TiltCard`'s own root instead.

- [ ] **Step 4: Verify ExploreMore**

Run: `npm run dev`, open `/`, scroll to "Go deeper".
Check: all three cards (Events, Execom, Contact) still link to the right routes on click.
Check: hovering a card now tilts it toward the cursor (3D) in addition to the existing accent-bar wipe and arrow shift; the accent bar still sits flush at the very top edge of the card, not inset.
Check: card backgrounds still read as the same dark glass panel as before (visually — the glass finish itself gets refined further in Task 7).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/GalleryStrip.jsx src/components/sections/ExploreMore.jsx
git commit -m "feat: scroll-3D depth on GalleryStrip/ExploreMore, pointer-tilt on ExploreMore cards"
```

---

### Task 6: `SectionHeading` depth-layered mode

**Files:**
- Modify: `src/components/SectionHeading.jsx`
- Modify: `src/components/sections/About.jsx` (add `depth` prop to its `SectionHeading` call)
- Modify: `src/components/sections/Goals.jsx` (add `depth` prop to its `SectionHeading` call)

(ExploreMore's `SectionHeading depth` call was already added in Task 5, Step 3.)

**Interfaces:**
- Consumes: `useDepthScroll()` from `src/components/ui/DepthSection.jsx` (Task 2).
- Produces: `SectionHeading` gains an optional `depth` prop (default `false`) — existing callers on other pages (Events/Execom/Contact/Membership, if any use this component) are unaffected since it defaults off and they aren't rendered inside a `DepthSection`.

- [ ] **Step 1: Add depth-layered mode to `SectionHeading`**

Replace the full contents of `src/components/SectionHeading.jsx` with:

```jsx
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { cn } from '../lib/cn'
import { useDepthScroll } from './ui/DepthSection'

export function SectionHeading({ eyebrow, title, description, align = 'center', className, depth = false }) {
  const centered = align === 'center'
  const depthScroll = useDepthScroll()
  const fallbackProgress = useMotionValue(0)
  const scrollYProgress = depthScroll?.scrollYProgress ?? fallbackProgress
  const hasDepth = depth && !!depthScroll

  // Only meaningful inside a DepthSection — reuses its scroll progress so the
  // eyebrow/title/description drift apart slightly as the section scrolls,
  // instead of moving as one flat block. Outside a DepthSection (or with
  // depth=false) these motion values exist but are simply never applied to
  // style below, so the hook is always called (React rules of hooks) against
  // a safe fallback value.
  const eyebrowY = useTransform(scrollYProgress, [0, 1], [0, -14])
  const descriptionY = useTransform(scrollYProgress, [0, 1], [0, 10])

  return (
    <div className={cn(centered ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl', className)}>
      {eyebrow && (
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          style={hasDepth ? { y: eyebrowY, translateZ: 36 } : undefined}
          className="eyebrow"
        >
          {eyebrow}
        </motion.span>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.05 }}
        style={hasDepth ? { translateZ: 24 } : undefined}
        className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl"
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.1 }}
          style={hasDepth ? { y: descriptionY } : undefined}
          className={cn('mt-4 text-pretty leading-relaxed text-neutral-500 dark:text-neutral-400', centered && 'mx-auto')}
        >
          {description}
        </motion.p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire `depth` into About and Goals**

In `src/components/sections/About.jsx`, change:

```jsx
        <SectionHeading
          eyebrow="About"
          title={content.aboutTitle}
          description={`${chapter.fullName}. Since ${established}, we’ve turned curious first-years into confident engineers through relentless hands-on learning.`}
        />
```

to add `depth` as a prop (any position):

```jsx
        <SectionHeading
          depth
          eyebrow="About"
          title={content.aboutTitle}
          description={`${chapter.fullName}. Since ${established}, we’ve turned curious first-years into confident engineers through relentless hands-on learning.`}
        />
```

Also update the second `SectionHeading` call in the same file ("Why join Us?", `align="left"`) the same way: add `depth`.

In `src/components/sections/Goals.jsx`, change:

```jsx
        <SectionHeading
          eyebrow="Our Goals"
          title="What we point every event toward"
          description="Three pillars keep the chapter honest — a clear picture of where we’re going, how we get there, and what we refuse to compromise on."
        />
```

to add `depth`.

- [ ] **Step 3: Verify**

Run: `npm run dev`, open `/`.
Check: About, Goals, and ExploreMore headings still fade/slide in on scroll exactly as before, and now the eyebrow/title/description visibly separate slightly in depth as you scroll past each section (subtle — look for the eyebrow pill drifting up a touch faster than the paragraph below it).
Check: any `SectionHeading` usage on other pages (grep for `<SectionHeading` outside `src/pages/Home.jsx`'s section tree, e.g. Events/Execom/Contact/Membership pages) renders identically to before — those aren't wrapped in `DepthSection`, so `depthScroll` is `null` there and `hasDepth` is `false`.

- [ ] **Step 4: Commit**

```bash
git add src/components/SectionHeading.jsx src/components/sections/About.jsx src/components/sections/Goals.jsx
git commit -m "feat: depth-layered SectionHeading mode, wired into About/Goals"
```

---

### Task 7: Glassmorphism pass — Navbar, dropdown, drawer, GalleryLightbox

**Files:**
- Modify: `src/components/layout/Navbar.jsx` (scrolled nav bar background, account dropdown, mobile drawer)
- Modify: `src/components/sections/GalleryLightbox.jsx` (overlay backdrop)

**Interfaces:** none — purely className changes, no new props or components.

- [ ] **Step 1: Navbar — scrolled bar background**

In `src/components/layout/Navbar.jsx`, find (around line 124-129):

```jsx
        className={cn(
          'flex w-full max-w-6xl items-center justify-between gap-3 rounded-2xl border px-3 py-2 transition-all duration-300 sm:px-4',
          scrolled
            ? 'border-neutral-200/80 bg-white/80 shadow-sm backdrop-blur-xl dark:border-neutral-800/80 dark:bg-neutral-950/70'
            : 'border-transparent bg-transparent',
        )}
```

Change the `scrolled` branch to:

```jsx
            ? 'border-white/40 bg-white/65 shadow-[0_8px_32px_-8px_rgba(21,29,87,0.25)] backdrop-blur-xl backdrop-saturate-150 dark:border-acm-900/50 dark:bg-neutral-950/55 dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)]'
```

(`acm-900` = `#1c2f8f`, the blue-tint-lean color for this new glass edge in dark mode, per the Global Constraints.)

- [ ] **Step 2: Navbar — account dropdown menu**

Find (around line 224):

```jsx
                    className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
```

Change to:

```jsx
                    className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-neutral-200/70 bg-white/85 p-1.5 shadow-lg backdrop-blur-xl backdrop-saturate-150 dark:border-acm-900/40 dark:bg-neutral-900/75"
```

- [ ] **Step 3: Navbar — mobile drawer**

Find (around line 291):

```jsx
            className="absolute inset-x-3 top-[76px] z-40 rounded-2xl border border-neutral-200 bg-white/95 p-3 shadow-xl backdrop-blur-xl lg:hidden dark:border-neutral-800 dark:bg-neutral-950/95"
```

Change to:

```jsx
            className="absolute inset-x-3 top-[76px] z-40 rounded-2xl border border-neutral-200/70 bg-white/80 p-3 shadow-xl backdrop-blur-xl backdrop-saturate-150 lg:hidden dark:border-acm-900/40 dark:bg-neutral-950/80"
```

- [ ] **Step 4: GalleryLightbox overlay backdrop**

In `src/components/sections/GalleryLightbox.jsx`, find (around line 53):

```jsx
            className="absolute inset-0 bg-neutral-950/70 backdrop-blur-md"
```

Change to:

```jsx
            className="absolute inset-0 bg-neutral-950/70 backdrop-blur-md backdrop-saturate-150"
```

- [ ] **Step 5: Verify**

Run: `npm run dev`, open `/`.
Check: scroll down until the navbar's scrolled background kicks in — it should read as a richer, slightly saturated glass panel over the page content behind it (try scrolling while the LiquidEther hero backdrop or a photo-heavy section is visible behind the bar, in both light and dark theme) rather than a flat translucent gray/white panel; nav text/links stay fully legible.
Check: sign in (or use an existing test account) and open the account avatar dropdown — background is glassy but menu text is still legible.
Check: on a narrow viewport (or DevTools device toolbar), open the hamburger menu — the drawer reads glassy but its links stay legible.
Check: open the gallery, click a photo to open the lightbox — the dark overlay behind the photo looks slightly richer/more saturated; the close button and photo itself are unaffected.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Navbar.jsx src/components/sections/GalleryLightbox.jsx
git commit -m "style: glassmorphism pass on navbar, dropdown, drawer, gallery lightbox"
```

---

### Task 8: `/welcome` — 3D logo landing route

**Files:**
- Create: `src/components/welcome/LogoScene3D.jsx`
- Create: `src/pages/Welcome.jsx`
- Modify: `src/App.jsx` (register the route, add it to the bare-layout list)
- Modify: `scripts/verify.mjs` (add a marker entry for `/welcome`)

**Interfaces:**
- Produces: `LogoScene3D` — default export, no props, renders a full-size three.js canvas of the ACM logo with an entrance animation, idle auto-rotation, and pointer-parallax tilt. Cleans up its renderer/geometry/listeners on unmount.
- Consumes: `/acm-logo.png` (already present in `public/`, used by `Logo.jsx` and `Hero.jsx`).

- [ ] **Step 1: Create `LogoScene3D`**

```jsx
// src/components/welcome/LogoScene3D.jsx
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'

// Radial-gradient sprite used as a soft glow behind the logo plane — cheaper
// and more predictable than wiring up postprocessing bloom for a single
// static mesh. Tinted from the deep end of the acm scale (acm-600 core,
// fading through acm-800 to transparent acm-950) per the blue-tint-lean
// decision for this redesign's new depth/glass surfaces.
function createGlowTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(31, 71, 245, 0.55)')
  gradient.addColorStop(0.5, 'rgba(26, 47, 182, 0.25)')
  gradient.addColorStop(1, 'rgba(21, 29, 87, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

export default function LogoScene3D() {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.z = 6

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearAlpha(0)
    container.appendChild(renderer.domElement)

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: createGlowTexture(), transparent: true, depthWrite: false }),
    )
    glow.scale.set(6, 6, 1)
    glow.position.z = -0.6
    scene.add(glow)

    const group = new THREE.Group()
    scene.add(group)

    let frontMaterial
    let backMaterial
    const loader = new THREE.TextureLoader()
    loader.load('/acm-logo.png', (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      const geometry = new THREE.PlaneGeometry(3, 3)

      // A slightly smaller, darker plane offset behind the front face gives
      // the flat logo a sense of thickness as it rotates, instead of reading
      // as a paper-thin card. Tint matches acm-800.
      backMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, color: 0x1a2fb6, opacity: 0 })
      const back = new THREE.Mesh(geometry, backMaterial)
      back.position.z = -0.12
      back.scale.setScalar(0.97)
      group.add(back)

      frontMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0 })
      const front = new THREE.Mesh(geometry, frontMaterial)
      group.add(front)

      group.scale.setScalar(0.6)
      group.rotation.y = Math.PI

      gsap.to(group.scale, { x: 1, y: 1, z: 1, duration: 1.4, ease: 'power3.out' })
      gsap.to(group.rotation, { y: 0, duration: 1.4, ease: 'power3.out' })
      gsap.to(frontMaterial, { opacity: 1, duration: 1, ease: 'power2.out' })
      gsap.to(backMaterial, { opacity: 0.85, duration: 1, ease: 'power2.out' })
    })

    const pointer = { x: 0, y: 0 }
    function onPointerMove(e) {
      const rect = container.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = ((e.clientY - rect.top) / rect.height) * 2 - 1
    }
    window.addEventListener('pointermove', onPointerMove)

    function setSize() {
      const w = container.clientWidth || 1
      const h = container.clientHeight || 1
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    setSize()
    const ro = new ResizeObserver(setSize)
    ro.observe(container)

    let raf
    function animate() {
      group.rotation.y += 0.0025
      group.rotation.x += (pointer.y * 0.25 - group.rotation.x) * 0.04
      group.rotation.z += (-pointer.x * 0.12 - group.rotation.z) * 0.04
      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointerMove)
      ro.disconnect()
      gsap.killTweensOf(group.scale)
      gsap.killTweensOf(group.rotation)
      if (frontMaterial) gsap.killTweensOf(frontMaterial)
      if (backMaterial) gsap.killTweensOf(backMaterial)
      scene.traverse((obj) => {
        obj.geometry?.dispose()
        if (obj.material) {
          obj.material.map?.dispose()
          obj.material.dispose()
        }
      })
      renderer.dispose()
      renderer.forceContextLoss()
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={containerRef} className="relative h-[60vh] w-full max-w-xl sm:h-[70vh]" />
}
```

- [ ] **Step 2: Create the `Welcome` page**

```jsx
// src/pages/Welcome.jsx
import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Logo } from '../components/Logo'

const LogoScene3D = lazy(() => import('../components/welcome/LogoScene3D'))
const AUTO_ADVANCE_MS = 2800

export default function Welcome() {
  const navigate = useNavigate()
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  useEffect(() => {
    if (reduceMotion) return
    const t = setTimeout(() => navigate('/'), AUTO_ADVANCE_MS)
    return () => clearTimeout(t)
  }, [reduceMotion, navigate])

  return (
    <div
      onClick={() => navigate('/')}
      className="relative flex min-h-screen cursor-pointer items-center justify-center overflow-hidden bg-neutral-950"
    >
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-acm-900/40 blur-[140px]" />

      {reduceMotion ? (
        <div className="relative flex flex-col items-center gap-8">
          <Logo showText={false} size="lg" className="[&_img]:h-40 [&_img]:w-40" />
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate('/')
            }}
            className="rounded-xl border border-acm-800/60 bg-acm-900/30 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-acm-900/50"
          >
            Enter ACM TKMCE
          </button>
        </div>
      ) : (
        <Suspense fallback={<Logo showText={false} size="lg" className="relative [&_img]:h-40 [&_img]:w-40" />}>
          <LogoScene3D />
        </Suspense>
      )}

      <motion.button
        onClick={(e) => {
          e.stopPropagation()
          navigate('/')
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 text-xs font-medium uppercase tracking-widest text-neutral-500 hover:text-neutral-300"
      >
        Skip
      </motion.button>
    </div>
  )
}
```

- [ ] **Step 3: Register the route in `App.jsx`**

In `src/App.jsx`, add the import:

```jsx
import Welcome from './pages/Welcome'
```

Change the bare-route check (currently `const isBareRoute = (pathname) => pathname === '/auth'`) to:

```jsx
const isBareRoute = (pathname) => pathname === '/auth' || pathname === '/welcome'
```

Add the route inside `<Routes>` (any position, e.g. right after `/auth`):

```jsx
            <Route path="/welcome" element={<Welcome />} />
```

- [ ] **Step 4: Add a verify.mjs marker**

In `scripts/verify.mjs`, add an entry to the `marker` object (it currently has `'/'`, `'/events'`, `'/execom'`, `'/contact'`, `'/auth'`, `'/dashboard'`, `'/admin'`):

```js
  '/welcome': 'Skip',
```

- [ ] **Step 5: Verify end-to-end**

Run: `npm run dev`, open `http://localhost:5173/welcome` directly.
Check: the ACM logo animates in (scales/rotates/fades up from behind, per the entrance tweens), then settles into a slow idle rotation.
Check: move the mouse over the page — the logo tilts slightly toward the cursor.
Check: wait ~2.8s without interacting — the page auto-navigates to `/`.
Check: reload `/welcome` and click anywhere (or the "Skip" text) before the timer fires — it navigates to `/` immediately.
Check: confirm `/welcome` has no navbar or footer (bare layout, like `/auth`).
Check: emulate `prefers-reduced-motion: reduce` in DevTools, reload `/welcome` — it should show the static logo + "Enter ACM TKMCE" button instead of the animated scene, with no auto-navigate timer running.
Check: with the dev server running, `node scripts/verify.mjs` — confirm it now also checks `/welcome` and passes.

- [ ] **Step 6: Commit**

```bash
git add src/components/welcome/LogoScene3D.jsx src/pages/Welcome.jsx src/App.jsx scripts/verify.mjs
git commit -m "feat: add /welcome 3D logo landing route"
```

---

## Self-Review

**Spec coverage:**
- Scroll-linked 3D on every Home section → `DepthSection` (Task 2), wired into Hero (Task 3, bold), About/Goals/GalleryStrip/ExploreMore (Tasks 4–5, subtle). ✓
- Every card feels depth/3D → `TiltCard` rolled out to Goals and ExploreMore (Tasks 4–5); GalleryStrip cards deliberately excluded per the design's own reasoning (marquee drag conflict) but the section itself still gets scroll-3D. ✓
- Every text feels depth → `SectionHeading` depth mode (Task 6), applied to About (both headings), Goals, ExploreMore. ✓
- Mixed intensity (bold hero/logo, subtle elsewhere) → `DepthSection`'s `intensity` prop + Hero's own bold constants + `LogoScene3D`'s dramatic entrance. ✓
- Glassmorphism on navbar and "wherever it looks nice" → Navbar scrolled bar/dropdown/drawer, ExploreMore card background (folded into Task 5's `TiltCard` className), GalleryLightbox overlay (Task 7). ✓
- No new colors / blue-tint lean → called out in Global Constraints and followed in every task that touches color (Navbar's `acm-900` border, `LogoScene3D`'s `acm-600`/`acm-800`/`acm-950` glow). ✓
- `/welcome` standalone route, 3D logo, auto-continue with skip → Task 8. ✓
- Reduced motion → `DepthSection` (Task 2, `useReducedMotion`), `Welcome`/`LogoScene3D` (Task 8, `matchMedia` gate + static fallback). ✓
- Out-of-scope pages untouched → no task modifies Events/Execom/Membership/Dashboard/Admin/Auth/Contact.

**Placeholder scan:** no TBD/TODO markers; every step has literal code, not a description of code.

**Type/name consistency:** `DepthSection`'s exported name and `useDepthScroll()` match between Task 2 (definition) and Tasks 4/5/6 (usage) and Task 6 (`SectionHeading`'s import path `./ui/DepthSection`, matching the file created in Task 2 at `src/components/ui/DepthSection.jsx`). `TiltCard`'s `as`/`intensity`/`glare` prop names match between Task 1 (definition) and Tasks 4/5 (usage). `motionTag` export name matches between Task 1's creation and its use inside `DepthSection.jsx` (Task 2) and `Card.jsx`/`Button.jsx` (Task 1).

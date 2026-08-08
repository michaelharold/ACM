# Home page 3D-interactive redesign + logo landing route

Status: approved (design discussion in chat, 2026-08-08)

## Goal

Push the Home page's existing motion foundation (`framer-motion`, GSAP, three.js/OGL shader backdrops) further into a "3D interactive" feel: every scroll transition on Home carries a 3D depth cue, every card gets pointer-reactive 3D tilt, headings read as depth-layered rather than flat fade-ups, and a small amount of glassmorphism is layered onto the chrome (navbar, dropdowns, overlays) and a few cards where it reads as premium rather than decorative. A new standalone `/welcome` route gives the logo its own dramatic 3D entrance moment.

**Constraint: no new colors.** Everything uses the existing `acm-*` blue scale (`tailwind.config.js`: `acm-500 #3366ff` … `acm-950 #151d57`, already a deep-navy scale tuned to the logo), existing neutrals, and existing dark/light tokens. Any theme/palette change beyond this is a separate ask-first conversation.

**Blue-tint lean for new depth/glass surfaces:** the new surfaces introduced by this redesign — glass tints/shadows (Navbar, dropdown, drawer, ExploreMore cards, GalleryLightbox), `DepthSection`'s shadow/glow, and the `/welcome` logo scene's lighting/bloom tint — pull from the deeper end of the existing scale (`acm-700`–`acm-950`) rather than the brighter `acm-500`/`acm-600` used elsewhere on Home for buttons/gradients/accents. This reads closer to the logo's actual navy and gives the new depth effects more weight, while staying entirely within the existing palette. Pre-existing bright-blue usage (buttons, the `acm-600→acm-400` gradients, etc.) is untouched.

## Scope

**In scope:** Home page only — `Hero`, `AnnouncementTicker`, `About`, `Goals`, `GalleryStrip`, `ExploreMore`, `SectionHeading`, `Navbar` (glass only), plus the new `/welcome` route.

**Out of scope:** Events, Execom, Membership, Dashboard, Admin, Auth, Contact pages. Execom's existing `TiltedCard` usage is untouched. No new brand colors. No changes to data/content/services layers.

## Architecture

### 1. `DepthSection` — scroll-linked 3D wrapper

New component: `src/components/ui/DepthSection.jsx`.

Wraps a section's content and drives 3D transforms off scroll position, using the same `useScroll({ target, offset })` + `useTransform` pattern already proven in `Hero.jsx`'s parallax. Applies to the wrapper:

- `perspective` on the outer element, `transform-style: preserve-3d` on the inner.
- `rotateX` ramps from a small negative angle → 0 → small positive angle as the section moves through the viewport (a "swings into place" feel), magnitude controlled by an `intensity` prop.
- `translateZ` and `scale` move together with `rotateX` so the section feels like it's arriving from depth, not just rotating in place.
- `intensity="bold"` (larger angles/translateZ, used by `Hero`) vs `intensity="subtle"` (small angles, mostly opacity+scale carrying the depth feel, used by `About`/`Goals`/`GalleryStrip`/`ExploreMore`) — matches the mixed-intensity decision.
- Reduced motion: reads the same `prefers-reduced-motion` media query gate already used in `Hero.jsx`; when set, all transforms collapse to the existing plain opacity/fade behavior (no rotation/translateZ).

`Hero` already has its own bespoke scroll-parallax; it gets `DepthSection`'s bold treatment adapted into its existing `ref`/`useScroll`, rather than double-wrapping.

### 2. Card depth — extend `TiltCard`

`TiltCard` (`src/components/ui/Card.jsx`) already implements pointer 3D tilt + cursor glare. Roll it out to cards that don't have it yet:

- **Goals** (`src/components/sections/Goals.jsx`): the three pillar buttons switch from the current plain hover-scale to `TiltCard`'s pointer-tilt, keeping the existing active-pillar accent bar / layoutId behavior layered on top.
- **ExploreMore** (`src/components/sections/ExploreMore.jsx`): the three `Link` cards get wrapped with `TiltCard`'s tilt treatment (as a `Link`-compatible wrapper) in place of the current `hover:-translate-y-1`.
- **GalleryStrip** (`src/components/sections/GalleryStrip.jsx`): cards keep their current hover-scale/opacity behavior (pointer-tilt would fight the horizontal marquee drag) but gain a scroll-linked `translateZ` lift via a lightweight depth wrapper, not full `TiltCard`.
- All rollouts use `intensity` in the "subtle" range (matching About's existing `TiltCard` usage) — Home's card depth stays in the subtle tier per the mixed-intensity decision; only Hero/`/welcome` get the bold treatment.

### 3. `SectionHeading` depth variant

`src/components/SectionHeading.jsx` gets an optional depth-layered mode: eyebrow, title, and description each get a slightly different scroll-driven parallax speed and a `translateZ` offset (title reads "in front of" description), via `useTransform` off the enclosing `DepthSection`'s scroll progress. Existing non-depth usage (if any headings outside Home use this component) is unaffected — the depth behavior is opt-in via a prop, default off.

### 4. Glassmorphism pass

Applied using existing neutrals/acm colors only — no new hues. "Glass" here means: translucent background (`bg-white/N` / `bg-neutral-950/N`), `backdrop-blur`, `backdrop-saturate-150` for richer color-through, a subtle 1px gradient/light border, and a soft shadow — refining what's already partially present rather than introducing a new pattern.

- **Navbar** (`src/components/layout/Navbar.jsx`): the scrolled state (`bg-white/80 backdrop-blur-xl dark:bg-neutral-950/70`) gains `backdrop-saturate-150`, a softer/lower-opacity fill, and a subtle top inner-highlight border for a true glass edge instead of a flat translucent panel. The border/shadow tint pulls from `acm-800`/`acm-900` (dark mode) per the blue-tint lean above, instead of neutral gray.
- **Account dropdown menu** and **mobile drawer** (same file): currently near-opaque (`bg-white`, `bg-white/95`) — both drop opacity and add `backdrop-saturate-150` to match the navbar's glass finish.
- **ExploreMore cards**: background shifts from flat `bg-neutral-900/50` to a glass treatment consistent with `About`'s `StatCard` (`bg-neutral-950/50 backdrop-blur-md`).
- **GalleryLightbox** (`src/components/sections/GalleryLightbox.jsx`): its overlay/panel chrome (not the photo itself) gets the same glass finish if it isn't already using one.
- Deliberately skipped: large body-text containers (About's "Why join" card *text* stays on a near-opaque backing for legibility — only chrome/accent surfaces go glassy), and anywhere glass would sit over dense text.

### 5. `/welcome` — 3D logo landing route

- `src/pages/Welcome.jsx`, registered in `src/App.jsx` as `<Route path="/welcome" element={<Welcome />} />`. Bare layout like `/auth` (add `/welcome` to `isBareRoute` — no navbar/footer).
- `src/components/welcome/LogoScene3D.jsx`: a three.js scene (matching the library already used for the codebase's more complex/geometric shader work — `LiquidEther`, `MagicRings`, `ColorBends` — vs. the simpler `ogl` shader-only effects), rendering the ACM logo as a lit, textured mesh:
  - Entrance: blur/scale/rotate in over ~1.2–1.5s (mirrors the existing logo reveal timing in `Hero.jsx`).
  - Idle: slow auto-rotation + pointer-parallax tilt.
  - Optional soft bloom via the already-installed `postprocessing` package if it doesn't hurt frame health on mid-range devices; skipped otherwise.
  - Colors: lighting/glow/bloom tint pulls from `acm-800`/`acm-900`/`acm-950` (the blue-tint lean) for a moodier, more navy-true glow than the brighter `acm-500`/`acm-600` used on buttons elsewhere — still no new hues.
- After the entrance settles (~2.5–3s total), auto-navigates to `/`. A tap/click-anywhere (and a small "Skip" text link for keyboard/a11y) jumps immediately.
- Not linked from the Navbar. Reachable directly at `/welcome` (shareable). `LogoScene3D` and its three.js scene are lazy-loaded (`React.lazy`) so the extra WebGL weight never lands on the main Home bundle.
- Respects `prefers-reduced-motion`: skips straight to a static logo + "Enter" affordance instead of animating.

## Testing / verification

No automated test suite covers visual/animation behavior in this codebase (`npm run verify` covers data scripts, not UI). Verification is manual:

1. `npm run dev`, walk the Home page scroll from top to bottom in both light and dark theme, confirm each section's depth transition feels intentional (not jarring) and text stays legible throughout.
2. Hover-test the Goals pillars, ExploreMore cards, and GalleryStrip cards for tilt/lift behavior; confirm GalleryStrip's horizontal drag still works cleanly.
3. Visit `/welcome` directly: confirm the entrance animation, pointer-parallax, skip affordance, and auto-navigation to `/` all work; confirm it does not add navbar/footer chrome.
4. Emulate `prefers-reduced-motion: reduce` in devtools; confirm Home falls back to plain fades and `/welcome` falls back to a static logo + Enter button.
5. Throttle CPU/network in devtools (or test on a real mid-range phone) to sanity-check the `/welcome` three.js scene and Home's scroll-3D don't drop below a usable frame rate.
6. Spot-check the glass surfaces (navbar, dropdown, drawer, ExploreMore cards, gallery lightbox) against busy backgrounds (the LiquidEther hero backdrop, gallery photos) to confirm legibility holds.

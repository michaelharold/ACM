import { Suspense, lazy, useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, ArrowDown } from 'lucide-react'
import SpecularButton from '../reactbits/SpecularButton'
import BlurText from '../reactbits/BlurText'
import { SocialLinks } from '../SocialLinks'
import { useTheme } from '../../context/ThemeContext'
import { scrollToId } from '../../lib/smoothScroll'
import { chapter } from '../../data/mock'

// Fluid-sim backdrop (three.js) stays in its own lazy chunk.
const LiquidEther = lazy(() => import('../reactbits/LiquidEther'))

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
}
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 28 } },
}

export function Hero() {
  const ref = useRef(null)
  const navigate = useNavigate()
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setMounted(true)
  }, [])

  // Scroll-linked parallax: copy drifts up and fades as the hero scrolls out.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -120])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0])

  // Shared theme-aware styling for the secondary specular CTAs.
  const secondary = dark
    ? { tint: '#ffffff', tintOpacity: 0.07, blur: 8, textColor: '#f5f5f5', lineColor: '#9db9ff', baseColor: '#3f3f46' }
    : { tint: '#ffffff', tintOpacity: 0.65, blur: 8, textColor: '#171717', lineColor: '#1f47f5', baseColor: '#a3a3a3' }

  return (
    <section ref={ref} className="bg-grid relative flex min-h-[100svh] items-center overflow-hidden">
      {/* Liquid ether fluid backdrop — reacts to the cursor, self-drives when idle */}
      {mounted && (
        <div className="absolute inset-0" aria-hidden>
          <Suspense fallback={null}>
            <LiquidEther
              colors={['#0d75e7', '#1173e6', '#0c04f2']}
              mouseForce={15}
              cursorSize={100}
              isViscous={false}
              viscous={30}
              iterationsViscous={32}
              iterationsPoisson={32}
              resolution={0.5}
              isBounce
              autoDemo
              autoSpeed={0.6}
              autoIntensity={2.7}
              takeoverDuration={0.25}
              autoResumeDelay={3000}
              autoRampDuration={0.6}
            />
          </Suspense>
        </div>
      )}

      {/* Ambient glow + bottom fade above the fluid layer */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-acm-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-white dark:to-neutral-950" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        style={{ y: contentY, opacity: contentOpacity }}
        className="section-shell pointer-events-none relative z-10 py-28 text-center"
      >
        {/* Official chapter mark — unblurs and settles in, then breathes */}
        <motion.div variants={item} className="mx-auto mb-10 flex justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.72, filter: 'blur(14px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            className="relative"
          >
            {/* Glow that blooms outward as the mark lands */}
            <motion.span
              aria-hidden
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.85, 0.45], scale: [0.5, 1.35, 1.15] }}
              transition={{ duration: 1.8, ease: 'easeOut', delay: 0.2 }}
              className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-acm-500/35 blur-[52px]"
            />
            <motion.img
              src="/acm-logo.png"
              alt="ACM TKMCE Student Chapter"
              width={311}
              height={311}
              animate={{ y: [0, -9, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="h-28 w-28 object-contain drop-shadow-[0_8px_28px_rgba(31,71,245,0.35)] sm:h-36 sm:w-36"
            />
          </motion.div>
        </motion.div>

        <motion.h1
          variants={item}
          className="mx-auto mt-6 max-w-4xl text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl"
        >
          Advancing computing at{' '}
          <span className="relative whitespace-nowrap">
            <span className="bg-gradient-to-r from-acm-600 to-acm-400 bg-clip-text text-transparent">TKMCE</span>
            <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none" preserveAspectRatio="none">
              <motion.path
                d="M2 9 C 80 2, 220 2, 298 8"
                stroke="url(#g)"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, delay: 0.6, ease: 'easeInOut' }}
              />
              <defs>
                <linearGradient id="g" x1="0" x2="1">
                  <stop offset="0" stopColor="#1f47f5" />
                  <stop offset="1" stopColor="#598eff" />
                </linearGradient>
              </defs>
            </svg>
          </span>
        </motion.h1>

        <motion.div variants={item} className="mx-auto mt-7 max-w-xl">
          <BlurText
            text={chapter.description}
            delay={40}
            animateBy="words"
            direction="top"
            className="justify-center text-pretty text-base leading-relaxed text-neutral-500 dark:text-neutral-400 sm:text-lg"
          />
        </motion.div>

        <motion.div variants={item} className="pointer-events-auto mt-9 flex flex-wrap items-center justify-center gap-3">
          <SpecularButton
            size="md"
            radius={14}
            tint="#1f47f5"
            tintOpacity={1}
            textColor="#ffffff"
            lineColor="#bcd0ff"
            baseColor="#1634b8"
            intensity={1}
            proximity={220}
            onClick={() => navigate('/auth')}
          >
            <span className="inline-flex items-center gap-2">
              Join ACM <ArrowRight className="h-4 w-4" />
            </span>
          </SpecularButton>
          <SpecularButton size="md" radius={14} {...secondary} proximity={220} onClick={() => navigate('/events')}>
            Explore Events
          </SpecularButton>
          <SpecularButton size="md" radius={14} {...secondary} proximity={220} onClick={() => scrollToId('about')}>
            Learn More
          </SpecularButton>
        </motion.div>

        <motion.div variants={item} className="pointer-events-auto mt-10 flex justify-center">
          <SocialLinks />
        </motion.div>
      </motion.div>

      {/* Scroll cue */}
      <motion.button
        onClick={() => scrollToId('about')}
        aria-label="Scroll to about"
        style={{ opacity: contentOpacity }}
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-neutral-400 sm:block"
      >
        <motion.span
          animate={{ y: [0, 7, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="block"
        >
          <ArrowDown className="h-5 w-5" />
        </motion.span>
      </motion.button>
    </section>
  )
}

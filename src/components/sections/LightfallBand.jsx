import Lightfall from '../reactbits/Lightfall'
import ScrollFloat from '../reactbits/ScrollFloat'

// Cinematic band directly below the liquid-ether hero: falling light streaks
// with a scroll-scrubbed headline floating up through them.
export function LightfallBand() {
  return (
    <section className="relative overflow-hidden bg-neutral-950">
      <div className="absolute inset-0" aria-hidden>
        <Lightfall
          colors={['#A6C8FF', '#5227FF', '#FF9FFC']}
          backgroundColor="#0A29FF"
          speed={0.6}
          streakCount={1}
          streakWidth={1.8}
          streakLength={1.8}
          glow={0.2}
          density={0.5}
          twinkle={0}
          zoom={2}
          backgroundGlow={1}
          opacity={1}
          mouseInteraction
          mouseStrength={0}
          mouseRadius={1.35}
        />
      </div>
      <div className="relative z-10 flex min-h-[300px] items-center justify-center px-5 py-16 sm:min-h-[380px]">
        <ScrollFloat
          animationDuration={1}
          ease="back.inOut(2)"
          scrollStart="center bottom+=50%"
          scrollEnd="bottom bottom-=40%"
          stagger={0.03}
          containerClassName="text-center"
          textClassName="text-white"
        >
          Think. Build. Ship.
        </ScrollFloat>
      </div>
    </section>
  )
}

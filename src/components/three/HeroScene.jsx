import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTheme } from '../../context/ThemeContext'

const ACM_BLUE = '#1f47f5'
const ACM_LIGHT = '#598eff'

const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Slowly-tumbling wireframe icosahedron that leans toward the pointer.
function CoreShape({ dark }) {
  const group = useRef()
  const inner = useRef()

  useFrame((state, delta) => {
    if (!group.current) return
    if (!reducedMotion) {
      group.current.rotation.y += delta * 0.12
      group.current.rotation.x += delta * 0.05
      inner.current.rotation.y -= delta * 0.2
      inner.current.rotation.z += delta * 0.08
    }
    // Ease the whole group toward the pointer for a parallax lean.
    const tx = state.pointer.y * 0.25
    const ty = state.pointer.x * 0.35
    group.current.rotation.x += (tx - group.current.rotation.x) * 0.02
    group.current.position.x += (state.pointer.x * 0.6 - group.current.position.x) * 0.03
    group.current.position.y += (state.pointer.y * 0.35 - group.current.position.y) * 0.03
    void ty
  })

  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[2.4, 1]} />
        <meshBasicMaterial
          color={ACM_BLUE}
          wireframe
          transparent
          opacity={dark ? 0.34 : 0.13}
        />
      </mesh>
      <mesh ref={inner} scale={0.55}>
        <icosahedronGeometry args={[2.4, 0]} />
        <meshBasicMaterial
          color={ACM_LIGHT}
          wireframe
          transparent
          opacity={dark ? 0.5 : 0.22}
        />
      </mesh>
    </group>
  )
}

// Orbiting particle shell that drifts and counter-rotates against the pointer.
function ParticleField({ dark, count = 650 }) {
  const points = useRef()

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Spherical shell between r=3.4 and r=7 so particles frame the core shape.
      const r = 3.4 + Math.random() * 3.6
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [count])

  useFrame((state, delta) => {
    if (!points.current) return
    if (!reducedMotion) {
      points.current.rotation.y += delta * 0.03
      points.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.08) * 0.06
    }
    points.current.rotation.z += (state.pointer.x * -0.08 - points.current.rotation.z) * 0.02
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        sizeAttenuation
        color={dark ? ACM_LIGHT : ACM_BLUE}
        transparent
        opacity={dark ? 0.55 : 0.4}
        depthWrite={false}
      />
    </points>
  )
}

// Two faint orbit rings for depth.
function OrbitRings({ dark }) {
  const a = useRef()
  const b = useRef()
  useFrame((_, delta) => {
    if (reducedMotion) return
    if (a.current) a.current.rotation.z += delta * 0.05
    if (b.current) b.current.rotation.z -= delta * 0.04
  })
  const opacity = dark ? 0.2 : 0.14
  return (
    <>
      <mesh ref={a} rotation={[Math.PI / 2.4, 0.4, 0]}>
        <torusGeometry args={[4.4, 0.006, 8, 120]} />
        <meshBasicMaterial color={ACM_BLUE} transparent opacity={opacity} />
      </mesh>
      <mesh ref={b} rotation={[Math.PI / 1.9, -0.5, 0.6]}>
        <torusGeometry args={[5.6, 0.005, 8, 120]} />
        <meshBasicMaterial color={ACM_LIGHT} transparent opacity={opacity} />
      </mesh>
    </>
  )
}

// Full-bleed 3D backdrop for the hero. Renders behind the copy; pointer-events
// stay off so it never blocks CTAs. Lazy-loaded — keep this file the only
// entry point into three.js so the chunk splits cleanly.
export default function HeroScene() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const mobile = typeof window !== 'undefined' && window.innerWidth < 640

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <Canvas
        dpr={[1, 1.8]}
        camera={{ position: [0, 0, 9], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ pointerEvents: 'none' }}
        eventSource={typeof document !== 'undefined' ? document.body : undefined}
      >
        <CoreShape dark={dark} />
        <ParticleField dark={dark} count={mobile ? 320 : 650} />
        {!mobile && <OrbitRings dark={dark} />}
      </Canvas>
    </div>
  )
}

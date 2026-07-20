import { initials } from './icons'

// Brand-adjacent gradient pairs, picked deterministically per name.
const palettes = [
  ['#1f47f5', '#598eff'],
  ['#4338ca', '#818cf8'],
  ['#0e7490', '#22d3ee'],
  ['#7c3aed', '#c084fc'],
  ['#0f766e', '#34d399'],
  ['#b45309', '#fbbf24'],
  ['#be185d', '#fb7185'],
]

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Self-contained SVG monogram avatar as a data URI — no external image service,
// works offline and matches the brand gradients used elsewhere.
export function avatarDataUri(name, size = 400) {
  const [c1, c2] = palettes[hash(name) % palettes.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <circle cx="${size * 0.85}" cy="${size * 0.12}" r="${size * 0.35}" fill="#ffffff" opacity="0.08"/>
  <circle cx="${size * 0.1}" cy="${size * 0.9}" r="${size * 0.28}" fill="#000000" opacity="0.10"/>
  <text x="50%" y="47%" text-anchor="middle" dominant-baseline="central" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="${size * 0.3}" fill="#ffffff" letter-spacing="2">${initials(name)}</text>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

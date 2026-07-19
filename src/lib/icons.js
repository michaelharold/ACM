import {
  Hammer,
  Globe2,
  Rocket,
  HeartHandshake,
  Eye,
  Target,
  Gem,
  Award,
  CalendarRange,
  Settings2,
  Palette,
  FileText,
  Code2,
  Megaphone,
  Network,
  AtSign,
  Star,
} from 'lucide-react'

// Maps mock-data string icon names to lucide components.
export const iconMap = {
  Hammer,
  Globe2,
  Rocket,
  HeartHandshake,
  Eye,
  Target,
  Gem,
  Award,
  CalendarRange,
  Settings2,
  Palette,
  FileText,
  Code2,
  Megaphone,
  Network,
  AtSign,
  Star,
}

// Deterministic initials + gradient for monogram avatars.
const gradients = [
  'from-acm-500 to-acm-700',
  'from-violet-500 to-indigo-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
]

export function initials(name) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase()
}

export function gradientFor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return gradients[h % gradients.length]
}

// Tiny className joiner — avoids pulling in clsx/tailwind-merge for a demo build.
export function cn(...args) {
  return args
    .flat(Infinity)
    .filter(Boolean)
    .join(' ')
    .trim()
}

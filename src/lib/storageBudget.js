// Keeping the project comfortably inside Firebase's FREE (Spark) plan.
//
// Images are stored as base64 data URIs inline in their Firestore documents, and
// a base64 string's length is ≈ the bytes it occupies, so we can estimate how
// much of the free storage quota the imagery uses straight from the data already
// loaded in memory — no extra reads, no billing, no Cloud Storage required.
//
// (If an image is ever a Storage URL instead of base64 it's a short string that
// costs almost nothing here AND doesn't sit in Firestore, so counting only the
// base64 length stays an honest estimate of Firestore usage either way.)

// The Spark plan gives 1 GiB of Firestore storage. We treat 700 MB as "full" so
// there's always headroom for indexes, non-image documents and growth — the
// alarms fire long before anything actually breaks.
export const STORAGE_BUDGET_BYTES = 700 * 1024 * 1024

// The gallery page loads every image at once, so this cap is a page-performance
// ceiling as much as a storage one. Uploads are blocked past it.
export const GALLERY_MAX_IMAGES = 80

const len = (s) => (typeof s === 'string' && s.startsWith('data:') ? s.length : 0)

// Best-effort byte estimate of every inline image across the site.
export function estimateImageBytes({ gallery = [], events = [], execomGroups = [] } = {}) {
  let bytes = 0
  for (const g of gallery) bytes += len(g.image)
  for (const e of events) bytes += len(e.poster)
  for (const grp of execomGroups) for (const m of grp.members || []) bytes += len(m.photo)
  return bytes
}

// ok < 60% · warn 60–80% · critical 80–100% · full ≥ 100%
export function storageStatus(bytes) {
  const pct = bytes / STORAGE_BUDGET_BYTES
  if (pct >= 1) return 'full'
  if (pct >= 0.8) return 'critical'
  if (pct >= 0.6) return 'warn'
  return 'ok'
}

export function formatBytes(b) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

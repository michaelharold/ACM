// Prepares an uploaded photo for the gallery: centre-crops it to a fixed
// aspect ratio and re-encodes it small enough to live inside a Firestore
// document (1 MB hard cap, so we aim well under it).

const TARGET_W = 800
const TARGET_H = 560 // 10:7 — matches the gallery card proportions
const MAX_BYTES = 700 * 1024

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`${file.name} is not a readable image.`))
    }
    img.src = url
  })

// Centre-crop to the target ratio, then scale — never letterbox or squash.
//
// Every inline image in this app lives in a Firestore document, which is hard
// capped at 1 MB. A raw phone photo is several MB once base64-encoded, so
// anything uploaded MUST come through here or the write silently fails.
export async function prepareImage(file, { width = TARGET_W, height = TARGET_H, maxBytes = MAX_BYTES } = {}) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`)
  const img = await loadImage(file)

  const targetRatio = width / height
  const srcRatio = img.width / img.height
  let sx = 0
  let sy = 0
  let sw = img.width
  let sh = img.height

  if (srcRatio > targetRatio) {
    // Source is wider — trim the sides.
    sw = img.height * targetRatio
    sx = (img.width - sw) / 2
  } else {
    // Source is taller — trim top and bottom.
    sh = img.width / targetRatio
    sy = (img.height - sh) / 2
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)

  // Step the quality down until it fits comfortably in a Firestore document.
  for (const q of [0.82, 0.7, 0.58, 0.45, 0.34]) {
    const url = canvas.toDataURL('image/jpeg', q)
    if (url.length * 0.75 <= maxBytes) return url
  }
  return canvas.toDataURL('image/jpeg', 0.3)
}

// Gallery cards (10:7).
export const cropToCard = (file) => prepareImage(file)

// Execom member portraits. Several members share one team document, so these
// are budgeted much smaller than a gallery image.
export const cropToPortrait = (file) => prepareImage(file, { width: 480, height: 480, maxBytes: 90 * 1024 })

// Event posters — one per event document, so they can afford the card budget.
export const cropToPoster = (file) => prepareImage(file, { width: 800, height: 560, maxBytes: 300 * 1024 })

// Deterministic-per-load shuffle so the strip looks fresh on every visit
// without reordering mid-session (which would fight the marquee animation).
export function shuffle(list) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

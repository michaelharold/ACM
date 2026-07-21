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
export async function cropToCard(file) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`)
  const img = await loadImage(file)

  const targetRatio = TARGET_W / TARGET_H
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
  canvas.width = TARGET_W
  canvas.height = TARGET_H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H)

  // Step the quality down until it fits comfortably in a Firestore document.
  for (const q of [0.82, 0.7, 0.58, 0.45, 0.34]) {
    const url = canvas.toDataURL('image/jpeg', q)
    if (url.length * 0.75 <= MAX_BYTES) return url
  }
  return canvas.toDataURL('image/jpeg', 0.3)
}

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

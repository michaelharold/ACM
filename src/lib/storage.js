// Firebase Storage helper for site imagery (event posters, gallery photos,
// execom portraits).
//
// Historically every image was stored as a base64 data URI *inline* in its
// Firestore document. That works, but each image counts against the 1 MB
// per-document cap, bloats every read of that collection, and eats the 1 GiB
// Firestore free tier fast. Cloud Storage is the right home: 5 GB free,
// CDN-served, and it never inflates a Firestore read.
//
// KEY DESIGN — graceful fallback. `uploadImage` tries Storage and returns a
// download URL; if Storage is unreachable for ANY reason (not enabled, billing
// plan, quota, rules not yet deployed) it returns the original base64 data URI
// unchanged. The document then simply carries the inline image exactly as
// before, and `<img src>` renders a data URI and an https URL identically. So
// turning Storage on is a pure upgrade with no flag day and no regression.

import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage'
import { app, isFirebaseConfigured } from './firebase'

let storage = null
if (isFirebaseConfigured && app) {
  try {
    storage = getStorage(app)
  } catch {
    storage = null // no bucket configured — fall back to inline base64
  }
}

// Upload a base64 data URI to `<prefix>/<id>.jpg` and return its download URL.
// Anything that isn't a fresh data URI (already an https/gs URL, or empty) is
// returned untouched, so re-saving a record doesn't re-upload existing images.
// Never throws — on failure it falls back to the inline data URI.
export async function uploadImage(prefix, dataUri) {
  if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:')) return dataUri
  if (!storage) return dataUri
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const objRef = ref(storage, `${prefix}/${id}.jpg`)
    await uploadString(objRef, dataUri, 'data_url')
    return await getDownloadURL(objRef)
  } catch {
    return dataUri // Storage unavailable — keep the inline copy, nothing breaks
  }
}

// Best-effort removal of a Storage object from its download URL, so deleting a
// poster/gallery image doesn't leave the file orphaned in the bucket. Inline
// base64 or foreign URLs are ignored, and it never throws.
export async function deleteImage(url) {
  if (!storage || !url || typeof url !== 'string') return
  if (!url.startsWith('http') && !url.startsWith('gs://')) return
  try {
    await deleteObject(ref(storage, url))
  } catch {
    /* already gone, or not one of ours — orphan cleanup is best-effort */
  }
}

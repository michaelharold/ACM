import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ImagePlus, Trash2, Loader2, AlertCircle, Shuffle, Images } from 'lucide-react'
import { Button } from '../ui/Button'
import { useData } from '../../context/DataContext'
import { cropToCard } from '../../lib/imagePrep'

export function GalleryPanel() {
  const { gallery, addGalleryImages, removeGalleryImage } = useData()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [errors, setErrors] = useState([])
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)

  async function handleFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    setBusy(true)
    setErrors([])
    const prepared = []
    const failed = []
    for (let i = 0; i < files.length; i++) {
      setProgress(`Cropping ${i + 1} of ${files.length}…`)
      try {
        // Every upload is centre-cropped to the card ratio and recompressed,
        // so the strip stays uniform whatever the source photo looks like.
        const image = await cropToCard(files[i])
        prepared.push({ image, caption: files[i].name.replace(/\.[^.]+$/, '') })
      } catch (err) {
        failed.push(err.message)
      }
    }
    if (prepared.length) {
      setProgress(`Saving ${prepared.length} image${prepared.length > 1 ? 's' : ''}…`)
      try {
        await addGalleryImages(prepared)
      } catch (err) {
        failed.push(err?.message || 'Could not save the images.')
      }
    }
    setErrors(failed)
    setProgress('')
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Images className="h-5 w-5 text-acm-500" /> Gallery
        </h2>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
          <Shuffle className="h-3.5 w-3.5" />
          Uploads are auto-cropped to the card shape and reshuffled on every visit.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files) }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          drag ? 'border-acm-500 bg-acm-500/5' : 'border-neutral-300 dark:border-neutral-700'
        }`}
      >
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-neutral-200 bg-neutral-50 text-acm-500 dark:border-neutral-800 dark:bg-neutral-800/60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
        </span>
        <p className="mt-4 text-sm font-medium">
          {busy ? progress : 'Drop photos here, or choose files'}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          JPG or PNG · any size or shape · cropped to 800×560 automatically
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button size="sm" className="mt-5" disabled={busy} onClick={() => inputRef.current?.click()}>
          <ImagePlus className="h-4 w-4" /> Choose images
        </Button>
      </div>

      {errors.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {errors.map((e, i) => (
            <p key={i} className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {e}
            </p>
          ))}
        </div>
      )}

      {/* Current images */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {gallery.length} image{gallery.length === 1 ? '' : 's'} live on the site
        </p>
        {gallery.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 p-10 text-center dark:border-neutral-800">
            <p className="text-sm text-neutral-500">No images yet — the gallery section stays hidden until you add one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {gallery.map((g) => (
              <figure
                key={g.id}
                className="group relative aspect-[10/7] overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800"
              >
                <img src={g.image} alt={g.caption} className="h-full w-full object-cover" />
                <figcaption className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-6 text-[11px] text-white">
                  {g.caption}
                </figcaption>
                <button
                  onClick={() => removeGalleryImage(g.id)}
                  aria-label={`Remove ${g.caption}`}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-neutral-950/70 text-white opacity-0 backdrop-blur transition-opacity hover:bg-rose-600 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </figure>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

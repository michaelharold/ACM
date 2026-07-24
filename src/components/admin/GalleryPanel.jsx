import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ImagePlus, Trash2, Loader2, AlertCircle, Shuffle, Images, Check, Pencil } from 'lucide-react'
import { Button } from '../ui/Button'
import { useData } from '../../context/DataContext'
import { cropToCard } from '../../lib/imagePrep'

export function GalleryPanel() {
  const { gallery, addGalleryImages, removeGalleryImage, updateGalleryImage } = useData()
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
        // No auto-title from the filename (avoids "WhatsApp Image 2024…").
        // Titles are opt-in — set them below, or leave blank for none.
        prepared.push({ image, caption: '' })
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
              <GalleryTile
                key={g.id}
                item={g}
                onRename={(caption) => updateGalleryImage(g.id, { caption })}
                onRemove={() => removeGalleryImage(g.id)}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// One managed image: shows the photo, its optional title, and an inline editor
// so the team can set a clean title (or leave it blank to show none on the site).
function GalleryTile({ item, onRename, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.caption || '')

  function save() {
    const next = value.trim()
    if (next !== (item.caption || '')) onRename(next)
    setEditing(false)
  }

  return (
    <figure className="group relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <div className="relative aspect-[10/7] overflow-hidden">
        <img src={item.image} alt={item.caption || 'Gallery image'} className="h-full w-full object-cover" />
        <button
          onClick={onRemove}
          aria-label="Remove image"
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-neutral-950/70 text-white opacity-0 backdrop-blur transition-opacity hover:bg-rose-600 group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {editing ? (
        <div className="flex items-center gap-1 p-1.5">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            onBlur={save}
            maxLength={80}
            placeholder="Add a title…"
            className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-acm-400 dark:border-neutral-700 dark:bg-neutral-800"
          />
          <button onMouseDown={(e) => e.preventDefault()} onClick={save} aria-label="Save title" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-acm-600 hover:bg-acm-50 dark:hover:bg-acm-500/10">
            <Check className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setValue(item.caption || ''); setEditing(true) }}
          className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-xs text-neutral-500 transition-colors hover:text-acm-600 dark:text-neutral-400"
        >
          <Pencil className="h-3 w-3 shrink-0" />
          <span className="truncate">{item.caption || <span className="italic text-neutral-400">No title — click to add</span>}</span>
        </button>
      )}
    </figure>
  )
}

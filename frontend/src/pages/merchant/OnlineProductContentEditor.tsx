import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { resolveMediaUrl } from '../../lib/api'
import {
  deleteOnlineProductGalleryImage,
  uploadOnlineProductGalleryImage,
  type OnlineGalleryImage,
} from '../../lib/merchantOnlinePricingApi'

const GALLERY_MAX = 10

type Props = {
  productId: number
  description: string
  galleryImages: OnlineGalleryImage[]
  labels: {
    description: string
    descriptionHint: string
    gallery: string
    galleryHint: string
    addImage: string
    removeImage: string
    uploading: string
    galleryMax: string
  }
  onDescriptionChange: (value: string) => void
  onGalleryChange: (images: OnlineGalleryImage[]) => void
  onError?: (message: string) => void
}

export function OnlineProductContentEditor({
  productId,
  description,
  galleryImages,
  labels,
  onDescriptionChange,
  onGalleryChange,
  onError,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function handleUpload(file: File) {
    if (galleryImages.length >= GALLERY_MAX) {
      onError?.(labels.galleryMax)
      return
    }
    setUploading(true)
    try {
      const row = await uploadOnlineProductGalleryImage(productId, file)
      onGalleryChange([...galleryImages, row])
    } catch (e) {
      onError?.(e instanceof Error ? e.message : labels.uploading)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleRemove(imageId: number) {
    setDeletingId(imageId)
    try {
      await deleteOnlineProductGalleryImage(imageId)
      onGalleryChange(galleryImages.filter((g) => g.id !== imageId))
    } catch (e) {
      onError?.(e instanceof Error ? e.message : labels.removeImage)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-emerald-200/70 bg-emerald-50/30 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/15">
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
          {labels.description}
        </label>
        <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">{labels.descriptionHint}</p>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          placeholder="..."
        />
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{labels.gallery}</p>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{labels.galleryHint}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {galleryImages.map((img) => {
            const src = resolveMediaUrl(img.image_url)
            return (
              <div
                key={img.id}
                className="group relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800"
              >
                {src ? (
                  <img src={src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-slate-300">
                    ?
                  </span>
                )}
                <button
                  type="button"
                  disabled={deletingId === img.id}
                  onClick={() => void handleRemove(img.id)}
                  className="absolute end-1 top-1 flex h-7 w-7 items-center justify-center rounded-lg bg-red-600/90 text-white opacity-0 shadow transition group-hover:opacity-100 disabled:opacity-60"
                  title={labels.removeImage}
                >
                  {deletingId === img.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              </div>
            )
          })}
          {galleryImages.length < GALLERY_MAX ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleUpload(f)
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-emerald-300/80 bg-white text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <ImagePlus className="h-5 w-5" aria-hidden />
                )}
                <span className="px-1 text-center text-[10px] font-semibold leading-tight">
                  {labels.addImage}
                </span>
              </button>
            </>
          ) : null}
        </div>
        <p className="mt-2 text-[10px] text-slate-400">
          {galleryImages.length}/{GALLERY_MAX}
        </p>
      </div>
    </div>
  )
}

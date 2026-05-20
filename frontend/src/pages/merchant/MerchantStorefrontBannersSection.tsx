import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { apiJson } from '../../lib/api'
import { useLocale } from '../../context/LocaleContext'
import {
  createMerchantStorefrontBanner,
  deleteMerchantStorefrontBanner,
  fetchMerchantStorefrontBanners,
  reorderMerchantStorefrontBanners,
  updateMerchantStorefrontBanner,
  type MerchantStorefrontBanner,
  type StorefrontBannerLinkType,
} from '../../lib/merchantStorefrontBannersApi'

type CategoryOption = { id: number; name: string }

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-400/20 dark:border-slate-600 dark:bg-slate-800/80 dark:text-white'

/** Ensure uploaded file has an extension Django/Pillow accepts. */
function normalizeBannerImageFile(file: File): File {
  const name = file.name?.trim() || ''
  if (/\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(name)) return file
  const mime = (file.type || '').toLowerCase()
  let ext = 'jpg'
  if (mime.includes('png')) ext = 'png'
  else if (mime.includes('webp')) ext = 'webp'
  else if (mime.includes('gif')) ext = 'gif'
  return new File([file], `banner-${Date.now()}.${ext}`, { type: file.type || 'image/jpeg' })
}

type Props = {
  rotateSeconds: number
  onRotateSecondsChange: (n: number) => void
}

export function MerchantStorefrontBannersSection({
  rotateSeconds,
  onRotateSecondsChange,
}: Props) {
  const { t } = useLocale()
  const [banners, setBanners] = useState<MerchantStorefrontBanner[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [linkType, setLinkType] = useState<StorefrontBannerLinkType>('none')
  const [linkUrl, setLinkUrl] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, cats] = await Promise.all([
        fetchMerchantStorefrontBanners(),
        apiJson<CategoryOption[] | { results: CategoryOption[] }>('/api/categories/', {
          shopScoped: true,
        }),
      ])
      setBanners(rows)
      const catList = Array.isArray(cats) ? cats : cats.results
      setCategories(catList)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function resetForm() {
    setTitle('')
    setSubtitle('')
    setLinkType('none')
    setLinkUrl('')
    setCategoryId('')
    setImageFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function onPickImage(file: File | null) {
    if (!file) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!imageFile) {
      setError(t('onlineShop.bannerImageRequired'))
      return
    }
    if (linkType === 'url' && !linkUrl.trim()) {
      setError(t('onlineShop.bannerUrlRequired'))
      return
    }
    if (linkType === 'category' && !categoryId) {
      setError(t('onlineShop.bannerCategoryRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const upload = normalizeBannerImageFile(imageFile)
      const form = new FormData()
      form.append('image', upload, upload.name)
      form.append('title', title.trim())
      form.append('subtitle', subtitle.trim())
      form.append('link_type', linkType)
      form.append('is_active', 'true')
      form.append('sort_order', String(banners.length))
      if (linkType === 'url') {
        let url = linkUrl.trim()
        if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
        form.append('link_url', url)
      }
      if (linkType === 'category' && categoryId) form.append('category', categoryId)
      await createMerchantStorefrontBanner(form)
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  async function moveBanner(id: number, dir: -1 | 1) {
    const idx = banners.findIndex((b) => b.id === id)
    const swap = idx + dir
    if (swap < 0 || swap >= banners.length) return
    const order = banners.map((b) => b.id)
    ;[order[idx], order[swap]] = [order[swap], order[idx]]
    setBusy(true)
    try {
      const rows = await reorderMerchantStorefrontBanners(order)
      setBanners(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  async function removeBanner(id: number) {
    if (!window.confirm(t('onlineShop.bannerDeleteConfirm'))) return
    setBusy(true)
    try {
      await deleteMerchantStorefrontBanner(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(b: MerchantStorefrontBanner) {
    const form = new FormData()
    form.append('is_active', b.is_active ? 'false' : 'true')
    setBusy(true)
    try {
      await updateMerchantStorefrontBanner(b.id, form)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
          <ImagePlus className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('onlineShop.bannersSection')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('onlineShop.bannersHint')}</p>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">
            {t('onlineShop.bannerRotate')}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={2}
              max={15}
              value={rotateSeconds}
              onChange={(e) => onRotateSecondsChange(Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-12 text-center text-sm font-mono font-semibold text-slate-700 dark:text-slate-200">
              {rotateSeconds}s
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : (
          <>
            {banners.length > 0 ? (
              <ul className="space-y-2">
                {banners.map((b, idx) => (
                  <li
                    key={b.id}
                    className={[
                      'flex items-center gap-3 rounded-xl border p-2.5',
                      b.is_active
                        ? 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/40'
                        : 'border-dashed border-slate-300 opacity-60',
                    ].join(' ')}
                  >
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                      {b.image_url ? (
                        <img src={b.image_url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {b.title || t('onlineShop.bannerUntitled')}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {b.link_type === 'category'
                          ? `${t('onlineShop.linkCategory')}: ${b.category_name || '—'}`
                          : b.link_type === 'url'
                            ? t('onlineShop.linkUrl')
                            : t('onlineShop.linkNone')}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={busy || idx === 0}
                        onClick={() => void moveBanner(b.id, -1)}
                        className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busy || idx === banners.length - 1}
                        onClick={() => void moveBanner(b.id, 1)}
                        className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleActive(b)}
                      className="rounded-lg px-2 py-1 text-[10px] font-semibold text-violet-600 hover:bg-violet-50"
                    >
                      {b.is_active ? t('onlineShop.bannerHide') : t('onlineShop.bannerShow')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeBanner(b.id)}
                      className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                      aria-label={t('onlineShop.bannerDeleteConfirm')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">{t('onlineShop.noBanners')}</p>
            )}

            <form onSubmit={(e) => void handleAdd(e)} className="space-y-3 rounded-xl border border-dashed border-violet-200 bg-violet-50/30 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
              <p className="text-xs font-bold text-violet-800 dark:text-violet-200">
                <Plus className="me-1 inline h-3.5 w-3.5" aria-hidden />
                {t('onlineShop.addBanner')}
              </p>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {t('onlineShop.bannerImage')} *
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white py-6 text-sm text-slate-600 hover:border-violet-400 dark:border-slate-600 dark:bg-slate-800"
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="" className="max-h-24 rounded-lg object-contain" />
                  ) : (
                    <>
                      <ImagePlus className="h-5 w-5" aria-hidden />
                      {t('onlineShop.bannerPickImage')}
                    </>
                  )}
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    {t('onlineShop.bannerTitle')}
                  </label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    {t('onlineShop.bannerSubtitle')}
                  </label>
                  <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {t('onlineShop.bannerLinkType')}
                </label>
                <select
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value as StorefrontBannerLinkType)}
                  className={inputClass}
                >
                  <option value="none">{t('onlineShop.linkNone')}</option>
                  <option value="category">{t('onlineShop.linkCategory')}</option>
                  <option value="url">{t('onlineShop.linkUrl')}</option>
                </select>
              </div>

              {linkType === 'url' ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">URL</label>
                  <input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    dir="ltr"
                    placeholder="https://"
                    className={inputClass}
                  />
                </div>
              ) : null}

              {linkType === 'category' ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    {t('onlineShop.pickCategory')}
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50 sm:w-auto sm:px-6"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t('onlineShop.addBanner')}
              </button>
            </form>
          </>
        )}

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        ) : null}
      </div>
    </section>
  )
}

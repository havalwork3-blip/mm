import { ImagePlus, Loader2, Plus, Save, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createProduct,
  createProductCategory,
  deleteProduct,
  deleteProductCategory,
  fetchProductCategories,
  fetchProducts,
  updateProduct,
  type LocalizedText,
  type MarketingProductCard,
  type MarketingProductCategory,
} from '../../lib/marketingApi'
import { LANG_LABELS, type Lang } from './marketingCmsConfig'

const PAGES = [
  { id: 'luxury', label: 'لوکس' },
  { id: 'tech', label: 'تەکنەلۆژیا' },
  { id: 'shop', label: 'شۆپ' },
  { id: 'services', label: 'خزمەتگوزاری' },
] as const

const TONES = ['violet', 'cyan', 'gold', 'indigo'] as const
const TAGS = ['', 'new', 'hot', 'premium', 'ai', 'mm', 'discount'] as const

type PageId = (typeof PAGES)[number]['id']

const emptyTitle = (): LocalizedText => ({ ckb: '', ar: '', en: '' })

export function MarketingProductsPage() {
  const [page, setPage] = useState<PageId>('luxury')
  const [products, setProducts] = useState<MarketingProductCard[]>([])
  const [categories, setCategories] = useState<MarketingProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<MarketingProductCard | 'new' | null>(null)
  const [form, setForm] = useState({
    title: emptyTitle(),
    tagKey: '',
    link_url: '',
    tone: 'violet' as string,
    category: '' as string,
    sort_order: 10,
    is_published: true,
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [catForm, setCatForm] = useState(emptyTitle())
  const [lang, setLang] = useState<Lang>('ckb')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [prods, cats] = await Promise.all([fetchProducts(page), fetchProductCategories(page)])
      setProducts(prods)
      setCategories(cats)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => products.filter((p) => p.page === page), [products, page])

  function openNew() {
    setEditing('new')
    setForm({
      title: emptyTitle(),
      tagKey: '',
      link_url: `/${page}/`,
      tone: 'violet',
      category: '',
      sort_order: (filtered.length + 1) * 10,
      is_published: true,
    })
    setImageFile(null)
    setPreview(null)
  }

  function openEdit(p: MarketingProductCard) {
    setEditing(p)
    setForm({
      title: { ...emptyTitle(), ...p.title },
      tagKey: p.tag?.key || '',
      link_url: p.link_url || `/${page}/`,
      tone: p.tone || 'violet',
      category: p.category_id ? String(p.category_id) : '',
      sort_order: p.sort_order,
      is_published: p.is_published,
    })
    setImageFile(null)
    setPreview(p.image_url)
  }

  async function saveProduct() {
    setBusy(true)
    try {
      const payload = {
        page,
        title: form.title,
        tag: form.tagKey ? { key: form.tagKey } : {},
        link_url: form.link_url,
        tone: form.tone,
        category: form.category ? Number(form.category) : null,
        sort_order: form.sort_order,
        is_published: form.is_published,
      }
      if (editing === 'new') {
        await createProduct(payload, imageFile)
      } else if (editing && editing !== 'new') {
        await updateProduct(editing.id, payload, imageFile)
      }
      setEditing(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function removeProduct(id: number) {
    if (!window.confirm('ئایا دەتەوێت ئەم کاڵایە بسڕیتەوە؟')) return
    setBusy(true)
    try {
      await deleteProduct(id)
      if (editing !== 'new' && editing && editing.id === id) setEditing(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function addCategory() {
    if (!catForm.ckb?.trim() && !catForm.en?.trim()) return
    setBusy(true)
    try {
      await createProductCategory({
        page,
        title: catForm,
        sort_order: (categories.length + 1) * 10,
        is_published: true,
      })
      setCatForm(emptyTitle())
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className={`flex-1 p-4 sm:p-6 lg:p-8 ${editing ? 'hidden lg:block' : ''}`}>
        <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">کاڵا و پۆستەکان</h1>
            <p className="text-sm text-slate-400">وێنە، دەق، کاتەگۆری — بۆ هەر پەڕەیەک</p>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 sm:w-auto"
          >
            <Plus className="h-4 w-4" /> کاڵای نوێ
          </button>
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 sm:mb-6 sm:flex-wrap">
          {PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPage(p.id)}
              className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium sm:px-4 ${
                page === p.id ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">کاتەگۆرییەکان</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300"
              >
                {c.title[lang] || c.title.ckb || c.title.en}
                <button
                  type="button"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => void deleteProductCategory(c.id).then(load)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(LANG_LABELS) as Lang[]).map((code) => (
              <input
                key={code}
                type="text"
                placeholder={`ناوی کاتەگۆری (${LANG_LABELS[code]})`}
                value={catForm[code] || ''}
                onChange={(e) => setCatForm({ ...catForm, [code]: e.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void addCategory()}
            className="mt-3 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            + کاتەگۆری زیاد بکە
          </button>
        </section>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <article
                key={p.id}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60"
              >
                <div
                  className={`aspect-square bg-gradient-to-br from-slate-800 to-slate-950 ${
                    p.image_url ? 'bg-cover bg-center' : ''
                  }`}
                  style={p.image_url ? { backgroundImage: `url(${p.image_url})` } : undefined}
                />
                <div className="p-4">
                  <p className="font-medium text-white">{p.title[lang] || p.title.ckb || p.title.en}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {p.is_published ? 'بڵاوکراوە' : 'شاردراوە'}
                    {p.tag?.key ? ` · ${p.tag.key}` : ''}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
                    >
                      دەستکاری
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeProduct(p.id)}
                      className="rounded-lg border border-red-900/50 px-3 py-1.5 text-xs text-red-300"
                    >
                      سڕینەوە
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <aside className="fixed inset-0 z-50 flex flex-col bg-[#0d1017] lg:static lg:inset-auto lg:z-auto lg:w-[420px] lg:border-r lg:border-t-0 lg:border-slate-800">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-800 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <h2 className="font-semibold text-white">{editing === 'new' ? 'کاڵای نوێ' : 'دەستکاری کاڵا'}</h2>
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-h-[calc(100dvh-4rem)]">
            <div>
              <label className="mb-2 block text-xs text-slate-400">وێنە</label>
              <div
                className="mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-700 bg-slate-950"
                style={preview ? { backgroundImage: `url(${preview})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
              >
                {!preview && <ImagePlus className="h-8 w-8 text-slate-600" />}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  setImageFile(f)
                  setPreview(f ? URL.createObjectURL(f) : (editing !== 'new' && editing ? editing.image_url : null))
                }}
                className="text-xs text-slate-400"
              />
            </div>

            {(Object.keys(LANG_LABELS) as Lang[]).map((code) => (
              <label key={code} className="block text-xs text-slate-400">
                ناو ({LANG_LABELS[code]})
                <input
                  type="text"
                  value={form.title[code] || ''}
                  onChange={(e) => setForm({ ...form, title: { ...form.title, [code]: e.target.value } })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
            ))}

            <label className="block text-xs text-slate-400">
              لینک
              <input
                type="text"
                value={form.link_url}
                onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                dir="ltr"
              />
            </label>

            <label className="block text-xs text-slate-400">
              کاتەگۆری
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="">بێ کاتەگۆری</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title[lang] || c.title.ckb}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-slate-400">
                تاگ
                <select
                  value={form.tagKey}
                  onChange={(e) => setForm({ ...form, tagKey: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  {TAGS.map((t) => (
                    <option key={t || 'none'} value={t}>
                      {t || '—'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-400">
                ڕەنگ (بێ وێنە)
                <select
                  value={form.tone}
                  onChange={(e) => setForm({ ...form, tone: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
              />
              بڵاوکراوە لە ماڵپەڕ
            </label>

            <button
              type="button"
              disabled={busy}
              onClick={() => void saveProduct()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {busy ? 'پاشەکەوت…' : 'پاشەکەوت'}
            </button>
          </div>
        </aside>
      )}
    </div>
  )
}

import { Eye, EyeOff, ImagePlus, Loader2, RefreshCw, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  importMarketingDefaults,
  fetchMarketingSiteAdmin,
  saveMarketingBrand,
  saveMarketingSite,
  type MarketingSiteContent,
} from '../../lib/marketingApi'
import { PAGE_SECTION_LABELS } from './marketingCmsConfig'

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export function MarketingSettingsPage() {
  const [content, setContent] = useState<MarketingSiteContent | null>(null)
  const [brandName, setBrandName] = useState('MM IRAQ')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [clearLogo, setClearLogo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const currentLogo = useMemo(() => {
    if (logoPreview) return logoPreview
    if (clearLogo) return '/logo-optimized.webp'
    return content?.brand_logo_url || '/logo-optimized.webp'
  }, [logoPreview, clearLogo, content?.brand_logo_url])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const site = await fetchMarketingSiteAdmin()
      setContent(site)
      setBrandName(site.brand_name || 'MM IRAQ')
      setLogoFile(null)
      setLogoPreview(null)
      setClearLogo(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSave() {
    if (!content) return
    setSaving(true)
    setMessage(null)
    try {
      let saved = await saveMarketingSite({
        translations: content.translations,
        sections: content.sections,
        is_published: content.is_published,
        brand_name: brandName.trim() || 'MM IRAQ',
      })
      if (logoFile || clearLogo) {
        saved = await saveMarketingBrand(brandName, logoFile, clearLogo)
      }
      setContent(saved)
      setBrandName(saved.brand_name || brandName)
      setLogoFile(null)
      setLogoPreview(null)
      setClearLogo(false)
      setMessage('ڕێکخستنەکان پاشەکەوت کران — لە mmiraq.com دەردەکەون.')
    } catch {
      setMessage('پاشەکەوتکردن سەرکەوتوو نەبوو.')
    } finally {
      setSaving(false)
    }
  }

  async function handleImport() {
    if (!window.confirm('ئایا دەتەوێت هەموو دەقەکان بگەڕێنیتەوە بۆ بنەڕەت؟')) return
    setSaving(true)
    try {
      setContent(await importMarketingDefaults())
      setMessage('بنەڕەتییەکان گەڕێندرانەوە.')
      await load()
    } finally {
      setSaving(false)
    }
  }

  function toggleSection(key: string) {
    if (!content) return
    const next = deepClone(content)
    const cur = next.sections[key] ?? { published: true }
    next.sections[key] = { ...cur, published: !cur.published }
    setContent(next)
  }

  if (loading || !content) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">ڕێکخستن</h1>
          <p className="text-sm text-slate-400">ناو، لۆگۆ، بڵاوکردنەوە، بەشەکان</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm hover:bg-slate-800 sm:w-auto"
          >
            <RefreshCw className="h-4 w-4" /> گەڕاندنەوەی بنەڕەت
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm text-white hover:bg-amber-500 sm:w-auto"
          >
            <Save className="h-4 w-4" /> {saving ? '…' : 'پاشەکەوت'}
          </button>
        </div>
      </div>

      {message && (
        <p className={`mb-4 rounded-xl px-4 py-3 text-sm ${message.includes('سەرکەوتوو نەبوو') ? 'bg-red-950/50 text-red-300' : 'bg-emerald-950/50 text-emerald-300'}`}>
          {message}
        </p>
      )}

      <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-white">
          <ImagePlus className="h-5 w-5 text-amber-400" />
          ناو و لۆگۆی ماڵپەڕ
        </h2>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-300">ناوی ماڵپەڕ / براند</label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
              placeholder="MM IRAQ"
            />
            <p className="mt-2 text-xs text-slate-500">لە header و footer دەردەکەوێت</p>
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">لۆگۆ</label>
            <div className="mb-3 flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 p-4">
              <img src={currentLogo} alt="" className="max-h-full max-w-full object-contain" />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] || null
                setLogoFile(f)
                setClearLogo(false)
                setLogoPreview(f ? URL.createObjectURL(f) : null)
              }}
              className="text-xs text-slate-400"
            />
            <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={clearLogo}
                onChange={(e) => {
                  setClearLogo(e.target.checked)
                  if (e.target.checked) {
                    setLogoFile(null)
                    setLogoPreview(null)
                  }
                }}
              />
              گەڕاندنەوە بۆ لۆگۆی بنەڕەتی
            </label>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <label className="flex cursor-pointer items-center gap-4">
          <input
            type="checkbox"
            checked={content.is_published}
            onChange={(e) => setContent({ ...content, is_published: e.target.checked })}
            className="h-5 w-5 rounded border-slate-600"
          />
          <div>
            <p className="font-medium text-white">بڵاوکردنەوە لە mmiraq.com</p>
            <p className="text-sm text-slate-400">کاتێک OFF ـە، ماڵپەڕ دەقی بنەڕەتی بەکاردەهێنێت</p>
          </div>
        </label>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-4 font-semibold text-white">بەشەکان — پیشاندان / شاردنەوە</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.keys(content.sections).map((key) => {
            const on = content.sections[key]?.published !== false
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleSection(key)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                  on
                    ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-100'
                    : 'border-slate-800 bg-slate-950/50 text-slate-500'
                }`}
              >
                <span>{PAGE_SECTION_LABELS[key] ?? key}</span>
                {on ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

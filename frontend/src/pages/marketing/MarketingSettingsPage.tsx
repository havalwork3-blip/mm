import { Eye, EyeOff, Loader2, RefreshCw, Save } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  importMarketingDefaults,
  fetchMarketingSiteAdmin,
  saveMarketingSite,
  type MarketingSiteContent,
} from '../../lib/marketingApi'
import { PAGE_SECTION_LABELS } from './marketingCmsConfig'

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export function MarketingSettingsPage() {
  const [content, setContent] = useState<MarketingSiteContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setContent(await fetchMarketingSiteAdmin())
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
    try {
      const saved = await saveMarketingSite(content)
      setContent(saved)
      setMessage('ڕێکخستنەکان پاشەکەوت کران.')
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
          <p className="text-sm text-slate-400">بڵاوکردنەوە و پیشاندانی بەشەکان</p>
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

      {message && <p className="mb-4 rounded-xl bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">{message}</p>}

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

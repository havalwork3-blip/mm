import { ChevronDown, ChevronRight, Loader2, RefreshCw, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchMarketingSiteAdmin,
  importMarketingDefaults,
  saveMarketingSite,
  type MarketingSiteContent,
} from '../../lib/marketingApi'

type Lang = 'ckb' | 'ar' | 'en'

const LANG_LABELS: Record<Lang, string> = {
  ckb: 'کوردی',
  ar: 'عەرەبی',
  en: 'English',
}

const SECTION_LABELS: Record<string, string> = {
  ui: 'ڕووکار',
  nav: 'ناڤیگەیشن',
  footer: 'فووتەر',
  search: 'گەڕان',
  cta: 'دوگمەکان',
  hero: 'بانێر',
  feat: 'تایبەتمەندییەکان',
  homeAbout: 'دەربارە (سەرەکی)',
  explore: 'گەڕان',
  showcase: 'کارتی گەڕان',
  tag: 'تاگی کاڵا',
  luxury: 'لوکس',
  tech: 'تەکنەلۆژیا',
  shop: 'شۆپ',
  services: 'خزمەتگوزاری',
  about: 'دەربارە',
  terms: 'مەرجەکان',
  contact: 'پەیوەندی',
  products: 'کاڵاکان',
  meta: 'SEO / Meta',
  sections: 'ناونیشانی بەشەکان',
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function setNested(obj: Record<string, unknown>, path: string[], value: string) {
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i]
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {}
    cur = cur[k] as Record<string, unknown>
  }
  cur[path[path.length - 1]] = value
}

function FieldTree({
  data,
  path,
  onChange,
}: {
  data: Record<string, unknown>
  path: string[]
  onChange: (path: string[], value: string) => void
}) {
  const [open, setOpen] = useState(path.length <= 1)
  const label = path[path.length - 1] ?? 'root'

  const entries = Object.entries(data)
  const isLeafGroup = entries.every(([, v]) => typeof v === 'string')

  if (isLeafGroup) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
        <button
          type="button"
          className="mb-2 flex w-full items-center gap-2 text-sm font-medium text-amber-400"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {SECTION_LABELS[label] ?? label}
        </button>
        {open && (
          <div className="space-y-2">
            {entries.map(([key, val]) => (
              <label key={key} className="block text-xs text-slate-400">
                <span className="font-mono text-slate-500">{key}</span>
                {typeof val === 'string' && val.includes('<span>') ? (
                  <textarea
                    rows={3}
                    value={val}
                    onChange={(e) => onChange([...path, key], e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
                    dir={path[0] === 'en' ? 'ltr' : 'auto'}
                  />
                ) : (
                  <input
                    type="text"
                    value={String(val ?? '')}
                    onChange={(e) => onChange([...path, key], e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
                    dir={path[0] === 'en' ? 'ltr' : 'auto'}
                  />
                )}
              </label>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, val]) => {
        if (typeof val === 'string') {
          return (
            <label key={key} className="block text-xs text-slate-400">
              <span className="font-mono text-slate-500">{key}</span>
              <input
                type="text"
                value={val}
                onChange={(e) => onChange([...path, key], e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
              />
            </label>
          )
        }
        if (typeof val === 'object' && val !== null) {
          return (
            <FieldTree
              key={key}
              data={val as Record<string, unknown>}
              path={[...path, key]}
              onChange={onChange}
            />
          )
        }
        return null
      })}
    </div>
  )
}

export function MarketingSiteEditorPage() {
  const [lang, setLang] = useState<Lang>('ckb')
  const [content, setContent] = useState<MarketingSiteContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMarketingSiteAdmin()
      setContent(data)
    } catch {
      setError('بارکردنی ناوەڕۆک سەرکەوتوو نەبوو.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const langData = useMemo(() => {
    if (!content?.translations?.[lang]) return {}
    return content.translations[lang] as Record<string, unknown>
  }, [content, lang])

  function handleFieldChange(path: string[], value: string) {
    if (!content) return
    const next = deepClone(content)
    if (!next.translations[lang]) next.translations[lang] = {}
    setNested(next.translations[lang] as Record<string, unknown>, path.slice(1), value)
    setContent(next)
  }

  async function handleSave() {
    if (!content) return
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const saved = await saveMarketingSite({
        translations: content.translations,
        sections: content.sections,
        is_published: content.is_published,
      })
      setContent(saved)
      setMessage('پاشەکەوت کرا — گۆڕانکارییەکان لە mmiraq.com دەردەکەون.')
    } catch {
      setError('پاشەکەوتکردن سەرکەوتوو نەبوو.')
    } finally {
      setSaving(false)
    }
  }

  async function handleImport() {
    if (!window.confirm('ئایا دەتەوێت هەموو دەقەکان بگەڕێنیتەوە بۆ بنەڕەتی فایلی ماڵپەڕ؟')) return
    setSaving(true)
    setError(null)
    try {
      const data = await importMarketingDefaults()
      setContent(data)
      setMessage('بنەڕەتییەکان گەڕێندرانەوە.')
    } catch {
      setError('گەڕاندنەوە سەرکەوتوو نەبوو.')
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

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!content) {
    return <p className="p-8 text-center text-red-400">{error ?? 'هەڵە'}</p>
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">دەق و بەشەکانی ماڵپەڕ</h1>
          <p className="text-sm text-slate-400">هەر ٣ زمان — کوردی، عەرەبی، ئینگلیزی</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={content.is_published}
              onChange={(e) => setContent({ ...content, is_published: e.target.checked })}
            />
            بڵاوکراوە لە mmiraq.com
          </label>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            گەڕاندنەوەی بنەڕەت
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? '…' : 'پاشەکەوت'}
          </button>
        </div>
      </div>

      {message && <p className="mb-4 rounded-lg bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">{message}</p>}
      {error && <p className="mb-4 rounded-lg bg-red-950/50 px-4 py-2 text-sm text-red-300">{error}</p>}

      <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-300">بەشە سەرەکییەکان — پیشاندان / شاردنەوە</h2>
        <div className="flex flex-wrap gap-2">
          {Object.keys(content.sections).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleSection(key)}
              className={`rounded-full px-3 py-1 text-xs ${
                content.sections[key]?.published !== false
                  ? 'bg-emerald-900/60 text-emerald-200 ring-1 ring-emerald-700'
                  : 'bg-slate-800 text-slate-500 ring-1 ring-slate-700'
              }`}
            >
              {SECTION_LABELS[key] ?? key}
            </button>
          ))}
        </div>
      </section>

      <div className="mb-4 flex gap-2">
        {(Object.keys(LANG_LABELS) as Lang[]).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              lang === code ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {LANG_LABELS[code]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <FieldTree data={langData} path={[lang]} onChange={handleFieldChange} />
      </div>

      {content.updated_at && (
        <p className="mt-8 text-center text-xs text-slate-500">
          دوایین نوێکردنەوە: {new Date(content.updated_at).toLocaleString()}
        </p>
      )}
    </main>
  )
}

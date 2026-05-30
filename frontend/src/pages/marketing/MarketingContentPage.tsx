import { Check, Loader2, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import {
  fetchMarketingSiteAdmin,
  saveMarketingSite,
  type MarketingSiteContent,
} from '../../lib/marketingApi'
import {
  CMS_SECTION_MAP,
  FIELD_LABELS,
  LANG_LABELS,
  type Lang,
} from './marketingCmsConfig'

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

function flattenFields(
  data: Record<string, unknown>,
  prefix: string[] = [],
): { path: string[]; key: string; value: string; isHtml: boolean }[] {
  const out: { path: string[]; key: string; value: string; isHtml: boolean }[] = []
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string') {
      out.push({
        path: [...prefix, key],
        key,
        value: val,
        isHtml: val.includes('<span>') || val.includes('<'),
      })
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      out.push(...flattenFields(val as Record<string, unknown>, [...prefix, key]))
    }
  }
  return out
}

export function MarketingContentPage() {
  const { section = '' } = useParams<{ section: string }>()
  const meta = CMS_SECTION_MAP[section]
  const [lang, setLang] = useState<Lang>('ckb')
  const [content, setContent] = useState<MarketingSiteContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setContent(await fetchMarketingSiteAdmin())
    } catch {
      setError('بارکردن سەرکەوتوو نەبوو.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const fields = useMemo(() => {
    if (!content || !meta) return []
    const block = content.translations?.[lang]?.[meta.key]
    if (!block || typeof block !== 'object') return []
    return flattenFields(block as Record<string, unknown>)
  }, [content, lang, meta])

  if (!meta) return <Navigate to="/site-cms" replace />

  function handleChange(path: string[], value: string) {
    if (!content || !meta) return
    const next = deepClone(content)
    if (!next.translations[lang]) next.translations[lang] = {}
    if (!next.translations[lang][meta.key]) next.translations[lang][meta.key] = {}
    setNested(next.translations[lang][meta.key] as Record<string, unknown>, path, value)
    setContent(next)
  }

  async function handleSave() {
    if (!content) return
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      await saveMarketingSite({
        translations: content.translations,
        sections: content.sections,
        is_published: content.is_published,
      })
      setMessage('پاشەکەوت کرا — لە mmiraq.com دەردەکەوێت.')
    } catch {
      setError('پاشەکەوتکردن سەرکەوتوو نەبوو.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-xs text-amber-400/90">دەستکاری ناوەڕۆک</p>
          <h1 className="text-xl font-bold text-white sm:text-2xl">{meta.label}</h1>
          <p className="mt-1 text-sm text-slate-400">هەر ٣ زمان جیا دەستکاری دەکرێت</p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60 sm:w-auto lg:sticky lg:top-4"
        >
          <Save className="h-4 w-4" />
          {saving ? 'پاشەکەوت…' : 'پاشەکەوت'}
        </button>
      </div>

      {message && (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">
          <Check className="h-4 w-4" /> {message}
        </p>
      )}
      {error && <p className="mb-4 rounded-xl bg-red-950/50 px-4 py-3 text-sm text-red-300">{error}</p>}

      <div className="mb-6 flex gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-1">
        {(Object.keys(LANG_LABELS) as Lang[]).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
              lang === code ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            {LANG_LABELS[code]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {fields.map((field) => {
          const label = FIELD_LABELS[field.key] ?? field.key
          const pathLabel = field.path.length > 1 ? field.path.join(' › ') : field.key
          return (
            <label
              key={field.path.join('.')}
              className="block rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <span className="block text-sm font-medium text-slate-200">{label}</span>
              <span className="mt-0.5 block font-mono text-[10px] text-slate-600">{pathLabel}</span>
              {field.isHtml || field.value.length > 80 ? (
                <textarea
                  rows={field.isHtml ? 4 : 3}
                  value={field.value}
                  onChange={(e) => handleChange(field.path, e.target.value)}
                  className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-amber-600 focus:outline-none"
                  dir={lang === 'en' ? 'ltr' : 'auto'}
                />
              ) : (
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => handleChange(field.path, e.target.value)}
                  className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-amber-600 focus:outline-none"
                  dir={lang === 'en' ? 'ltr' : 'auto'}
                />
              )}
            </label>
          )
        })}
      </div>

      {fields.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-700 py-12 text-center text-slate-500">
          هیچ خانەیەک بۆ ئەم بەشە نییە.
        </p>
      )}
    </div>
  )
}

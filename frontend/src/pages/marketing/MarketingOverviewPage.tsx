import { ExternalLink, Eye, EyeOff, Globe, Loader2, Mail, Save } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchContactStats,
  fetchMarketingSiteAdmin,
  saveMarketingSite,
  type MarketingSiteContent,
} from '../../lib/marketingApi'
import { CMS_NAV_GROUPS, PAGE_SECTION_LABELS } from './marketingCmsConfig'

export function MarketingOverviewPage() {
  const [content, setContent] = useState<MarketingSiteContent | null>(null)
  const [stats, setStats] = useState({ total: 0, unread: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [site, contact] = await Promise.all([fetchMarketingSiteAdmin(), fetchContactStats()])
      setContent(site)
      setStats(contact)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function togglePublished() {
    if (!content) return
    setSaving(true)
    try {
      const saved = await saveMarketingSite({ is_published: !content.is_published })
      setContent(saved)
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

  const sectionCount = content ? Object.keys(content.sections).length : 0
  const publishedCount = content
    ? Object.values(content.sections).filter((s) => s?.published !== false).length
    : 0

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold text-white sm:text-2xl">سەرەوەی داشبۆرد</h1>
        <p className="mt-1 text-sm text-slate-400">بەڕێوەبردنی mmiraq.com — کوردی، عەرەبی، ئینگلیزی</p>
      </div>

      <div className="mb-6 grid gap-3 sm:mb-8 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-amber-950/40 to-slate-900 p-5">
          <p className="text-xs text-amber-300/80">پەیامی نوێ</p>
          <p className="mt-2 text-3xl font-bold text-white">{stats.unread}</p>
          <Link to="/site-cms/inbox" className="mt-3 inline-flex items-center gap-1 text-sm text-amber-400 hover:underline">
            <Mail className="h-4 w-4" /> بینینی پەیامەکان
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <p className="text-xs text-slate-400">کۆی پەیام</p>
          <p className="mt-2 text-3xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <p className="text-xs text-slate-400">بەشە چالاکەکان</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {publishedCount}/{sectionCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <p className="text-xs text-slate-400">دۆخی ماڵپەڕ</p>
          <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
            {content?.is_published ? (
              <>
                <Eye className="h-5 w-5 text-emerald-400" /> بڵاوکراوە
              </>
            ) : (
              <>
                <EyeOff className="h-5 w-5 text-slate-500" /> نەبڵاوکراوە
              </>
            )}
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() => void togglePublished()}
            className="mt-3 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? '…' : content?.is_published ? 'وەستاندنی بڵاوکردنەوە' : 'بڵاوکردنەوە'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-white">
            <Globe className="h-5 w-5 text-amber-400" />
            دەستکاری خێرا
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {CMS_NAV_GROUPS[0].items.map((item) => (
              <Link
                key={item.id}
                to={`/site-cms/content/${item.id}`}
                className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200 transition hover:border-amber-700/50 hover:bg-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-4 font-semibold text-white">بەشە سەرەکییەکان</h2>
          <ul className="space-y-2">
            {content &&
              Object.entries(content.sections).map(([key, val]) => (
                <li
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm"
                >
                  <span className="text-slate-300">{PAGE_SECTION_LABELS[key] ?? key}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      val?.published !== false
                        ? 'bg-emerald-950 text-emerald-300'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {val?.published !== false ? 'چالاک' : 'شاردراوە'}
                  </span>
                </li>
              ))}
          </ul>
          <Link
            to="/site-cms/settings"
            className="mt-4 inline-flex items-center gap-1 text-sm text-amber-400 hover:underline"
          >
            <Save className="h-4 w-4" /> ڕێکخستنی بەشەکان
          </Link>
        </section>
      </div>

      <a
        href="https://mmiraq.com"
        target="_blank"
        rel="noreferrer"
        className="mt-8 inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-900"
      >
        <ExternalLink className="h-4 w-4" />
        بینینی ماڵپەڕ لە tab ـی نوێ
      </a>
    </div>
  )
}

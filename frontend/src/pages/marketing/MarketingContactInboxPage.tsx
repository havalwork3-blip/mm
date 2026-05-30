import {
  ArrowRight,
  Check,
  Loader2,
  Mail,
  MailOpen,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  deleteContactMessage,
  fetchContactMessages,
  fetchContactStats,
  patchContactMessage,
  type ContactMessageRow,
} from '../../lib/marketingApi'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ar-IQ', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function MarketingContactInboxPage() {
  const [messages, setMessages] = useState<ContactMessageRow[]>([])
  const [selected, setSelected] = useState<ContactMessageRow | null>(null)
  const [stats, setStats] = useState({ total: 0, unread: 0 })
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, st] = await Promise.all([
        fetchContactMessages(filter === 'unread'),
        fetchContactStats(),
      ])
      setMessages(rows)
      setStats(st)
      setSelected((cur) => {
        if (!cur) {
          if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
            return rows[0] ?? null
          }
          return null
        }
        return rows.find((r) => r.id === cur.id) ?? (window.matchMedia('(min-width: 1024px)').matches ? rows[0] ?? null : null)
      })
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  async function markRead(msg: ContactMessageRow, isRead: boolean) {
    setBusy(true)
    try {
      const updated = await patchContactMessage(msg.id, { is_read: isRead })
      setMessages((list) => list.map((m) => (m.id === updated.id ? updated : m)))
      setSelected(updated)
      setStats(await fetchContactStats())
    } finally {
      setBusy(false)
    }
  }

  async function remove(msg: ContactMessageRow) {
    if (!window.confirm('ئایا دەتەوێت ئەم پەیامە بسڕیتەوە؟')) return
    setBusy(true)
    try {
      await deleteContactMessage(msg.id)
      setMessages((list) => list.filter((m) => m.id !== msg.id))
      setSelected(null)
      setStats(await fetchContactStats())
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside
        className={`w-full shrink-0 border-b border-slate-800 lg:w-96 lg:border-b-0 lg:border-l ${
          selected ? 'hidden lg:block' : 'block'
        }`}
      >
        <div className="border-b border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-lg font-bold text-white">
              <Mail className="h-5 w-5 text-amber-400" />
              پەیامەکان
            </h1>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              title="نوێکردنەوە"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {stats.unread} نوێ · {stats.total} کۆی گشتی
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-lg px-3 py-1.5 text-xs ${filter === 'all' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              هەموو
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`rounded-lg px-3 py-1.5 text-xs ${filter === 'unread' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              نەخوێندراوە
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain lg:max-h-[calc(100dvh-12rem)]">
          {loading && messages.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : messages.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">هیچ پەیامێک نییە.</p>
          ) : (
            messages.map((msg) => (
              <button
                key={msg.id}
                type="button"
                onClick={() => {
                  setSelected(msg)
                  if (!msg.is_read) void markRead(msg, true)
                }}
                className={`block w-full border-b border-slate-800/80 px-4 py-4 text-right transition hover:bg-slate-900/80 ${
                  selected?.id === msg.id ? 'bg-amber-950/30' : ''
                } ${!msg.is_read ? 'border-r-2 border-r-amber-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`truncate text-sm ${msg.is_read ? 'text-slate-300' : 'font-semibold text-white'}`}>
                    {msg.name}
                  </p>
                  {!msg.is_read && (
                    <span className="shrink-0 rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] text-white">
                      نوێ
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">{msg.email}</p>
                <p className="mt-2 line-clamp-2 text-xs text-slate-400">{msg.message}</p>
                <p className="mt-2 text-[10px] text-slate-600">{formatDate(msg.created_at)}</p>
              </button>
            ))
          )}
        </div>
      </aside>

      <main
        className={`min-h-0 flex-1 flex-col ${!selected ? 'hidden lg:flex' : 'flex'}`}
      >
        {!selected ? (
          <div className="hidden flex-1 flex-col items-center justify-center p-8 text-slate-500 lg:flex">
            <MailOpen className="mb-4 h-12 w-12 opacity-40" />
            <p>پەیامێک هەڵبژێرە بۆ بینین</p>
          </div>
        ) : (
          <>
            <div className="border-b border-slate-800 p-4 sm:p-6">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="mb-3 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-amber-400 hover:bg-slate-800 lg:hidden"
              >
                <ArrowRight className="h-4 w-4" />
                گەڕانەوە بۆ لیست
              </button>
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                  <a
                    href={`mailto:${selected.email}`}
                    className="mt-1 block text-sm text-amber-400 hover:underline"
                    dir="ltr"
                  >
                    {selected.email}
                  </a>
                  <p className="mt-2 text-xs text-slate-500">{formatDate(selected.created_at)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!selected.is_read ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void markRead(selected, true)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-900/50 px-3 py-2 text-xs text-emerald-200"
                    >
                      <Check className="h-3.5 w-3.5" /> خوێندراوە
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void markRead(selected, false)}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400"
                    >
                      نەخوێندراوە
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(selected)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-900/50 px-3 py-2 text-xs text-red-300 hover:bg-red-950/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> سڕینەوە
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{selected.message}</p>
              </div>
              <a
                href={`mailto:${selected.email}?subject=Re: MM IRAQ`}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm text-white hover:bg-amber-500"
              >
                <Mail className="h-4 w-4" />
                وەڵامدانەوە بە ئیمەیڵ
              </a>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

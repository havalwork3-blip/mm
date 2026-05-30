import type { FormEvent } from 'react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { isMarketingAuthError, marketingLogin } from '../../lib/marketingApi'
import { useMarketingSession } from '../../context/MarketingSessionContext'

export function MarketingLoginPage() {
  const { editor, loading, refresh } = useMarketingSession()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && editor) {
    return <Navigate to="/site-cms" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await marketingLogin(email.trim(), password)
      await refresh()
      navigate('/site-cms', { replace: true })
    } catch (err) {
      setError(isMarketingAuthError(err) ? 'ئیمەیڵ یان پاسۆرد هەڵەیە.' : 'چوونەژوورەوە سەرکەوتوو نەبوو.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <img src="/brand-logo.png" alt="" className="h-11 w-11 rounded-lg object-contain" />
          <div>
            <p className="font-semibold text-white">MM IRAQ — Site CMS</p>
            <p className="text-xs text-slate-400">چوونەژوورەوەی تایبەت بۆ بەڕێوەبردنی mmiraq.com</p>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-lg px-4 py-12">
        <p className="mb-6 text-sm leading-relaxed text-slate-400">
          ئەم چوونەژوورەوەیە جیاوازە لە سیستەمی POS و فرۆشگا. تەنها بۆ دەستکاری ماڵپەڕی سەرەکی
          mmiraq.com بەکاردێت.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <label className="block text-sm text-slate-300">
            ئیمەیڵ
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
              autoComplete="email"
              dir="ltr"
            />
          </label>
          <label className="block text-sm text-slate-300">
            پاسۆرد
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
              autoComplete="current-password"
              dir="ltr"
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-amber-600 py-2.5 font-medium text-white hover:bg-amber-500 disabled:opacity-60"
          >
            {busy ? '…' : 'چوونەژوورەوە'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">
          POS / فرۆشگا؟{' '}
          <a href="/" className="text-amber-500 underline">
            بچۆ بۆ داشبۆردی سەرەکی
          </a>
        </p>
      </main>
    </div>
  )
}

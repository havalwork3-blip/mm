import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { Download, History, Lock, Pencil, Printer, Unlock } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageAuthLoading } from '../components/PageAuthLoading'
import { useLocale } from '../context/LocaleContext'
import { useSubmitLock } from '../hooks/useSubmitLock'
import { useSyncedSession } from '../hooks/useSyncedSession'
import { useResyncLocalMe } from '../hooks/useResyncLocalMe'
import { apiJson } from '../lib/api'
import { hasPerm } from '../lib/permissions'
import type { CurrencyRow, EmployeeDebtRow, ShopUserRow, SummaryEmployee } from '../types/api'

function normalizeMoneyInput(s: string) {
  return s.replace(/[\s,،\u066C]/g, '').trim()
}

function parseDec(s: string): number {
  const n = parseFloat(normalizeMoneyInput(s).replace(/٫/g, '.'))
  return Number.isNaN(n) ? 0 : n
}

function roleLabel(t: (k: string) => string, role: string) {
  const k = `role.${role}`
  const s = t(k)
  return s === k ? role : s
}

function debtTypeLabel(t: (k: string) => string, debtType: string) {
  if (debtType === 'returned') return t('debts.returned')
  if (debtType === 'taken') return t('debts.taken')
  return debtType
}

function escapeHtml(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripAnyParens(label: string): string {
  return label
    .replace(/\s*[\(\（][^)\）]*[\)\）]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatMoneyCompact(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0'
  const n = Number(String(value).replace(/,/g, '').trim())
  if (!Number.isFinite(n)) return String(value ?? '')
  return n.toFixed(2).replace(/\.?0+$/, '')
}

function BackHomeLink({ label }: { label: string }) {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1 text-sm text-violet-600 hover:underline"
    >
      <span className="inline-block rtl:rotate-180" aria-hidden>
        ←
      </span>
      {label}
    </Link>
  )
}

export function DebtsPage() {
  const { t } = useLocale()
  const { me, authPending, showLogin, login } = useSyncedSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [rows, setRows] = useState<EmployeeDebtRow[]>([])
  const [summary, setSummary] = useState<SummaryEmployee[]>([])
  const [employees, setEmployees] = useState<ShopUserRow[]>([])
  const [rate, setRate] = useState<number | null>(null)
  const [amountUsd, setAmountUsd] = useState('')
  const [amountIqd, setAmountIqd] = useState('')
  const [paymentUsdLinked, setPaymentUsdLinked] = useState(true)
  const [paymentIqdLinked, setPaymentIqdLinked] = useState(true)
  const [debtType, setDebtType] = useState<'taken' | 'returned'>('taken')
  const [employeeId, setEmployeeId] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [debtEditOpen, setDebtEditOpen] = useState(false)
  const [debtEditSaving, setDebtEditSaving] = useState(false)
  const { isSubmitting: addingDebt, runLocked: runAddDebt } = useSubmitLock()
  const [debtEditError, setDebtEditError] = useState<string | null>(null)
  const [debtEditRow, setDebtEditRow] = useState<EmployeeDebtRow | null>(null)
  const [debtEditOccurredOn, setDebtEditOccurredOn] = useState('')
  const [debtEditAmount, setDebtEditAmount] = useState('')
  const [debtEditType, setDebtEditType] = useState<'taken' | 'returned'>('taken')
  const [debtEditNote, setDebtEditNote] = useState('')

  const buildDebtsHistoryPdfDoc = useCallback(async (): Promise<jsPDF> => {
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-100000px'
    container.style.top = '0'
    container.style.width = '1300px'
    container.style.background = '#ffffff'
    container.style.color = '#0f172a'
    container.style.fontFamily = '"Noto Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif'
    container.style.padding = '16px'
    const rowsHtml = rows
      .map(
        (r) => `<tr>
      <td>${escapeHtml(r.occurred_on)}</td>
      <td>${escapeHtml(r.employee_email)}</td>
      <td>${escapeHtml(debtTypeLabel(t, r.debt_type))}</td>
      <td>${escapeHtml(formatMoneyCompact(r.amount))}</td>
    </tr>`,
      )
      .join('')
    container.innerHTML = `
      <style>
        .sheet { border: 1px solid #dbe2ea; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(2,6,23,.08); }
        .head { padding: 14px 16px; background: linear-gradient(180deg,#f8fafc,#f1f5f9); border-bottom: 1px solid #e2e8f0; }
        h2 { margin: 0; font-size: 18px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
        th, td { border: 1px solid #dbe2ea; padding: 8px 9px; text-align: center; vertical-align: middle; }
        thead th { background: #0ea5a4; color: #fff; font-weight: 700; }
      </style>
      <div class="sheet">
        <div class="head">
          <h2>${escapeHtml(t('debts.recentEntries'))}</h2>
        </div>
        <table>
          <thead><tr>
            <th>${escapeHtml(t('debts.date'))}</th>
            <th>${escapeHtml(t('debts.employee'))}</th>
            <th>${escapeHtml(t('debts.type'))}</th>
            <th>${escapeHtml(stripAnyParens(t('debts.amountUsd')) + ' USD')}</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `
    document.body.appendChild(container)
    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
            if (!el.textContent?.includes('.sheet {')) el.remove()
          })
        },
      })
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const margin = 20
      const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2
      const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2
      const sourcePageHeight = Math.floor((canvas.width * pageHeight) / pageWidth)
      let offsetY = 0
      let pageNo = 1
      while (offsetY < canvas.height) {
        const sliceHeight = Math.min(sourcePageHeight, canvas.height - offsetY)
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvas.width
        pageCanvas.height = sliceHeight
        const ctx = pageCanvas.getContext('2d')
        if (ctx) ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
        const img = pageCanvas.toDataURL('image/png')
        const renderedHeight = (sliceHeight * pageWidth) / canvas.width
        if (pageNo > 1) pdf.addPage()
        pdf.addImage(img, 'PNG', margin, margin, pageWidth, renderedHeight)
        offsetY += sliceHeight
        pageNo += 1
      }
      return pdf
    } finally {
      document.body.removeChild(container)
    }
  }, [rows, t])

  const downloadDebtsHistoryPdf = useCallback(async () => {
    const pdf = await buildDebtsHistoryPdfDoc()
    pdf.save(`employee-debt-history-${new Date().toISOString().slice(0, 10)}.pdf`)
  }, [buildDebtsHistoryPdfDoc])

  const printDebtsHistory = useCallback(async () => {
    const w = window.open('', '_blank')
    if (!w) return
    try {
      const pdf = await buildDebtsHistoryPdfDoc()
      const url = URL.createObjectURL(pdf.output('blob'))
      w.location.href = url
      window.setTimeout(() => {
        w.focus()
        w.print()
        window.setTimeout(() => URL.revokeObjectURL(url), 5000)
      }, 900)
    } catch {
      w.close()
    }
  }, [buildDebtsHistoryPdfDoc])
  const loadData = useCallback(async () => {
    if (!me) return
    try {
      const d = await apiJson<EmployeeDebtRow[] | { results: EmployeeDebtRow[] }>(
        '/api/employee-debts/',
      )
      setRows(Array.isArray(d) ? d : d.results)
      const s = await apiJson<{ employees: SummaryEmployee[] }>(
        '/api/employee-debts/summary/',
      )
      setSummary(s.employees)

      const users = await apiJson<ShopUserRow[] | { results: ShopUserRow[] }>('/api/users/')
      const list = Array.isArray(users) ? users : users.results
      setEmployees(list.filter((u) => u.role === 'employee'))

      try {
        const currencies = await apiJson<CurrencyRow[]>('/api/currencies/')
        const sorted = [...currencies].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        )
        const latest = sorted[0]
        setRate(latest ? parseFloat(latest.usd_to_iqd) : null)
      } catch {
        setRate(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }, [me, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useResyncLocalMe(loadData)

  const onAmountUsdChange = useCallback(
    (raw: string) => {
      setAmountUsd(raw)
      if (!paymentUsdLinked || rate === null || rate <= 0) return
      const cleaned = normalizeMoneyInput(raw)
      if (!cleaned) {
        setAmountIqd('')
        return
      }
      const usd = parseFloat(cleaned)
      if (Number.isNaN(usd) || usd <= 0) {
        setAmountIqd('')
        return
      }
      setAmountIqd(String(Math.round(usd * rate)))
    },
    [rate, paymentUsdLinked],
  )

  const onAmountIqdChange = useCallback(
    (raw: string) => {
      setAmountIqd(raw)
      if (!paymentIqdLinked || rate === null || rate <= 0) return
      const cleaned = normalizeMoneyInput(raw)
      if (!cleaned) {
        setAmountUsd('')
        return
      }
      const iqd = parseFloat(cleaned)
      if (Number.isNaN(iqd) || iqd <= 0) {
        setAmountUsd('')
        return
      }
      setAmountUsd(formatMoneyCompact(iqd / rate))
    },
    [rate, paymentIqdLinked],
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(null)
    try {
      await login(email, password)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : t('common.loginFailed'))
    }
  }

  async function addDebt(e: React.FormEvent) {
    e.preventDefault()
    await runAddDebt(async () => {
      setError(null)
      let usdVal = parseDec(normalizeMoneyInput(amountUsd))
      if (usdVal <= 0 && rate !== null && rate > 0) {
        const iqdVal = parseDec(normalizeMoneyInput(amountIqd))
        if (iqdVal > 0) usdVal = iqdVal / rate
      }
      if (usdVal <= 0) {
        setError(t('debts.enterValidAmount'))
        return
      }
      try {
        await apiJson('/api/employee-debts/', {
          method: 'POST',
          body: JSON.stringify({
            employee: employeeId,
            amount: usdVal.toFixed(4),
            debt_type: debtType,
            occurred_on: date,
            note,
          }),
        })
        setAmountUsd('')
        setAmountIqd('')
        setNote('')
        await loadData()
      } catch (err) {
        setError(err instanceof Error ? err.message : t('common.error'))
      }
    })
  }

  const canUseDebts = Boolean(me && hasPerm(me, 'view_employeedebt'))
  const canChangeEmployeeDebt = Boolean(me && hasPerm(me, 'change_employeedebt'))

  function closeDebtEdit() {
    setDebtEditOpen(false)
    setDebtEditSaving(false)
    setDebtEditError(null)
    setDebtEditRow(null)
    setDebtEditOccurredOn('')
    setDebtEditAmount('')
    setDebtEditType('taken')
    setDebtEditNote('')
  }

  function openDebtEdit(r: EmployeeDebtRow) {
    setDebtEditError(null)
    setDebtEditRow(r)
    setDebtEditOccurredOn(String(r.occurred_on ?? '').slice(0, 10))
    setDebtEditAmount(formatMoneyCompact(r.amount))
    setDebtEditType(r.debt_type === 'returned' ? 'returned' : 'taken')
    setDebtEditNote(String(r.note ?? ''))
    setDebtEditOpen(true)
  }

  async function saveDebtEdit() {
    if (!debtEditRow) return
    const d = debtEditOccurredOn.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setDebtEditError(t('inv.historyEditInvalidDate'))
      return
    }
    const amt = parseDec(debtEditAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setDebtEditError(t('debts.enterValidAmount'))
      return
    }
    setDebtEditSaving(true)
    setDebtEditError(null)
    try {
      await apiJson(`/api/employee-debts/${debtEditRow.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          occurred_on: d,
          amount: amt.toFixed(4),
          debt_type: debtEditType,
          note: debtEditNote.trim(),
        }),
      })
      closeDebtEdit()
      await loadData()
    } catch (err) {
      setDebtEditError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setDebtEditSaving(false)
    }
  }

  if (authPending) {
    return <PageAuthLoading />
  }

  if (showLogin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-start">
        <BackHomeLink label={t('nav.home')} />
        <h1 className="mt-4 text-xl font-semibold">{t('debts.title')}</h1>
        <form onSubmit={handleLogin} className="mt-6 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2"
            placeholder={t('pos.emailPlaceholder')}
            autoComplete="email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2"
            placeholder={t('pos.passwordPlaceholder')}
            autoComplete="current-password"
            required
          />
          {loginError && <p className="text-sm text-red-600">{loginError}</p>}
          <button type="submit" className="w-full rounded bg-violet-600 py-2 text-white">
            {t('dash.signIn')}
          </button>
        </form>
      </div>
    )
  }

  if (!canUseDebts) {
    return (
      <div className="p-8 text-start">
        <p className="text-red-600">{t('settings.ownerOnly')}</p>
        <Link to="/" className="text-violet-600">
          {t('nav.home')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-start">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t('debts.title')}</h1>
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <History className="h-4 w-4" aria-hidden />
          {t('debts.recentEntries')}
        </button>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('debts.remainingDebt')}</h2>
        <div className="mt-3 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[16rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 ps-0 pe-2 text-start font-medium">
                  {t('debts.employee')}
                </th>
                <th className="py-2 ps-2 pe-0 text-end font-medium">
                  {t('debts.amountUsd')}
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.employee_id} className="border-b border-slate-100">
                  <td className="py-2 ps-0 pe-2">{s.email}</td>
                  <td className="py-2 ps-2 pe-0 text-end font-mono">
                    {formatMoneyCompact(s.remaining_debt_usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {summary.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t('debts.noneOutstanding')}</p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('debts.addEntry')}</h2>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <form onSubmit={addDebt} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-slate-700 sm:col-span-2 dark:text-slate-300">
            <span className="font-medium">{t('debts.employee')}</span>
            <select
              value={employeeId === '' ? '' : String(employeeId)}
              onChange={(e) =>
                setEmployeeId(e.target.value ? Number(e.target.value) : '')
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              required
            >
              <option value="">{t('debts.selectEmployee')}</option>
              {employees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email} ({roleLabel(t, u.role)})
                </option>
              ))}
            </select>
          </label>

          {rate !== null && rate > 0 && !Number.isNaN(rate) ? (
            <p
              className="text-xs font-medium tabular-nums text-slate-500 sm:col-span-2 dark:text-slate-400"
              role="status"
            >
              {t('pos.paymentRateLine').replace(
                '{iqd100}',
                Math.round(rate * 100).toLocaleString(),
              )}
            </p>
          ) : (
            <p className="text-xs text-amber-800 sm:col-span-2 dark:text-amber-200">
              {t('pos.setRateBeforeCheckout')}
            </p>
          )}

          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="debts-usd"
                  className="text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  {stripAnyParens(t('pos.amountReceivedUsd'))} USD
                </label>
                {rate !== null && rate > 0 && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setPaymentUsdLinked((v) => !v)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-violet-500 dark:hover:bg-slate-800 dark:hover:text-violet-300"
                    aria-pressed={paymentUsdLinked}
                    title={
                      paymentUsdLinked
                        ? t('pos.usdLinkActiveTitle')
                        : t('pos.usdLinkInactiveTitle')
                    }
                    aria-label={
                      paymentUsdLinked
                        ? t('pos.usdLinkActiveTitle')
                        : t('pos.usdLinkInactiveTitle')
                    }
                  >
                    {paymentUsdLinked ? (
                      <Lock className="h-4 w-4" aria-hidden />
                    ) : (
                      <Unlock className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                )}
              </div>
              <input
                id="debts-usd"
                value={amountUsd}
                onChange={(e) => onAmountUsdChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-start tabular-nums dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                inputMode="decimal"
                placeholder="0"
                required={rate === null || rate <= 0}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="debts-iqd"
                  className="text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  {t('pos.amountReceivedIqd')}
                </label>
                {rate !== null && rate > 0 && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setPaymentIqdLinked((v) => !v)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-violet-500 dark:hover:bg-slate-800 dark:hover:text-violet-300"
                    aria-pressed={paymentIqdLinked}
                    title={
                      paymentIqdLinked
                        ? t('pos.iqdLinkActiveTitle')
                        : t('pos.iqdLinkInactiveTitle')
                    }
                    aria-label={
                      paymentIqdLinked
                        ? t('pos.iqdLinkActiveTitle')
                        : t('pos.iqdLinkInactiveTitle')
                    }
                  >
                    {paymentIqdLinked ? (
                      <Lock className="h-4 w-4" aria-hidden />
                    ) : (
                      <Unlock className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                )}
              </div>
              <input
                id="debts-iqd"
                value={amountIqd}
                onChange={(e) => onAmountIqdChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-start tabular-nums dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                inputMode="numeric"
                placeholder="0"
                required={false}
                disabled={rate === null || rate <= 0}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 text-sm text-slate-700 sm:col-span-2">
            <label className="flex flex-col gap-1">
              <span className="font-medium">{t('debts.type')}</span>
              <select
                value={debtType}
                onChange={(e) => setDebtType(e.target.value as 'taken' | 'returned')}
                className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="taken">{t('debts.taken')}</option>
                <option value="returned">{t('debts.returned')}</option>
              </select>
            </label>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {t('debts.typeHint')}
            </p>
          </div>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium">{t('debts.date')}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700 sm:col-span-2">
            <span className="font-medium">{t('debts.note')}</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('debts.note')}
              className="rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <button
            type="submit"
            disabled={addingDebt}
            className="sm:col-span-2 rounded-lg bg-violet-600 py-2.5 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {addingDebt ? t('pos.saving') : t('debts.save')}
          </button>
        </form>
      </section>

      {historyOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-4 sm:items-center lg:pr-64"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistoryOpen(false)
          }}
        >
          <div
            className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-debt-history-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2
                id="employee-debt-history-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                {t('debts.recentEntries')}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void printDebtsHistory()}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Printer className="h-4 w-4" aria-hidden />
                  {t('companiesPage.print')}
                </button>
                <button
                  type="button"
                  onClick={() => void downloadDebtsHistoryPdf()}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {t('companiesPage.downloadPdf')}
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:text-slate-200"
                >
                  {t('crud.cancel')}
                </button>
              </div>
            </div>
            {rows.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">{t('crud.noRows')}</p>
            ) : (
              <div className="max-h-[65dvh] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">{t('debts.date')}</th>
                      <th className="px-3 py-2 text-start font-medium">{t('debts.employee')}</th>
                      <th className="px-3 py-2 text-start font-medium">{t('debts.type')}</th>
                      <th className="px-3 py-2 text-end font-medium">
                        {stripAnyParens(t('debts.amountUsd'))} USD
                      </th>
                      {canChangeEmployeeDebt ? (
                        <th className="sticky end-0 z-10 min-w-[3rem] bg-slate-50 px-2 py-2 text-center font-medium shadow-[-6px_0_8px_-4px_rgba(15,23,42,0.15)] dark:bg-slate-800/95 dark:shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.35)]">
                          {t('purchasePage.colActions')}
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="px-3 py-2">{r.occurred_on}</td>
                        <td className="px-3 py-2">{r.employee_email}</td>
                        <td className="px-3 py-2">{debtTypeLabel(t, r.debt_type)}</td>
                        <td className="px-3 py-2 text-end font-mono">
                          {formatMoneyCompact(r.amount)}
                        </td>
                        {canChangeEmployeeDebt ? (
                          <td className="sticky end-0 z-10 border-s border-slate-100 bg-white px-2 py-2 text-center align-middle shadow-[-6px_0_8px_-4px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.35)]">
                            <button
                              type="button"
                              onClick={() => openDebtEdit(r)}
                              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                              title={t('purchasePage.editHistoryRow')}
                              aria-label={t('purchasePage.editHistoryRow')}
                            >
                              <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {debtEditOpen && debtEditRow ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-4 sm:items-center lg:pr-64"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !debtEditSaving) closeDebtEdit()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-debt-edit-title"
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="employee-debt-edit-title"
              className="text-start text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {t('debts.editHistoryTitle')}
            </h3>
            <p className="mt-2 text-start text-xs text-slate-500 dark:text-slate-400">
              {t('debts.editHistoryHint')}
            </p>
            {debtEditError ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {debtEditError}
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-3 text-start">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('debts.date')}
                </span>
                <input
                  type="date"
                  value={debtEditOccurredOn}
                  onChange={(e) => setDebtEditOccurredOn(e.target.value)}
                  disabled={debtEditSaving}
                  className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {stripAnyParens(t('debts.amountUsd'))} USD
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={debtEditAmount}
                  onChange={(e) => setDebtEditAmount(e.target.value)}
                  disabled={debtEditSaving}
                  className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('debts.type')}
                </span>
                <select
                  value={debtEditType}
                  onChange={(e) => setDebtEditType(e.target.value === 'returned' ? 'returned' : 'taken')}
                  disabled={debtEditSaving}
                  className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="taken">{t('debts.taken')}</option>
                  <option value="returned">{t('debts.returned')}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('debts.note')}
                </span>
                <input
                  type="text"
                  value={debtEditNote}
                  onChange={(e) => setDebtEditNote(e.target.value)}
                  disabled={debtEditSaving}
                  placeholder={t('debts.note')}
                  className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={debtEditSaving}
                onClick={closeDebtEdit}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
              >
                {t('crud.cancel')}
              </button>
              <button
                type="button"
                disabled={debtEditSaving}
                onClick={() => void saveDebtEdit()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {debtEditSaving ? t('pos.saving') : t('crud.save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

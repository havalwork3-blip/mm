import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { ArrowLeft, Download, Pencil, Printer, Wallet } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocale } from '../context/LocaleContext'
import { useSession } from '../context/SessionContext'
import { apiJson, isApiStatus } from '../lib/api'
import { hasPerm } from '../lib/permissions'

type ArchiveRow = {
  company_id: number
  company_name: string
  purchase_count: number
  total_goods_value_usd: string
  outstanding_usd: string
}

type PaySupplierResponse = {
  applied_usd_eq: string
  overpaid_usd_eq: string
  outstanding_usd_after: string
}

type SupplierPaymentHistoryRow = {
  kind: 'purchase_payment'
  id: number
  occurred_on: string
  occurred_at: string | null
  amount_usd: string
  direction: 'in' | 'out' | 'balance'
  label: string
}

function asList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results
}

function normalizeMoneyInput(s: string) {
  return s.replace(/[\s,،\u066C]/g, '').trim()
}

function escapeHtml(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatMoneyCompact(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0'
  const n = Number(String(value).replace(/,/g, '').trim())
  if (!Number.isFinite(n)) return String(value)
  return n.toFixed(2).replace(/\.?0+$/, '')
}

function formatDateTimeCell(value: string | null | undefined): string {
  if (!value) return '—'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return String(value)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  const hh = String(dt.getHours()).padStart(2, '0')
  const mm = String(dt.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toDatetimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function parseDec(s: string): number {
  const n = parseFloat(normalizeMoneyInput(s))
  return Number.isNaN(n) ? 0 : n
}

export function CompanyDebtsPage() {
  const { t, lang } = useLocale()
  const { me, loading: sessionLoading } = useSession()
  const [rows, setRows] = useState<ArchiveRow[]>([])
  const [supplierQuery, setSupplierQuery] = useState('')
  const [supplierFilterOpen, setSupplierFilterOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [iqdPerUsdRounded, setIqdPerUsdRounded] = useState<string | null>(null)

  const [payFor, setPayFor] = useState<{ id: number; name: string } | null>(null)
  const [payUsd, setPayUsd] = useState('')
  const [payIqd, setPayIqd] = useState('')
  const [submittingPay, setSubmittingPay] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyRows, setHistoryRows] = useState<SupplierPaymentHistoryRow[]>([])
  const [localHistoryRows, setLocalHistoryRows] = useState<SupplierPaymentHistoryRow[]>(
    [],
  )
  const [historySupplierQuery, setHistorySupplierQuery] = useState('')
  const [historySupplierOpen, setHistorySupplierOpen] = useState(false)

  const [ledgerEditOpen, setLedgerEditOpen] = useState(false)
  const [ledgerEditSaving, setLedgerEditSaving] = useState(false)
  const [ledgerEditError, setLedgerEditError] = useState<string | null>(null)
  const [ledgerEditId, setLedgerEditId] = useState<number | null>(null)
  const [ledgerEditLabel, setLedgerEditLabel] = useState('')
  const [ledgerEditOccurredAt, setLedgerEditOccurredAt] = useState('')
  const [ledgerEditAmountUsd, setLedgerEditAmountUsd] = useState('')

  const canView = Boolean(me && hasPerm(me, 'view_purchase'))
  const canPay = Boolean(me && hasPerm(me, 'add_purchase'))
  const canEditLedgerPayment = Boolean(me && hasPerm(me, 'change_purchase', 'change_product'))

  const groupedRows = useMemo(
    () => [...rows].sort((a, b) => a.company_name.localeCompare(b.company_name)),
    [rows],
  )

  const supplierNames = Array.from(new Set(groupedRows.map((r) => r.company_name).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )
  const filteredSupplierNames = supplierQuery.trim()
    ? supplierNames.filter((name) => name.toLowerCase().includes(supplierQuery.trim().toLowerCase()))
    : supplierNames
  const filteredRows = supplierQuery.trim()
    ? groupedRows.filter((r) => r.company_name.toLowerCase().includes(supplierQuery.trim().toLowerCase()))
    : groupedRows
  const totalOutstandingUsd = filteredRows.reduce(
    (sum, r) => sum + (Number.parseFloat(r.outstanding_usd) || 0),
    0,
  )
  const debtRowsCount = filteredRows.filter((r) => (Number.parseFloat(r.outstanding_usd) || 0) > 0.0001).length
  const historySupplierNames = supplierNames
  const filteredHistorySupplierNames = historySupplierQuery.trim()
    ? historySupplierNames.filter((name) =>
        name.toLowerCase().includes(historySupplierQuery.trim().toLowerCase()),
      )
    : historySupplierNames
  const filteredHistoryRows = historySupplierQuery.trim()
    ? historyRows.filter((r) =>
        r.label.toLowerCase().includes(historySupplierQuery.trim().toLowerCase()),
      )
    : historyRows

  const load = useCallback(async () => {
    if (!canView) return
    setLoading(true)
    setError(null)
    try {
      const [archive, cur] = await Promise.all([
        apiJson<ArchiveRow[]>('/api/purchases/supplier-archive/'),
        apiJson<
          { date: string; usd_to_iqd: string }[] | { results: { date: string; usd_to_iqd: string }[] }
        >('/api/currencies/').catch(() => null),
      ])
      setRows(archive)
      if (cur) {
        const list = asList<{ date: string; usd_to_iqd: string }>(cur).sort((a, b) =>
          String(b.date).localeCompare(String(a.date)),
        )
        const latest = list[0]
        if (latest?.usd_to_iqd != null) {
          const n = parseFloat(String(latest.usd_to_iqd))
          if (!Number.isNaN(n) && n > 0) {
            setIqdPerUsdRounded(Math.round(n * 100).toLocaleString())
          } else {
            setIqdPerUsdRounded(null)
          }
        } else {
          setIqdPerUsdRounded(null)
        }
      } else {
        setIqdPerUsdRounded(null)
      }
    } catch (e) {
      if (isApiStatus(e, 403)) setError(t('crud.permissionDenied'))
      else setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [canView, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!successMsg) return
    const id = window.setTimeout(() => setSuccessMsg(null), 6000)
    return () => window.clearTimeout(id)
  }, [successMsg])

  function openPay(row: { company_id: number; company_name: string }) {
    setError(null)
    setPayFor({ id: row.company_id, name: row.company_name })
    setPayUsd('')
    setPayIqd('')
  }

  async function submitPay() {
    if (!payFor) return
    const usdClean = normalizeMoneyInput(payUsd)
    const iqdClean = normalizeMoneyInput(payIqd)
    if (!usdClean && !iqdClean) {
      setError(t('customerDebts.enterPayment'))
      return
    }
    setSubmittingPay(true)
    setError(null)
    try {
      const data = await apiJson<PaySupplierResponse>('/api/purchases/pay-supplier/', {
        method: 'POST',
        body: JSON.stringify({
          company_id: payFor.id,
          amount_paid_usd: usdClean || '0',
          amount_paid_iqd: iqdClean || '0',
        }),
      })
      let msg = t('customerDebts.paymentRecorded')
      const over = parseFloat(data.overpaid_usd_eq)
      if (over > 0.0001) {
        msg += ` ${t('customerDebts.overpaidHint').replace('{usd}', data.overpaid_usd_eq)}`
      }
      setSuccessMsg(msg)
      const applied = parseFloat(data.applied_usd_eq)
      if (applied > 0.000001) {
        setLocalHistoryRows((prev) => [
          {
            kind: 'purchase_payment',
            id: -Date.now(),
            occurred_on: new Date().toISOString().slice(0, 10),
            occurred_at: new Date().toISOString(),
            amount_usd: data.applied_usd_eq,
            direction: 'out',
            label: payFor.name,
          },
          ...prev,
        ])
      }
      setPayFor(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSubmittingPay(false)
    }
  }

  const reloadPaymentHistory = useCallback(async () => {
    setHistoryLoading(true)
    setError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const from = '2000-01-01'
      const q = new URLSearchParams({ from, to: today })
      const led = await apiJson<{ entries: SupplierPaymentHistoryRow[] }>(
        `/api/cashier/ledger/?${q.toString()}`,
      )
      const onlySupplierPayments = (led.entries ?? []).filter((e) => e.kind === 'purchase_payment')
      const merged = [...localHistoryRows, ...onlySupplierPayments]
      const seen = new Set<string>()
      const deduped = merged.filter((r) => {
        const key = `${r.kind}-${r.id}-${r.occurred_at ?? r.occurred_on}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      setHistoryRows(deduped)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
      setHistoryRows([])
    } finally {
      setHistoryLoading(false)
    }
  }, [localHistoryRows, t])

  async function openPaymentHistory() {
    setHistoryOpen(true)
    setHistorySupplierQuery('')
    setHistorySupplierOpen(false)
    setError(null)
    await reloadPaymentHistory()
  }

  function closeLedgerEdit() {
    setLedgerEditOpen(false)
    setLedgerEditSaving(false)
    setLedgerEditError(null)
    setLedgerEditId(null)
    setLedgerEditLabel('')
    setLedgerEditOccurredAt('')
    setLedgerEditAmountUsd('')
  }

  function openLedgerEdit(r: SupplierPaymentHistoryRow) {
    if (r.kind !== 'purchase_payment' || r.id <= 0) return
    setLedgerEditError(null)
    setLedgerEditId(r.id)
    setLedgerEditLabel(r.label)
    const d = new Date(r.occurred_at ?? r.occurred_on)
    setLedgerEditOccurredAt(Number.isNaN(d.getTime()) ? '' : toDatetimeLocalValue(d))
    setLedgerEditAmountUsd(formatMoneyCompact(r.amount_usd))
    setLedgerEditOpen(true)
  }

  async function saveLedgerEdit() {
    if (ledgerEditId == null) return
    let occurred = ledgerEditOccurredAt.trim()
    if (occurred.length === 16) occurred = `${occurred}:00`
    const dt = new Date(occurred)
    if (Number.isNaN(dt.getTime())) {
      setLedgerEditError(t('inv.historyEditInvalidDate'))
      return
    }
    const amt = parseDec(ledgerEditAmountUsd)
    if (!Number.isFinite(amt) || amt < 0) {
      setLedgerEditError(t('common.error'))
      return
    }
    setLedgerEditSaving(true)
    setLedgerEditError(null)
    try {
      await apiJson(`/api/purchases/${ledgerEditId}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          occurred_at: dt.toISOString(),
          amount_paid_usd: amt.toFixed(4),
        }),
      })
      closeLedgerEdit()
      await reloadPaymentHistory()
      await load()
    } catch (e) {
      setLedgerEditError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setLedgerEditSaving(false)
    }
  }

  const buildPaymentHistoryPdfDoc = useCallback(async (): Promise<jsPDF> => {
    const isRtl = lang === 'ku' || lang === 'ar'
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-100000px'
    container.style.top = '0'
    container.style.width = '1300px'
    container.style.background = '#ffffff'
    container.style.color = '#0f172a'
    container.style.fontFamily = '"Noto Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif'
    container.style.padding = '16px'
    container.setAttribute('dir', isRtl ? 'rtl' : 'ltr')
    const rowsHtml = filteredHistoryRows
      .map(
        (r) => `<tr>
      <td>${escapeHtml(formatDateTimeCell(r.occurred_at ?? r.occurred_on))}</td>
      <td>${escapeHtml(r.label)}</td>
      <td>${escapeHtml(formatMoneyCompact(r.amount_usd))}</td>
    </tr>`,
      )
      .join('')
    const dateText = new Date().toISOString().slice(0, 10)
    container.innerHTML = `
      <style>
        .sheet { border: 1px solid #dbe2ea; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(2,6,23,.08); }
        .head { padding: 14px 16px; background: linear-gradient(180deg,#f8fafc,#f1f5f9); border-bottom: 1px solid #e2e8f0; }
        h2 { margin: 0 0 4px; font-size: 18px; font-weight: 700; }
        p.meta { margin: 0; color: #475569; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
        th, td { border: 1px solid #dbe2ea; padding: 8px 9px; text-align: center; vertical-align: middle; }
        thead th { background: #0ea5a4; color: #fff; font-weight: 700; padding: 0; height: 34px; vertical-align: middle; }
        thead th > span { display: flex; align-items: center; justify-content: center; height: 34px; line-height: 1.1; text-align: center; }
        tbody tr:nth-child(even) { background: #f8fafc; }
      </style>
      <div class="sheet">
        <div class="head">
          <h2>${escapeHtml(t('companyDebtsPage.paymentsHistoryTitle'))}</h2>
          <p class="meta">${escapeHtml(dateText)}</p>
        </div>
        <table>
          <thead><tr>
            <th><span>${escapeHtml(t('cashier.ledgerColDate'))}</span></th>
            <th><span>${escapeHtml(t('cashier.ledgerColLabel'))}</span></th>
            <th><span>${escapeHtml('بر USD')}</span></th>
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
  }, [filteredHistoryRows, lang, t])

  const downloadPaymentHistoryPdf = useCallback(async () => {
    try {
      const pdf = await buildPaymentHistoryPdfDoc()
      pdf.save(`supplier-payment-history-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }, [buildPaymentHistoryPdfDoc, t])

  const printPaymentHistory = useCallback(async () => {
    const w = window.open('', '_blank')
    if (!w) {
      setError(t('common.error'))
      return
    }
    try {
      const pdf = await buildPaymentHistoryPdfDoc()
      const url = URL.createObjectURL(pdf.output('blob'))
      w.location.href = url
      window.setTimeout(() => {
        w.focus()
        w.print()
        window.setTimeout(() => URL.revokeObjectURL(url), 5000)
      }, 900)
    } catch (e) {
      w.close()
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }, [buildPaymentHistoryPdfDoc, t])

  if (sessionLoading) {
    return <div className="p-6 text-slate-500">{t('common.loading')}</div>
  }
  if (!me) {
    return (
      <div className="p-6">
        <Link to="/" className="text-violet-600 hover:underline">
          {t('nav.home')}
        </Link>
      </div>
    )
  }
  if (!canView) {
    return (
      <div className="p-6">
        <p className="text-amber-800">{t('crud.permissionDenied')}</p>
        <Link to="/" className="mt-4 inline-block text-violet-600 hover:underline">
          {t('nav.home')}
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <Link
            to="/manage/companies"
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden />
            {t('common.back')}
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t('nav.companyDebts')}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void openPaymentHistory()}
          className="min-h-9 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {t('companyDebtsPage.paymentsHistoryBtn')}
        </button>
      </div>
    

      {successMsg && (
        <p
          className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
          role="status"
        >
          {successMsg}
        </p>
      )}

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {t('customerDebts.total')} ({t('purchasePage.colOutstanding')} USD)
          </p>
          <p className="font-mono text-lg font-semibold tabular-nums text-amber-950 dark:text-amber-100">
            {formatMoneyCompact(totalOutstandingUsd)}
          </p>
        </div>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          {debtRowsCount} {t('purchasePage.colCompany')}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-600">
          {t('purchasePage.archiveTitle')}
        </h2>
        <div className="relative border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('purchasePage.filterCompanyName')}
            </span>
            <input
              value={supplierQuery}
              onChange={(e) => {
                setSupplierQuery(e.target.value)
                setSupplierFilterOpen(true)
              }}
              onFocus={() => setSupplierFilterOpen(true)}
              onBlur={() => window.setTimeout(() => setSupplierFilterOpen(false), 120)}
              placeholder={t('purchasePage.filterCompanyName')}
              className="min-h-9 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          {supplierFilterOpen && filteredSupplierNames.length > 0 ? (
            <ul className="absolute inset-x-4 top-full z-20 mt-1 max-h-44 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-900">
              {filteredSupplierNames.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => {
                      setSupplierQuery(name)
                      setSupplierFilterOpen(false)
                    }}
                    className="w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-500">{t('common.loading')}</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-3 py-2 text-start">{t('purchasePage.colCompany')}</th>
                <th className="px-3 py-2 text-end">{t('purchasePage.colPurchases')}</th>
                <th className="px-3 py-2 text-end">{t('purchasePage.colTotalGoods')}</th>
                <th className="px-3 py-2 text-end">{t('purchasePage.colOutstanding')}</th>
                {canPay ? (
                  <th className="w-14 px-2 py-2 text-center">
                    <span className="sr-only">{t('companyDebtsPage.paySupplier')}</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={canPay ? 5 : 4}
                    className="px-3 py-4 text-slate-500"
                  >
                    {t('crud.noRows')}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const hasDebt = parseFloat(r.outstanding_usd) > 0.0001
                  return (
                    <tr key={r.company_id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-3 py-2 font-medium">{r.company_name}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{r.purchase_count}</td>
                      <td className="px-3 py-2 text-end font-mono tabular-nums">
                        {formatMoneyCompact(r.total_goods_value_usd)}
                      </td>
                      <td className="px-3 py-2 text-end font-mono tabular-nums">
                        {formatMoneyCompact(r.outstanding_usd)}
                      </td>
                      {canPay ? (
                        <td className="px-2 py-2 text-center">
                          {hasDebt ? (
                            <button
                              type="button"
                              onClick={() => openPay(r)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-800 transition hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/50"
                              title={t('companyDebtsPage.paySupplier')}
                              aria-label={t('companyDebtsPage.paySupplier')}
                            >
                              <Wallet className="h-4 w-4" aria-hidden />
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {payFor && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPayFor(null)
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
            role="dialog"
            aria-labelledby="pay-supplier-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="pay-supplier-dialog-title"
              className="text-start text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {t('companyDebtsPage.payTitle').replace('{name}', payFor.name)}
            </h2>
            {iqdPerUsdRounded !== null ? (
              <p className="mt-2 text-start text-xs text-slate-500 dark:text-slate-400">
                {t('customerDebts.rateHint').replace('{iqd}', iqdPerUsdRounded)}
              </p>
            ) : (
              <p className="mt-2 text-start text-xs text-amber-700 dark:text-amber-300">
                {t('pos.setRateBeforeCheckout')}
              </p>
            )}
            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="cd-sup-usd"
                  className="mb-1 block text-start text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  {t('customerDebts.amountUsdShort')}
                </label>
                <input
                  id="cd-sup-usd"
                  value={payUsd}
                  onChange={(e) => setPayUsd(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono tabular-nums dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  inputMode="decimal"
                  placeholder="0"
                  autoComplete="off"
                />
              </div>
              <div>
                <label
                  htmlFor="cd-sup-iqd"
                  className="mb-1 block text-start text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  {t('customerDebts.amountIqdShort')}
                </label>
                <input
                  id="cd-sup-iqd"
                  value={payIqd}
                  onChange={(e) => setPayIqd(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono tabular-nums dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  inputMode="numeric"
                  placeholder="0"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayFor(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {t('customerDebts.cancel')}
              </button>
              <button
                type="button"
                disabled={submittingPay || !iqdPerUsdRounded}
                onClick={() => void submitPay()}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {submittingPay ? t('pos.saving') : t('customerDebts.submitPayment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <>
          <div
            className="fixed inset-0 z-[210] flex items-end justify-center bg-black/50 p-4 sm:items-center lg:pr-64"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeLedgerEdit()
                setHistoryOpen(false)
              }
            }}
          >
            <div
              className="flex max-h-[90dvh] min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
              role="dialog"
              aria-modal="true"
              aria-labelledby="supplier-payments-history-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2
                    id="supplier-payments-history-title"
                    className="text-start text-base font-semibold text-slate-900 dark:text-slate-100"
                  >
                    {t('companyDebtsPage.paymentsHistoryTitle')}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void printPaymentHistory()}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Printer className="h-4 w-4" aria-hidden />
                      {t('companiesPage.print')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void downloadPaymentHistoryPdf()}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      {t('companiesPage.downloadPdf')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        closeLedgerEdit()
                        setHistoryOpen(false)
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:text-slate-200"
                    >
                      {t('crud.cancel')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
                {historyLoading ? (
                  <p className="py-6 text-sm text-slate-500">{t('common.loading')}</p>
                ) : historyRows.length === 0 ? (
                  <p className="py-6 text-sm text-slate-500">{t('crud.noRows')}</p>
                ) : (
                  <>
                    <div className="relative shrink-0">
                      <label className="block">
                        <span className="mb-1 block text-start text-xs font-medium text-slate-600 dark:text-slate-400">
                          {t('purchasePage.filterCompanyName')}
                        </span>
                        <input
                          value={historySupplierQuery}
                          onChange={(e) => {
                            setHistorySupplierQuery(e.target.value)
                            setHistorySupplierOpen(true)
                          }}
                          onFocus={() => setHistorySupplierOpen(true)}
                          onBlur={() => window.setTimeout(() => setHistorySupplierOpen(false), 120)}
                          placeholder={t('purchasePage.filterCompanyName')}
                          className="min-h-9 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </label>
                      {historySupplierOpen && filteredHistorySupplierNames.length > 0 ? (
                        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-44 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-900">
                          {filteredHistorySupplierNames.map((name) => (
                            <li key={name}>
                              <button
                                type="button"
                                onClick={() => {
                                  setHistorySupplierQuery(name)
                                  setHistorySupplierOpen(false)
                                }}
                                className="w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                {name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="min-w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/95">
                          <tr>
                            <th className="px-3 py-2 text-start">{t('cashier.ledgerColDate')}</th>
                            <th className="px-3 py-2 text-start">{t('cashier.ledgerColLabel')}</th>
                            <th className="px-3 py-2 text-end">{'بر USD'}</th>
                            {canEditLedgerPayment ? (
                              <th className="w-14 px-2 py-2 text-center print:hidden">
                                {t('companyDebtsPage.colActions')}
                              </th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredHistoryRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={canEditLedgerPayment ? 4 : 3}
                                className="px-3 py-4 text-sm text-slate-500"
                              >
                                {t('crud.noRows')}
                              </td>
                            </tr>
                          ) : (
                            filteredHistoryRows.map((r) => {
                              const editable =
                                canEditLedgerPayment && r.kind === 'purchase_payment' && r.id > 0
                              return (
                                <tr
                                  key={`${r.kind}-${r.id}-${r.occurred_at ?? r.occurred_on}`}
                                  className="border-t border-slate-100 dark:border-slate-700"
                                >
                                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                                    {formatDateTimeCell(r.occurred_at ?? r.occurred_on)}
                                  </td>
                                  <td className="px-3 py-2">{r.label}</td>
                                  <td className="px-3 py-2 text-end font-mono tabular-nums">
                                    {formatMoneyCompact(r.amount_usd)}
                                  </td>
                                  {canEditLedgerPayment ? (
                                    <td className="print:hidden px-2 py-2 text-center">
                                      {editable ? (
                                        <button
                                          type="button"
                                          onClick={() => openLedgerEdit(r)}
                                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                          title={t('companyDebtsPage.editLedgerRow')}
                                          aria-label={t('companyDebtsPage.editLedgerRow')}
                                        >
                                          <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                                        </button>
                                      ) : null}
                                    </td>
                                  ) : null}
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {ledgerEditOpen ? (
            <div
              className="fixed inset-0 z-[220] flex items-end justify-center bg-black/55 p-4 sm:items-center lg:pr-64"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeLedgerEdit()
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ledger-edit-title"
                className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="ledger-edit-title" className="text-start text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t('companyDebtsPage.editLedgerTitle')}
                </h3>
                <p className="mt-2 text-start text-xs text-slate-500 dark:text-slate-400">
                  {t('companyDebtsPage.editLedgerHint')}
                </p>
                {ledgerEditError ? (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                    {ledgerEditError}
                  </p>
                ) : null}
                <p className="mt-3 text-start text-sm font-medium text-slate-800 dark:text-slate-100">{ledgerEditLabel}</p>
                <div className="mt-4 space-y-3 text-start">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('purchasePage.date')}</span>
                    <input
                      type="datetime-local"
                      value={ledgerEditOccurredAt}
                      onChange={(e) => setLedgerEditOccurredAt(e.target.value)}
                      className="min-h-10 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">USD</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={ledgerEditAmountUsd}
                      onChange={(e) => setLedgerEditAmountUsd(e.target.value)}
                      className="min-h-10 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm tabular-nums dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeLedgerEdit}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
                  >
                    {t('crud.cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={ledgerEditSaving}
                    onClick={() => void saveLedgerEdit()}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    {ledgerEditSaving ? t('pos.saving') : t('crud.save')}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

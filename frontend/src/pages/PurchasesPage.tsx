import { Download, Pencil, Printer } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { Link } from 'react-router-dom'
import { useLocale } from '../context/LocaleContext'
import { useSession } from '../context/SessionContext'
import { apiJson, isApiStatus } from '../lib/api'
import { hasPerm } from '../lib/permissions'
import type { Paginated, ProductRow } from '../types/api'

type CompanyRow = { id: number; name: string }
type PurchaseHistoryRow = {
  id: number
  company: number | null
  company_name?: string
  note?: string
  occurred_at: string
  invoice_number?: string
  discount_received_usd: string
  amount_paid_usd: string
  lines_summary?: string
  lines_product_names?: string
  goods_total_usd?: string
  remaining_balance_usd?: string
  total_units?: number
  has_returns?: boolean
}

type PurchaseHeaderApiDetail = {
  id: number
  company: number | null
  occurred_at: string
  exchange_rate_usd_to_iqd: string
  discount_received_usd: string
  amount_paid_usd: string
  invoice_number?: string
  note?: string
  currency: string
  payment_type: string
}
type LineForm = {
  productId: string
  productName: string
  quantity: string
  unitPrice: string
  damaged: string
}

function asList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toDatetimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function normalizeNum(s: string) {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
    .replace(/[\s,،\u066C]/g, '')
    .trim()
}

/** ASCII digits only, for receipt # input (max 128 per backend). */
function digitsOnlyAscii(s: string) {
  return normalizeNum(s).replace(/\D/g, '').slice(0, 128)
}

/** Show stored receipt if it is all digits; otherwise show purchase id (numeric). */
function purchaseReceiptDisplay(p: PurchaseHistoryRow): string {
  const normalized = normalizeNum(String(p.invoice_number ?? '').trim())
  if (normalized !== '' && /^\d+$/.test(normalized)) {
    const trimmed = normalized.replace(/^0+/, '')
    return trimmed === '' ? '0' : trimmed
  }
  return String(p.id)
}

function isInventoryStockIncreaseEntry(p: PurchaseHistoryRow): boolean {
  return String(p.note ?? '').includes('[AUTO_STOCK_INCREASE]')
}

function parseDec(s: string) {
  const n = parseFloat(normalizeNum(s))
  return Number.isNaN(n) ? 0 : n
}

/** Up to 2 fraction digits; trailing zeros after the decimal are omitted (e.g. 5.1 not 5.10). */
function formatMoneySmart(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(2).replace(/\.?0+$/, '') || '0'
}

/** API USD strings (e.g. 0.0000) → up to 2 decimals, trailing fractional zeros stripped. */
function formatUsdCellString(raw: string | undefined | null): string {
  if (raw == null) return '—'
  const trimmed = String(raw).trim()
  if (trimmed === '') return '—'
  const n = parseFloat(normalizeNum(trimmed))
  if (Number.isNaN(n)) return '—'
  const s = n.toFixed(2).replace(/\.?0+$/, '')
  return s === '' ? '0' : s
}

function formatUsdForInput(raw: string | undefined | null): string {
  const s = formatUsdCellString(raw)
  return s === '—' ? '0' : s
}

function formatRateCompact(value: string | number | null | undefined): string {
  if (value == null || String(value).trim() === '') return '1'
  const n = parseFloat(normalizeNum(String(value)))
  if (!Number.isFinite(n)) return '1'
  return n.toFixed(4).replace(/\.?0+$/, '') || '1'
}

/** API stores IQD per 1 USD; purchase forms show IQD per 100 USD (same as Settings). */
function displayIqdPer100FromApiPerUsd(value: string | number | null | undefined): string {
  if (value == null || String(value).trim() === '') return ''
  const n = parseFloat(normalizeNum(String(value)))
  if (!Number.isFinite(n) || n <= 0) return ''
  return formatRateCompact(n * 100)
}

function formatDateTimeCell(value: string | undefined | null): string {
  if (!value) return '—'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return String(value)
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripUsdParens(label: string): string {
  return label.replace(/\s*\(USD\)\s*/gi, ' ').replace(/\s+/g, ' ').trim()
}

/** Keep purchase product summary as product names only. */
function formatProductsSummaryCell(raw: string | undefined | null): string {
  const source = String(raw ?? '').trim()
  if (!source) return '—'
  const parts = source
    .split('·')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.split('@')[0] ?? p).replace(/\s*[x×]\s*\d+\s*$/i, '').trim())
  return parts.length ? parts.join(' · ') : '—'
}

function emptyLine(): LineForm {
  return { productId: '', productName: '', quantity: '', unitPrice: '', damaged: '' }
}

function nextReceiptNumberFromRows(rows: PurchaseHistoryRow[]): string {
  const maxNum = rows.reduce((max, row) => {
    const invoiceDigits = digitsOnlyAscii(String(row.invoice_number ?? ''))
    const raw = invoiceDigits !== '' ? invoiceDigits : String(row.id)
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) return max
    return Math.max(max, n)
  }, 0)
  return String(maxNum + 1)
}

export function PurchasesPage() {
  const { t, lang } = useLocale()
  const { me, loading: sessionLoading } = useSession()
  const [tab, setTab] = useState<'form' | 'history'>('form')
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [historyRows, setHistoryRows] = useState<PurchaseHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyCompanyName, setHistoryCompanyName] = useState('')
  const [historyProductName, setHistoryProductName] = useState('')
  const [historyProductFilterOpen, setHistoryProductFilterOpen] = useState(false)
  const [historyInvoice, setHistoryInvoice] = useState('')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [companyId, setCompanyId] = useState('')
  const [outstandingUsd, setOutstandingUsd] = useState<string | null>(null)
  const [occurredAt, setOccurredAt] = useState(() => toDatetimeLocalValue(new Date()))
  const [currency, setCurrency] = useState<'USD' | 'IQD'>('USD')
  const [exchangeRate, setExchangeRate] = useState('')
  const [paymentType, setPaymentType] = useState<'cash' | 'debt'>('debt')
  const [discountUsd, setDiscountUsd] = useState('')
  const [amountPaidUsd, setAmountPaidUsd] = useState('')
  const [note, setNote] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [lines, setLines] = useState<LineForm[]>([emptyLine()])

  const [phEditOpen, setPhEditOpen] = useState(false)
  const [phEditLoading, setPhEditLoading] = useState(false)
  const [phEditSaving, setPhEditSaving] = useState(false)
  const [phEditError, setPhEditError] = useState<string | null>(null)
  const [phEditId, setPhEditId] = useState<number | null>(null)
  const [phEditCompanyId, setPhEditCompanyId] = useState<number | null>(null)
  const [phEditSupplierLabel, setPhEditSupplierLabel] = useState('')
  const [phEditIsAutoStock, setPhEditIsAutoStock] = useState(false)
  const [phEditOccurredAt, setPhEditOccurredAt] = useState('')
  const [phEditDiscountUsd, setPhEditDiscountUsd] = useState('')
  const [phEditAmountPaidUsd, setPhEditAmountPaidUsd] = useState('')
  const [phEditNote, setPhEditNote] = useState('')
  const [phEditInvoice, setPhEditInvoice] = useState('')
  const [phEditCurrency, setPhEditCurrency] = useState<'USD' | 'IQD'>('USD')
  const [phEditPaymentType, setPhEditPaymentType] = useState<'cash' | 'debt'>('debt')
  const [phEditExchangeRate, setPhEditExchangeRate] = useState('')

  const canView = Boolean(me && hasPerm(me, 'view_purchase'))
  const canAdd = Boolean(me && hasPerm(me, 'add_purchase'))
  const canChangePurchase = Boolean(me && hasPerm(me, 'change_purchase', 'change_product'))
  const historyProductNameSuggestions = useMemo(() => {
    const names = new Set<string>()
    for (const row of historyRows) {
      const raw = String(row.lines_product_names ?? row.lines_summary ?? '').trim()
      if (!raw) continue
      for (const part of raw.split('·')) {
        const clean = (part.split('@')[0] ?? part).replace(/\s*[x×]\s*\d+\s*$/i, '').trim()
        if (clean) names.add(clean)
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b)).slice(0, 100)
  }, [historyRows])

  const loadBasics = useCallback(async () => {
    if (!canView) return
    setError(null)
    try {
      const [co, pr] = await Promise.all([
        apiJson<CompanyRow[] | { results: CompanyRow[] }>('/api/companies/'),
        apiJson<ProductRow[] | { results: ProductRow[] }>(
          '/api/products/?page_size=200&exclude_discontinued=1',
        ),
      ])
      setCompanies(asList(co))
      setProducts(asList(pr))
      try {
        const cur = await apiJson<
          { date: string; usd_to_iqd: string }[] | { results: { date: string; usd_to_iqd: string }[] }
        >('/api/currencies/')
        const list = asList(cur).sort((a, b) => String(b.date).localeCompare(String(a.date)))
        const latest = list[0]
        if (latest?.usd_to_iqd != null) {
          const per100 = displayIqdPer100FromApiPerUsd(latest.usd_to_iqd)
          setExchangeRate((prev) => (prev.trim() ? prev : per100))
        }
      } catch {
        /* optional */
      }
    } catch (e) {
      if (isApiStatus(e, 403)) setError(t('crud.permissionDenied'))
      else setError(e instanceof Error ? e.message : t('common.error'))
    }
  }, [canView, t])

  const loadPurchaseHistory = useCallback(async () => {
    if (!canView) return
    setHistoryLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      const cn = historyCompanyName.trim()
      const pn = historyProductName.trim()
      const inv = historyInvoice.trim()
      const df = historyDateFrom.trim()
      const dt = historyDateTo.trim()
      if (cn) params.set('company_name', cn)
      if (pn) params.set('product_name', pn)
      if (inv) params.set('invoice', inv)
      if (df) params.set('date_from', df)
      if (dt) params.set('date_to', dt)
      const q = params.toString() ? `?${params.toString()}` : ''
      const data = await apiJson<Paginated<PurchaseHistoryRow> | PurchaseHistoryRow[]>(
        `/api/purchases/${q}`,
      )
      setHistoryRows(asList(data))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
      setHistoryRows([])
    } finally {
      setHistoryLoading(false)
    }
  }, [canView, historyCompanyName, historyDateFrom, historyDateTo, historyInvoice, historyProductName, t])

  const closePhEdit = useCallback(() => {
    setPhEditOpen(false)
    setPhEditLoading(false)
    setPhEditSaving(false)
    setPhEditError(null)
    setPhEditId(null)
    setPhEditCompanyId(null)
    setPhEditSupplierLabel('')
    setPhEditIsAutoStock(false)
    setPhEditOccurredAt('')
    setPhEditDiscountUsd('')
    setPhEditAmountPaidUsd('')
    setPhEditNote('')
    setPhEditInvoice('')
    setPhEditCurrency('USD')
    setPhEditPaymentType('debt')
    setPhEditExchangeRate('')
  }, [])

  const openPhEdit = useCallback(
    async (p: PurchaseHistoryRow) => {
      if (p.has_returns) return
      setPhEditOpen(true)
      setPhEditLoading(true)
      setPhEditError(null)
      setPhEditId(p.id)
      setPhEditSupplierLabel(
        isInventoryStockIncreaseEntry(p)
          ? t('purchasePage.companyInventoryIncrease')
          : String(p.company_name ?? '').trim() || '—',
      )
      try {
        const data = await apiJson<PurchaseHeaderApiDetail>(`/api/purchases/${p.id}/`)
        setPhEditCompanyId(typeof data.company === 'number' ? data.company : null)
        const noteStr = String(data.note ?? '')
        setPhEditIsAutoStock(noteStr.includes('[AUTO_STOCK_INCREASE]'))
        const d = new Date(data.occurred_at)
        setPhEditOccurredAt(Number.isNaN(d.getTime()) ? '' : toDatetimeLocalValue(d))
        setPhEditDiscountUsd(formatUsdForInput(data.discount_received_usd))
        setPhEditAmountPaidUsd(formatUsdForInput(data.amount_paid_usd))
        setPhEditNote(noteStr)
        setPhEditInvoice(String(data.invoice_number ?? ''))
        const cur = data.currency === 'IQD' ? 'IQD' : 'USD'
        setPhEditCurrency(cur)
        setPhEditPaymentType(data.payment_type === 'cash' ? 'cash' : 'debt')
        setPhEditExchangeRate(displayIqdPer100FromApiPerUsd(data.exchange_rate_usd_to_iqd))
      } catch (e) {
        setPhEditError(e instanceof Error ? e.message : t('common.error'))
      } finally {
        setPhEditLoading(false)
      }
    },
    [t],
  )

  const savePhEdit = useCallback(async () => {
    if (phEditId == null) return
    if (phEditIsAutoStock && !phEditNote.includes('[AUTO_STOCK_INCREASE]')) {
      setPhEditError(t('inv.historyEditMarkerRequired'))
      return
    }
    let occurred = phEditOccurredAt.trim()
    if (occurred.length === 16) occurred = `${occurred}:00`
    const dt = new Date(occurred)
    if (Number.isNaN(dt.getTime())) {
      setPhEditError(t('inv.historyEditInvalidDate'))
      return
    }
    const rateDisplay = parseDec(phEditExchangeRate)
    const rate = rateDisplay / 100
    if (phEditCurrency === 'IQD' && rateDisplay <= 0) {
      setPhEditError(t('purchasePage.needRate'))
      return
    }
    setPhEditSaving(true)
    setPhEditError(null)
    try {
      await apiJson(`/api/purchases/${phEditId}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          company: phEditCompanyId,
          occurred_at: dt.toISOString(),
          exchange_rate_usd_to_iqd: (rate > 0 ? rate : 1).toFixed(4),
          discount_received_usd: parseDec(phEditDiscountUsd).toFixed(4),
          amount_paid_usd: parseDec(phEditAmountPaidUsd).toFixed(4),
          invoice_number: digitsOnlyAscii(phEditInvoice),
          note: phEditNote.trim(),
          currency: phEditCurrency,
          payment_type: phEditPaymentType,
        }),
      })
      closePhEdit()
      await loadPurchaseHistory()
    } catch (e) {
      setPhEditError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setPhEditSaving(false)
    }
  }, [
    phEditId,
    phEditIsAutoStock,
    phEditNote,
    phEditOccurredAt,
    phEditExchangeRate,
    phEditCurrency,
    phEditDiscountUsd,
    phEditAmountPaidUsd,
    phEditInvoice,
    phEditPaymentType,
    phEditCompanyId,
    closePhEdit,
    loadPurchaseHistory,
    t,
  ])

  const loadNextInvoiceNumber = useCallback(
    async (force = false) => {
      if (!canView) return
      try {
        const data = await apiJson<Paginated<PurchaseHistoryRow> | PurchaseHistoryRow[]>(
          '/api/purchases/?page_size=50',
        )
        const rows = asList(data)
        const next = nextReceiptNumberFromRows(rows)
        setInvoiceNumber((prev) => (force || prev.trim() === '' ? next : prev))
      } catch {
        // If history fetch fails, leave manual entry available.
      }
    },
    [canView],
  )

  useEffect(() => {
    void loadBasics()
  }, [loadBasics])

  useEffect(() => {
    void loadNextInvoiceNumber()
  }, [loadNextInvoiceNumber])

  useEffect(() => {
    if (tab === 'history') void loadPurchaseHistory()
  }, [tab, loadPurchaseHistory])

  useEffect(() => {
    if (!companyId) {
      setOutstandingUsd(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await apiJson<{ outstanding_usd: string }>(
          `/api/purchases/company-outstanding/?company_id=${encodeURIComponent(companyId)}`,
        )
        if (!cancelled) setOutstandingUsd(r.outstanding_usd)
      } catch {
        if (!cancelled) setOutstandingUsd(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [companyId])

  const lineUsdTotals = useMemo(() => {
    const rate = parseDec(exchangeRate) / 100
    return lines.map((ln) => {
      const q = Math.max(0, Math.floor(parseDec(ln.quantity)))
      const up = parseDec(ln.unitPrice)
      if (currency === 'IQD') {
        if (rate <= 0) return 0
        return (q * up) / rate
      }
      return q * up
    })
  }, [lines, currency, exchangeRate])

  const subtotalUsd = useMemo(
    () => lineUsdTotals.reduce((a, b) => a + b, 0),
    [lineUsdTotals],
  )
  const discountVal = parseDec(discountUsd)
  const netAfterDiscount = Math.max(0, subtotalUsd - discountVal)

  const buildHistoryPdfDoc = useCallback(async (): Promise<jsPDF> => {
    const isRtl = lang === 'ku' || lang === 'ar'
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-100000px'
    container.style.top = '0'
    container.style.width = '1400px'
    container.style.background = '#ffffff'
    container.style.color = '#0f172a'
    container.style.fontFamily = '"Noto Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif'
    container.style.padding = '16px'
    container.setAttribute('dir', isRtl ? 'rtl' : 'ltr')
    const rowsHtml = historyRows
      .map((p) => `<tr>
        <td>${escapeHtml(formatDateTimeCell(p.occurred_at))}</td>
        <td>${escapeHtml(p.company_name ?? '—')}</td>
        <td>${escapeHtml(formatProductsSummaryCell(p.lines_product_names ?? p.lines_summary))}</td>
        <td>${escapeHtml(typeof p.total_units === 'number' ? p.total_units : '—')}</td>
        <td>${escapeHtml(purchaseReceiptDisplay(p))}</td>
        <td>${escapeHtml(formatUsdCellString(p.goods_total_usd))}</td>
        <td>${escapeHtml(formatUsdCellString(p.amount_paid_usd))}</td>
        <td>${escapeHtml(formatUsdCellString(p.remaining_balance_usd))}</td>
      </tr>`)
      .join('')
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
          <h2>${escapeHtml(t('purchasePage.historyTitle'))}</h2>
          <p class="meta">${escapeHtml((historyDateFrom || '—') + ' -> ' + (historyDateTo || '—'))}</p>
        </div>
        <table>
          <thead><tr>
            <th><span>${escapeHtml(t('purchasePage.colWhen'))}</span></th>
            <th><span>${escapeHtml(t('purchasePage.colCompany'))}</span></th>
            <th><span>${escapeHtml(t('purchasePage.colProducts'))}</span></th>
            <th><span>${escapeHtml(t('purchasePage.colTotalUnits'))}</span></th>
            <th><span>${escapeHtml(t('purchasePage.colInvoice'))}</span></th>
            <th><span>${escapeHtml(stripUsdParens(t('purchasePage.colGoodsTotal')) + ' USD')}</span></th>
            <th><span>${escapeHtml(stripUsdParens(t('purchasePage.colPaid')) + ' USD')}</span></th>
            <th><span>${escapeHtml(stripUsdParens(t('purchasePage.colRemaining')) + ' USD')}</span></th>
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
          // Prevent parser issues with global Tailwind color functions (e.g. oklch).
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
  }, [historyRows, historyDateFrom, historyDateTo, lang, t])

  const downloadHistoryPdf = useCallback(async () => {
    try {
      const pdf = await buildHistoryPdfDoc()
      pdf.save(`purchase-history-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }, [buildHistoryPdfDoc, t])

  const printHistory = useCallback(async () => {
    const w = window.open('', '_blank')
    if (!w) {
      setError(t('common.error'))
      return
    }
    try {
      const pdf = await buildHistoryPdfDoc()
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
  }, [buildHistoryPdfDoc, t])

  useEffect(() => {
    if (paymentType !== 'cash') return
    setAmountPaidUsd(netAfterDiscount.toFixed(4))
  }, [paymentType, netAfterDiscount])

  function resetForm() {
    setCompanyId('')
    setOutstandingUsd(null)
    setOccurredAt(toDatetimeLocalValue(new Date()))
    setCurrency('USD')
    setPaymentType('debt')
    setDiscountUsd('')
    setAmountPaidUsd('')
    setNote('')
    void loadNextInvoiceNumber(true)
    setLines([emptyLine()])
  }

  async function submitPurchase() {
    if (!canAdd) return
    setError(null)
    if (!companyId) {
      setError(t('purchasePage.needCompany'))
      return
    }
    const rateDisplay = parseDec(exchangeRate)
    const rate = rateDisplay / 100
    if (currency === 'IQD' && rateDisplay <= 0) {
      setError(t('purchasePage.needRate'))
      return
    }
    const preparedLines = lines
      .map((ln) => {
        const parsedQty = Math.max(0, Math.floor(parseDec(ln.quantity)))
        const q = parsedQty
        const up = parseDec(ln.unitPrice)
        const typedName = ln.productName.trim()
        const byName = products.find((p) => p.name.trim().toLowerCase() === typedName.toLowerCase())
        const pid = byName ? byName.id : parseInt(ln.productId, 10)
        const damaged = Math.min(Math.max(0, Math.floor(parseDec(ln.damaged))), q)
        const unitUsd =
          currency === 'IQD' && rate > 0 ? (up / rate).toFixed(4) : up.toFixed(4)
        return { pid, q, unitUsd, damaged, typedName }
      })
      .filter((x) => x.q > 0 && (x.pid > 0 || x.typedName))
    if (preparedLines.length === 0) {
      setError(t('purchasePage.needLines'))
      return
    }

    const apiLines = preparedLines.map((ln) => ({
      pid: ln.pid > 0 ? ln.pid : null,
      manualName: ln.pid > 0 ? null : ln.typedName,
      q: ln.q,
      unitUsd: ln.unitUsd,
      damaged: ln.damaged,
    }))
    if (apiLines.some((x) => (x.pid == null || x.pid <= 0) && !x.manualName)) {
      setError(t('purchasePage.needLines'))
      return
    }
    let occurred = occurredAt.trim()
    if (occurred.length === 16) occurred = `${occurred}:00`

    setSubmitting(true)
    try {
      await apiJson('/api/purchases/', {
        method: 'POST',
        body: JSON.stringify({
          company: Number(companyId),
          occurred_at: occurred,
          exchange_rate_usd_to_iqd: (rate > 0 ? rate : 1).toFixed(4),
          discount_received_usd: parseDec(discountUsd).toFixed(4),
          amount_paid_usd: parseDec(amountPaidUsd).toFixed(4),
          invoice_number: digitsOnlyAscii(invoiceNumber),
          note: note.trim(),
          currency,
          payment_type: paymentType,
          lines: apiLines.map((x) => {
            const line: Record<string, unknown> = {
              quantity: x.q,
              unit_cost_usd: x.unitUsd,
              damaged_quantity: x.damaged,
            }
            if (x.pid != null && x.pid > 0) {
              line.product = x.pid
            } else if (x.manualName) {
              line.manual_name = x.manualName
            }
            return line
          }),
        }),
      })
      resetForm()
      await loadBasics()
      await loadNextInvoiceNumber(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

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
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('nav.purchases')}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/manage/purchase-returns"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t('nav.purchaseReturns')}
          </Link>
          <Link
            to="/manage/purchase-returns?tab=history"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t('purchaseReturns.historyBtn')}
          </Link>
          {tab === 'history' ? (
            <button
              type="button"
              onClick={() => setTab('form')}
              className="text-sm font-medium text-violet-600 hover:underline"
            >
              {t('purchasePage.backToForm')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === 'history'
                ? 'bg-violet-600 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {t('purchasePage.tabHistory')}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      {tab === 'history' && (
        <>
          <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('purchasePage.historyTitle')}</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void printHistory()}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-sm dark:border-slate-600 dark:text-slate-200"
                >
                  <Printer className="h-4 w-4" aria-hidden />
                  {t('companiesPage.print')}
                </button>
                <button
                  type="button"
                  onClick={() => void downloadHistoryPdf()}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-sm dark:border-slate-600 dark:text-slate-200"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {t('companiesPage.downloadPdf')}
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-6">
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('purchasePage.filterCompanyName')}
                </span>
                <input
                  value={historyCompanyName}
                  onChange={(e) => setHistoryCompanyName(e.target.value)}
                  className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="relative">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('purchasePage.filterProductName')}
                </span>
                <input
                  value={historyProductName}
                  onChange={(e) => {
                    setHistoryProductName(e.target.value)
                    setHistoryProductFilterOpen(true)
                  }}
                  onFocus={() => setHistoryProductFilterOpen(true)}
                  onBlur={() => window.setTimeout(() => setHistoryProductFilterOpen(false), 120)}
                  className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
                {historyProductFilterOpen && historyProductNameSuggestions.length > 0 ? (
                  <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-900">
                    {historyProductNameSuggestions
                      .filter((name) =>
                        !historyProductName.trim()
                          ? true
                          : name.toLowerCase().includes(historyProductName.trim().toLowerCase()),
                      )
                      .slice(0, 20)
                      .map((name) => (
                        <li key={name}>
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryProductName(name)
                              setHistoryProductFilterOpen(false)
                            }}
                            className="w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            {name}
                          </button>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('purchasePage.filterInvoice')}
                </span>
                <input
                  value={historyInvoice}
                  onChange={(e) => setHistoryInvoice(digitsOnlyAscii(e.target.value))}
                  inputMode="numeric"
                  className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('purchasePage.filterDateFrom')}
                </span>
                <input
                  type="date"
                  value={historyDateFrom}
                  onChange={(e) => setHistoryDateFrom(e.target.value)}
                  className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('purchasePage.filterDateTo')}
                </span>
                <input
                  type="date"
                  value={historyDateTo}
                  onChange={(e) => setHistoryDateTo(e.target.value)}
                  className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-1">
                <button
                  type="button"
                  disabled={historyLoading}
                  onClick={() => void loadPurchaseHistory()}
                  className="min-h-9 flex-1 rounded-lg bg-violet-600 px-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {historyLoading ? t('common.loading') : t('purchasePage.applyHistoryFilters')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHistoryCompanyName('')
                    setHistoryProductName('')
                    setHistoryInvoice('')
                    setHistoryDateFrom('')
                    setHistoryDateTo('')
                    void loadPurchaseHistory()
                  }}
                  className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-sm dark:border-slate-600 dark:text-slate-200"
                >
                  {t('purchasePage.clearHistoryFilters')}
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-[min(75dvh,42rem)] overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/95">
                  <tr>
                    <th className="px-3 py-2 text-start">{t('purchasePage.colWhen')}</th>
                    <th className="px-3 py-2 text-start">{t('purchasePage.colCompany')}</th>
                    <th className="px-3 py-2 text-center">{t('purchasePage.colProducts')}</th>
                    <th className="px-3 py-2 text-center">{t('purchasePage.colTotalUnits')}</th>
                    <th className="px-3 py-2 text-start">{t('purchasePage.colInvoice')}</th>
                    <th className="px-3 py-2 text-center">{stripUsdParens(t('purchasePage.colGoodsTotal'))} USD</th>
                    <th className="px-3 py-2 text-center">{stripUsdParens(t('purchasePage.colPaid'))} USD</th>
                    <th className="px-3 py-2 text-center">{stripUsdParens(t('purchasePage.colRemaining'))} USD</th>
                    <th className="px-3 py-2 text-center">{t('purchasePage.colHasReturns')}</th>
                    {canChangePurchase ? (
                      <th className="print:hidden w-14 px-2 py-2 text-center">{t('purchasePage.colActions')}</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan={canChangePurchase ? 10 : 9} className="px-3 py-4 text-slate-500">
                        {t('common.loading')}
                      </td>
                    </tr>
                  ) : historyRows.length === 0 ? (
                    <tr>
                      <td colSpan={canChangePurchase ? 10 : 9} className="px-3 py-4 text-slate-500">
                        {t('crud.noRows')}
                      </td>
                    </tr>
                  ) : (
                    historyRows.map((p) => {
                      const editable = canChangePurchase && !p.has_returns
                      return (
                        <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700">
                          <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                            {formatDateTimeCell(p.occurred_at)}
                          </td>
                          <td className="px-3 py-2">
                            {isInventoryStockIncreaseEntry(p)
                              ? t('purchasePage.companyInventoryIncrease')
                              : (p.company_name ?? '—')}
                          </td>
                          <td className="px-3 py-2 text-center text-xs font-medium leading-relaxed text-slate-900 dark:text-slate-100">
                            {formatProductsSummaryCell(p.lines_product_names ?? p.lines_summary)}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-xs tabular-nums">
                            {typeof p.total_units === 'number' ? p.total_units : '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs tabular-nums">{purchaseReceiptDisplay(p)}</td>
                          <td className="px-3 py-2 text-center font-mono tabular-nums">
                            {formatUsdCellString(p.goods_total_usd)}
                          </td>
                          <td className="px-3 py-2 text-center font-mono tabular-nums">
                            {formatUsdCellString(p.amount_paid_usd)}
                          </td>
                          <td className="px-3 py-2 text-center font-mono tabular-nums">
                            {formatUsdCellString(p.remaining_balance_usd)}
                          </td>
                          <td className="px-3 py-2 text-center text-xs font-medium">
                            {p.has_returns ? t('purchasePage.hasReturnsYes') : '—'}
                          </td>
                          {canChangePurchase ? (
                            <td className="print:hidden px-2 py-2 text-center">
                              {editable ? (
                                <button
                                  type="button"
                                  onClick={() => void openPhEdit(p)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                  title={t('purchasePage.editHistoryRow')}
                                  aria-label={t('purchasePage.editHistoryRow')}
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
          </div>
        </div>

          {phEditOpen ? (
            <div
              className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-4 sm:items-center lg:pr-64"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) closePhEdit()
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ph-edit-title"
                className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="ph-edit-title" className="text-start text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t('purchasePage.editHistoryTitle')}
                </h3>
                <p className="mt-2 text-start text-xs text-slate-500 dark:text-slate-400">
                  {t('purchasePage.editHistoryHint')}
                </p>
                {phEditError ? (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                    {phEditError}
                  </p>
                ) : null}
                {phEditLoading ? (
                  <p className="mt-4 text-sm text-slate-500">{t('common.loading')}</p>
                ) : (
                  <>
                    <p className="mt-3 text-start text-sm font-medium text-slate-800 dark:text-slate-100">
                      {phEditSupplierLabel}
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-3 text-start">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          {t('purchasePage.date')}
                        </span>
                        <input
                          type="datetime-local"
                          value={phEditOccurredAt}
                          onChange={(e) => setPhEditOccurredAt(e.target.value)}
                          className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {stripUsdParens(t('purchasePage.discount'))}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={phEditDiscountUsd}
                            onChange={(e) => setPhEditDiscountUsd(e.target.value)}
                            className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {stripUsdParens(t('purchasePage.amountPaid'))}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={phEditAmountPaidUsd}
                            onChange={(e) => setPhEditAmountPaidUsd(e.target.value)}
                            className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {t('purchasePage.paymentType')}
                          </span>
                          <select
                            value={phEditPaymentType}
                            onChange={(e) => setPhEditPaymentType(e.target.value === 'cash' ? 'cash' : 'debt')}
                            className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          >
                            <option value="cash">{t('purchasePage.paymentCash')}</option>
                            <option value="debt">{t('purchasePage.paymentDebt')}</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">USD / IQD</span>
                          <select
                            value={phEditCurrency}
                            onChange={(e) => setPhEditCurrency(e.target.value === 'IQD' ? 'IQD' : 'USD')}
                            className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          >
                            <option value="USD">USD</option>
                            <option value="IQD">IQD</option>
                          </select>
                        </label>
                      </div>
                      {phEditCurrency === 'IQD' ? (
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {t('purchasePage.exchangeRate')}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={phEditExchangeRate}
                            onChange={(e) => setPhEditExchangeRate(e.target.value)}
                            className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </label>
                      ) : null}
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          {t('purchasePage.invoiceNumber')}
                        </span>
                        <input
                          type="text"
                          value={phEditInvoice}
                          onChange={(e) => setPhEditInvoice(digitsOnlyAscii(e.target.value))}
                          className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          spellCheck={false}
                        />
                        <span className="text-[11px] text-slate-500">{t('purchasePage.invoiceDigitsOnly')}</span>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('purchasePage.note')}</span>
                        <textarea
                          value={phEditNote}
                          onChange={(e) => setPhEditNote(e.target.value)}
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          spellCheck={false}
                        />
                      </label>
                    </div>
                    <div className="mt-5 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={closePhEdit}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
                      >
                        {t('crud.cancel')}
                      </button>
                      <button
                        type="button"
                        disabled={phEditSaving || phEditLoading}
                        onClick={() => void savePhEdit()}
                        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                      >
                        {phEditSaving ? t('pos.saving') : t('crud.save')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}

      {tab === 'form' && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('purchasePage.company')}
                </span>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">{t('crud.selectPlaceholder')}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('purchasePage.date')}
                </span>
                <input
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              {companyId && outstandingUsd != null ? (
                <p
                  className={`sm:col-span-2 text-sm font-medium tabular-nums ${
                    parseFloat(outstandingUsd) > 0 ? 'text-amber-800 dark:text-amber-200' : 'text-slate-500'
                  }`}
                >
                  {parseFloat(outstandingUsd) > 0
                    ? t('purchasePage.outstanding').replace('{usd}', formatUsdCellString(outstandingUsd))
                    : t('purchasePage.noOutstanding')}
                </p>
              ) : null}

              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('common.currencyUsd')} / {t('common.currencyIqd')}
                </span>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'USD' | 'IQD')}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="USD">USD</option>
                  <option value="IQD">IQD</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('purchasePage.paymentType')}
                </span>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as 'cash' | 'debt')}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="cash">{t('purchasePage.paymentCash')}</option>
                  <option value="debt">{t('purchasePage.paymentDebt')}</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('purchasePage.discount')}
                </span>
                <input
                  value={discountUsd}
                  onChange={(e) => setDiscountUsd(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  inputMode="decimal"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('purchasePage.amountPaid')}
                </span>
                <input
                  value={amountPaidUsd}
                  onChange={(e) => setAmountPaidUsd(e.target.value)}
                  disabled={paymentType === 'cash'}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  inputMode="decimal"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('purchasePage.note')}
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-600">
              <div className="mb-2 hidden grid-cols-12 gap-2 px-1 text-[11px] font-semibold text-slate-900 sm:grid dark:text-slate-100">
                <span className="sm:col-span-4">{t('purchasePage.product')}</span>
                <span className="sm:col-span-2">{t('purchasePage.quantity')}</span>
                <span className="sm:col-span-2">{t('purchasePage.unitPrice')} (USD)</span>
                <span className="sm:col-span-2">{t('purchasePage.damaged')}</span>
                <span className="sm:col-span-2">{t('purchasePage.lineTotal')} (USD)</span>
              </div>
              <div className="space-y-3">
                {lines.map((ln, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-12 dark:border-slate-700"
                  >
                    <div className="sm:col-span-4">
                      <input
                        list={`purchase-products-${idx}`}
                        value={ln.productName}
                        onChange={(e) => {
                          const typed = e.target.value
                          const match = products.find(
                            (p) => p.name.trim().toLowerCase() === typed.trim().toLowerCase(),
                          )
                          setLines((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? { ...x, productName: typed, productId: match ? String(match.id) : '' }
                                : x,
                            ),
                          )
                        }}
                        className="min-h-11 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        placeholder={t('purchasePage.product')}
                      />
                      <datalist id={`purchase-products-${idx}`}>
                        {products.map((p) => (
                          <option key={p.id} value={p.name} />
                        ))}
                      </datalist>
                    </div>
                    <input
                      className="min-h-11 rounded-lg border border-slate-200 px-2 py-1 text-sm tabular-nums sm:col-span-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                      value={ln.quantity}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)),
                        )
                      }
                      onBlur={() =>
                        setLines((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, quantity: x.quantity.trim() === '' ? '0' : x.quantity } : x,
                          ),
                        )
                      }
                      inputMode="numeric"
                      placeholder={t('purchasePage.quantity')}
                    />
                    <input
                      className="min-h-11 rounded-lg border border-slate-200 px-2 py-1 text-sm tabular-nums sm:col-span-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                      value={ln.unitPrice}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, unitPrice: e.target.value } : x)),
                        )
                      }
                      inputMode="decimal"
                      placeholder="USD"
                    />
                    <input
                      className="min-h-11 rounded-lg border border-slate-200 px-2 py-1 text-sm tabular-nums sm:col-span-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                      value={ln.damaged}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, damaged: e.target.value } : x)),
                        )
                      }
                      onBlur={() =>
                        setLines((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, damaged: x.damaged.trim() === '' ? '0' : x.damaged } : x,
                          ),
                        )
                      }
                      inputMode="numeric"
                      placeholder="0"
                    />
                    <div className="flex items-center justify-between gap-2 sm:col-span-2">
                      <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
                        {formatMoneySmart(lineUsdTotals[idx])}
                      </span>
                      <button
                        type="button"
                        disabled={lines.length < 2}
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-xs text-rose-600 disabled:opacity-40"
                      >
                        {t('purchasePage.removeLine')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                className="mt-2 text-sm font-medium text-violet-600 hover:underline"
              >
                + {t('purchasePage.addLine')}
              </button>
              <div className="mt-3">
                <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm dark:border-violet-800 dark:bg-violet-950/40">
                  <p className="text-xs text-violet-700 dark:text-violet-300">{t('pos.totalUsd')}</p>
                  <p className="font-semibold tabular-nums text-violet-900 dark:text-violet-200">
                    {formatMoneySmart(netAfterDiscount)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {canAdd && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submitPurchase()}
                  className="min-h-11 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {submitting ? t('inv.saving') : t('purchasePage.submit')}
                </button>
              )}
              <button
                type="button"
                onClick={resetForm}
                className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm dark:border-slate-600 dark:text-slate-200"
              >
                {t('purchasePage.resetForm')}
              </button>
            </div>
          </div>

        </>
      )}
    </div>
  )
}

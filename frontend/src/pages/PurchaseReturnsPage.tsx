import { Pencil } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLocale } from '../context/LocaleContext'
import { useSession } from '../context/SessionContext'
import { apiJson } from '../lib/api'
import { hasPerm } from '../lib/permissions'
import type { Paginated, ProductRow } from '../types/api'

type CompanyRow = {
  id: number
  name: string
  phone_1?: string
  phone_2?: string
}

type PurchaseLineRow = {
  id: number
  quantity: number
  returned_quantity?: number
  product_name?: string
  manual_name?: string
  unit_cost_usd?: string
}

type PurchaseHistoryRow = {
  id: number
  company: number | null
  company_name?: string
  occurred_at: string
  invoice_number?: string
  lines_summary?: string
  lines_product_names?: string
  total_units?: number
  has_returns?: boolean
  lines?: PurchaseLineRow[]
}

type ReturnLineForm = {
  purchaseLineId: number
  productName: string
  maxQty: number
  quantity: string
}

type PurchaseReturnHistoryRow = {
  id: number
  purchase_return_id: number
  purchase_id: number
  purchase_invoice_number?: string
  company_name?: string
  product_name?: string
  quantity: number
  unit_cost_usd?: string
  occurred_at: string
  note?: string
}

function asList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatDateTimeCell(value: string | undefined | null): string {
  if (!value) return '—'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return String(value)
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`
}

function toDatetimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function formatMoneyCompact(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0'
  const n = Number(String(value).replace(/,/g, '').trim())
  if (!Number.isFinite(n)) return String(value ?? '')
  return n.toFixed(2).replace(/\.?0+$/, '')
}

function normalizeNum(s: string) {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
    .replace(/[\s,،\u066C]/g, '')
    .trim()
}

function parseDec(s: string) {
  const n = parseFloat(normalizeNum(s))
  return Number.isNaN(n) ? 0 : n
}

function digitsOnlyAscii(s: string) {
  return normalizeNum(s).replace(/\D/g, '').slice(0, 128)
}

function purchaseReceiptDisplay(p: PurchaseHistoryRow): string {
  const normalized = normalizeNum(String(p.invoice_number ?? '').trim())
  if (normalized !== '' && /^\d+$/.test(normalized)) {
    const trimmed = normalized.replace(/^0+/, '')
    return trimmed === '' ? '0' : trimmed
  }
  return String(p.id)
}

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

export function PurchaseReturnsPage() {
  const { t } = useLocale()
  const [searchParams] = useSearchParams()
  const { me, loading: sessionLoading } = useSession()
  const [tab, setTab] = useState<'form' | 'history'>(
    searchParams.get('tab') === 'history' ? 'history' : 'form',
  )
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [historyRows, setHistoryRows] = useState<PurchaseHistoryRow[]>([])
  const [companies, setCompanies] = useState<CompanyRow[]>([])

  const [historyCompanyName, setHistoryCompanyName] = useState('')
  const [historyCompanyPhone, setHistoryCompanyPhone] = useState('')
  const [historyProductName, setHistoryProductName] = useState('')
  const [historyCompanyFilterOpen, setHistoryCompanyFilterOpen] = useState(false)
  const [historyPhoneFilterOpen, setHistoryPhoneFilterOpen] = useState(false)
  const [historyProductFilterOpen, setHistoryProductFilterOpen] = useState(false)
  const [historyInvoiceFilterOpen, setHistoryInvoiceFilterOpen] = useState(false)
  const [historyInvoice, setHistoryInvoice] = useState('')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [shopProducts, setShopProducts] = useState<ProductRow[]>([])

  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseHistoryRow | null>(null)
  const [lockedReceiptId, setLockedReceiptId] = useState<number | null>(null)
  const [companyId, setCompanyId] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [note, setNote] = useState('')
  const [returnLines, setReturnLines] = useState<ReturnLineForm[]>([])
  const [returnsHistoryRows, setReturnsHistoryRows] = useState<PurchaseReturnHistoryRow[]>([])
  const [returnsHistoryLoading, setReturnsHistoryLoading] = useState(false)
  const [returnsCompanyName, setReturnsCompanyName] = useState('')
  const [returnsInvoice, setReturnsInvoice] = useState('')
  const [returnsProductName, setReturnsProductName] = useState('')
  const [returnsCompanyFilterOpen, setReturnsCompanyFilterOpen] = useState(false)
  const [returnsInvoiceFilterOpen, setReturnsInvoiceFilterOpen] = useState(false)
  const [returnsProductFilterOpen, setReturnsProductFilterOpen] = useState(false)
  const [returnsDateFrom, setReturnsDateFrom] = useState('')
  const [returnsDateTo, setReturnsDateTo] = useState('')
  const productCatalogNames = useMemo(
    () =>
      Array.from(
        new Set(shopProducts.map((p) => String(p.name ?? '').trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [shopProducts],
  )

  const companyNameSuggestions = useMemo(
    () =>
      Array.from(new Set(companies.map((c) => String(c.name ?? '').trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [companies],
  )

  const companyPhoneSuggestions = useMemo(() => {
    const set = new Set<string>()
    for (const c of companies) {
      const p1 = String(c.phone_1 ?? '').trim()
      const p2 = String(c.phone_2 ?? '').trim()
      if (p1) set.add(p1)
      if (p2) set.add(p2)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [companies])

  const purchaseInvoiceSuggestions = useMemo(() => {
    const set = new Set<string>()
    for (const p of historyRows) {
      const d = digitsOnlyAscii(purchaseReceiptDisplay(p))
      if (d) set.add(d)
    }
    return Array.from(set).sort((a, b) => {
      const na = parseInt(a, 10)
      const nb = parseInt(b, 10)
      if (
        Number.isFinite(na) &&
        Number.isFinite(nb) &&
        String(na) === a &&
        String(nb) === b
      ) {
        return nb - na
      }
      return b.localeCompare(a)
    })
  }, [historyRows])

  const returnsInvoiceSuggestions = useMemo(() => {
    const set = new Set<string>()
    for (const row of returnsHistoryRows) {
      const inv = digitsOnlyAscii(String(row.purchase_invoice_number ?? ''))
      if (inv) set.add(inv)
      const fallback = String(row.purchase_id)
      if (fallback) set.add(fallback)
    }
    return Array.from(set).sort((a, b) => {
      const na = parseInt(a, 10)
      const nb = parseInt(b, 10)
      if (
        Number.isFinite(na) &&
        Number.isFinite(nb) &&
        String(na) === a &&
        String(nb) === b
      ) {
        return nb - na
      }
      return b.localeCompare(a)
    })
  }, [returnsHistoryRows])

  const canView = Boolean(me && hasPerm(me, 'view_purchase'))
  const canAdd = Boolean(me && hasPerm(me, 'add_purchase'))
  const canChangePurchase = Boolean(me && hasPerm(me, 'change_purchase', 'change_product'))

  const [returnsEditOpen, setReturnsEditOpen] = useState(false)
  const [returnsEditSaving, setReturnsEditSaving] = useState(false)
  const [returnsEditError, setReturnsEditError] = useState<string | null>(null)
  const [returnsEditLineId, setReturnsEditLineId] = useState<number | null>(null)
  const [returnsEditLabel, setReturnsEditLabel] = useState('')
  const [returnsEditOccurredAt, setReturnsEditOccurredAt] = useState('')
  const [returnsEditUnitCostUsd, setReturnsEditUnitCostUsd] = useState('')
  const [returnsEditNote, setReturnsEditNote] = useState('')

  const loadCompanies = useCallback(async () => {
    if (!canView) return
    try {
      const co = await apiJson<CompanyRow[] | { results: CompanyRow[] }>('/api/companies/')
      setCompanies(asList(co))
    } catch {
      setCompanies([])
    }
  }, [canView])

  const loadShopProducts = useCallback(async () => {
    if (!canView) return
    try {
      const pr = await apiJson<ProductRow[] | { results: ProductRow[] }>(
        '/api/products/?page_size=200&exclude_discontinued=1',
      )
      setShopProducts(asList(pr))
    } catch {
      setShopProducts([])
    }
  }, [canView])

  const loadPurchaseHistory = useCallback(async () => {
    if (!canView) return
    setHistoryLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const params = new URLSearchParams()
      const cn = historyCompanyName.trim()
      const cp = historyCompanyPhone.trim()
      const pn = historyProductName.trim()
      const inv = historyInvoice.trim()
      const df = historyDateFrom.trim()
      const dt = historyDateTo.trim()
      if (cn) params.set('company_name', cn)
      if (cp) params.set('company_phone', cp)
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
  }, [canView, historyCompanyName, historyCompanyPhone, historyDateFrom, historyDateTo, historyInvoice, historyProductName, t])

  const loadReturnsHistory = useCallback(async () => {
    if (!canView) return
    setReturnsHistoryLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      const cn = returnsCompanyName.trim()
      const inv = returnsInvoice.trim()
      const pn = returnsProductName.trim()
      const df = returnsDateFrom.trim()
      const dt = returnsDateTo.trim()
      if (cn) params.set('company_name', cn)
      if (inv) params.set('invoice', inv)
      if (pn) params.set('product_name', pn)
      if (df) params.set('date_from', df)
      if (dt) params.set('date_to', dt)
      const q = params.toString() ? `?${params.toString()}` : ''
      const data = await apiJson<Paginated<PurchaseReturnHistoryRow> | PurchaseReturnHistoryRow[]>(
        `/api/purchases/returns-history/${q}`,
      )
      setReturnsHistoryRows(asList(data))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
      setReturnsHistoryRows([])
    } finally {
      setReturnsHistoryLoading(false)
    }
  }, [canView, returnsCompanyName, returnsDateFrom, returnsDateTo, returnsInvoice, returnsProductName, t])

  function closeReturnsEdit() {
    setReturnsEditOpen(false)
    setReturnsEditSaving(false)
    setReturnsEditError(null)
    setReturnsEditLineId(null)
    setReturnsEditLabel('')
    setReturnsEditOccurredAt('')
    setReturnsEditUnitCostUsd('')
    setReturnsEditNote('')
  }

  function openReturnsEdit(row: PurchaseReturnHistoryRow) {
    setReturnsEditError(null)
    setReturnsEditLineId(row.id)
    setReturnsEditLabel(
      [row.company_name, row.product_name].filter(Boolean).join(' · ') || `#${row.id}`,
    )
    const d = new Date(row.occurred_at)
    setReturnsEditOccurredAt(Number.isNaN(d.getTime()) ? '' : toDatetimeLocalValue(d))
    setReturnsEditUnitCostUsd(formatMoneyCompact(row.unit_cost_usd ?? '0'))
    setReturnsEditNote(String(row.note ?? ''))
    setReturnsEditOpen(true)
  }

  async function saveReturnsEdit() {
    if (returnsEditLineId == null) return
    let occurred = returnsEditOccurredAt.trim()
    if (occurred.length === 16) occurred = `${occurred}:00`
    const dt = new Date(occurred)
    if (Number.isNaN(dt.getTime())) {
      setReturnsEditError(t('inv.historyEditInvalidDate'))
      return
    }
    const uc = parseDec(returnsEditUnitCostUsd)
    if (!Number.isFinite(uc) || uc < 0) {
      setReturnsEditError(t('common.error'))
      return
    }
    setReturnsEditSaving(true)
    setReturnsEditError(null)
    try {
      await apiJson(`/api/purchases/purchase-return-lines/${returnsEditLineId}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          occurred_at: dt.toISOString(),
          note: returnsEditNote.trim(),
          unit_cost_usd: uc.toFixed(4),
        }),
      })
      closeReturnsEdit()
      await loadReturnsHistory()
    } catch (e) {
      setReturnsEditError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setReturnsEditSaving(false)
    }
  }

  const buildReturnLines = useCallback((purchase: PurchaseHistoryRow) => {
    const lines = (purchase.lines ?? [])
      .map((ln) => {
        const maxQty = Math.max(0, Number(ln.quantity) - Number(ln.returned_quantity ?? 0))
        if (maxQty <= 0) return null
        return {
          purchaseLineId: ln.id,
          productName: String(ln.product_name ?? ln.manual_name ?? `#${ln.id}`),
          maxQty,
          quantity: '',
        } as ReturnLineForm
      })
      .filter((x): x is ReturnLineForm => x !== null)
    setReturnLines(lines)
  }, [])

  const selectPurchase = useCallback(
    async (row: PurchaseHistoryRow) => {
      setError(null)
      setSuccess(null)
      setLockedReceiptId(row.id)
      // Lock selection immediately so the receipts table hides right away.
      setSelectedPurchase(row)
      setCompanyId(row.company ? String(row.company) : '')
      setOccurredAt(String(row.occurred_at ?? '').slice(0, 16))
      setInvoiceNumber(digitsOnlyAscii(String(row.invoice_number ?? '')))
      setNote('')
      buildReturnLines(row)
      try {
        const details = await apiJson<PurchaseHistoryRow>(`/api/purchases/${row.id}/`)
        const selected = { ...row, ...details }
        setSelectedPurchase(selected)
        setCompanyId(selected.company ? String(selected.company) : '')
        setOccurredAt(String(selected.occurred_at ?? '').slice(0, 16))
        setInvoiceNumber(digitsOnlyAscii(String(selected.invoice_number ?? '')))
        setNote('')
        buildReturnLines(selected)
      } catch {
        // Keep initial selection data if details fetch fails.
      }
    },
    [buildReturnLines],
  )

  useEffect(() => {
    void loadCompanies()
    void loadShopProducts()
  }, [loadCompanies, loadShopProducts])

  useEffect(() => {
    if (tab === 'form') void loadPurchaseHistory()
  }, [loadPurchaseHistory, tab])

  useEffect(() => {
    if (tab === 'history') void loadReturnsHistory()
  }, [loadReturnsHistory, tab])

  const selectedCompanyName = useMemo(() => {
    if (!companyId) return ''
    return companies.find((c) => String(c.id) === String(companyId))?.name ?? ''
  }, [companies, companyId])

  const visibleHistoryRows = useMemo(() => {
    if (lockedReceiptId == null) return historyRows
    return historyRows.filter((row) => row.id === lockedReceiptId)
  }, [historyRows, lockedReceiptId])

  async function submitReturn() {
    if (!canAdd) return
    if (!selectedPurchase) {
      setError(t('purchaseReturns.needPurchase'))
      return
    }
    const lines = returnLines
      .map((ln) => ({
        purchase_line_id: ln.purchaseLineId,
        quantity: Math.max(0, Math.floor(parseDec(ln.quantity))),
        maxQty: ln.maxQty,
      }))
      .filter((x) => x.quantity > 0)

    if (lines.length === 0) {
      setError(t('purchaseReturns.needLines'))
      return
    }
    if (lines.some((x) => x.quantity > x.maxQty)) {
      setError(t('purchaseReturns.qtyTooHigh'))
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await apiJson('/api/purchases/return-products/', {
        method: 'POST',
        body: JSON.stringify({
          purchase_id: selectedPurchase.id,
          note: note.trim(),
          lines: lines.map((x) => ({
            purchase_line_id: x.purchase_line_id,
            quantity: x.quantity,
          })),
        }),
      })
      setSuccess(t('purchaseReturns.returnSuccess'))
      setSelectedPurchase(null)
      setLockedReceiptId(null)
      setCompanyId('')
      setOccurredAt('')
      setInvoiceNumber('')
      setNote('')
      setReturnLines([])
      await loadPurchaseHistory()
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

  const returnsHistoryColSpan = canChangePurchase ? 8 : 7

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t('nav.purchaseReturns')}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('form')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === 'form'
                ? 'bg-violet-600 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {t('nav.purchaseReturns')}
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === 'history'
                ? 'bg-violet-600 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {t('purchaseReturns.historyBtn')}
          </button>
          <Link to="/manage/purchases" className="text-sm font-medium text-violet-600 hover:underline">
            {t('purchaseReturns.backToPurchases')}
          </Link>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {success}
        </p>
      )}

      {tab === 'form' && <div className="space-y-4">
        {lockedReceiptId == null && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('purchaseReturns.searchTitle')}
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-7">
            <label className="relative">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('purchasePage.filterCompanyName')}
              </span>
              <input
                value={historyCompanyName}
                onChange={(e) => {
                  setHistoryCompanyName(e.target.value)
                  setHistoryCompanyFilterOpen(true)
                }}
                onFocus={() => {
                  setHistoryPhoneFilterOpen(false)
                  setHistoryProductFilterOpen(false)
                  setHistoryInvoiceFilterOpen(false)
                  setHistoryCompanyFilterOpen(true)
                }}
                onBlur={() => window.setTimeout(() => setHistoryCompanyFilterOpen(false), 120)}
                className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
              {historyCompanyFilterOpen && companyNameSuggestions.length > 0 ? (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-900">
                  {companyNameSuggestions
                    .filter((name) =>
                      !historyCompanyName.trim()
                        ? true
                        : name.toLowerCase().includes(historyCompanyName.trim().toLowerCase()),
                    )
                    .map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setHistoryCompanyName(name)
                            setHistoryCompanyFilterOpen(false)
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
            <label className="relative">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('purchaseReturns.filterCompanyPhone')}
              </span>
              <input
                value={historyCompanyPhone}
                onChange={(e) => {
                  setHistoryCompanyPhone(e.target.value)
                  setHistoryPhoneFilterOpen(true)
                }}
                onFocus={() => {
                  setHistoryCompanyFilterOpen(false)
                  setHistoryProductFilterOpen(false)
                  setHistoryInvoiceFilterOpen(false)
                  setHistoryPhoneFilterOpen(true)
                }}
                onBlur={() => window.setTimeout(() => setHistoryPhoneFilterOpen(false), 120)}
                className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
              {historyPhoneFilterOpen && companyPhoneSuggestions.length > 0 ? (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-900">
                  {companyPhoneSuggestions
                    .filter((phone) =>
                      !historyCompanyPhone.trim()
                        ? true
                        : phone.includes(historyCompanyPhone.trim()),
                    )
                    .map((phone) => (
                      <li key={phone}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setHistoryCompanyPhone(phone)
                            setHistoryPhoneFilterOpen(false)
                          }}
                          className="w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          {phone}
                        </button>
                      </li>
                    ))}
                </ul>
              ) : null}
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
                onFocus={() => {
                  setHistoryCompanyFilterOpen(false)
                  setHistoryPhoneFilterOpen(false)
                  setHistoryInvoiceFilterOpen(false)
                  setHistoryProductFilterOpen(true)
                }}
                onBlur={() => window.setTimeout(() => setHistoryProductFilterOpen(false), 120)}
                className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
              {historyProductFilterOpen && productCatalogNames.length > 0 ? (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-900">
                  {productCatalogNames
                    .filter((name) =>
                      !historyProductName.trim()
                        ? true
                        : name.toLowerCase().includes(historyProductName.trim().toLowerCase()),
                    )
                    .map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
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
            <label className="relative">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('purchasePage.filterInvoice')}
              </span>
              <input
                value={historyInvoice}
                onChange={(e) => {
                  setHistoryInvoice(digitsOnlyAscii(e.target.value))
                  setHistoryInvoiceFilterOpen(true)
                }}
                onFocus={() => {
                  setHistoryCompanyFilterOpen(false)
                  setHistoryPhoneFilterOpen(false)
                  setHistoryProductFilterOpen(false)
                  setHistoryInvoiceFilterOpen(true)
                }}
                onBlur={() => window.setTimeout(() => setHistoryInvoiceFilterOpen(false), 120)}
                inputMode="numeric"
                className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
              {historyInvoiceFilterOpen && purchaseInvoiceSuggestions.length > 0 ? (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-900">
                  {purchaseInvoiceSuggestions
                    .filter((inv) =>
                      !historyInvoice.trim() ? true : inv.includes(historyInvoice.trim()),
                    )
                    .map((inv) => (
                      <li key={inv}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setHistoryInvoice(inv)
                            setHistoryInvoiceFilterOpen(false)
                          }}
                          className="w-full px-3 py-2 text-start font-mono text-sm tabular-nums hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          {inv}
                        </button>
                      </li>
                    ))}
                </ul>
              ) : null}
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
                  setHistoryCompanyPhone('')
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
        )}

        {lockedReceiptId == null && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-3 py-2 text-start">{t('purchasePage.colWhen')}</th>
                <th className="px-3 py-2 text-start">{t('purchasePage.colCompany')}</th>
                <th className="px-3 py-2 text-center">{t('purchasePage.colProducts')}</th>
                <th className="px-3 py-2 text-center">{t('purchasePage.colTotalUnits')}</th>
                <th className="px-3 py-2 text-start">{t('purchasePage.colInvoice')}</th>
                <th className="px-3 py-2 text-center">{t('purchasePage.colHasReturns')}</th>
                <th className="px-3 py-2 text-center">{t('crud.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-slate-500">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : visibleHistoryRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-slate-500">
                    {t('crud.noRows')}
                  </td>
                </tr>
              ) : (
                visibleHistoryRows.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                      {formatDateTimeCell(p.occurred_at)}
                    </td>
                    <td className="px-3 py-2">{p.company_name ?? '—'}</td>
                    <td className="px-3 py-2 text-center text-xs leading-relaxed font-medium text-slate-900 dark:text-slate-100">
                      {formatProductsSummaryCell(p.lines_product_names ?? p.lines_summary)}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs tabular-nums">
                      {typeof p.total_units === 'number' ? p.total_units : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums">
                      {purchaseReceiptDisplay(p)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs font-medium">
                      {p.has_returns ? t('purchasePage.hasReturnsYes') : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => void selectPurchase(p)}
                        className="rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                      >
                        {t('purchaseReturns.selectReceipt')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('purchasePage.company')}
              </span>
              <input
                value={selectedCompanyName}
                readOnly
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('purchasePage.date')}
              </span>
              <input
                type="datetime-local"
                value={occurredAt}
                readOnly
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('purchasePage.invoiceNumber')}
              </span>
              <input
                value={invoiceNumber}
                readOnly
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono tabular-nums dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
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
                placeholder={t('purchaseReturns.notePlaceholder')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-600">
            <div className="mb-2 hidden grid-cols-12 gap-2 px-1 text-[11px] font-semibold text-slate-900 sm:grid dark:text-slate-100">
              <span className="sm:col-span-6">{t('purchasePage.product')}</span>
              <span className="sm:col-span-3">{t('purchaseReturns.maxReturnQty')}</span>
              <span className="sm:col-span-3">{t('pos.returnQty')}</span>
            </div>
            <div className="space-y-3">
              {returnLines.length === 0 ? (
                <p className="text-sm text-slate-500">{t('purchaseReturns.selectReceiptHint')}</p>
              ) : (
                returnLines.map((ln) => (
                  <div
                    key={ln.purchaseLineId}
                    className="grid gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-12 dark:border-slate-700"
                  >
                    <div className="sm:col-span-6">
                      <input
                        value={ln.productName}
                        readOnly
                        className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
                      />
                    </div>
                    <input
                      className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm tabular-nums sm:col-span-3 dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
                      value={String(ln.maxQty)}
                      readOnly
                    />
                    <input
                      className="min-h-11 rounded-lg border border-slate-200 px-2 py-1 text-sm tabular-nums sm:col-span-3 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                      value={ln.quantity}
                      onChange={(e) =>
                        setReturnLines((prev) =>
                          prev.map((x) =>
                            x.purchaseLineId === ln.purchaseLineId
                              ? { ...x, quantity: e.target.value }
                              : x,
                          ),
                        )
                      }
                      inputMode="numeric"
                      placeholder="0"
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {canAdd && (
              <button
                type="button"
                disabled={submitting || !selectedPurchase}
                onClick={() => void submitReturn()}
                className="min-h-11 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {submitting ? t('inv.saving') : t('purchaseReturns.submit')}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedPurchase(null)
                setLockedReceiptId(null)
                setCompanyId('')
                setOccurredAt('')
                setInvoiceNumber('')
                setNote('')
                setReturnLines([])
              }}
              className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm dark:border-slate-600 dark:text-slate-200"
            >
              {t('purchasePage.resetForm')}
            </button>
          </div>
        </div>
      </div>}

      {tab === 'history' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('purchaseReturns.historyTitle')}</h2>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-6">
              <label className="relative">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('purchasePage.filterCompanyName')}</span>
                <input
                  value={returnsCompanyName}
                  onChange={(e) => {
                    setReturnsCompanyName(e.target.value)
                    setReturnsCompanyFilterOpen(true)
                  }}
                  onFocus={() => {
                    setReturnsInvoiceFilterOpen(false)
                    setReturnsProductFilterOpen(false)
                    setReturnsCompanyFilterOpen(true)
                  }}
                  onBlur={() => window.setTimeout(() => setReturnsCompanyFilterOpen(false), 120)}
                  className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
                {returnsCompanyFilterOpen && companyNameSuggestions.length > 0 ? (
                  <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-900">
                    {companyNameSuggestions
                      .filter((name) =>
                        !returnsCompanyName.trim()
                          ? true
                          : name.toLowerCase().includes(returnsCompanyName.trim().toLowerCase()),
                      )
                      .map((name) => (
                        <li key={name}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setReturnsCompanyName(name)
                              setReturnsCompanyFilterOpen(false)
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
              <label className="relative">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('purchasePage.filterInvoice')}</span>
                <input
                  value={returnsInvoice}
                  onChange={(e) => {
                    setReturnsInvoice(digitsOnlyAscii(e.target.value))
                    setReturnsInvoiceFilterOpen(true)
                  }}
                  onFocus={() => {
                    setReturnsCompanyFilterOpen(false)
                    setReturnsProductFilterOpen(false)
                    setReturnsInvoiceFilterOpen(true)
                  }}
                  onBlur={() => window.setTimeout(() => setReturnsInvoiceFilterOpen(false), 120)}
                  inputMode="numeric"
                  className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
                {returnsInvoiceFilterOpen && returnsInvoiceSuggestions.length > 0 ? (
                  <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-900">
                    {returnsInvoiceSuggestions
                      .filter((inv) =>
                        !returnsInvoice.trim() ? true : inv.includes(returnsInvoice.trim()),
                      )
                      .map((inv) => (
                        <li key={inv}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setReturnsInvoice(inv)
                              setReturnsInvoiceFilterOpen(false)
                            }}
                            className="w-full px-3 py-2 text-start font-mono text-sm tabular-nums hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            {inv}
                          </button>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </label>
              <label className="relative">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('purchasePage.filterProductName')}</span>
                <input
                  value={returnsProductName}
                  onChange={(e) => {
                    setReturnsProductName(e.target.value)
                    setReturnsProductFilterOpen(true)
                  }}
                  onFocus={() => {
                    setReturnsCompanyFilterOpen(false)
                    setReturnsInvoiceFilterOpen(false)
                    setReturnsProductFilterOpen(true)
                  }}
                  onBlur={() => window.setTimeout(() => setReturnsProductFilterOpen(false), 120)}
                  className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
                {returnsProductFilterOpen && productCatalogNames.length > 0 ? (
                  <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-900">
                    {productCatalogNames
                      .filter((name) =>
                        !returnsProductName.trim()
                          ? true
                          : name.toLowerCase().includes(returnsProductName.trim().toLowerCase()),
                      )
                      .map((name) => (
                        <li key={name}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setReturnsProductName(name)
                              setReturnsProductFilterOpen(false)
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
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('purchasePage.filterDateFrom')}</span>
                <input type="date" value={returnsDateFrom} onChange={(e) => setReturnsDateFrom(e.target.value)} className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100" />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('purchasePage.filterDateTo')}</span>
                <input type="date" value={returnsDateTo} onChange={(e) => setReturnsDateTo(e.target.value)} className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100" />
              </label>
              <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-1">
                <button type="button" disabled={returnsHistoryLoading} onClick={() => void loadReturnsHistory()} className="min-h-9 flex-1 rounded-lg bg-violet-600 px-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
                  {returnsHistoryLoading ? t('common.loading') : t('purchasePage.applyHistoryFilters')}
                </button>
                <button type="button" onClick={() => { setReturnsCompanyName(''); setReturnsInvoice(''); setReturnsProductName(''); setReturnsDateFrom(''); setReturnsDateTo(''); void loadReturnsHistory() }} className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-sm dark:border-slate-600 dark:text-slate-200">
                  {t('purchasePage.clearHistoryFilters')}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80">
                <tr>
                  <th className="px-3 py-2 text-start">{t('purchasePage.colWhen')}</th>
                  <th className="px-3 py-2 text-start">{t('purchasePage.colCompany')}</th>
                  <th className="px-3 py-2 text-start">{t('purchasePage.colInvoice')}</th>
                  <th className="px-3 py-2 text-start">{t('purchasePage.product')}</th>
                  <th className="px-3 py-2 text-center">{t('purchasePage.quantity')}</th>
                  <th className="px-3 py-2 text-center">{t('purchasePage.unitPrice')} (USD)</th>
                  <th className="px-3 py-2 text-start">{t('purchasePage.note')}</th>
                  {canChangePurchase ? (
                    <th className="sticky end-0 z-10 min-w-[3rem] bg-slate-50 px-2 py-2 text-center shadow-[-6px_0_8px_-4px_rgba(15,23,42,0.15)] dark:bg-slate-800/95 dark:shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.35)]">
                      {t('purchasePage.colActions')}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {returnsHistoryLoading ? (
                  <tr>
                    <td colSpan={returnsHistoryColSpan} className="px-3 py-4 text-slate-500">
                      {t('common.loading')}
                    </td>
                  </tr>
                ) : returnsHistoryRows.length === 0 ? (
                  <tr>
                    <td colSpan={returnsHistoryColSpan} className="px-3 py-4 text-slate-500">
                      {t('crud.noRows')}
                    </td>
                  </tr>
                ) : (
                  returnsHistoryRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{formatDateTimeCell(row.occurred_at)}</td>
                      <td className="px-3 py-2">{row.company_name || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs tabular-nums">{digitsOnlyAscii(String(row.purchase_invoice_number ?? '')) || String(row.purchase_id)}</td>
                      <td className="px-3 py-2">{row.product_name || '—'}</td>
                      <td className="px-3 py-2 text-center font-mono text-xs tabular-nums">{row.quantity}</td>
                      <td className="px-3 py-2 text-center font-mono text-xs tabular-nums">{formatMoneyCompact(row.unit_cost_usd ?? '0')}</td>
                      <td className="px-3 py-2">{row.note || '—'}</td>
                      {canChangePurchase ? (
                        <td className="sticky end-0 z-10 border-s border-slate-100 bg-white px-2 py-2 text-center align-middle shadow-[-6px_0_8px_-4px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.35)]">
                          <button
                            type="button"
                            onClick={() => openReturnsEdit(row)}
                            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                            title={t('purchasePage.editHistoryRow')}
                            aria-label={t('purchasePage.editHistoryRow')}
                          >
                            <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {returnsEditOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-4 sm:items-center lg:pr-64"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeReturnsEdit()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="returns-edit-title"
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="returns-edit-title" className="text-start text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t('purchaseReturns.editHistoryTitle')}
            </h3>
            <p className="mt-2 text-start text-xs text-slate-500 dark:text-slate-400">{t('purchaseReturns.editHistoryHint')}</p>
            {returnsEditError ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {returnsEditError}
              </p>
            ) : null}
            <p className="mt-3 text-start text-sm font-medium text-slate-800 dark:text-slate-100">{returnsEditLabel}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 text-start">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('inv.historyEditOccurredAt')}</span>
                <input
                  type="datetime-local"
                  value={returnsEditOccurredAt}
                  onChange={(e) => setReturnsEditOccurredAt(e.target.value)}
                  className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('purchaseReturns.editUnitCost')}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={returnsEditUnitCostUsd}
                  onChange={(e) => setReturnsEditUnitCostUsd(e.target.value)}
                  className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('inv.historyEditNote')}</span>
                <textarea
                  value={returnsEditNote}
                  onChange={(e) => setReturnsEditNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  spellCheck={false}
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeReturnsEdit}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
              >
                {t('crud.cancel')}
              </button>
              <button
                type="button"
                disabled={returnsEditSaving}
                onClick={() => void saveReturnsEdit()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {returnsEditSaving ? t('pos.saving') : t('crud.save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

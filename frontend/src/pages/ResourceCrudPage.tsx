import { ArrowLeft, Banknote, Building2, Download, FileText, History, Pencil, Printer } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSubmitLock } from '../hooks/useSubmitLock'
import { Link, useParams } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { useLocale } from '../context/LocaleContext'
import { useSession } from '../context/SessionContext'
import { apiJson, isApiStatus } from '../lib/api'
import {
  formatInventoryLossExpenseName,
  formatInventoryLossExpenseNote,
} from '../lib/inventoryLossExpenseText'
import { buildReceiptHtml, computeReceiptSummaryFromSale, printReceiptHtml } from '../lib/receiptHtml'
import { withReceiptPrefs } from '../lib/receiptPrefs'
import { hasPerm } from '../lib/permissions'
import type { ReceiptSettingsRow, SaleListRow } from '../types/api'

type Option = { value: string; label: string }
type FieldType = 'text' | 'number' | 'date' | 'datetime' | 'textarea' | 'checkbox' | 'select'
type FieldDef = {
  key: string
  /** Fallback when labelKey is unset */
  label?: string
  /** When set, table/form use t(labelKey) instead of label */
  labelKey?: string
  /** Small helper under textarea */
  hintKey?: string
  type: FieldType
  required?: boolean
  optionsFrom?: string
}
type ResourceConfig = {
  endpoint: string
  title: string
  /** Page title via i18n key */
  titleKey?: string
  modelCodename: string
  searchParam?: string
  fields: FieldDef[]
  /** Map API column name → i18n key for table header */
  columnLabelKeys?: Record<string, string>
  toPayload?: (draft: Record<string, unknown>) => Record<string, unknown>
}

const RESOURCE_CONFIG: Record<string, ResourceConfig> = {
  categories: {
    endpoint: '/api/categories/',
    title: 'Categories',
    modelCodename: 'category',
    searchParam: 'search',
    fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
  },
  companies: {
    endpoint: '/api/companies/',
    title: 'Companies',
    titleKey: 'nav.companies',
    modelCodename: 'company',
    searchParam: 'search',
    columnLabelKeys: {
      id: 'crud.col.id',
      shop: 'crud.col.shop',
      name: 'customersPage.fieldName',
      phone_1: 'customersPage.fieldPhone1',
      phone_2: 'customersPage.fieldPhone2',
      note: 'customersPage.fieldNote',
    },
    fields: [
      { key: 'name', labelKey: 'customersPage.fieldName', label: 'Name', type: 'text', required: true },
      { key: 'phone_1', labelKey: 'customersPage.fieldPhone1', label: 'Phone 1', type: 'text' },
      { key: 'phone_2', labelKey: 'customersPage.fieldPhone2', label: 'Phone 2', type: 'text' },
      { key: 'note', labelKey: 'customersPage.fieldNote', label: 'Note', type: 'textarea' },
    ],
  },
  customers: {
    endpoint: '/api/customers/',
    title: 'Customers',
    titleKey: 'nav.customers',
    modelCodename: 'customer',
    searchParam: 'search',
    columnLabelKeys: {
      id: 'crud.col.id',
      shop: 'crud.col.shop',
      name: 'customersPage.fieldName',
      workplace: 'customersPage.fieldWorkplace',
      address: 'customersPage.fieldAddress',
      phone_1: 'customersPage.fieldPhone1',
      phone_2: 'customersPage.fieldPhone2',
      requires_attention: 'customersPage.fieldNeedsAttention',
      note: 'customersPage.fieldNote',
    },
    fields: [
      { key: 'name', labelKey: 'customersPage.fieldName', label: 'Name', type: 'text', required: true },
      { key: 'workplace', labelKey: 'customersPage.fieldWorkplace', label: 'Workplace', type: 'text' },
      { key: 'address', labelKey: 'customersPage.fieldAddress', label: 'Address', type: 'text' },
      { key: 'phone_1', labelKey: 'customersPage.fieldPhone1', label: 'Phone 1', type: 'text' },
      { key: 'phone_2', labelKey: 'customersPage.fieldPhone2', label: 'Phone 2', type: 'text' },
      {
        key: 'requires_attention',
        labelKey: 'customersPage.fieldNeedsAttention',
        label: 'Needs attention',
        type: 'checkbox',
      },
      { key: 'note', labelKey: 'customersPage.fieldNote', label: 'Note', type: 'textarea' },
    ],
  },
  expenses: {
    endpoint: '/api/expenses/',
    title: 'Expenses',
    titleKey: 'nav.expenses',
    modelCodename: 'expense',
    columnLabelKeys: {
      id: 'expensePage.colId',
      shop: 'expensePage.colShop',
      name: 'expensePage.name',
      amount: 'expensePage.amount',
      currency: 'expensePage.currency',
      note: 'expensePage.note',
      occurred_on: 'expensePage.occurredOn',
      exchange_rate_usd_to_iqd: 'expensePage.rateWhenIqd',
      amount_usd: 'expensePage.colAmountUsd',
      created_at: 'expensePage.colCreated',
    },
    fields: [
      { key: 'name', labelKey: 'expensePage.name', label: 'Name', type: 'text', required: true },
      { key: 'amount', labelKey: 'expensePage.amount', label: 'Amount', type: 'number', required: true },
      { key: 'currency', labelKey: 'expensePage.currency', label: 'Currency', type: 'select', required: true },
      { key: 'occurred_on', labelKey: 'expensePage.occurredOn', label: 'Occurred on', type: 'date', required: true },
      { key: 'note', labelKey: 'expensePage.note', label: 'Note', type: 'textarea' },
    ],
    toPayload: (d) => ({
      name: d.name ?? '',
      amount: d.amount ?? '',
      currency: d.currency || 'USD',
      occurred_on: d.occurred_on ?? '',
      note: d.note ?? '',
    }),
  },
  shareholders: {
    endpoint: '/api/shareholders/',
    title: 'Shareholders',
    titleKey: 'nav.shareholders',
    modelCodename: 'shareholder',
    searchParam: 'search',
    columnLabelKeys: {
      id: 'crud.col.id',
      shop: 'crud.col.shop',
      name: 'profit.shName',
      share_percentage: 'profit.shPct',
      capital_contribution_usd: 'settings.shareholderCapitalUsd',
    },
    fields: [
      { key: 'name', labelKey: 'profit.shName', label: 'Name', type: 'text', required: true },
      { key: 'share_percentage', labelKey: 'profit.shPct', label: 'Share %', type: 'number', required: true },
      {
        key: 'capital_contribution_usd',
        labelKey: 'settings.shareholderCapitalUsd',
        type: 'number',
        required: false,
        hintKey: 'settings.shareholderCapitalHint',
      },
    ],
    toPayload: (d) => ({
      name: String(d.name ?? '').trim(),
      share_percentage: d.share_percentage ?? '',
      capital_contribution_usd: String(d.capital_contribution_usd ?? '').trim() || '0',
    }),
  },
  'opening-cash': {
    endpoint: '/api/cashier/opening/',
    title: 'Shop Day Opening Cash',
    modelCodename: 'shopdayopeningcash',
    fields: [
      { key: 'for_date', label: 'Date', type: 'date', required: true },
      { key: 'opening_cash_usd', label: 'Opening cash (USD)', type: 'number', required: true },
    ],
  },
}

function asList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function firstDayOfMonthISO(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`
}

function lastDayOfMonthISO(d: Date) {
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${e.getFullYear()}-${pad2(e.getMonth() + 1)}-${pad2(e.getDate())}`
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function expenseMonthRangeForResource(resource: string) {
  if (resource !== 'expenses') return { from: '', to: '' }
  const now = new Date()
  return { from: firstDayOfMonthISO(now), to: lastDayOfMonthISO(now) }
}

const EXPENSE_FORM_NAMES_LS_PREFIX = 'expense_form_saved_names'

function expenseNamesStorageKey(shopId: number | null | undefined): string {
  const sid = shopId != null && Number.isFinite(Number(shopId)) ? String(shopId) : '0'
  return `${EXPENSE_FORM_NAMES_LS_PREFIX}:${sid}`
}

function readExpenseSavedNames(shopId: number | null | undefined): string[] {
  try {
    const raw = localStorage.getItem(expenseNamesStorageKey(shopId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((x) => String(x).trim()).filter(Boolean)
  } catch {
    return []
  }
}

function persistExpenseSavedNames(shopId: number | null | undefined, names: string[]) {
  try {
    localStorage.setItem(expenseNamesStorageKey(shopId), JSON.stringify(names))
  } catch {
    /* ignore quota */
  }
}

/** Remember a label for future expense rows (per shop). Returns the merged list. */
function rememberExpenseName(shopId: number | null | undefined, name: string): string[] {
  const trimmed = name.trim()
  if (!trimmed) return readExpenseSavedNames(shopId)
  const prev = readExpenseSavedNames(shopId)
  const merged = Array.from(new Set([trimmed, ...prev])).slice(0, 250)
  persistExpenseSavedNames(shopId, merged)
  return merged
}

function toDatetimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function parseDec(s: string): number {
  const n = parseFloat(String(s).replace(/,/g, '').trim())
  return Number.isNaN(n) ? 0 : n
}

function digitsOnlyAscii(s: string) {
  return s.replace(/\D/g, '').slice(0, 128)
}

type PurchaseHistoryLine = {
  id?: number
  product?: number
  product_name?: string
  quantity?: number
  unit_cost_usd?: string
  damaged_quantity?: number
}

type PurchaseHistoryRow = {
  id: number
  occurred_at: string
  lines_summary?: string
  lines?: PurchaseHistoryLine[]
  discount_received_usd?: string
  amount_paid_usd?: string
  payment_type?: string
  currency?: string
  note?: string
  has_returns?: boolean
  exchange_rate_usd_to_iqd?: string
  invoice_number?: string
  company?: number | null
}

type PurchaseApiDetail = {
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
  lines: Array<{
    id: number
    product: number
    product_name?: string
    quantity: number
    unit_cost_usd: string
    damaged_quantity?: number
  }>
}

type PurchaseEditLineForm = {
  product: number
  productName: string
  quantity: string
  unitCostUsd: string
  damaged: string
}

function saleLineColumnValues(row: SaleListRow): {
  productNames: string
  quantities: string
  unitPrices: string
} {
  const lines = row.lines ?? []
  if (lines.length === 0) {
    return {
      productNames: '—',
      quantities: '—',
      unitPrices: '—',
    }
  }
  return {
    productNames: lines
      .map((ln) => {
        const base = ln.product_name || ln.manual_name || '?'
        const returned = Number(ln.returned_quantity ?? 0)
        return returned > 0 ? `${base} (گەڕاوە ${returned})` : base
      })
      .join('\n'),
    quantities: lines.map((ln) => String(ln.quantity ?? 0)).join('\n'),
    unitPrices: lines.map((ln) => formatMoneyCompact(ln.unit_price_usd ?? '—')).join('\n'),
  }
}

function purchaseLineColumnValues(row: PurchaseHistoryRow): {
  productNames: string
  quantities: string
  unitPrices: string
} {
  const lines = row.lines ?? []
  if (lines.length === 0) {
    return {
      productNames: row.lines_summary ?? '—',
      quantities: '—',
      unitPrices: '—',
    }
  }
  return {
    productNames: lines.map((ln) => ln.product_name ?? '?').join('\n'),
    quantities: lines.map((ln) => String(ln.quantity ?? 0)).join('\n'),
    unitPrices: lines.map((ln) => formatMoneyCompact(ln.unit_cost_usd ?? '—')).join('\n'),
  }
}

function stripUsdParens(label: string): string {
  return label.replace(/\s*\(USD\)\s*/gi, ' ').replace(/\s+/g, ' ').trim()
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

/** IQD/USD rate fields: up to 4 decimals, strip trailing zeros. */
function formatRateCompact(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '1'
  const n = Number(String(value).replace(/,/g, '').trim())
  if (!Number.isFinite(n)) return String(value ?? '').trim() || '1'
  return n.toFixed(4).replace(/\.?0+$/, '') || '1'
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

function downloadReceiptHtmlFile(html: string, saleId: number) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `receipt-${saleId}.html`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function ResourceCrudPage() {
  const { resource = '' } = useParams()
  const expenseMonth0 = expenseMonthRangeForResource(resource)
  const prevResourceRef = useRef('')
  const cfg = RESOURCE_CONFIG[resource]
  const { t, lang } = useLocale()
  const { me } = useSession()
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [search, setSearch] = useState('')
  const [phoneSearch, setPhoneSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [options, setOptions] = useState<Record<string, Option[]>>({})
  const [customerFilterOpen, setCustomerFilterOpen] = useState(false)
  const [customerLookup, setCustomerLookup] = useState<
    Array<{ id: number; name: string; phone_1?: string; phone_2?: string }>
  >([])

  const [historyCompany, setHistoryCompany] = useState<{ id: number; name: string } | null>(null)
  const [historyRows, setHistoryRows] = useState<PurchaseHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')

  const [saleHistCustomer, setSaleHistCustomer] = useState<{ id: number; name: string } | null>(null)
  const [saleHistRows, setSaleHistRows] = useState<SaleListRow[]>([])
  const [saleHistLoading, setSaleHistLoading] = useState(false)
  const [saleHistError, setSaleHistError] = useState<string | null>(null)
  const [saleHistDateFrom, setSaleHistDateFrom] = useState('')
  const [saleHistDateTo, setSaleHistDateTo] = useState('')
  const [saleHistProductQuery, setSaleHistProductQuery] = useState('')
  const [saleHistProductFilterOpen, setSaleHistProductFilterOpen] = useState(false)
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettingsRow | null>(null)
  const [receiptPreviewHtml, setReceiptPreviewHtml] = useState<string | null>(null)
  const [receiptPreviewSaleId, setReceiptPreviewSaleId] = useState<number | null>(null)
  const [expenseDateFrom, setExpenseDateFrom] = useState(expenseMonth0.from)
  const [expenseDateTo, setExpenseDateTo] = useState(expenseMonth0.to)
  const [expenseHistoryOpen, setExpenseHistoryOpen] = useState(false)
  const [expenseHistoryLoading, setExpenseHistoryLoading] = useState(false)
  const [expenseHistoryRows, setExpenseHistoryRows] = useState<Record<string, unknown>[]>([])
  const [expenseHistDateFrom, setExpenseHistDateFrom] = useState('')
  const [expenseHistDateTo, setExpenseHistDateTo] = useState('')
  const [expenseHistNameQuery, setExpenseHistNameQuery] = useState('')
  const [expenseHistNameSuggestOpen, setExpenseHistNameSuggestOpen] = useState(false)
  /** Recent expense labels (localStorage + current table rows). */
  const [expenseFormSavedNames, setExpenseFormSavedNames] = useState<string[]>([])
  const [expenseFormNameSuggestOpen, setExpenseFormNameSuggestOpen] = useState(false)

  const [purchaseEditOpen, setPurchaseEditOpen] = useState(false)
  const [purchaseEditLoading, setPurchaseEditLoading] = useState(false)
  const [purchaseEditSaving, setPurchaseEditSaving] = useState(false)
  const { isSubmitting: formSaving, runLocked: runFormSave } = useSubmitLock()
  const [purchaseEditError, setPurchaseEditError] = useState<string | null>(null)
  const [purchaseEditId, setPurchaseEditId] = useState<number | null>(null)
  const [purchaseEditCompanyId, setPurchaseEditCompanyId] = useState<number | null>(null)
  const [purchaseEditIsAutoStock, setPurchaseEditIsAutoStock] = useState(false)
  const [editOccurredAt, setEditOccurredAt] = useState('')
  const [editDiscountUsd, setEditDiscountUsd] = useState('')
  const [editAmountPaidUsd, setEditAmountPaidUsd] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editInvoice, setEditInvoice] = useState('')
  const [editCurrency, setEditCurrency] = useState<'USD' | 'IQD'>('USD')
  const [editPaymentType, setEditPaymentType] = useState<'cash' | 'debt'>('debt')
  const [editExchangeRate, setEditExchangeRate] = useState('')
  const [editLines, setEditLines] = useState<PurchaseEditLineForm[]>([])

  const openingCashViewPerms =
    resource === 'opening-cash' ? ['view_shopdayopeningcash', 'view_openingcash'] : null
  const canView = Boolean(
    me &&
      cfg &&
      (openingCashViewPerms
        ? hasPerm(me, ...openingCashViewPerms)
        : hasPerm(me, `view_${cfg.modelCodename}`)),
  )
  const canAdd = Boolean(
    me &&
      cfg &&
      (resource === 'opening-cash'
        ? hasPerm(me, 'add_shopdayopeningcash', 'add_openingcash')
        : hasPerm(me, `add_${cfg.modelCodename}`)),
  )
  const canChange = Boolean(
    me &&
      cfg &&
      (resource === 'opening-cash'
        ? hasPerm(me, 'change_shopdayopeningcash', 'change_openingcash')
        : hasPerm(me, `change_${cfg.modelCodename}`)),
  )
  const canDelete = Boolean(
    me &&
      cfg &&
      (resource === 'opening-cash'
        ? hasPerm(me, 'delete_shopdayopeningcash', 'delete_openingcash')
        : hasPerm(me, `delete_${cfg.modelCodename}`)),
  )
  const canViewPurchaseHistory = Boolean(me && hasPerm(me, 'view_purchase'))
  const canChangePurchase = Boolean(me && hasPerm(me, 'change_purchase', 'change_product'))
  const canViewCompanyDebtsPage = Boolean(me && hasPerm(me, 'view_purchase'))
  const canViewCustomerDebtsPage = Boolean(me && hasPerm(me, 'view_customer'))
  const canViewSaleHistory = Boolean(me && hasPerm(me, 'view_sale'))
  const isCustomersResource = resource === 'customers'
  const isExpensesResource = resource === 'expenses'
  const isShareholdersResource = resource === 'shareholders'
  const isOpeningCashResource = resource === 'opening-cash'

  const filteredCustomerLookup = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customerLookup
    return customerLookup.filter((c) => {
      const name = String(c.name ?? '').toLowerCase()
      const p1 = String(c.phone_1 ?? '').toLowerCase()
      const p2 = String(c.phone_2 ?? '').toLowerCase()
      return name.includes(q) || p1.includes(q) || p2.includes(q)
    })
  }, [customerLookup, search])

  const saleHistProductNames = useMemo(() => {
    const names = new Set<string>()
    for (const sale of saleHistRows) {
      for (const ln of sale.lines ?? []) {
        const nm = String(ln.product_name || ln.manual_name || '').trim()
        if (nm) names.add(nm)
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [saleHistRows])

  const filteredSaleHistProductNames = useMemo(() => {
    const q = saleHistProductQuery.trim().toLowerCase()
    if (!q) return saleHistProductNames
    return saleHistProductNames.filter((name) => name.toLowerCase().includes(q))
  }, [saleHistProductNames, saleHistProductQuery])

  const filteredSaleHistRows = useMemo(() => {
    const q = saleHistProductQuery.trim().toLowerCase()
    if (!q) return saleHistRows
    return saleHistRows.filter((sale) =>
      (sale.lines ?? []).some((ln) =>
        String(ln.product_name || ln.manual_name || '')
          .toLowerCase()
          .includes(q),
      ),
    )
  }, [saleHistRows, saleHistProductQuery])

  const visibleRows = useMemo(() => {
    if (!isCustomersResource) return rows
    const q = phoneSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const p1 = String(r.phone_1 ?? '').toLowerCase()
      const p2 = String(r.phone_2 ?? '').toLowerCase()
      return p1.includes(q) || p2.includes(q)
    })
  }, [isCustomersResource, phoneSearch, rows])

  const expenseFormNameSuggestions = useMemo(() => {
    if (!isExpensesResource) return []
    const seen = new Set<string>()
    for (const row of rows) {
      const name = String(row.name ?? '').trim()
      if (name) seen.add(name)
    }
    for (const n of expenseFormSavedNames) {
      if (n.trim()) seen.add(n.trim())
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b))
  }, [expenseFormSavedNames, isExpensesResource, rows])

  const filteredExpenseFormNameSuggestions = useMemo(() => {
    const q = String(draft.name ?? '').trim().toLowerCase()
    if (!q) return expenseFormNameSuggestions
    return expenseFormNameSuggestions.filter((n) => n.toLowerCase().includes(q))
  }, [draft.name, expenseFormNameSuggestions])

  const fetchExpenseHistory = useCallback(async (df: string, dt: string) => {
    if (!canView) return
    setExpenseHistoryLoading(true)
    try {
      const params = new URLSearchParams()
      if (df.trim()) params.set('date_from', df.trim())
      if (dt.trim()) params.set('date_to', dt.trim())
      const q = params.toString() ? `?${params.toString()}` : ''
      const data = await apiJson<Record<string, unknown>[] | { results: Record<string, unknown>[] }>(
        `/api/expenses/${q}`,
      )
      setExpenseHistoryRows(asList(data))
    } catch {
      setExpenseHistoryRows([])
    } finally {
      setExpenseHistoryLoading(false)
    }
  }, [canView])

  const filteredExpenseHistoryRows = useMemo(() => {
    const q = expenseHistNameQuery.trim().toLowerCase()
    if (!q) return expenseHistoryRows
    return expenseHistoryRows.filter((r) =>
      String(r.name ?? '')
        .toLowerCase()
        .includes(q),
    )
  }, [expenseHistoryRows, expenseHistNameQuery])

  const expenseHistNameSuggestions = useMemo(() => {
    const seen = new Set<string>()
    for (const row of expenseHistoryRows) {
      const name = String(row.name ?? '').trim()
      if (name) seen.add(name)
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b))
  }, [expenseHistoryRows])

  const filteredExpenseHistNameSuggestions = useMemo(() => {
    const q = expenseHistNameQuery.trim().toLowerCase()
    if (!q) return expenseHistNameSuggestions
    return expenseHistNameSuggestions.filter((n) => n.toLowerCase().includes(q))
  }, [expenseHistNameQuery, expenseHistNameSuggestions])

  async function openExpenseHistory() {
    setExpenseHistoryOpen(true)
    setExpenseHistNameQuery('')
    setExpenseHistNameSuggestOpen(false)
    const to = todayISO()
    const from = '2000-01-01'
    setExpenseHistDateFrom(from)
    setExpenseHistDateTo(to)
    await fetchExpenseHistory(from, to)
  }

  function closeExpenseHistory() {
    setExpenseHistoryOpen(false)
    setExpenseHistoryRows([])
    setExpenseHistNameQuery('')
    setExpenseHistNameSuggestOpen(false)
  }

  const fetchCustomerLookup = useCallback(async () => {
    if (!isCustomersResource || !canView) return
    try {
      const data = await apiJson<
        Array<{ id: number; name: string; phone_1?: string; phone_2?: string }> | {
          results: Array<{ id: number; name: string; phone_1?: string; phone_2?: string }>
        }
      >('/api/customers/?page_size=1000')
      const list = asList(data)
      setCustomerLookup(list)
    } catch {
      setCustomerLookup([])
    }
  }, [canView, isCustomersResource])

  const loadRows = useCallback(async () => {
    if (!cfg || !canView) return
    setLoading(true)
    setError(null)
    setDenied(false)
    try {
      const params = new URLSearchParams()
      if (search.trim() && cfg.searchParam) {
        params.set(cfg.searchParam, search.trim())
      }
      if (resource === 'expenses') {
        const df = expenseDateFrom.trim()
        const dt = expenseDateTo.trim()
        if (df) params.set('date_from', df)
        if (dt) params.set('date_to', dt)
      }
      const q = params.toString() ? `?${params.toString()}` : ''
      const data = await apiJson<Record<string, unknown>[] | { results: Record<string, unknown>[] }>(
        `${cfg.endpoint}${q}`,
      )
      setRows(asList(data))
    } catch (e) {
      if (isApiStatus(e, 403)) setDenied(true)
      setError(e instanceof Error ? e.message : t('common.error'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [cfg, canView, expenseDateFrom, expenseDateTo, search, t, resource])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    const prev = prevResourceRef.current
    prevResourceRef.current = resource
    if (resource !== 'expenses') return
    if (prev === 'expenses') return
    const now = new Date()
    setExpenseDateFrom(firstDayOfMonthISO(now))
    setExpenseDateTo(lastDayOfMonthISO(now))
  }, [resource])

  useEffect(() => {
    if (!isCustomersResource || !canView) return
    void fetchCustomerLookup()
  }, [canView, fetchCustomerLookup, isCustomersResource])

  useEffect(() => {
    if (!isExpensesResource || !me) return
    setExpenseFormSavedNames(readExpenseSavedNames(me.shop))
  }, [isExpensesResource, me])

  const openCreate = async () => {
    if (!cfg) return
    setEditing(null)
    const next: Record<string, Option[]> = {}
    for (const f of cfg.fields) {
      if (!f.optionsFrom) continue
      const data = await apiJson<Record<string, unknown>[] | { results: Record<string, unknown>[] }>(f.optionsFrom)
      const list = asList(data)
      next[f.key] = list.map((x) => ({
        value: String(x.id ?? ''),
        label: String(x.email ?? x.name ?? x.id ?? ''),
      }))
    }
    if (resource === 'expenses') next.currency = [{ value: 'USD', label: 'USD' }, { value: 'IQD', label: 'IQD' }]
    const nextDraft: Record<string, unknown> = {}
    if (resource === 'expenses') {
      nextDraft.occurred_on = todayISO()
      nextDraft.currency = 'USD'
    }
    setOptions(next)
    setDraft(nextDraft)
    setExpenseFormNameSuggestOpen(false)
    setOpen(true)
  }

  const openEdit = async (row: Record<string, unknown>) => {
    await openCreate()
    setEditing(row)
    setDraft({ ...row })
  }

  const save = async () => {
    await runFormSave(async () => {
      if (!cfg) return
      setError(null)
      let body: Record<string, unknown>
      try {
        body = cfg.toPayload ? cfg.toPayload(draft) : draft
      } catch {
        setError(t('purchase.linesJsonInvalid'))
        return
      }
      if (resource === 'opening-cash') {
        body = {
          for_date: String(body.for_date ?? ''),
          opening_cash_usd: String(body.opening_cash_usd ?? ''),
        }
      }
      const id = editing?.id
      const path =
        resource === 'opening-cash' ? cfg.endpoint : id ? `${cfg.endpoint}${id}/` : cfg.endpoint
      try {
        await apiJson(path, {
          method: resource === 'opening-cash' ? 'POST' : id ? 'PATCH' : 'POST',
          body: JSON.stringify(body),
        })
        if (resource === 'expenses') {
          const nm = String((body as { name?: unknown }).name ?? '').trim()
          if (nm)
            setExpenseFormSavedNames(rememberExpenseName(me?.shop, nm))
        }
        setOpen(false)
        await loadRows()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('common.error'))
      }
    })
  }

  const remove = async (id: unknown) => {
    if (!cfg || id == null) return
    await apiJson(`${cfg.endpoint}${id}/`, { method: 'DELETE' })
    await loadRows()
  }

  const closePurchaseEdit = useCallback(() => {
    setPurchaseEditOpen(false)
    setPurchaseEditLoading(false)
    setPurchaseEditSaving(false)
    setPurchaseEditError(null)
    setPurchaseEditId(null)
    setPurchaseEditCompanyId(null)
    setPurchaseEditIsAutoStock(false)
    setEditOccurredAt('')
    setEditDiscountUsd('')
    setEditAmountPaidUsd('')
    setEditNote('')
    setEditInvoice('')
    setEditCurrency('USD')
    setEditPaymentType('debt')
    setEditExchangeRate('')
    setEditLines([])
  }, [])

  const closePurchaseHistory = useCallback(() => {
    closePurchaseEdit()
    setHistoryCompany(null)
    setHistoryRows([])
    setHistoryError(null)
    setHistoryDateFrom('')
    setHistoryDateTo('')
  }, [closePurchaseEdit])

  const fetchPurchaseHistory = useCallback(
    async (companyId: number, dateFrom: string, dateTo: string) => {
      setHistoryLoading(true)
      setHistoryError(null)
      setHistoryRows([])
      try {
        const params = new URLSearchParams()
        params.set('company', String(companyId))
        const df = dateFrom.trim()
        const dt = dateTo.trim()
        if (df) params.set('date_from', df)
        if (dt) params.set('date_to', dt)
        const data = await apiJson<PurchaseHistoryRow[] | { results: PurchaseHistoryRow[] }>(
          `/api/purchases/?${params.toString()}`,
        )
        setHistoryRows(asList(data))
      } catch (e) {
        setHistoryError(e instanceof Error ? e.message : t('common.error'))
      } finally {
        setHistoryLoading(false)
      }
    },
    [t],
  )

  const openPurchaseEdit = useCallback(
    async (p: PurchaseHistoryRow) => {
      if (p.has_returns) return
      setPurchaseEditOpen(true)
      setPurchaseEditLoading(true)
      setPurchaseEditError(null)
      setPurchaseEditId(p.id)
      try {
        const data = await apiJson<PurchaseApiDetail>(`/api/purchases/${p.id}/`)
        setPurchaseEditCompanyId(typeof data.company === 'number' ? data.company : null)
        const noteStr = String(data.note ?? '')
        setPurchaseEditIsAutoStock(noteStr.includes('[AUTO_STOCK_INCREASE]'))
        const d = new Date(data.occurred_at)
        setEditOccurredAt(Number.isNaN(d.getTime()) ? '' : toDatetimeLocalValue(d))
        setEditDiscountUsd(formatMoneyCompact(data.discount_received_usd ?? '0'))
        setEditAmountPaidUsd(formatMoneyCompact(data.amount_paid_usd ?? '0'))
        setEditNote(noteStr)
        setEditInvoice(String(data.invoice_number ?? ''))
        const cur = data.currency === 'IQD' ? 'IQD' : 'USD'
        setEditCurrency(cur)
        setEditPaymentType(data.payment_type === 'cash' ? 'cash' : 'debt')
        const rateRaw = String(data.exchange_rate_usd_to_iqd ?? '').trim()
        if (rateRaw === '') {
          setEditExchangeRate('1')
        } else {
          const r = parseFloat(rateRaw)
          setEditExchangeRate(Number.isFinite(r) && r > 0 ? formatRateCompact(r * 100) : '1')
        }
        setEditLines(
          (data.lines ?? []).map((ln) => ({
            product: ln.product,
            productName: ln.product_name ?? `#${ln.product}`,
            quantity: String(ln.quantity ?? ''),
            unitCostUsd: formatMoneyCompact(ln.unit_cost_usd ?? '0'),
            damaged: String(ln.damaged_quantity ?? 0),
          })),
        )
      } catch (e) {
        setPurchaseEditError(e instanceof Error ? e.message : t('common.error'))
      } finally {
        setPurchaseEditLoading(false)
      }
    },
    [t],
  )

  const savePurchaseEdit = useCallback(async () => {
    if (purchaseEditId == null || !historyCompany) return
    if (purchaseEditIsAutoStock && !editNote.includes('[AUTO_STOCK_INCREASE]')) {
      setPurchaseEditError(t('inv.historyEditMarkerRequired'))
      return
    }
    if (editLines.length === 0) {
      setPurchaseEditError(t('purchasePage.needLines'))
      return
    }
    let occurred = editOccurredAt.trim()
    if (occurred.length === 16) occurred = `${occurred}:00`
    const occurredDate = new Date(occurred)
    if (Number.isNaN(occurredDate.getTime())) {
      setPurchaseEditError(t('inv.historyEditInvalidDate'))
      return
    }
    const rateDisplay = parseDec(editExchangeRate)
    const rate = rateDisplay / 100
    if (editCurrency === 'IQD' && rateDisplay <= 0) {
      setPurchaseEditError(t('purchasePage.needRate'))
      return
    }
    const apiLines: Array<{
      product: number
      quantity: number
      unit_cost_usd: string
      damaged_quantity: number
    }> = []
    for (const ln of editLines) {
      const q = Math.max(0, Math.floor(parseDec(ln.quantity)))
      const damaged = Math.min(Math.max(0, Math.floor(parseDec(ln.damaged))), q)
      if (q < 1) {
        setPurchaseEditError(t('purchasePage.needLines'))
        return
      }
      apiLines.push({
        product: ln.product,
        quantity: q,
        unit_cost_usd: parseDec(ln.unitCostUsd).toFixed(4),
        damaged_quantity: damaged,
      })
    }
    setPurchaseEditSaving(true)
    setPurchaseEditError(null)
    try {
      await apiJson(`/api/purchases/${purchaseEditId}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          company: purchaseEditCompanyId,
          occurred_at: occurredDate.toISOString(),
          exchange_rate_usd_to_iqd: (rate > 0 ? rate : 1).toFixed(4),
          discount_received_usd: parseDec(editDiscountUsd).toFixed(4),
          amount_paid_usd: parseDec(editAmountPaidUsd).toFixed(4),
          invoice_number: digitsOnlyAscii(editInvoice),
          note: editNote.trim(),
          currency: editCurrency,
          payment_type: editPaymentType,
          lines: apiLines,
        }),
      })
      closePurchaseEdit()
      await fetchPurchaseHistory(historyCompany.id, historyDateFrom, historyDateTo)
    } catch (e) {
      setPurchaseEditError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setPurchaseEditSaving(false)
    }
  }, [
    purchaseEditId,
    historyCompany,
    purchaseEditIsAutoStock,
    editNote,
    editLines,
    editOccurredAt,
    editCurrency,
    editExchangeRate,
    editDiscountUsd,
    editAmountPaidUsd,
    editInvoice,
    editPaymentType,
    purchaseEditCompanyId,
    fetchPurchaseHistory,
    historyDateFrom,
    historyDateTo,
    closePurchaseEdit,
    t,
  ])

  const openPurchaseHistory = useCallback(
    async (row: Record<string, unknown>) => {
      const id = Number(row.id)
      const name = String(row.name ?? `#${id}`)
      if (!Number.isFinite(id)) return
      setHistoryCompany({ id, name })
      setHistoryDateFrom('')
      setHistoryDateTo('')
      await fetchPurchaseHistory(id, '', '')
    },
    [fetchPurchaseHistory],
  )

  const closeCustomerSaleHistory = useCallback(() => {
    setSaleHistCustomer(null)
    setSaleHistRows([])
    setSaleHistError(null)
    setSaleHistDateFrom('')
    setSaleHistDateTo('')
    setSaleHistProductQuery('')
    setSaleHistProductFilterOpen(false)
    setReceiptSettings(null)
    setReceiptPreviewHtml(null)
    setReceiptPreviewSaleId(null)
  }, [])

  const fetchCustomerSales = useCallback(
    async (customerId: number, dateFrom: string, dateTo: string) => {
      setSaleHistLoading(true)
      setSaleHistError(null)
      setSaleHistRows([])
      try {
        const params = new URLSearchParams()
        params.set('customer', String(customerId))
        const df = dateFrom.trim()
        const dt = dateTo.trim()
        if (df) params.set('date_from', df)
        if (dt) params.set('date_to', dt)
        const data = await apiJson<SaleListRow[] | { results: SaleListRow[] }>(
          `/api/sales/?${params.toString()}`,
        )
        setSaleHistRows(asList(data))
      } catch (e) {
        setSaleHistError(e instanceof Error ? e.message : t('common.error'))
      } finally {
        setSaleHistLoading(false)
      }
    },
    [t],
  )

  const openCustomerSaleHistory = useCallback(
    async (row: Record<string, unknown>) => {
      const id = Number(row.id)
      const name = String(row.name ?? `#${id}`)
      if (!Number.isFinite(id)) return
      setReceiptPreviewHtml(null)
      setReceiptPreviewSaleId(null)
      setSaleHistCustomer({ id, name })
      setSaleHistProductQuery('')
      setSaleHistProductFilterOpen(false)
      setSaleHistDateFrom('')
      setSaleHistDateTo('')
      try {
        const settings = await apiJson<ReceiptSettingsRow>('/api/receipt-settings/')
        setReceiptSettings(withReceiptPrefs(settings))
      } catch {
        setReceiptSettings(null)
      }
      await fetchCustomerSales(id, '', '')
    },
    [fetchCustomerSales],
  )

  const openSaleReceiptPreview = useCallback(
    (sale: SaleListRow) => {
      void (async () => {
        const sum = computeReceiptSummaryFromSale(sale)
        const html = await buildReceiptHtml({
          sale: sale as unknown as Record<string, unknown>,
          sum,
          receiptSettings,
          customerNameDisplay: sale.customer_name || saleHistCustomer?.name || '—',
          forScreenPreview: true,
        })
        setReceiptPreviewSaleId(sale.id)
        setReceiptPreviewHtml(html)
      })()
    },
    [receiptSettings, saleHistCustomer?.name],
  )

  const buildCustomerSalesHistoryPdfDoc = useCallback(async (): Promise<jsPDF | null> => {
    if (!saleHistCustomer) return null
    const title = t('customersPage.salesHistoryTitle').replace('{name}', saleHistCustomer.name)
    const dateRange = `${saleHistDateFrom.trim() || '—'} -> ${saleHistDateTo.trim() || '—'}`
    const isRtl = lang === 'ku' || lang === 'ar'
    const rowsHtml = filteredSaleHistRows
      .map((s) => {
        const sum = computeReceiptSummaryFromSale(s)
        const cols = saleLineColumnValues(s)
        return `<tr>
          <td class="nowrap">${escapeHtml(formatDateTimeCell(String(s.occurred_at)))}</td>
          <td class="nowrap num">${escapeHtml(cols.unitPrices).replace(/\n/g, '<br/>')}</td>
          <td class="nowrap num">${escapeHtml(cols.quantities).replace(/\n/g, '<br/>')}</td>
          <td class="details">${escapeHtml(cols.productNames).replace(/\n/g, '<br/>')}</td>
          <td class="nowrap num">${escapeHtml(formatMoneyCompact(sum.finalUsd))}</td>
          <td class="nowrap num">${escapeHtml(formatMoneyCompact(sum.paidUsdEq))}</td>
          <td class="nowrap num">${escapeHtml(formatMoneyCompact(sum.balanceUsd))}</td>
        </tr>`
      })
      .join('')
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
    container.innerHTML = `
      <style>
        :root { color-scheme: light; }
        body { font-family: "Noto Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif; margin: 20px; color: #0f172a; background: #ffffff; }
        .sheet { border: 1px solid #dbe2ea; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(2, 6, 23, 0.08); }
        .head { padding: 14px 16px; background: linear-gradient(180deg, #f8fafc, #f1f5f9); border-bottom: 1px solid #e2e8f0; }
        h2 { margin: 0 0 4px; font-size: 18px; font-weight: 700; }
        p.meta { margin: 0; color: #475569; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
        th, td { border: 1px solid #dbe2ea; padding: 8px 9px; text-align: center; vertical-align: middle; }
        thead th { background: #0ea5a4; color: #fff; font-weight: 700; white-space: normal; line-height: 1.3; }
        tbody tr:nth-child(even) { background: #f8fafc; }
        .nowrap { white-space: nowrap; }
        .details { white-space: normal; word-break: break-word; line-height: 1.35; }
        .num { font-family: ui-monospace,SFMono-Regular,Menlo,monospace; }
      </style>
      <div class="sheet">
      <div class="head">
        <h2>${escapeHtml(title)}</h2>
        <p class="meta">${escapeHtml(dateRange)}</p>
      </div>
      <table>
        <colgroup>
          <col style="width:14%">
          <col style="width:10%">
          <col style="width:10%">
          <col style="width:26%">
          <col style="width:13%">
          <col style="width:13%">
          <col style="width:14%">
        </colgroup>
        <thead>
          <tr>
            <th class="nowrap">${escapeHtml(t('purchasePage.colWhen'))}</th>
            <th class="nowrap">${escapeHtml(t('purchasePage.unitPrice'))}</th>
            <th class="nowrap">${escapeHtml(t('purchasePage.quantity'))}</th>
            <th>${escapeHtml(t('purchasePage.colProducts'))}</th>
            <th class="nowrap">${escapeHtml(stripAnyParens(t('pos.finalUsdReceipt')) + ' USD')}</th>
            <th class="nowrap">${escapeHtml(stripAnyParens(t('pos.paidUsdEquivalent')) + ' USD')}</th>
            <th class="nowrap">${escapeHtml(stripAnyParens(t('pos.remainingUsd')) + ' USD')}</th>
          </tr>
        </thead>
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
            if (!el.textContent?.includes('table { width: 100%')) el.remove()
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
        if (ctx) {
          ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
        }
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
  }, [filteredSaleHistRows, lang, saleHistCustomer, saleHistDateFrom, saleHistDateTo, t])

  const printCustomerSalesHistory = useCallback(async () => {
    const pdf = await buildCustomerSalesHistoryPdfDoc()
    if (!pdf) return
    const blob = pdf.output('blob')
    const url = URL.createObjectURL(blob)
    const w = window.open(url, '_blank')
    if (!w) {
      URL.revokeObjectURL(url)
      return
    }
    window.setTimeout(() => {
      try {
        w.focus()
        w.print()
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
    }, 800)
  }, [buildCustomerSalesHistoryPdfDoc])

  const downloadCustomerSalesHistoryPdf = useCallback(async () => {
    const pdf = await buildCustomerSalesHistoryPdfDoc()
    if (!pdf || !saleHistCustomer) return
    pdf.save(`customer-sales-history-${saleHistCustomer.id}.pdf`)
  }, [buildCustomerSalesHistoryPdfDoc, saleHistCustomer])

  const buildCompanyPurchaseHistoryPdfDoc = useCallback(async (): Promise<jsPDF | null> => {
    if (!historyCompany) return null
    const title = t('companiesPage.historyTitle').replace('{name}', historyCompany?.name ?? '')
    const dateRange = `${historyDateFrom.trim() || '—'} -> ${historyDateTo.trim() || '—'}`
    const isRtl = lang === 'ku' || lang === 'ar'
    const discountHeader = `${stripUsdParens(t('purchasePage.discount'))} USD`
    const paidHeader = `${stripUsdParens(t('purchasePage.amountPaid'))} USD`
    const rowsHtml = historyRows
      .map((p) => {
        const paymentType =
          p.payment_type === 'cash'
            ? t('purchasePage.paymentCash')
            : p.payment_type === 'debt'
              ? t('purchasePage.paymentDebt')
              : p.payment_type ?? '—'
        const cols = purchaseLineColumnValues(p)
        return `<tr>
          <td class="nowrap">${escapeHtml(formatDateTimeCell(String(p.occurred_at)))}</td>
          <td class="details">${escapeHtml(cols.productNames).replace(/\n/g, '<br/>')}</td>
          <td class="nowrap num">${escapeHtml(cols.quantities).replace(/\n/g, '<br/>')}</td>
          <td class="nowrap num">${escapeHtml(cols.unitPrices).replace(/\n/g, '<br/>')}</td>
          <td class="nowrap num">${escapeHtml(formatMoneyCompact(p.discount_received_usd ?? '—'))}</td>
          <td class="nowrap num">${escapeHtml(formatMoneyCompact(p.amount_paid_usd ?? '—'))}</td>
          <td class="nowrap">${escapeHtml(paymentType)}</td>
          <td class="nowrap">${escapeHtml(p.currency ?? 'USD')}</td>
          <td class="details">${escapeHtml(p.note?.trim() || '—')}</td>
        </tr>`
      })
      .join('')
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
    container.innerHTML = `
      <style>
        :root { color-scheme: light; }
        body { font-family: "Noto Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif; margin: 20px; color: #0f172a; background: #ffffff; }
        .sheet { border: 1px solid #dbe2ea; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(2, 6, 23, 0.08); }
        .head { padding: 14px 16px; background: linear-gradient(180deg, #f8fafc, #f1f5f9); border-bottom: 1px solid #e2e8f0; }
        h2 { margin: 0 0 4px; font-size: 18px; font-weight: 700; }
        p.meta { margin: 0; color: #475569; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
        th, td { border: 1px solid #dbe2ea; padding: 8px 9px; vertical-align: top; text-align: ${isRtl ? 'right' : 'left'}; }
        thead th { background: #0ea5a4; color: #fff; font-weight: 700; white-space: normal; line-height: 1.3; }
        tbody tr:nth-child(even) { background: #f8fafc; }
        tbody tr:hover { background: #eef6ff; }
        .nowrap { white-space: nowrap; }
        .details { white-space: normal; word-break: break-word; line-height: 1.35; }
        .num { font-family: ui-monospace,SFMono-Regular,Menlo,monospace; text-align: ${isRtl ? 'left' : 'right'}; }
      </style>
      <div class="sheet">
      <div class="head">
        <h2>${escapeHtml(title)}</h2>
        <p class="meta">${escapeHtml(dateRange)}</p>
      </div>
      <table>
        <colgroup>
          <col style="width:14%">
          <col style="width:22%">
          <col style="width:8%">
          <col style="width:10%">
          <col style="width:11%">
          <col style="width:11%">
          <col style="width:10%">
          <col style="width:6%">
          <col style="width:8%">
        </colgroup>
        <thead>
          <tr>
            <th class="nowrap">${escapeHtml(t('purchasePage.colWhen'))}</th>
            <th>${escapeHtml(t('purchasePage.product'))}</th>
            <th class="nowrap">${escapeHtml(t('purchasePage.quantity'))}</th>
            <th class="nowrap">${escapeHtml(t('purchasePage.unitPrice'))}</th>
            <th class="nowrap">${escapeHtml(discountHeader)}</th>
            <th class="nowrap">${escapeHtml(paidHeader)}</th>
            <th class="nowrap">${escapeHtml(t('purchasePage.paymentType'))}</th>
            <th class="nowrap">${escapeHtml(t('common.currencyUsd'))}</th>
            <th>${escapeHtml(t('purchasePage.note'))}</th>
          </tr>
        </thead>
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
            if (!el.textContent?.includes('table { width: 100%')) el.remove()
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
        if (ctx) {
          ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
        }
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
  }, [historyCompany, historyDateFrom, historyDateTo, historyRows, lang, t])

  const printCompanyPurchaseHistory = useCallback(async () => {
    const pdf = await buildCompanyPurchaseHistoryPdfDoc()
    if (!pdf) return
    const blob = pdf.output('blob')
    const url = URL.createObjectURL(blob)
    const w = window.open(url, '_blank')
    if (!w) {
      URL.revokeObjectURL(url)
      return
    }
    window.setTimeout(() => {
      try {
        w.focus()
        w.print()
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
    }, 800)
  }, [buildCompanyPurchaseHistoryPdfDoc])

  const downloadCompanyPurchaseHistoryPdf = useCallback(async () => {
    const pdf = await buildCompanyPurchaseHistoryPdfDoc()
    if (!pdf || !historyCompany) return
    pdf.save(`company-purchase-history-${historyCompany.id}.pdf`)
  }, [historyCompany, historyDateFrom, historyDateTo, historyRows, lang, t])

  const columns = useMemo(() => {
    if (!rows.length) return []
    return Object.keys(rows[0]).slice(0, 8)
  }, [rows])

  if (!cfg) return <div className="p-6 text-sm text-slate-600">{t('crud.unknownResource')}</div>

  const pageTitle = cfg.titleKey ? t(cfg.titleKey) : cfg.title
  const columnHeader = (key: string) =>
    cfg.columnLabelKeys?.[key] ? t(cfg.columnLabelKeys[key]) : key
  const fieldLabel = (f: FieldDef) => (f.labelKey ? t(f.labelKey) : f.label ?? f.key)
  const formatCellValue = (value: unknown, columnKey?: string) => {
    if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no')
    if (isExpensesResource && columnKey === 'exchange_rate_usd_to_iqd') {
      const raw = String(value ?? '').trim().replace(/,/g, '')
      if (raw === '' || raw.toLowerCase() === 'null') return '—'
      const n = parseFloat(raw)
      if (!Number.isFinite(n) || n <= 0) return String(value ?? '')
      return formatRateCompact(n * 100)
    }
    if (
      isExpensesResource &&
      (typeof value === 'number' || typeof value === 'string')
    ) {
      const raw = String(value).trim()
      if (/^-?\d+(\.\d+)?$/.test(raw)) {
        return formatMoneyCompact(raw)
      }
    }
    if (isShareholdersResource && columnKey === 'capital_contribution_usd') {
      const raw = String(value ?? '').trim()
      if (/^-?\d+(\.\d+)?$/.test(raw.replace(/,/g, ''))) {
        return formatMoneyCompact(raw)
      }
    }
    if (isShareholdersResource && columnKey === 'share_percentage') {
      const raw = String(value ?? '').trim()
      if (/^-?\d+(\.\d+)?$/.test(raw.replace(/,/g, ''))) {
        return `${formatMoneyCompact(raw)}%`
      }
    }
    if (isOpeningCashResource && columnKey === 'opening_cash_usd') {
      const raw = String(value ?? '').trim()
      if (/^-?\d+(\.\d+)?$/.test(raw.replace(/,/g, ''))) {
        return formatMoneyCompact(raw)
      }
    }
    if (isExpensesResource && columnKey === 'name') {
      return formatInventoryLossExpenseName(String(value ?? ''))
    }
    if (isExpensesResource && columnKey === 'note') {
      return formatInventoryLossExpenseNote(String(value ?? '')) || '—'
    }
    return String(value ?? '')
  }

  if (!canView || denied) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold text-slate-900">{pageTitle}</h1>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t('crud.permissionDenied')}
        </p>
        <Link to="/" className="mt-4 inline-block text-sm text-violet-600 hover:underline">{t('nav.home')}</Link>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            {resource === 'categories' ? (
              <Link
                to="/inventory"
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" aria-hidden />
                {t('common.back')}
              </Link>
            ) : null}
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{pageTitle}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadRows()}
              className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-xs dark:border-slate-600 dark:text-slate-200"
            >
              {t('crud.filter')}
            </button>
            {resource === 'companies' && canViewCompanyDebtsPage ? (
              <Link
                to="/company-debts"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                {t('nav.companyDebts')}
              </Link>
            ) : null}
            {resource === 'customers' && canViewCustomerDebtsPage ? (
              <Link
                to="/customer-debts"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Banknote className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                {t('nav.customerDebts')}
              </Link>
            ) : null}
            {isExpensesResource ? (
              <button
                type="button"
                onClick={() => void openExpenseHistory()}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <History className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                {t('expensePage.historyBtn')}
              </button>
            ) : null}
            {canAdd && (
              <button
                type="button"
                onClick={() => void openCreate()}
                className="min-h-9 rounded-lg bg-violet-600 px-2.5 text-xs font-medium text-white"
              >
                {t('crud.createNew')}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <div className="relative">
              <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {isCustomersResource ? 'ناوی کڕیار' : t('crud.filter')}
              </p>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  if (isCustomersResource) setCustomerFilterOpen(true)
                }}
                onFocus={() => {
                  if (isCustomersResource) setCustomerFilterOpen(true)
                }}
                onBlur={() => {
                  if (isCustomersResource) {
                    window.setTimeout(() => setCustomerFilterOpen(false), 120)
                  }
                }}
                placeholder={isCustomersResource ? 'ناوی کڕیار' : t('crud.filter')}
                className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              {isCustomersResource && customerFilterOpen && filteredCustomerLookup.length > 0 ? (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-900">
                  {filteredCustomerLookup.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSearch(String(c.name ?? ''))
                          setCustomerFilterOpen(false)
                          window.setTimeout(() => void loadRows(), 0)
                        }}
                        className="w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <span className="block font-medium">{String(c.name ?? '—')}</span>
                        {c.phone_1 ? (
                          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                            {c.phone_1}
                          </span>
                        ) : null}
                        {c.phone_2 ? (
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {c.phone_2}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div>
              {isCustomersResource ? (
                <>
                  <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">مۆبایل</p>
                  <input
                    value={phoneSearch}
                    onChange={(e) => setPhoneSearch(e.target.value)}
                    placeholder="مۆبایل"
                    className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </>
              ) : isExpensesResource ? (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    <label className="block">
                      <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">{t('dash.from')}</p>
                      <input
                        type="date"
                        value={expenseDateFrom}
                        onChange={(e) => setExpenseDateFrom(e.target.value)}
                        className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="block">
                      <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">{t('dash.to')}</p>
                      <input
                        type="date"
                        value={expenseDateTo}
                        onChange={(e) => setExpenseDateTo(e.target.value)}
                        className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('expensePage.monthListHint')}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/80">
            <tr>
              {columns.map((c) => (
                <th key={c} className="border-b border-slate-200 px-3 py-2 text-start dark:border-slate-600">
                  {columnHeader(c)}
                </th>
              ))}
              <th className="border-b border-slate-200 px-3 py-2 text-start dark:border-slate-600">
                {t('crud.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-3 text-slate-500 dark:text-slate-400" colSpan={columns.length + 1}>
                  {t('common.loading')}
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-slate-500 dark:text-slate-400" colSpan={columns.length + 1}>
                  {t('crud.noRows')}
                </td>
              </tr>
            ) : (
              visibleRows.map((r) => (
                <tr key={String(r.id ?? Math.random())} className="border-b border-slate-100 dark:border-slate-700">
                  {columns.map((c) => (
                    <td key={c} className="px-3 py-2 text-slate-900 dark:text-slate-100">
                      {formatCellValue(r[c], c)}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {resource === 'companies' && canViewPurchaseHistory && (
                        <button
                          type="button"
                          onClick={() => void openPurchaseHistory(r)}
                          className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
                          title={t('companiesPage.purchaseHistoryBtn')}
                        >
                          <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {t('companiesPage.purchaseHistoryBtn')}
                        </button>
                      )}
                      {resource === 'customers' && canViewSaleHistory && (
                        <button
                          type="button"
                          onClick={() => void openCustomerSaleHistory(r)}
                          className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                          title={t('customersPage.salesHistoryBtn')}
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {t('customersPage.salesHistoryBtn')}
                        </button>
                      )}
                      {canChange && (
                        <button
                          type="button"
                          onClick={() => void openEdit(r)}
                          className="rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-600"
                        >
                          {t('crud.edit')}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void remove(r.id)}
                          className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:text-rose-400"
                        >
                          {t('crud.delete')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {receiptPreviewHtml && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setReceiptPreviewHtml(null)
              setReceiptPreviewSaleId(null)
            }
          }}
        >
          <div
            className="flex h-[min(96dvh,920px)] w-full max-w-[min(calc(100vw-1rem),1180px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
            role="dialog"
            aria-labelledby="receipt-preview-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-4 dark:border-slate-600">
              <h2
                id="receipt-preview-title"
                className="text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-100"
              >
                {t('pos.receipt')}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => printReceiptHtml(receiptPreviewHtml)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  <Printer className="h-4 w-4" aria-hidden />
                  {t('pos.printReceipt')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadReceiptHtmlFile(
                      receiptPreviewHtml,
                      receiptPreviewSaleId ?? Date.now(),
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {t('customersPage.downloadReceipt')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptPreviewHtml(null)
                    setReceiptPreviewSaleId(null)
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
                >
                  {t('crud.cancel')}
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 dark:bg-slate-950/80">
              <iframe
                title={t('pos.receipt')}
                className="block w-full border-0 bg-white"
                style={{ minHeight: 'min(78dvh, 820px)' }}
                srcDoc={receiptPreviewHtml}
                sandbox="allow-popups allow-modals allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}

      {saleHistCustomer && (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCustomerSaleHistory()
          }}
        >
          <div
            className="relative flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
            role="dialog"
            aria-labelledby="customer-sales-history-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="no-print shrink-0 border-b border-slate-200 dark:border-slate-600">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <h2
                  id="customer-sales-history-heading"
                  className="text-start text-base font-semibold text-slate-900 dark:text-slate-100"
                >
                  {t('customersPage.salesHistoryTitle').replace('{name}', saleHistCustomer.name)}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={printCustomerSalesHistory}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    <Printer className="h-4 w-4" aria-hidden />
                    {t('companiesPage.print')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadCustomerSalesHistoryPdf()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    {t('companiesPage.downloadPdf')}
                  </button>
                  <button
                    type="button"
                    onClick={closeCustomerSaleHistory}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
                  >
                    {t('crud.cancel')}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-700">
                <label className="relative flex min-w-[16rem] flex-col gap-1 text-start">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t('purchasePage.filterProductName')}
                  </span>
                  <input
                    value={saleHistProductQuery}
                    onChange={(e) => {
                      setSaleHistProductQuery(e.target.value)
                      setSaleHistProductFilterOpen(true)
                    }}
                    onFocus={() => setSaleHistProductFilterOpen(true)}
                    onBlur={() =>
                      window.setTimeout(() => setSaleHistProductFilterOpen(false), 120)
                    }
                    placeholder={t('purchasePage.filterProductName')}
                    className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  />
                  {saleHistProductFilterOpen && filteredSaleHistProductNames.length > 0 ? (
                    <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-900">
                      {filteredSaleHistProductNames.map((name) => (
                        <li key={name}>
                          <button
                            type="button"
                            onClick={() => {
                              setSaleHistProductQuery(name)
                              setSaleHistProductFilterOpen(false)
                            }}
                            className="w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <span className="block font-medium">{name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </label>
                <label className="flex min-w-[10rem] flex-col gap-1 text-start">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('dash.from')}</span>
                  <input
                    type="date"
                    value={saleHistDateFrom}
                    onChange={(e) => setSaleHistDateFrom(e.target.value)}
                    className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
                <label className="flex min-w-[10rem] flex-col gap-1 text-start">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('dash.to')}</span>
                  <input
                    type="date"
                    value={saleHistDateTo}
                    onChange={(e) => setSaleHistDateTo(e.target.value)}
                    className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
                <button
                  type="button"
                  disabled={saleHistLoading}
                  onClick={() => void fetchCustomerSales(saleHistCustomer.id, saleHistDateFrom, saleHistDateTo)}
                  className="min-h-10 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {t('dash.apply')}
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {saleHistError && (
                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                  {saleHistError}
                </p>
              )}
              {saleHistLoading ? (
                <p className="text-start text-sm text-slate-500">{t('customersPage.salesHistoryLoading')}</p>
              ) : filteredSaleHistRows.length === 0 ? (
                <p className="text-start text-sm text-slate-500">{t('customersPage.salesHistoryEmpty')}</p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/80">
                      <th className="px-2 py-2 text-center font-medium whitespace-nowrap">
                        {t('purchasePage.colWhen')}
                      </th>
                      <th className="px-2 py-2 text-center font-medium whitespace-nowrap">
                        {t('purchasePage.unitPrice')}
                      </th>
                      <th className="px-2 py-2 text-center font-medium whitespace-nowrap">
                        {t('purchasePage.quantity')}
                      </th>
                      <th className="px-2 py-2 text-center font-medium whitespace-nowrap">
                        {t('purchasePage.colProducts')}
                      </th>
                      <th className="px-2 py-2 text-end font-medium whitespace-nowrap">
                        {stripAnyParens(t('pos.finalUsdReceipt'))} USD
                      </th>
                      <th className="px-2 py-2 text-end font-medium whitespace-nowrap">
                        {stripAnyParens(t('pos.paidUsdEquivalent'))} USD
                      </th>
                      <th className="px-2 py-2 text-end font-medium whitespace-nowrap">
                        {stripAnyParens(t('pos.remainingUsd'))} USD
                      </th>
                      <th className="px-2 py-2 text-center font-medium whitespace-nowrap">
                        {t('customersPage.receiptCol')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSaleHistRows.map((s) => {
                      const sum = computeReceiptSummaryFromSale(s)
                      const cols = saleLineColumnValues(s)
                      return (
                        <tr key={s.id} className="border-b border-slate-100 align-top dark:border-slate-700">
                          <td className="px-2 py-2 text-center font-mono text-xs whitespace-nowrap">
                            {formatDateTimeCell(s.occurred_at)}
                          </td>
                          <td className="px-2 py-2 text-center font-mono text-xs tabular-nums whitespace-pre-line">
                            {cols.unitPrices}
                          </td>
                          <td className="px-2 py-2 text-center font-mono text-xs tabular-nums whitespace-pre-line">
                            {cols.quantities}
                          </td>
                          <td className="px-2 py-2 text-center text-xs leading-relaxed whitespace-pre-line">
                            {cols.productNames}
                          </td>
                          <td className="px-2 py-2 text-center font-mono tabular-nums">
                            {formatMoneyCompact(sum.finalUsd)}
                          </td>
                          <td className="px-2 py-2 text-center font-mono tabular-nums">
                            {formatMoneyCompact(sum.paidUsdEq)}
                          </td>
                          <td className="px-2 py-2 text-center font-mono tabular-nums">
                            {formatMoneyCompact(sum.balanceUsd)}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openSaleReceiptPreview(s)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-50 dark:border-slate-600 dark:text-violet-200 dark:hover:bg-violet-950/40"
                              >
                                <FileText className="h-3.5 w-3.5" aria-hidden />
                                {t('customersPage.viewReceipt')}
                              </button>
                              {s.has_returns ? (
                                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-200">
                                  {t('sales.returnedTag')} {formatMoneyCompact(s.returned_total_usd ?? '0')} USD
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {historyCompany && (
        <>
          <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center lg:pr-64"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) closePurchaseHistory()
            }}
          >
            <div
              className="relative flex min-h-0 max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900 lg:max-w-[calc(100vw-18rem)]"
            role="dialog"
            aria-labelledby="company-purchase-history-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="no-print shrink-0 border-b border-slate-200 dark:border-slate-600">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <h2
                  id="company-purchase-history-heading"
                  className="text-start text-base font-semibold text-slate-900 dark:text-slate-100"
                >
                  {t('companiesPage.historyTitle').replace('{name}', historyCompany.name)}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={printCompanyPurchaseHistory}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    <Printer className="h-4 w-4" aria-hidden />
                    {t('companiesPage.print')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadCompanyPurchaseHistoryPdf()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    {t('companiesPage.downloadPdf')}
                  </button>
                  <button
                    type="button"
                    onClick={closePurchaseHistory}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
                  >
                    {t('crud.cancel')}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-700">
                <label className="flex min-w-[10rem] flex-col gap-1 text-start">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('dash.from')}</span>
                  <input
                    type="date"
                    value={historyDateFrom}
                    onChange={(e) => setHistoryDateFrom(e.target.value)}
                    className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
                <label className="flex min-w-[10rem] flex-col gap-1 text-start">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('dash.to')}</span>
                  <input
                    type="date"
                    value={historyDateTo}
                    onChange={(e) => setHistoryDateTo(e.target.value)}
                    className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
                <button
                  type="button"
                  disabled={historyLoading}
                  onClick={() => void fetchPurchaseHistory(historyCompany.id, historyDateFrom, historyDateTo)}
                  className="min-h-10 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {t('dash.apply')}
                </button>
              </div>
            </div>
            <div
              id="company-purchase-history-print"
              className="min-h-0 flex-1 overflow-auto bg-white p-4 text-slate-900 dark:bg-slate-900 dark:text-slate-100 print:overflow-visible print:bg-white print:text-slate-900"
            >
              <h1 className="mb-3 hidden text-lg font-semibold text-slate-900 print:block dark:text-slate-100 print:text-black">
                {t('companiesPage.historyTitle').replace('{name}', historyCompany.name)}
              </h1>
              {(historyDateFrom.trim() || historyDateTo.trim()) && (
                <p className="mb-3 hidden text-sm text-slate-600 print:block print:text-black dark:text-slate-400">
                  {historyDateFrom.trim() || '—'} → {historyDateTo.trim() || '—'}
                </p>
              )}
              {historyError && (
                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                  {historyError}
                </p>
              )}
              {historyLoading ? (
                <p className="text-start text-sm text-slate-500">{t('companiesPage.historyLoading')}</p>
              ) : historyRows.length === 0 ? (
                <p className="text-start text-sm text-slate-500">{t('companiesPage.historyEmpty')}</p>
              ) : (
                <table className="min-w-[1100px] w-full border-collapse text-start text-sm print:text-xs print:text-black print:[&_th]:text-black print:[&_td]:text-black">
                  <colgroup>
                    {canChangePurchase ? (
                      <>
                        <col className="w-[13%]" />
                        <col className="w-[19%]" />
                        <col className="w-[8%]" />
                        <col className="w-[9%]" />
                        <col className="w-[10%]" />
                        <col className="w-[10%]" />
                        <col className="w-[9%]" />
                        <col className="w-[6%]" />
                        <col className="w-[7%]" />
                        <col className="w-[9%]" />
                      </>
                    ) : (
                      <>
                        <col className="w-[14%]" />
                        <col className="w-[22%]" />
                        <col className="w-[8%]" />
                        <col className="w-[10%]" />
                        <col className="w-[11%]" />
                        <col className="w-[11%]" />
                        <col className="w-[10%]" />
                        <col className="w-[6%]" />
                        <col className="w-[8%]" />
                      </>
                    )}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/80 print:border-slate-300 print:bg-slate-100 print:text-black">
                      <th className="border border-slate-200 px-2 py-2 align-top text-[11px] leading-tight font-medium whitespace-normal break-words">{t('purchasePage.colWhen')}</th>
                      <th className="border border-slate-200 px-2 py-2 align-top text-[11px] leading-tight font-medium whitespace-normal break-words">{t('purchasePage.product')}</th>
                      <th className="border border-slate-200 px-2 py-2 align-top text-[11px] leading-tight text-end font-medium whitespace-normal break-words">{t('purchasePage.quantity')}</th>
                      <th className="border border-slate-200 px-2 py-2 align-top text-[11px] leading-tight text-end font-medium whitespace-normal break-words">{t('purchasePage.unitPrice')}</th>
                      <th className="border border-slate-200 px-2 py-2 align-top text-[11px] leading-tight text-end font-medium whitespace-normal break-words">
                        {stripUsdParens(t('purchasePage.discount'))} USD
                      </th>
                      <th className="border border-slate-200 px-2 py-2 align-top text-[11px] leading-tight text-end font-medium whitespace-normal break-words">
                        {stripUsdParens(t('purchasePage.amountPaid'))} USD
                      </th>
                      <th className="border border-slate-200 px-2 py-2 align-top text-[11px] leading-tight font-medium whitespace-normal break-words">{t('purchasePage.paymentType')}</th>
                      <th className="border border-slate-200 px-2 py-2 align-top text-[11px] leading-tight font-medium whitespace-normal break-words">{t('common.currencyUsd')}</th>
                      <th className="border border-slate-200 px-2 py-2 align-top text-[11px] leading-tight font-medium whitespace-normal break-words">{t('purchasePage.note')}</th>
                      {canChangePurchase ? (
                        <th className="print:hidden border border-slate-200 px-2 py-2 align-top text-[11px] leading-tight font-medium whitespace-nowrap">
                          {t('companiesPage.colActions')}
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((p) => {
                      const cols = purchaseLineColumnValues(p)
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-slate-100 align-top dark:border-slate-700 print:border-slate-200"
                        >
                          <td className="border border-slate-200 px-2 py-2 font-mono text-xs whitespace-nowrap">{formatDateTimeCell(String(p.occurred_at))}</td>
                          <td className="border border-slate-200 px-2 py-2 text-xs leading-relaxed break-words whitespace-pre-line">{cols.productNames}</td>
                          <td className="border border-slate-200 px-2 py-2 text-end font-mono text-xs tabular-nums whitespace-pre-line">{cols.quantities}</td>
                          <td className="border border-slate-200 px-2 py-2 text-end font-mono text-xs tabular-nums whitespace-pre-line">{cols.unitPrices}</td>
                          <td className="border border-slate-200 px-2 py-2 text-end font-mono tabular-nums">
                            {formatMoneyCompact(p.discount_received_usd ?? '—')}
                          </td>
                          <td className="border border-slate-200 px-2 py-2 text-end font-mono tabular-nums">
                            {formatMoneyCompact(p.amount_paid_usd ?? '—')}
                          </td>
                          <td className="border border-slate-200 px-2 py-2 text-xs whitespace-nowrap">
                            {p.payment_type === 'cash'
                              ? t('purchasePage.paymentCash')
                              : p.payment_type === 'debt'
                                ? t('purchasePage.paymentDebt')
                                : p.payment_type ?? '—'}
                          </td>
                          <td className="border border-slate-200 px-2 py-2 font-mono text-xs whitespace-nowrap">{p.currency ?? 'USD'}</td>
                          <td className="border border-slate-200 max-w-[12rem] px-2 py-2 text-xs break-words">{p.note?.trim() || '—'}</td>
                          {canChangePurchase ? (
                            <td className="print:hidden border border-slate-200 px-1 py-2 text-center align-middle">
                              <button
                                type="button"
                                disabled={Boolean(p.has_returns)}
                                title={
                                  p.has_returns ? t('companiesPage.purchaseNoEditReturns') : t('companiesPage.editPurchase')
                                }
                                onClick={() => void openPurchaseEdit(p)}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                                <span className="sr-only">{t('companiesPage.editPurchase')}</span>
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
        {purchaseEditOpen ? (
          <div
            className="no-print fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-4 sm:items-center lg:pr-64"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) closePurchaseEdit()
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="company-purchase-edit-heading"
              className="flex max-h-[90dvh] min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
                  <h3
                    id="company-purchase-edit-heading"
                    className="text-start text-base font-semibold text-slate-900 dark:text-slate-100"
                  >
                    {t('companiesPage.editPurchaseTitle')}
                    {purchaseEditId != null ? ` (#${purchaseEditId})` : ''}
                  </h3>
                  {purchaseEditError ? (
                    <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                      {purchaseEditError}
                    </p>
                  ) : null}
                  {purchaseEditLoading ? (
                    <p className="mt-4 text-start text-sm text-slate-500">{t('companiesPage.editPurchaseLoading')}</p>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-3 text-start">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('purchasePage.date')}</span>
                        <input
                          type="datetime-local"
                          value={editOccurredAt}
                          onChange={(e) => setEditOccurredAt(e.target.value)}
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
                            value={editDiscountUsd}
                            onChange={(e) => setEditDiscountUsd(e.target.value)}
                            className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {stripUsdParens(t('purchasePage.amountPaid'))}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editAmountPaidUsd}
                            onChange={(e) => setEditAmountPaidUsd(e.target.value)}
                            className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('purchasePage.paymentType')}</span>
                          <select
                            value={editPaymentType}
                            onChange={(e) => setEditPaymentType(e.target.value === 'cash' ? 'cash' : 'debt')}
                            className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          >
                            <option value="cash">{t('purchasePage.paymentCash')}</option>
                            <option value="debt">{t('purchasePage.paymentDebt')}</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">USD / IQD</span>
                          <select
                            value={editCurrency}
                            onChange={(e) => setEditCurrency(e.target.value === 'IQD' ? 'IQD' : 'USD')}
                            className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          >
                            <option value="USD">USD</option>
                            <option value="IQD">IQD</option>
                          </select>
                        </label>
                      </div>
                      {editCurrency === 'IQD' ? (
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('purchasePage.exchangeRate')}</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editExchangeRate}
                            onChange={(e) => setEditExchangeRate(e.target.value)}
                            className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </label>
                      ) : null}
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('purchasePage.invoiceNumber')}</span>
                        <input
                          type="text"
                          value={editInvoice}
                          onChange={(e) => setEditInvoice(e.target.value)}
                          className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          spellCheck={false}
                        />
                        <span className="text-[11px] text-slate-500">{t('purchasePage.invoiceDigitsOnly')}</span>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('purchasePage.note')}</span>
                        <textarea
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          spellCheck={false}
                        />
                      </label>
                      <div className="border-t border-slate-200 pt-3 dark:border-slate-600">
                        <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">{t('purchasePage.product')}</p>
                        <div className="flex max-h-[min(40vh,20rem)] min-h-0 flex-col gap-2 overflow-y-auto sm:max-h-[50vh]">
                          {editLines.map((ln, idx) => (
                            <div
                              key={`${ln.product}-${idx}`}
                              className="rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-xs dark:border-slate-700 dark:bg-slate-950/50"
                            >
                              <p className="mb-2 font-medium text-slate-800 dark:text-slate-100">{ln.productName}</p>
                              <div className="grid grid-cols-3 gap-2">
                                <label className="flex flex-col gap-0.5">
                                  <span className="text-[10px] text-slate-500">{t('purchasePage.quantity')}</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={ln.quantity}
                                    onChange={(e) =>
                                      setEditLines((rows) =>
                                        rows.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r)),
                                      )
                                    }
                                    className="rounded border border-slate-200 px-1 py-1 dark:border-slate-600 dark:bg-slate-900"
                                  />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="text-[10px] text-slate-500">{t('purchasePage.unitPrice')} (USD)</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={ln.unitCostUsd}
                                    onChange={(e) =>
                                      setEditLines((rows) =>
                                        rows.map((r, i) => (i === idx ? { ...r, unitCostUsd: e.target.value } : r)),
                                      )
                                    }
                                    className="rounded border border-slate-200 px-1 py-1 dark:border-slate-600 dark:bg-slate-900"
                                  />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="text-[10px] text-slate-500">{t('purchasePage.damaged')}</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={ln.damaged}
                                    onChange={(e) =>
                                      setEditLines((rows) =>
                                        rows.map((r, i) => (i === idx ? { ...r, damaged: e.target.value } : r)),
                                      )
                                    }
                                    className="rounded border border-slate-200 px-1 py-1 dark:border-slate-600 dark:bg-slate-900"
                                  />
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-600">
                        <button
                          type="button"
                          onClick={closePurchaseEdit}
                          className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
                        >
                          {t('crud.cancel')}
                        </button>
                        <button
                          type="button"
                          disabled={purchaseEditSaving || purchaseEditLoading}
                          onClick={() => void savePurchaseEdit()}
                          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                        >
                          {t('crud.save')}
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        ) : null}
        </>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {editing ? t('crud.editRecordTitle') : t('crud.createRecordTitle')} — {pageTitle}
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cfg.fields.map((f) => (
                <label key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                  <span className="mb-1 block text-xs text-slate-600 dark:text-slate-400">{fieldLabel(f)}</span>
                  {f.type === 'textarea' ? (
                    <>
                      <textarea
                        value={String(draft[f.key] ?? '')}
                        onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                        className="min-h-32 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        spellCheck={false}
                      />
                      {f.hintKey ? (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(f.hintKey)}</p>
                      ) : null}
                    </>
                  ) : f.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(draft[f.key])}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.checked }))}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      value={String(draft[f.key] ?? '')}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                      className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">{t('crud.selectPlaceholder')}</option>
                      {(options[f.key] ?? []).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  ) : isExpensesResource && f.key === 'name' ? (
                    <div className="relative">
                      <input
                        type="text"
                        required={f.required}
                        value={String(draft[f.key] ?? '')}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                        }
                        onFocus={() => setExpenseFormNameSuggestOpen(true)}
                        onBlur={() =>
                          window.setTimeout(() => setExpenseFormNameSuggestOpen(false), 150)
                        }
                        autoComplete="off"
                        className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                      {expenseFormNameSuggestOpen &&
                      filteredExpenseFormNameSuggestions.length > 0 ? (
                        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900">
                          {filteredExpenseFormNameSuggestions.map((name) => (
                            <li key={name}>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setDraft((d) => ({ ...d, name }))
                                  setExpenseFormNameSuggestOpen(false)
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
                  ) : (
                    <input
                      type={f.type === 'datetime' ? 'datetime-local' : f.type}
                      required={f.required}
                      value={String(draft[f.key] ?? '')}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                      className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={formSaving}
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm disabled:opacity-50 dark:border-slate-600"
              >
                {t('crud.cancel')}
              </button>
              <button
                type="button"
                disabled={formSaving}
                onClick={() => void save()}
                className="min-h-11 rounded-lg bg-violet-600 px-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {formSaving ? t('pos.saving') : t('crud.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isExpensesResource && expenseHistoryOpen ? (
        <div
          className="fixed inset-0 z-[210] flex items-end justify-center bg-black/50 p-4 sm:items-center lg:pr-64"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeExpenseHistory()
          }}
        >
          <div
            className="flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expense-history-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-4 dark:border-slate-600">
              <h2 id="expense-history-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {t('expensePage.historyTitle')}
              </h2>
              <button
                type="button"
                onClick={closeExpenseHistory}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:text-slate-200"
              >
                {t('crud.cancel')}
              </button>
            </div>
            <div className="min-h-0 shrink space-y-3 overflow-y-auto p-4">
              <div className="relative grid grid-cols-1 gap-2 sm:grid-cols-12">
                <label className="relative block sm:col-span-4">
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t('expensePage.historyNameFilter')}
                  </span>
                  <input
                    value={expenseHistNameQuery}
                    onChange={(e) => {
                      setExpenseHistNameQuery(e.target.value)
                      setExpenseHistNameSuggestOpen(true)
                    }}
                    onFocus={() => setExpenseHistNameSuggestOpen(true)}
                    onBlur={() =>
                      window.setTimeout(() => setExpenseHistNameSuggestOpen(false), 120)
                    }
                    placeholder={t('expensePage.historyNamePlaceholder')}
                    autoComplete="off"
                    className="min-h-9 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  />
                  {expenseHistNameSuggestOpen && filteredExpenseHistNameSuggestions.length > 0 ? (
                    <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white shadow-md dark:border-slate-600 dark:bg-slate-900">
                      {filteredExpenseHistNameSuggestions.map((name) => (
                        <li key={name}>
                          <button
                            type="button"
                            onClick={() => {
                              setExpenseHistNameQuery(name)
                              setExpenseHistNameSuggestOpen(false)
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
                <label className="block sm:col-span-3">
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t('dash.from')}
                  </span>
                  <input
                    type="date"
                    value={expenseHistDateFrom}
                    onChange={(e) => setExpenseHistDateFrom(e.target.value)}
                    className="min-h-9 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
                <label className="block sm:col-span-3">
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t('dash.to')}
                  </span>
                  <input
                    type="date"
                    value={expenseHistDateTo}
                    onChange={(e) => setExpenseHistDateTo(e.target.value)}
                    className="min-h-9 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
                <div className="flex items-end gap-2 sm:col-span-2">
                  <button
                    type="button"
                    disabled={expenseHistoryLoading}
                    onClick={() => void fetchExpenseHistory(expenseHistDateFrom, expenseHistDateTo)}
                    className="min-h-9 flex-1 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    {expenseHistoryLoading ? t('common.loading') : t('dash.apply')}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80">
                    <tr>
                      <th className="px-3 py-2 text-start">{t('expensePage.name')}</th>
                      <th className="px-3 py-2 text-start">{t('expensePage.amount')}</th>
                      <th className="px-3 py-2 text-start">{t('expensePage.currency')}</th>
                      <th className="px-3 py-2 text-start">{t('expensePage.occurredOn')}</th>
                      <th className="px-3 py-2 text-end">{t('expensePage.colAmountUsd')}</th>
                      <th className="px-3 py-2 text-start">{t('expensePage.note')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseHistoryLoading ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-slate-500">
                          {t('common.loading')}
                        </td>
                      </tr>
                    ) : filteredExpenseHistoryRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-slate-500">
                          {t('crud.noRows')}
                        </td>
                      </tr>
                    ) : (
                      filteredExpenseHistoryRows.map((r) => (
                        <tr key={String(r.id)} className="border-t border-slate-100 dark:border-slate-700">
                          <td className="px-3 py-2">
                            {formatInventoryLossExpenseName(String(r.name ?? '')) || '—'}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums">
                            {r.amount != null && String(r.amount).trim() !== ''
                              ? formatMoneyCompact(r.amount as string | number)
                              : '—'}
                          </td>
                          <td className="px-3 py-2">{String(r.currency ?? '—')}</td>
                          <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                            {String(r.occurred_on ?? '—')}
                          </td>
                          <td className="px-3 py-2 text-end font-mono tabular-nums">
                            {formatMoneyCompact(r.amount_usd as string | number | null | undefined)}
                          </td>
                          <td
                            className="max-w-[12rem] truncate px-3 py-2 text-slate-600 dark:text-slate-300"
                            title={formatInventoryLossExpenseNote(String(r.note ?? ''))}
                          >
                            {formatInventoryLossExpenseNote(String(r.note ?? '')) || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}


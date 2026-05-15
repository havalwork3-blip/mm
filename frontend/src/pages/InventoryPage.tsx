import { Ban, Globe2, LayoutGrid, Layers } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'
import { PageAuthLoading } from '../components/PageAuthLoading'
import { InventoryProductGrid } from '../components/inventory/InventoryProductGrid'
import { useLocale } from '../context/LocaleContext'
import { useSyncedSession } from '../hooks/useSyncedSession'
import { apiJson, getGlobalView } from '../lib/api'
import imageCompression from 'browser-image-compression'
import { hasPerm } from '../lib/permissions'
import { useInventoryProductsStore } from '../stores/inventoryProductsStore'
import type { CurrencyRow, Paginated, ProductRow, ShopSettingsRow } from '../types/api'

type CategoryOption = { id: number; name: string }
type CompanyOption = { id: number; name: string }
type InventoryHistoryEntry = {
  id: string
  product_name: string
  occurred_at: string
  event_type: 'created' | 'stock_increase' | 'sale_return'
  quantity?: number
  /** Present for `stock_increase` rows from auto inventory purchases. */
  purchaseId?: number
}

type PurchaseHistoryDetailLine = {
  id: number
  product: number
  quantity: number
  unit_cost_usd: string
  damaged_quantity?: number
}

type PurchaseHistoryDetail = {
  id: number
  note?: string
  occurred_at: string
  lines: PurchaseHistoryDetailLine[]
}
const USD_RATE_DISPLAY_UNIT = 100

function parseRateInputValue(value: string): number | null {
  const normalized = value
    .replace(/[,\u066C،\s]/g, '')
    .trim()
  if (!normalized) return null
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function formatUsdInput(value: string): string {
  const normalized = value.replace(/[,،\s]/g, '').trim()
  if (!normalized) return ''
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed)) return value
  return parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function toApiPath(url: string): string | null {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return null
  }
}

function formatDateTimeForPdf(value: string | null | undefined): string {
  if (!value) return ''
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

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function InventoryPage() {
  const { t, lang, setLang } = useLocale()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const {
    me,
    authPending,
    showLogin,
    login,
    canAccessShopData,
    needsShop,
  } = useSyncedSession()
  const [error, setError] = useState<string | null>(null)

  const [search] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const setInventoryProducts = useInventoryProductsStore((s) => s.setItems)
  const products = useInventoryProductsStore((s) => s.items)
  const resetInventoryProducts = useInventoryProductsStore((s) => s.reset)

  useEffect(() => {
    if (!me) resetInventoryProducts()
  }, [me, resetInventoryProducts])
  const [loadingProducts, setLoadingProducts] = useState(false)

  const [, setRate] = useState<number | null>(null)
  const [lowStockThreshold, setLowStockThreshold] = useState(5)
  const [rateModalOpen, setRateModalOpen] = useState(false)
  const [rateInput, setRateInput] = useState('')
  const [savingRate, setSavingRate] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [savingEditProduct, setSavingEditProduct] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [exportingProducts, setExportingProducts] = useState(false)
  const [historyItems, setHistoryItems] = useState<InventoryHistoryEntry[]>([])
  const [historyStockEditOpen, setHistoryStockEditOpen] = useState(false)
  const [historyStockEditPurchaseId, setHistoryStockEditPurchaseId] = useState<number | null>(null)
  const [historyStockEditLoading, setHistoryStockEditLoading] = useState(false)
  const [historyStockEditSaving, setHistoryStockEditSaving] = useState(false)
  const [historyStockEditForm, setHistoryStockEditForm] = useState({
    occurredAt: '',
    quantity: '',
    unitCostUsd: '',
    note: '',
    productId: 0,
  })
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const imageFileInputRef = useRef<HTMLInputElement>(null)
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreviewUrl, setEditImagePreviewUrl] = useState<string | null>(null)
  const editImageFileInputRef = useRef<HTMLInputElement>(null)
  const [compressingImage, setCompressingImage] = useState(false)
  const [productNameFilter, setProductNameFilter] = useState('')
  const [productNameFilterOpen, setProductNameFilterOpen] = useState(false)
  const [categoryFilterId, setCategoryFilterId] = useState('')
  const [lowStockMaxInput, setLowStockMaxInput] = useState('')
  const [showDiscontinued, setShowDiscontinued] = useState(false)
  const [togglingDiscontinuedId, setTogglingDiscontinuedId] = useState<number | null>(null)
  const [discontinuedListOpen, setDiscontinuedListOpen] = useState(false)
  const [discontinuedListLoading, setDiscontinuedListLoading] = useState(false)
  const [discontinuedListItems, setDiscontinuedListItems] = useState<ProductRow[]>([])
  const [createForm, setCreateForm] = useState({
    name: '',
    category: '',
    sku: '',
    barcode: '',
    buy_price: '',
    sale_price_retail: '',
    sale_price_wholesale: '',
    current_stock_quantity: '0',
    low_stock_threshold: '',
  })
  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    sku: '',
    barcode: '',
    buy_price: '',
    current_stock_quantity: '0',
    low_stock_threshold: '',
  })

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])

  const loadCurrencies = useCallback(async () => {
    const rows = await apiJson<CurrencyRow[]>('/api/currencies/')
    const sorted = [...rows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
    const latest = sorted[0]
    if (latest) setRate(parseFloat(latest.usd_to_iqd))
    else setRate(null)
  }, [])

  const loadShopSettings = useCallback(async () => {
    try {
      const settings = await apiJson<ShopSettingsRow>('/api/shop-settings/')
      setLowStockThreshold(settings.low_stock_threshold)
    } catch {
      setLowStockThreshold(5)
    }
  }, [])

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const q = debouncedSearch
        ? `?search=${encodeURIComponent(debouncedSearch)}`
        : ''
      const data = await apiJson<Paginated<ProductRow> | ProductRow[]>(
        `/api/products/${q}`,
      )
      const list = Array.isArray(data) ? data : data.results
      setInventoryProducts(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('inv.loadProductsFailed'))
      setInventoryProducts([])
    } finally {
      setLoadingProducts(false)
    }
  }, [debouncedSearch, t])

  const fetchAllProducts = useCallback(async (): Promise<ProductRow[]> => {
    const all: ProductRow[] = []
    let nextPath: string | null = '/api/products/?page_size=200'
    while (nextPath) {
      const data: Paginated<ProductRow> | ProductRow[] = await apiJson<
        Paginated<ProductRow> | ProductRow[]
      >(nextPath)
      if (Array.isArray(data)) {
        all.push(...data)
        nextPath = null
        continue
      }
      all.push(...data.results)
      nextPath = data.next ? toApiPath(data.next) : null
    }
    return all
  }, [])

  const loadAddHistoryItems = useCallback(async (): Promise<InventoryHistoryEntry[]> => {
    const [allProducts, purchasesData, returnsData] = await Promise.all([
      fetchAllProducts(),
      apiJson<
        | Array<{
            id: number
            occurred_at: string
            lines_product_names?: string
            note?: string
            total_units?: number
          }>
        | {
            results: Array<{
              id: number
              occurred_at: string
              lines_product_names?: string
              note?: string
              total_units?: number
            }>
          }
      >('/api/purchases/'),
      apiJson<
        | Array<{
            id: number
            product_name?: string
            quantity?: number
            occurred_at?: string
          }>
        | {
            results: Array<{
              id: number
              product_name?: string
              quantity?: number
              occurred_at?: string
            }>
          }
      >('/api/sales/returns-history/'),
    ])
    const purchases = Array.isArray(purchasesData) ? purchasesData : purchasesData.results
    const returnsRows = Array.isArray(returnsData) ? returnsData : returnsData.results
    const createdEvents: InventoryHistoryEntry[] = allProducts.map((p) => ({
      id: `product-created-${p.id}`,
      product_name: p.name,
      occurred_at: p.created_at,
      event_type: 'created',
    }))
    const stockIncreaseEvents: InventoryHistoryEntry[] = purchases
      .filter((row) => String(row.note ?? '').includes('[AUTO_STOCK_INCREASE]'))
      .map((row) => ({
        id: `purchase-adjust-${row.id}`,
        purchaseId: row.id,
        product_name: String(row.lines_product_names || '').trim() || t('inv.unknownProduct'),
        occurred_at: row.occurred_at,
        event_type: 'stock_increase',
        quantity: typeof row.total_units === 'number' ? row.total_units : undefined,
      }))
    const returnedEvents: InventoryHistoryEntry[] = returnsRows.map((row) => ({
      id: `sale-return-${row.id}`,
      product_name: String(row.product_name || '').trim() || t('inv.unknownProduct'),
      occurred_at: String(row.occurred_at || ''),
      event_type: 'sale_return',
      quantity: Number(row.quantity ?? 0),
    }))
    const merged = [...createdEvents, ...stockIncreaseEvents].sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    )
    return [...merged, ...returnedEvents].sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    )
  }, [fetchAllProducts, t])

  const loadCreateDependencies = useCallback(async () => {
    const [catRes, compRes] = await Promise.allSettled([
      apiJson<CategoryOption[] | { results: CategoryOption[] }>('/api/categories/'),
      apiJson<CompanyOption[] | { results: CompanyOption[] }>('/api/companies/'),
    ])
    const catData = catRes.status === 'fulfilled' ? catRes.value : []
    const compData = compRes.status === 'fulfilled' ? compRes.value : []
    const catList = Array.isArray(catData) ? catData : catData.results
    const compList = Array.isArray(compData) ? compData : compData.results
    setCategories(catList)
    setCompanies(compList)
    if (catList.length > 0) {
      setCreateForm((prev) => ({ ...prev, category: prev.category || String(catList[0].id) }))
    }
  }, [])

  const loadCategoryFilters = useCallback(async () => {
    const catData = await apiJson<CategoryOption[] | { results: CategoryOption[] }>(
      '/api/categories/',
    )
    const catList = Array.isArray(catData) ? catData : catData.results
    setCategories(catList)
  }, [])

  useEffect(() => {
    if (!me || !canAccessShopData) return
    void loadCurrencies().catch((e) =>
      setError(e instanceof Error ? e.message : t('inv.loadRateFailed')),
    )
    void loadShopSettings()
    void loadCategoryFilters().catch(() => setCategories([]))
  }, [
    me,
    canAccessShopData,
    loadCurrencies,
    loadShopSettings,
    loadCategoryFilters,
    t,
  ])

  useEffect(() => {
    if (!me || !canAccessShopData) return
    void loadProducts()
  }, [me, canAccessShopData, loadProducts])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loginFailed'))
    }
  }

  async function saveTodayRate() {
    const displayRate = parseRateInputValue(rateInput)
    if (displayRate === null || displayRate <= 0) {
      setError(t('inv.saveRateFailed'))
      return
    }
    const perOneUsdRate = displayRate / USD_RATE_DISPLAY_UNIT
    setSavingRate(true)
    setError(null)
    try {
      await apiJson<CurrencyRow>('/api/currencies/set-today/', {
        method: 'POST',
        body: JSON.stringify({ usd_to_iqd: String(perOneUsdRate) }),
      })
      setRateModalOpen(false)
      await loadCurrencies()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('inv.saveRateFailed'))
    } finally {
      setSavingRate(false)
    }
  }

  async function openCreateModal() {
    setError(null)
    try {
      await loadCreateDependencies()
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
      setImageFile(null)
      setImagePreviewUrl(null)
      if (imageFileInputRef.current) imageFileInputRef.current.value = ''
      setCreateOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }

  async function createProduct() {
    if (!createForm.category) return
    setCreatingProduct(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('name', createForm.name.trim())
      form.append('category', String(Number(createForm.category)))
      form.append('sku', createForm.sku.trim())
      form.append('barcode', createForm.barcode.trim())
      form.append('buy_price', createForm.buy_price)
      // Hide sale-price inputs in create modal; default both to buy price.
      form.append('sale_price_retail', createForm.buy_price)
      form.append('sale_price_wholesale', createForm.buy_price)
      form.append(
        'current_stock_quantity',
        String(Number(createForm.current_stock_quantity || '0')),
      )
      const createThreshold = createForm.low_stock_threshold.trim()
      if (createThreshold) {
        form.append(
          'low_stock_threshold',
          String(Math.max(0, Number(createThreshold))),
        )
      }
      if (imageFile) form.append('image', imageFile)
      await apiJson<ProductRow>('/api/products/', {
        method: 'POST',
        body: form,
      })
      setCreateOpen(false)
      setCreateForm({
        name: '',
        category: categories[0] ? String(categories[0].id) : '',
        sku: '',
        barcode: '',
        buy_price: '',
        sale_price_retail: '',
        sale_price_wholesale: '',
        current_stock_quantity: '0',
        low_stock_threshold: '',
      })
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
      setImageFile(null)
      setImagePreviewUrl(null)
      if (imageFileInputRef.current) imageFileInputRef.current.value = ''
      await loadProducts()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setCreatingProduct(false)
    }
  }

  async function openEditModal(product: ProductRow) {
    setError(null)
    try {
      await loadCreateDependencies()
      setEditingProductId(product.id)
      setEditForm({
        name: product.name ?? '',
        category: String(product.category ?? ''),
        sku: product.sku ?? '',
        barcode: product.barcode ?? '',
        buy_price: formatUsdInput(product.buy_price ?? ''),
        current_stock_quantity: String(product.current_stock_quantity ?? 0),
        low_stock_threshold:
          product.low_stock_threshold === null || product.low_stock_threshold === undefined
            ? ''
            : String(product.low_stock_threshold),
      })
      if (editImagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(editImagePreviewUrl)
      setEditImageFile(null)
      setEditImagePreviewUrl(product.image_url || null)
      if (editImageFileInputRef.current) editImageFileInputRef.current.value = ''
      setEditOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }

  async function saveEditedProduct() {
    if (!editingProductId || !editForm.category) return
    setSavingEditProduct(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('name', editForm.name.trim())
      form.append('category', String(Number(editForm.category)))
      form.append('sku', editForm.sku.trim())
      form.append('barcode', editForm.barcode.trim())
      form.append('buy_price', editForm.buy_price)
      form.append('sale_price_retail', editForm.buy_price)
      form.append('sale_price_wholesale', editForm.buy_price)
      form.append('current_stock_quantity', String(Number(editForm.current_stock_quantity || '0')))
      const editThreshold = editForm.low_stock_threshold.trim()
      if (editThreshold) {
        form.append('low_stock_threshold', String(Math.max(0, Number(editThreshold))))
      } else {
        form.append('low_stock_threshold', '')
      }
      if (editImageFile) form.append('image', editImageFile)
      await apiJson<ProductRow>(`/api/products/${editingProductId}/`, {
        method: 'PATCH',
        body: form,
      })
      setEditOpen(false)
      setEditingProductId(null)
      if (editImagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(editImagePreviewUrl)
      setEditImageFile(null)
      setEditImagePreviewUrl(null)
      if (editImageFileInputRef.current) editImageFileInputRef.current.value = ''
      await loadProducts()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSavingEditProduct(false)
    }
  }

  async function setProductDiscontinued(p: ProductRow, next: boolean) {
    if (!hasPerm(me, 'inventory.change_product')) return
    if (next) {
      const ok = window.confirm(t('inv.confirmStopCarrying'))
      if (!ok) return
    }
    setTogglingDiscontinuedId(p.id)
    setError(null)
    try {
      await apiJson<ProductRow>(`/api/products/${p.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ is_discontinued: next }),
      })
      await loadProducts()
      if (!next) {
        setDiscontinuedListItems((items) => items.filter((x) => x.id !== p.id))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setTogglingDiscontinuedId(null)
    }
  }

  async function openAddHistoryModal() {
    setHistoryOpen(true)
    setHistoryLoading(true)
    setError(null)
    try {
      const items = await loadAddHistoryItems()
      setHistoryItems(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
      setHistoryItems([])
    } finally {
      setHistoryLoading(false)
    }
  }

  async function openHistoryStockEdit(purchaseId: number) {
    setHistoryStockEditPurchaseId(purchaseId)
    setHistoryStockEditOpen(true)
    setHistoryStockEditLoading(true)
    setError(null)
    try {
      const p = await apiJson<PurchaseHistoryDetail>(`/api/purchases/${purchaseId}/`)
      const line = p.lines?.[0]
      if (!line) {
        throw new Error(t('inv.historyEditLoadFailed'))
      }
      const d = new Date(p.occurred_at)
      setHistoryStockEditForm({
        occurredAt: Number.isNaN(d.getTime()) ? '' : toDatetimeLocalValue(d),
        quantity: String(line.quantity ?? ''),
        unitCostUsd: String(line.unit_cost_usd ?? ''),
        note: String(p.note ?? ''),
        productId: line.product,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('inv.historyEditLoadFailed'))
      setHistoryStockEditOpen(false)
      setHistoryStockEditPurchaseId(null)
    } finally {
      setHistoryStockEditLoading(false)
    }
  }

  async function saveHistoryStockEdit() {
    if (historyStockEditPurchaseId == null) return
    const qty = Number.parseInt(historyStockEditForm.quantity.trim(), 10)
    if (!Number.isFinite(qty) || qty < 1) {
      setError(t('inv.historyEditInvalidQty'))
      return
    }
    if (!historyStockEditForm.note.includes('[AUTO_STOCK_INCREASE]')) {
      setError(t('inv.historyEditMarkerRequired'))
      return
    }
    const occurred = new Date(historyStockEditForm.occurredAt)
    if (Number.isNaN(occurred.getTime())) {
      setError(t('inv.historyEditInvalidDate'))
      return
    }
    setHistoryStockEditSaving(true)
    setError(null)
    try {
      await apiJson<PurchaseHistoryDetail>(`/api/purchases/${historyStockEditPurchaseId}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          occurred_at: occurred.toISOString(),
          note: historyStockEditForm.note,
          lines: [
            {
              product: historyStockEditForm.productId,
              quantity: qty,
              unit_cost_usd: historyStockEditForm.unitCostUsd.trim() || '0',
              damaged_quantity: 0,
            },
          ],
        }),
      })
      setHistoryStockEditOpen(false)
      setHistoryStockEditPurchaseId(null)
      setHistoryLoading(true)
      try {
        const items = await loadAddHistoryItems()
        setHistoryItems(items)
      } finally {
        setHistoryLoading(false)
      }
      await loadProducts()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('inv.historyEditSaveFailed'))
    } finally {
      setHistoryStockEditSaving(false)
    }
  }

  async function openDiscontinuedListModal() {
    setDiscontinuedListOpen(true)
    setDiscontinuedListLoading(true)
    setError(null)
    try {
      const all = await fetchAllProducts()
      const list = all
        .filter((p) => p.is_discontinued)
        .sort((a, b) => a.name.localeCompare(b.name))
      setDiscontinuedListItems(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
      setDiscontinuedListItems([])
    } finally {
      setDiscontinuedListLoading(false)
    }
  }

  async function downloadProductsPdf() {
    setExportingProducts(true)
    setError(null)
    try {
      const all = await fetchAllProducts()
      const rows = [...all].sort((a, b) => a.name.localeCompare(b.name))
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const isKurdish = lang === 'ku'
      const title = isKurdish ? 'ڕاپۆرتی بەرهەمەکانی کۆگا - PDF' : 'Inventory Products Report (PDF)'
      const headers = isKurdish
        ? [
            'ناسنامە',
            'ناوی بەرهەم',
            'فرۆشگا',
            'پۆل',
            'SKU',
            'Barcode',
            'نرخی کڕین USD',
            'نرخی تاکفرۆشی USD',
            'نرخی کۆمەڵە USD',
            'کۆگا',
            'بەرواری زیادکردن',
            'بەرواری نوێکردنەوە',
          ]
        : [
            'ID',
            'Product Name',
            'Shop',
            'Category',
            'SKU',
            'Barcode',
            'Buy USD',
            'Retail USD',
            'Wholesale USD',
            'Stock',
            'Created At',
            'Updated',
          ]

      if (isKurdish) {
        // jsPDF standard fonts cannot reliably render Kurdish glyph shaping.
        // For Kurdish only, render an isolated HTML table and capture to PDF image pages.
        const container = document.createElement('div')
        container.setAttribute('dir', 'rtl')
        container.style.position = 'fixed'
        container.style.left = '-100000px'
        container.style.top = '0'
        container.style.width = '1280px'
        container.style.background = '#ffffff'
        container.style.color = '#0f172a'
        container.style.fontFamily = '"Noto Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif'
        container.style.padding = '16px'
        const headerCells = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
        const bodyRows = rows
          .map(
            (p) => `<tr>
              <td>${escapeHtml(p.id)}</td>
              <td class="name-cell">${escapeHtml(p.name ?? '')}</td>
              <td>${escapeHtml(p.shop_name ?? p.shop ?? '')}</td>
              <td>${escapeHtml(p.category ?? '')}</td>
              <td>${escapeHtml(p.sku ?? '')}</td>
              <td>${escapeHtml(p.barcode ?? '')}</td>
              <td>${escapeHtml(p.buy_price ?? '')}</td>
              <td>${escapeHtml(p.sale_price_retail ?? '')}</td>
              <td>${escapeHtml(p.sale_price_wholesale ?? '')}</td>
              <td>${escapeHtml(p.current_stock_quantity ?? '')}</td>
              <td>${escapeHtml(formatDateTimeForPdf(p.created_at))}</td>
              <td>${escapeHtml(formatDateTimeForPdf(p.updated_at))}</td>
            </tr>`,
          )
          .join('')
        container.innerHTML = `
          <style>
            .pdf-title { margin: 0 0 10px; font-size: 20px; font-weight: 700; text-align: right; }
            .pdf-meta { margin: 0 0 10px; font-size: 11px; color: #475569; text-align: right; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 4px 5px; text-align: right; vertical-align: middle; }
            td { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            td.name-cell { white-space: normal; word-break: break-word; line-height: 1.3; }
            th { background: #0ea5a4; color: #ffffff; font-weight: 700; }
            tbody tr:nth-child(even) { background: #f8fafc; }
          </style>
          <h1 class="pdf-title">${escapeHtml(title)}</h1>
          <p class="pdf-meta">${escapeHtml(new Date().toLocaleString('en-CA'))}</p>
          <table>
            <colgroup>
              <col style="width:5%">
              <col style="width:14%">
              <col style="width:5%">
              <col style="width:5%">
              <col style="width:6%">
              <col style="width:7%">
              <col style="width:9%">
              <col style="width:9%">
              <col style="width:9%">
              <col style="width:6%">
              <col style="width:12%">
              <col style="width:13%">
            </colgroup>
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        `
        document.body.appendChild(container)
        const canvas = await html2canvas(container, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          onclone: (clonedDoc) => {
            clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
              if (!el.textContent?.includes('.pdf-title')) el.remove()
            })
          },
        })
        document.body.removeChild(container)
        const margin = 20
        const pageWidth = doc.internal.pageSize.getWidth() - margin * 2
        const pageHeight = doc.internal.pageSize.getHeight() - margin * 2
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
          const pageImg = pageCanvas.toDataURL('image/png')
          const renderedHeight = (sliceHeight * pageWidth) / canvas.width
          if (pageNo > 1) doc.addPage()
          doc.addImage(pageImg, 'PNG', margin, margin, pageWidth, renderedHeight)
          offsetY += sliceHeight
          pageNo += 1
        }
        doc.save(`inventory-products-${new Date().toISOString().slice(0, 10)}.pdf`)
        return
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(title, 40, 30)
      autoTable(doc, {
        startY: 42,
        styles: { fontSize: 8, cellPadding: 4 },
        head: [headers],
        body: rows.map((p) => [
          String(p.id),
          p.name ?? '',
          String(p.shop_name ?? p.shop ?? ''),
          String(p.category ?? ''),
          p.sku ?? '',
          p.barcode ?? '',
          p.buy_price ?? '',
          p.sale_price_retail ?? '',
          p.sale_price_wholesale ?? '',
          String(p.current_stock_quantity ?? ''),
          formatDateTimeForPdf(p.created_at),
          formatDateTimeForPdf(p.updated_at),
        ]),
        margin: { left: 24, right: 24 },
        theme: 'grid',
        headStyles: { fillColor: [14, 165, 164], textColor: [255, 255, 255] },
        didDrawPage: (data) => {
          const pageSize = doc.internal.pageSize
          const pageWidth = pageSize.getWidth()
          doc.setFontSize(8)
          doc.text(`Page ${data.pageNumber}`, pageWidth - 56, pageSize.getHeight() - 12)
        },
      })
      doc.save(`inventory-products-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setExportingProducts(false)
    }
  }

  async function onImagePicked(file: File | null) {
    if (!file) {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
      setImageFile(null)
      setImagePreviewUrl(null)
      return
    }
    setCompressingImage(true)
    setError(null)
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      })
      if (compressed.size > 500 * 1024) {
        setError(t('inv.imageTooLarge'))
        return
      }
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
      const nextFile = new File([compressed], file.name, { type: compressed.type })
      setImageFile(nextFile)
      setImagePreviewUrl(URL.createObjectURL(nextFile))
    } catch {
      setError(t('inv.imageTooLarge'))
    } finally {
      setCompressingImage(false)
    }
  }

  async function onEditImagePicked(file: File | null) {
    if (!file) {
      if (editImagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(editImagePreviewUrl)
      setEditImageFile(null)
      setEditImagePreviewUrl(null)
      return
    }
    setCompressingImage(true)
    setError(null)
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      })
      if (compressed.size > 500 * 1024) {
        setError(t('inv.imageTooLarge'))
        return
      }
      if (editImagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(editImagePreviewUrl)
      const nextFile = new File([compressed], file.name, { type: compressed.type })
      setEditImageFile(nextFile)
      setEditImagePreviewUrl(URL.createObjectURL(nextFile))
    } catch {
      setError(t('inv.imageTooLarge'))
    } finally {
      setCompressingImage(false)
    }
  }

  const canAddProduct = hasPerm(me, 'inventory.add_product')
  const canEditProduct = hasPerm(me, 'inventory.change_product')
  const canEditStockHistory =
    hasPerm(me, 'inventory.change_product') || hasPerm(me, 'inventory.change_purchase')
  const canViewCategories = hasPerm(me, 'view_category')

  const productNameSuggestions = useMemo(() => {
    const q = productNameFilter.trim().toLowerCase()
    const names = Array.from(new Set(products.map((p) => p.name).filter(Boolean)))
    return names
      .filter((name) => !q || name.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 8)
  }, [productNameFilter, products])

  const filteredProducts = useMemo(() => {
    const q = productNameFilter.trim().toLowerCase()
    const lowStockMax = Number.parseInt(lowStockMaxInput.trim(), 10)
    const hasLowStockFilter = Number.isFinite(lowStockMax)
    return products.filter((p) => {
      if (!showDiscontinued && p.is_discontinued) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      if (categoryFilterId && p.category !== Number(categoryFilterId)) return false
      if (hasLowStockFilter && p.current_stock_quantity > lowStockMax) return false
      return true
    })
  }, [products, productNameFilter, categoryFilterId, lowStockMaxInput, showDiscontinued])

  const productCount = filteredProducts.length

  if (authPending) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 dark:text-slate-100">
        <PageAuthLoading />
      </div>
    )
  }

  if (showLogin) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 dark:text-slate-100">
        <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
            <Link
              to="/"
              className="text-sm font-medium text-violet-600 underline-offset-4 hover:underline"
            >
              {t('nav.home')}
            </Link>
            <div className="flex items-center gap-1">
              <Globe2 className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              <select
                value={lang}
                onChange={(e) =>
                  setLang(e.target.value as 'en' | 'ar' | 'ku')
                }
                className="rounded-lg border border-slate-200 px-2 py-1 text-start text-sm"
                aria-label={t('common.language')}
              >
                <option value="en">{t('lang.en')}</option>
                <option value="ar">{t('lang.ar')}</option>
                <option value="ku">{t('lang.ku')}</option>
              </select>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-lg px-4 py-12">
          <h1 className="text-start text-xl font-semibold text-slate-900">
            {t('inv.signInTitle')}
          </h1>
          <p className="mt-2 text-start text-sm text-slate-600">
            {t('inv.signInHint')}
          </p>
          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-start text-sm font-medium text-slate-700"
              >
                {t('inv.email')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-start shadow-sm"
                required
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-start text-sm font-medium text-slate-700"
              >
                {t('inv.password')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-start shadow-sm"
                required
              />
            </div>
            {error && (
              <p className="text-start text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
            >
              {t('inv.continue')}
            </button>
          </form>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 dark:text-slate-100">
      {needsShop && (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-start text-sm text-amber-900">
            {t('inv.superuserShopHint')}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {error && (
          <p
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-start text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <LayoutGrid className="h-5 w-5 text-violet-600" aria-hidden />
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {t('inv.sectionProducts')}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void downloadProductsPdf()}
              disabled={exportingProducts}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-60"
            >
              {exportingProducts ? t('inv.exportingPdf') : t('inv.exportPdf')}
            </button>
            <button
              type="button"
              onClick={() => void openDiscontinuedListModal()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Ban className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              {t('inv.stoppedRestockingList')}
            </button>
            <button
              type="button"
              onClick={() => void openAddHistoryModal()}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {t('inv.addHistory')}
            </button>
            {canViewCategories ? (
              <Link
                to="/manage/categories"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Layers className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                {t('inv.productCategoriesLink')}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40 sm:grid-cols-4">
          <div className="relative">
            <label className="mb-1 block text-start text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('sales.filterProductName')}
            </label>
            <input
              type="search"
              value={productNameFilter}
              onChange={(e) => {
                setProductNameFilter(e.target.value)
                setProductNameFilterOpen(true)
              }}
              onFocus={() => setProductNameFilterOpen(true)}
              onBlur={() => window.setTimeout(() => setProductNameFilterOpen(false), 120)}
              placeholder={t('sales.filterProductNamePlaceholder')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
            {productNameFilterOpen && productNameSuggestions.length > 0 ? (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-800">
                {productNameSuggestions.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => {
                        setProductNameFilter(name)
                        setProductNameFilterOpen(false)
                      }}
                      className="w-full px-3 py-2 text-start text-sm hover:bg-slate-50"
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-start text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('nav.categories')}
            </label>
            <select
              value={categoryFilterId}
              onChange={(e) => setCategoryFilterId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">{t('common.all')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-start text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('inv.lowStock')}
            </label>
            <input
              type="number"
              min={0}
              value={lowStockMaxInput}
              onChange={(e) => setLowStockMaxInput(e.target.value)}
              placeholder={String(lowStockThreshold)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          {canAddProduct ? (
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void openCreateModal()}
                className="min-h-11 w-full rounded-lg bg-violet-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
              >
                {t('inv.addProduct')}
              </button>
            </div>
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={showDiscontinued}
              onChange={(e) => setShowDiscontinued(e.target.checked)}
            />
            {t('inv.showDiscontinuedProducts')}
          </label>
        </div>

        {loadingProducts ? (
          <p className="text-center text-sm text-slate-500">{t('inv.loadingProducts')}</p>
        ) : (
          <InventoryProductGrid
            items={filteredProducts}
            showShopColumn={Boolean(me?.is_superuser && getGlobalView())}
            lowStockThreshold={lowStockThreshold}
            t={t}
            onEditProduct={canEditProduct ? (p) => void openEditModal(p) : undefined}
            onSetDiscontinued={
              canEditProduct
                ? (p, next) => {
                    void setProductDiscontinued(p, next)
                  }
                : undefined
            }
            togglingDiscontinuedId={togglingDiscontinuedId}
          />
        )}

        {!loadingProducts && productCount === 0 && !needsShop && (
          <p className="py-12 text-center text-sm text-slate-500">
            {t('inv.emptyProducts')}
          </p>
        )}
      </main>

      {rateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rate-dialog-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <h2
              id="rate-dialog-title"
              className="text-start text-base font-semibold text-slate-900"
            >
              {t('inv.rateDialogTitle')}
            </h2>
            <p className="mt-1 text-start text-sm text-slate-600">
              {t('inv.rateDialogHint')}
            </p>
            <label htmlFor="rate-input" className="mt-4 block text-start">
              <span className="text-sm font-medium text-slate-700">
                {t('inv.usdToIqd')}
              </span>
              <input
                id="rate-input"
                type="text"
                inputMode="decimal"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-start tabular-nums shadow-sm"
                placeholder={t('inv.ratePlaceholder')}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRateModalOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {t('inv.cancel')}
              </button>
              <button
                type="button"
                disabled={savingRate}
                onClick={() => void saveTodayRate()}
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {savingRate ? t('inv.saving') : t('inv.save')}
              </button>
            </div>
          </div>
        </div>
      )}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">{t('inv.addProduct')}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t('inv.addProductHint')} ({t('admin.permModel.company')}: {companies.length})
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-start">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  {t('inv.productName')}
                </span>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((v) => ({ ...v, name: e.target.value }))}
                  placeholder={t('inv.productName')}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-start">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  {t('nav.categories')}
                </span>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm((v) => ({ ...v, category: e.target.value }))}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-start">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  {t('inv.stockQty')}
                </span>
                <input
                  value={createForm.current_stock_quantity}
                  onChange={(e) =>
                    setCreateForm((v) => ({ ...v, current_stock_quantity: e.target.value }))
                  }
                  placeholder={t('inv.stockQty')}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-start">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  {t('inv.buyPrice')}
                </span>
                <input
                  value={createForm.buy_price}
                  onChange={(e) => setCreateForm((v) => ({ ...v, buy_price: e.target.value }))}
                  onBlur={(e) =>
                    setCreateForm((v) => ({ ...v, buy_price: formatUsdInput(e.target.value) }))
                  }
                  placeholder={t('inv.buyPrice')}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-start">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  {t('inv.productLowStockThreshold')}
                </span>
                <input
                  type="number"
                  min={0}
                  value={createForm.low_stock_threshold}
                  onChange={(e) =>
                    setCreateForm((v) => ({ ...v, low_stock_threshold: e.target.value }))
                  }
                  placeholder={t('inv.productLowStockThresholdPlaceholder')}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="sm:col-span-2">
                <span className="mb-1 block text-sm text-slate-700">{t('inv.uploadImage')}</span>
                <input
                  ref={imageFileInputRef}
                  id="inv-product-image"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => void onImagePicked(e.target.files?.[0] ?? null)}
                />
                <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <label
                    htmlFor="inv-product-image"
                    className="inline-flex cursor-pointer items-center rounded-md bg-violet-100 px-3 py-1.5 text-sm font-medium text-violet-800 hover:bg-violet-200"
                  >
                    {t('inv.chooseFile')}
                  </label>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                    {imageFile ? imageFile.name : t('inv.noFileChosen')}
                  </span>
                </div>
                {compressingImage ? (
                  <p className="mt-1 text-xs text-slate-500">{t('inv.compressing')}</p>
                ) : null}
                {imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt=""
                    className="mt-2 h-24 w-24 rounded-lg border border-slate-200 object-cover"
                  />
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false)
                  if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
                  setImageFile(null)
                  setImagePreviewUrl(null)
                  if (imageFileInputRef.current) imageFileInputRef.current.value = ''
                }}
                className="min-h-11 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {t('inv.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void createProduct()}
                disabled={creatingProduct || !createForm.name.trim() || !createForm.category}
                className="min-h-11 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {creatingProduct ? t('inv.saving') : t('inv.addProduct')}
              </button>
            </div>
          </div>
        </div>
      )}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">{t('crud.edit')}</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-start">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  {t('inv.productName')}
                </span>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((v) => ({ ...v, name: e.target.value }))}
                  placeholder={t('inv.productName')}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-start">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  {t('nav.categories')}
                </span>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm((v) => ({ ...v, category: e.target.value }))}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-start">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  {t('inv.stockQty')}
                </span>
                <input
                  value={editForm.current_stock_quantity}
                  onChange={(e) =>
                    setEditForm((v) => ({ ...v, current_stock_quantity: e.target.value }))
                  }
                  placeholder={t('inv.stockQty')}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-start">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  {t('inv.buyPrice')}
                </span>
                <input
                  value={editForm.buy_price}
                  onChange={(e) => setEditForm((v) => ({ ...v, buy_price: e.target.value }))}
                  onBlur={(e) =>
                    setEditForm((v) => ({ ...v, buy_price: formatUsdInput(e.target.value) }))
                  }
                  placeholder={t('inv.buyPrice')}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-start">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  {t('inv.productLowStockThreshold')}
                </span>
                <input
                  type="number"
                  min={0}
                  value={editForm.low_stock_threshold}
                  onChange={(e) =>
                    setEditForm((v) => ({ ...v, low_stock_threshold: e.target.value }))
                  }
                  placeholder={t('inv.productLowStockThresholdPlaceholder')}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-start">
                <span className="mb-1 block text-xs font-medium text-slate-600">SKU</span>
                <input
                  value={editForm.sku}
                  onChange={(e) => setEditForm((v) => ({ ...v, sku: e.target.value }))}
                  placeholder="SKU"
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-start">
                <span className="mb-1 block text-xs font-medium text-slate-600">Barcode</span>
                <input
                  value={editForm.barcode}
                  onChange={(e) => setEditForm((v) => ({ ...v, barcode: e.target.value }))}
                  placeholder="Barcode"
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="sm:col-span-2">
                <span className="mb-1 block text-sm text-slate-700">{t('inv.uploadImage')}</span>
                <input
                  ref={editImageFileInputRef}
                  id="inv-edit-product-image"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => void onEditImagePicked(e.target.files?.[0] ?? null)}
                />
                <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <label
                    htmlFor="inv-edit-product-image"
                    className="inline-flex cursor-pointer items-center rounded-md bg-violet-100 px-3 py-1.5 text-sm font-medium text-violet-800 hover:bg-violet-200"
                  >
                    {t('inv.chooseFile')}
                  </label>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                    {editImageFile ? editImageFile.name : t('inv.noFileChosen')}
                  </span>
                </div>
                {compressingImage ? (
                  <p className="mt-1 text-xs text-slate-500">{t('inv.compressing')}</p>
                ) : null}
                {editImagePreviewUrl ? (
                  <img
                    src={editImagePreviewUrl}
                    alt=""
                    className="mt-2 h-24 w-24 rounded-lg border border-slate-200 object-cover"
                  />
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditOpen(false)
                  setEditingProductId(null)
                  if (editImagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(editImagePreviewUrl)
                  setEditImageFile(null)
                  setEditImagePreviewUrl(null)
                  if (editImageFileInputRef.current) editImageFileInputRef.current.value = ''
                }}
                className="min-h-11 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {t('inv.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void saveEditedProduct()}
                disabled={savingEditProduct || !editForm.name.trim() || !editForm.category}
                className="min-h-11 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {savingEditProduct ? t('inv.saving') : t('inv.save')}
              </button>
            </div>
          </div>
        </div>
      )}
      {discontinuedListOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discontinued-list-title"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h2
                id="discontinued-list-title"
                className="text-base font-semibold text-slate-900"
              >
                {t('inv.stoppedRestockingListTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setDiscontinuedListOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {t('inv.close')}
              </button>
            </div>
            {discontinuedListLoading ? (
              <p className="mt-4 text-sm text-slate-500">{t('common.loading')}</p>
            ) : discontinuedListItems.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">{t('inv.stoppedRestockingListEmpty')}</p>
            ) : (
              <div className="mt-4 max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-start font-semibold">
                        {t('inv.productName')}
                      </th>
                      <th className="px-3 py-2 text-start font-semibold">
                        {t('nav.categories')}
                      </th>
                      <th className="px-3 py-2 text-start font-semibold tabular-nums">
                        {t('inv.labelStock')}
                      </th>
                      {me?.is_superuser && getGlobalView() ? (
                        <th className="px-3 py-2 text-start font-semibold">
                          {t('admin.colShop')}
                        </th>
                      ) : null}
                      {canEditProduct ? (
                        <th className="px-3 py-2 text-start font-semibold w-0 whitespace-nowrap">
                          {t('crud.actions')}
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {discontinuedListItems.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-900">{p.name}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {categories.find((c) => c.id === p.category)?.name ?? '—'}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-slate-800">
                          {p.current_stock_quantity}
                        </td>
                        {me?.is_superuser && getGlobalView() ? (
                          <td className="px-3 py-2 text-slate-700">
                            {p.shop_name ?? '—'}
                          </td>
                        ) : null}
                        {canEditProduct ? (
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setDiscontinuedListOpen(false)
                                  void openEditModal(p)
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                {t('crud.edit')}
                              </button>
                              <button
                                type="button"
                                disabled={togglingDiscontinuedId === p.id}
                                onClick={() => void setProductDiscontinued(p, false)}
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                              >
                                {togglingDiscontinuedId === p.id
                                  ? t('inv.saving')
                                  : t('inv.restoreProduct')}
                              </button>
                            </div>
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
      {historyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-add-history-title"
        >
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h2 id="inventory-add-history-title" className="text-base font-semibold text-slate-900">
                {t('inv.addHistoryTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {t('inv.close')}
              </button>
            </div>
            {historyLoading ? (
              <p className="mt-4 text-sm text-slate-500">{t('inv.addHistoryLoading')}</p>
            ) : historyItems.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">{t('inv.addHistoryEmpty')}</p>
            ) : (
              <div className="mt-4 max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-start font-semibold">{t('inv.historyType')}</th>
                      <th className="px-3 py-2 text-start font-semibold">{t('inv.productName')}</th>
                      <th className="px-3 py-2 text-start font-semibold">{t('inv.createdAt')}</th>
                      {canEditStockHistory ? (
                        <th className="px-3 py-2 text-start font-semibold w-0 whitespace-nowrap">
                          {t('crud.actions')}
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {historyItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700">
                          {item.event_type === 'stock_increase'
                            ? `${t('inv.historyStockIncrease')}${item.quantity ? ` (+${item.quantity})` : ''}`
                            : item.event_type === 'sale_return'
                              ? `${t('inv.historySaleReturn')}${item.quantity ? ` (+${item.quantity})` : ''}`
                            : t('inv.historyProductCreated')}
                        </td>
                        <td className="px-3 py-2 text-slate-800">{item.product_name}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {new Date(item.occurred_at).toLocaleString()}
                        </td>
                        {canEditStockHistory ? (
                          <td className="px-3 py-2 text-slate-700">
                            {item.event_type === 'stock_increase' && item.purchaseId != null ? (
                              <button
                                type="button"
                                onClick={() => void openHistoryStockEdit(item.purchaseId!)}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                {t('inv.historyEditStockIncrease')}
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
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
      {historyStockEditOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-stock-history-edit-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h2
                id="inventory-stock-history-edit-title"
                className="text-base font-semibold text-slate-900"
              >
                {t('inv.historyEditTitle')}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setHistoryStockEditOpen(false)
                  setHistoryStockEditPurchaseId(null)
                }}
                className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {t('inv.cancel')}
              </button>
            </div>
            <p className="mt-2 text-start text-xs text-slate-500">{t('inv.historyEditHint')}</p>
            {historyStockEditLoading ? (
              <p className="mt-4 text-sm text-slate-500">{t('common.loading')}</p>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-start">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    {t('inv.historyEditOccurredAt')}
                  </span>
                  <input
                    type="datetime-local"
                    value={historyStockEditForm.occurredAt}
                    onChange={(e) =>
                      setHistoryStockEditForm((f) => ({ ...f, occurredAt: e.target.value }))
                    }
                    className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-start">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    {t('inv.historyEditQuantity')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={historyStockEditForm.quantity}
                    onChange={(e) =>
                      setHistoryStockEditForm((f) => ({ ...f, quantity: e.target.value }))
                    }
                    className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
                  />
                </label>
                <label className="block text-start">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    {t('inv.buyPrice')}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={historyStockEditForm.unitCostUsd}
                    onChange={(e) =>
                      setHistoryStockEditForm((f) => ({ ...f, unitCostUsd: e.target.value }))
                    }
                    className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
                  />
                </label>
                <label className="block text-start">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    {t('inv.historyEditNote')}
                  </span>
                  <textarea
                    value={historyStockEditForm.note}
                    onChange={(e) =>
                      setHistoryStockEditForm((f) => ({ ...f, note: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
              </div>
            )}
            {!historyStockEditLoading ? (
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void saveHistoryStockEdit()}
                  disabled={historyStockEditSaving}
                  className="min-h-11 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {historyStockEditSaving ? t('inv.saving') : t('inv.save')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

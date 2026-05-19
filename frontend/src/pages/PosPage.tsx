import {
  ArrowLeft,
  Globe2,
  History,
  ImageOff,
  Lock,
  Printer,
  Trash2,
  Unlock,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageAuthLoading } from '../components/PageAuthLoading'
import { useLocale } from '../context/LocaleContext'
import { useSubmitLock } from '../hooks/useSubmitLock'
import { useSyncedSession } from '../hooks/useSyncedSession'
import { apiJson, getGlobalView, resolveMediaUrl } from '../lib/api'
import {
  buildBlankReceiptHtml,
  buildReceiptHtml,
  printReceiptHtml,
} from '../lib/receiptHtml'
import { withReceiptPrefs } from '../lib/receiptPrefs'
import { hasPerm } from '../lib/permissions'
import { formatSaleReceiptNumber } from '../lib/shopReceiptNumbers'
import type {
  CurrencyRow,
  CustomerRow,
  Paginated,
  ProductRow,
  ReceiptSettingsRow,
  SaleListRow,
  SaleReturnResponse,
  ShopSettingsRow,
} from '../types/api'

type CartLine = {
  product: Pick<
    ProductRow,
    'id' | 'name' | 'image_url' | 'current_stock_quantity'
  > & { manual_entry?: boolean }
  quantity: number
  unitPriceUsd: string
}

type PosDraft = {
  id: string
  createdAt: string
  customerQuery: string
  selectedCustomerId: number | null
  cart: CartLine[]
  discountIqd: string
  discountUsd: string
  amountPaidIqd: string
  amountPaidUsd: string
  paymentUsdLinked: boolean
  paymentIqdLinked: boolean
  saleNote: string
}

const MANUAL_SEARCH_OPTION_ID = -2147483648

function parseDec(s: string) {
  const n = parseFloat(s)
  return Number.isNaN(n) ? 0 : n
}

function formatMoneyCompact(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0'
  const n = Number(String(value).replace(/,/g, '').trim())
  if (!Number.isFinite(n)) return String(value ?? '')
  return n.toFixed(2).replace(/\.?0+$/, '')
}

/** Decimal string without unnecessary trailing zeros (e.g. 1.5 not 1.5000). */
function formatDecimalTrim(value: number, maxDecimals = 8): string {
  if (!Number.isFinite(value)) return ''
  return value.toFixed(maxDecimals).replace(/\.?0+$/, '')
}

/** Strip spaces / grouping commas so IQD inputs like 2,000 parse correctly */
function normalizeMoneyInput(s: string) {
  return s.replace(/[\s,،\u066C]/g, '').trim()
}

export function PosPage() {
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

  const [rate, setRate] = useState<number | null>(null)
  const [rateEditorOpen, setRateEditorOpen] = useState(false)
  const [ratePer100Input, setRatePer100Input] = useState('')
  const [savingRate, setSavingRate] = useState(false)
  const [productQuery, setProductQuery] = useState('')
  const [debouncedProductQ, setDebouncedProductQ] = useState('')
  const [searchHits, setSearchHits] = useState<ProductRow[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [cart, setCart] = useState<CartLine[]>([])

  const [customerQuery, setCustomerQuery] = useState('')
  const [debouncedCustQ, setDebouncedCustQ] = useState('')
  const [customerHits, setCustomerHits] = useState<CustomerRow[]>([])
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null,
  )
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null)
  /** قەرزی کۆکراوە لە فرۆشتنەکانی پێشوو (کاتێک کڕیار هەڵدەبژێردرێت لە سێرڤەر) */
  const [customerPriorDebtUsd, setCustomerPriorDebtUsd] = useState(0)
  const [customerPriorDebtLoading, setCustomerPriorDebtLoading] =
    useState(false)
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustWorkplace, setNewCustWorkplace] = useState('')
  const [newCustAddress, setNewCustAddress] = useState('')
  const [newCustPhone1, setNewCustPhone1] = useState('')
  const [newCustPhone2, setNewCustPhone2] = useState('')
  const [newCustNote, setNewCustNote] = useState('')

  /** داشکاندن دەتوانرێت بە USD یان IQD بنووسرێت؛ بۆ API وەک USD نێردرێت */
  const [discountIqd, setDiscountIqd] = useState('')
  const [discountUsd, setDiscountUsd] = useState('')
  const [amountPaidIqd, setAmountPaidIqd] = useState('')
  const [amountPaidUsd, setAmountPaidUsd] = useState('')
  /** هەر یەک قوفڵی خۆی: دۆلار ↔ دینار بە نرخ (پێشگریمان: هەردوو چالاک) */
  const [paymentUsdLinked, setPaymentUsdLinked] = useState(true)
  const [paymentIqdLinked, setPaymentIqdLinked] = useState(true)
  const [saleNote, setSaleNote] = useState('')
  const [drafts, setDrafts] = useState<PosDraft[]>([])
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [returnReceiptNumber, setReturnReceiptNumber] = useState('')
  const [returnNote, setReturnNote] = useState('')
  const [returnSale, setReturnSale] = useState<SaleListRow | null>(null)
  const [returnQuantities, setReturnQuantities] = useState<Record<number, string>>({})
  const [loadingReturnSale, setLoadingReturnSale] = useState(false)
  const [submittingReturn, setSubmittingReturn] = useState(false)
  const { isSubmitting: creatingCustomer, runLocked: runCreateCustomer } = useSubmitLock()
  const [saleSuccessOpen, setSaleSuccessOpen] = useState(false)
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettingsRow | null>(null)
  const [shopSettings, setShopSettings] = useState<ShopSettingsRow | null>(null)
  const [lastReceipt, setLastReceipt] = useState<SaleListRow | null>(null)
  const [receiptSummary, setReceiptSummary] = useState<{
    subtotalUsd: number
    discountUsd: number
    finalUsd: number
    finalIqd: number | null
    paidUsdEq: number
    balanceUsd: number
  } | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const editParam = useMemo(() => (searchParams.get('edit') ?? '').trim(), [searchParams])
  const returnSaleParam = useMemo(() => (searchParams.get('return_sale') ?? '').trim(), [searchParams])
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null)
  const [editingOccurredAt, setEditingOccurredAt] = useState('')
  const [editingSaleLoading, setEditingSaleLoading] = useState(false)
  const [saleSuccessMode, setSaleSuccessMode] = useState<'new' | 'edit'>('new')
  const loadedEditKeyRef = useRef('')
  const productSearchRef = useRef<HTMLInputElement | null>(null)
  const productSearchHitRefsRef = useRef<Map<number, HTMLButtonElement>>(new Map())
  const customerSearchHitRefsRef = useRef<Map<number, HTMLButtonElement>>(new Map())
  const customerSearchWrapRef = useRef<HTMLDivElement | null>(null)
  const productSearchWrapRef = useRef<HTMLDivElement | null>(null)
  const customerInputRef = useRef<HTMLInputElement | null>(null)
  const paymentUsdInputRef = useRef<HTMLInputElement | null>(null)
  const paymentIqdInputRef = useRef<HTMLInputElement | null>(null)
  const discountInputRef = useRef<HTMLInputElement | null>(null)
  const discountUsdInputRef = useRef<HTMLInputElement | null>(null)
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const completeSaleDesktopRef = useRef<HTMLButtonElement | null>(null)
  const completeSaleMobileRef = useRef<HTMLButtonElement | null>(null)
  const cartQtyRefsRef = useRef<Map<number, HTMLInputElement>>(new Map())
  const cartPriceRefsRef = useRef<Map<number, HTMLInputElement>>(new Map())
  const newCustNameRef = useRef<HTMLInputElement | null>(null)
  const newCustWorkplaceRef = useRef<HTMLInputElement | null>(null)
  const newCustAddressRef = useRef<HTMLInputElement | null>(null)
  const newCustPhone1Ref = useRef<HTMLInputElement | null>(null)
  const newCustPhone2Ref = useRef<HTMLInputElement | null>(null)
  const newCustNoteRef = useRef<HTMLTextAreaElement | null>(null)
  const newCustSaveRef = useRef<HTMLButtonElement | null>(null)
  const manualLineSeedRef = useRef(-1)

  const setCartQtyRef = useCallback((productId: number) => (el: HTMLInputElement | null) => {
    const m = cartQtyRefsRef.current
    if (el) m.set(productId, el)
    else m.delete(productId)
  }, [])

  const setCartPriceRef = useCallback((productId: number) => (el: HTMLInputElement | null) => {
    const m = cartPriceRefsRef.current
    if (el) m.set(productId, el)
    else m.delete(productId)
  }, [])

  const setProductSearchHitRef = useCallback((productId: number) => (el: HTMLButtonElement | null) => {
    const m = productSearchHitRefsRef.current
    if (el) m.set(productId, el)
    else m.delete(productId)
  }, [])

  const setCustomerSearchHitRef = useCallback((customerId: number) => (el: HTMLButtonElement | null) => {
    const m = customerSearchHitRefsRef.current
    if (el) m.set(customerId, el)
    else m.delete(customerId)
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedProductQ(productQuery.trim()), 250)
    return () => window.clearTimeout(t)
  }, [productQuery])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedCustQ(customerQuery.trim()), 250)
    return () => window.clearTimeout(t)
  }, [customerQuery])

  useEffect(() => {
    if (selectedCustomerId === null) {
      setCustomerPriorDebtUsd(0)
      setCustomerPriorDebtLoading(false)
      setSelectedCustomer(null)
      return
    }
    const fromHits = customerHits.find((c) => c.id === selectedCustomerId) ?? null
    if (fromHits) setSelectedCustomer(fromHits)
    let cancelled = false
    setCustomerPriorDebtLoading(true)
    void (async () => {
      try {
        const r = await apiJson<{ outstanding_balance_usd: string }>(
          `/api/customers/${selectedCustomerId}/balance/`,
        )
        if (cancelled) return
        setCustomerPriorDebtUsd(parseDec(r.outstanding_balance_usd))
      } catch {
        if (!cancelled) setCustomerPriorDebtUsd(0)
      } finally {
        if (!cancelled) setCustomerPriorDebtLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedCustomerId, customerHits])

  useEffect(() => {
    if (selectedCustomerId === null) return
    let cancelled = false
    void (async () => {
      try {
        const row = await apiJson<CustomerRow>(`/api/customers/${selectedCustomerId}/`)
        if (!cancelled) setSelectedCustomer(row)
      } catch {
        /* keep last known customer payload */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedCustomerId])

  const loadRate = useCallback(async () => {
    const rows = await apiJson<CurrencyRow[]>('/api/currencies/')
    const sorted = [...rows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
    const latest = sorted[0]
    if (latest) setRate(parseFloat(latest.usd_to_iqd))
    else setRate(null)
  }, [])

  function openRateEditor() {
    setRatePer100Input(
      rate !== null && Number.isFinite(rate) && rate > 0
        ? String(Math.round(rate * 100))
        : '',
    )
    setRateEditorOpen(true)
  }

  async function saveRateFromPos() {
    const normalized = ratePer100Input.replace(/[,\u066C،\s]/g, '').trim()
    const parsed = Number.parseFloat(normalized)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t('inv.saveRateFailed'))
      return
    }
    setSavingRate(true)
    setError(null)
    try {
      await apiJson<CurrencyRow>('/api/currencies/set-today/', {
        method: 'POST',
        body: JSON.stringify({ usd_to_iqd: String(parsed / 100) }),
      })
      await loadRate()
      setRateEditorOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('inv.saveRateFailed'))
    } finally {
      setSavingRate(false)
    }
  }

  useEffect(() => {
    if (!me || !canAccessShopData) return
    if (editParam && /^\d+$/.test(editParam)) return
    void loadRate().catch(() => setRate(null))
  }, [me, canAccessShopData, loadRate, editParam])

  useEffect(() => {
    if (!me || authPending || !canAccessShopData) return
    if (!editParam || !/^\d+$/.test(editParam)) {
      loadedEditKeyRef.current = ''
      setEditingSaleId(null)
      setEditingOccurredAt('')
      setEditingSaleLoading(false)
      return
    }
    if (!hasPerm(me, 'change_sale', 'add_sale')) {
      setError(t('sales.editNeedsPermission'))
      setSearchParams(
        (p) => {
          const n = new URLSearchParams(p)
          n.delete('edit')
          return n
        },
        { replace: true },
      )
      return
    }
    const saleId = Number(editParam)
    if (loadedEditKeyRef.current === editParam) {
      setEditingSaleLoading(false)
      return
    }

    let cancelled = false
    setEditingSaleLoading(true)
    setError(null)
    void (async () => {
      try {
        const sale = await apiJson<SaleListRow>(`/api/sales/${saleId}/`)
        if (cancelled) return
        if (sale.has_returns) {
          setError(t('sales.editBlockedReturns'))
          setSearchParams(
            (p) => {
              const n = new URLSearchParams(p)
              n.delete('edit')
              return n
            },
            { replace: true },
          )
          setEditingSaleLoading(false)
          return
        }
        const byProductId = new Map<number, ProductRow>()
        const ids = [
          ...new Set(sale.lines.map((l) => l.product).filter((x): x is number => x != null)),
        ]
        await Promise.all(
          ids.map(async (pid) => {
            const p = await apiJson<ProductRow>(`/api/products/${pid}/`)
            if (!cancelled) byProductId.set(pid, p)
          }),
        )
        if (cancelled) return

        const cartLines: CartLine[] = []
        for (const ln of sale.lines) {
          if (ln.product != null) {
            const p = byProductId.get(ln.product)
            if (!p) continue
            cartLines.push({
              product: {
                id: p.id,
                name: p.name,
                image_url: p.image_url,
                current_stock_quantity: p.current_stock_quantity,
              },
              quantity: ln.quantity,
              unitPriceUsd: formatMoneyCompact(ln.unit_price_usd),
            })
          } else {
            const mid = manualLineSeedRef.current
            manualLineSeedRef.current -= 1
            const name = (ln.manual_name || ln.product_name || '').trim() || '—'
            cartLines.push({
              product: {
                id: mid,
                name,
                image_url: null,
                current_stock_quantity: 0,
                manual_entry: true,
              },
              quantity: ln.quantity,
              unitPriceUsd: formatMoneyCompact(ln.unit_price_usd),
            })
          }
        }
        setCart(cartLines)
        setRate(Number(sale.exchange_rate_usd_to_iqd))
        setDiscountUsd(formatMoneyCompact(sale.invoice_discount_usd))
        setDiscountIqd('')
        setAmountPaidIqd(String(Math.round(Number(sale.amount_paid_iqd))))
        setAmountPaidUsd(
          formatDecimalTrim(Number(sale.amount_paid_usd ?? 0)) || '0',
        )
        setSaleNote(sale.note ?? '')
        if (sale.customer != null) {
          setSelectedCustomerId(sale.customer)
          setCustomerQuery(sale.customer_name || '')
        } else {
          setSelectedCustomerId(null)
          setSelectedCustomer(null)
          setCustomerQuery('')
        }
        setEditingOccurredAt(sale.occurred_at)
        setEditingSaleId(sale.id)
        loadedEditKeyRef.current = editParam
        setActiveDraftId(null)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('common.error'))
          setSearchParams(
            (p) => {
              const n = new URLSearchParams(p)
              n.delete('edit')
              return n
            },
            { replace: true },
          )
        }
      } finally {
        if (!cancelled) setEditingSaleLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editParam, me, authPending, canAccessShopData, setSearchParams, t])

  useEffect(() => {
    if (!me || !canAccessShopData) return
    void apiJson<ReceiptSettingsRow>('/api/receipt-settings/')
      .then((v) => setReceiptSettings(withReceiptPrefs(v)))
      .catch(() => setReceiptSettings(null))
  }, [me, canAccessShopData])

  useEffect(() => {
    if (!me || !canAccessShopData) return
    void apiJson<ShopSettingsRow>('/api/shop-settings/')
      .then((v) => setShopSettings(v))
      .catch(() => setShopSettings(null))
  }, [me, canAccessShopData])

  useEffect(() => {
    if (!me || !canAccessShopData) return
    let cancelled = false
    void (async () => {
      try {
        const q =
          debouncedProductQ.length > 0
            ? `search=${encodeURIComponent(debouncedProductQ)}&page_size=8&exclude_discontinued=1`
            : 'page_size=8&exclude_discontinued=1'
        const endpoint = `/api/products/?${q}`
        const data = await apiJson<Paginated<ProductRow> | ProductRow[]>(
          endpoint,
        )
        const list = Array.isArray(data) ? data : data.results
        if (!cancelled) {
          setSearchHits(list)
          if (debouncedProductQ.length > 0) setSearchOpen(true)
        }
      } catch {
        if (!cancelled) setSearchHits([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [me, canAccessShopData, debouncedProductQ])

  useEffect(() => {
    if (!me || !canAccessShopData) return
    let cancelled = false
    void (async () => {
      try {
        const endpoint =
          debouncedCustQ.length > 0
            ? `/api/customers/?search=${encodeURIComponent(debouncedCustQ)}`
            : '/api/customers/?page_size=10'
        const data = await apiJson<Paginated<CustomerRow> | CustomerRow[]>(
          endpoint,
        )
        const list = Array.isArray(data) ? data : data.results
        if (!cancelled) setCustomerHits(list)
      } catch {
        if (!cancelled) setCustomerHits([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [me, canAccessShopData, debouncedCustQ])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const active = document.activeElement
      const inProductSearch =
        active === productSearchRef.current ||
        Array.from(productSearchHitRefsRef.current.values()).some((el) => el === active)
      const inCustomerSearch =
        active === customerInputRef.current ||
        Array.from(customerSearchHitRefsRef.current.values()).some((el) => el === active)
      if (inProductSearch || inCustomerSearch) {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  useEffect(() => {
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (
        customerSearchWrapRef.current &&
        !customerSearchWrapRef.current.contains(target)
      ) {
        setCustomerSearchOpen(false)
      }
      if (
        productSearchWrapRef.current &&
        !productSearchWrapRef.current.contains(target)
      ) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loginFailed'))
    }
  }

  function addProduct(p: ProductRow) {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id)
      if (i >= 0) {
        const next = [...prev]
        next[i] = {
          ...next[i],
          quantity: next[i].quantity + 1,
        }
        return next
      }
      return [
        ...prev,
        {
          product: p,
          // Start like a normal in-stock line to avoid zero-qty calculation issues.
          quantity: 1,
          unitPriceUsd: '',
        },
      ]
    })
    setSearchOpen(false)
    setProductQuery('')
    window.setTimeout(() => {
      const qtyInput = cartQtyRefsRef.current.get(p.id)
      if (qtyInput) {
        qtyInput.focus()
        qtyInput.select()
        return
      }
      productSearchRef.current?.focus()
    }, 0)
  }

  function addManualLine(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    const manualId = manualLineSeedRef.current
    manualLineSeedRef.current -= 1
    setCart((prev) => [
      ...prev,
      {
        product: {
          id: manualId,
          name: trimmed,
          image_url: null,
          current_stock_quantity: 0,
          manual_entry: true,
        },
        // Manual items should also start as a valid line.
        quantity: 1,
        unitPriceUsd: '',
      },
    ])
    setSearchOpen(false)
    setProductQuery('')
    window.setTimeout(() => {
      const qtyInput = cartQtyRefsRef.current.get(manualId)
      if (qtyInput) {
        qtyInput.focus()
        qtyInput.select()
        return
      }
      productSearchRef.current?.focus()
    }, 0)
  }

  function selectCustomerFromSearch(c: CustomerRow) {
    setSelectedCustomerId(c.id)
    setSelectedCustomer(c)
    setCustomerQuery(c.name)
    setCustomerSearchOpen(false)
  }

  function focusAfterCustomerPick() {
    window.setTimeout(() => {
      productSearchRef.current?.focus()
    }, 0)
  }

  const focusCustomerSearchOption = useCallback(
    (direction: 'next' | 'prev') => {
      const optionIds = customerHits.map((c) => c.id)
      if (optionIds.length === 0) return
      const activeEl = document.activeElement
      const currentIndex = optionIds.findIndex(
        (id) => customerSearchHitRefsRef.current.get(id) === activeEl,
      )
      let nextIndex = 0
      if (currentIndex === -1) {
        nextIndex = direction === 'next' ? 0 : optionIds.length - 1
      } else if (direction === 'next') {
        nextIndex = (currentIndex + 1) % optionIds.length
      } else {
        nextIndex = (currentIndex - 1 + optionIds.length) % optionIds.length
      }
      customerSearchHitRefsRef.current.get(optionIds[nextIndex])?.focus()
    },
    [customerHits],
  )

  const getFocusedCustomerSearchOption = useCallback((): CustomerRow | null => {
    const active = document.activeElement
    if (!active) return null
    for (const c of customerHits) {
      if (customerSearchHitRefsRef.current.get(c.id) === active) return c
    }
    return null
  }, [customerHits])

  const focusProductSearchOption = useCallback(
    (direction: 'next' | 'prev') => {
      const query = productQuery.trim()
      if (!query) return
      const optionIds = [MANUAL_SEARCH_OPTION_ID, ...searchHits.map((p) => p.id)]
      if (optionIds.length === 0) return
      const activeEl = document.activeElement
      const currentIndex = optionIds.findIndex(
        (id) => productSearchHitRefsRef.current.get(id) === activeEl,
      )
      let nextIndex = 0
      if (currentIndex === -1) {
        nextIndex = direction === 'next' ? 0 : optionIds.length - 1
      } else if (direction === 'next') {
        nextIndex = (currentIndex + 1) % optionIds.length
      } else {
        nextIndex = (currentIndex - 1 + optionIds.length) % optionIds.length
      }
      productSearchHitRefsRef.current.get(optionIds[nextIndex])?.focus()
    },
    [productQuery, searchHits],
  )

  function updateLineQty(pid: number, qty: number) {
    if (qty < 1) {
      setCart((c) => c.filter((l) => l.product.id !== pid))
      return
    }
    setCart((c) =>
      c.map((l) =>
        l.product.id === pid ? { ...l, quantity: qty } : l,
      ),
    )
  }

  function updateLinePrice(pid: number, price: string) {
    setCart((c) =>
      c.map((l) =>
        l.product.id === pid ? { ...l, unitPriceUsd: price } : l,
      ),
    )
  }

  function focusNextEmptyInputFrom(
    fromEl: HTMLElement | null,
    fallback?: () => void,
  ) {
    if (!fromEl || typeof document === 'undefined') {
      fallback?.()
      return
    }
    const candidates = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled])',
      ),
    ).filter((el) => {
      if (el.tabIndex < 0) return false
      if (el.offsetParent === null) return false
      const style = window.getComputedStyle(el)
      return style.visibility !== 'hidden'
    })
    const start = candidates.indexOf(fromEl as HTMLInputElement | HTMLTextAreaElement)
    if (start < 0) {
      fallback?.()
      return
    }
    for (let i = start + 1; i < candidates.length; i += 1) {
      if (!candidates[i].value.trim()) {
        candidates[i].focus()
        return
      }
    }
    fallback?.()
  }

  const draftStorageKey = useMemo(() => {
    const userId = me?.id ?? 'guest'
    return `pos_drafts_v1_${userId}`
  }, [me?.id])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftStorageKey)
      if (!raw) {
        setDrafts([])
        return
      }
      const parsed = JSON.parse(raw) as PosDraft[]
      if (Array.isArray(parsed)) setDrafts(parsed)
      else setDrafts([])
    } catch {
      setDrafts([])
    }
  }, [draftStorageKey])

  const persistDrafts = useCallback(
    (next: PosDraft[]) => {
      setDrafts(next)
      try {
        localStorage.setItem(draftStorageKey, JSON.stringify(next))
      } catch {
        /* ignore quota/storage errors */
      }
    },
    [draftStorageKey],
  )

  const applyDraft = useCallback((draft: PosDraft) => {
    setCustomerQuery(draft.customerQuery)
    setSelectedCustomerId(draft.selectedCustomerId)
    setCart(draft.cart)
    setDiscountIqd(draft.discountIqd)
    setDiscountUsd(draft.discountUsd)
    setAmountPaidIqd(draft.amountPaidIqd)
    setAmountPaidUsd(draft.amountPaidUsd)
    setPaymentUsdLinked(draft.paymentUsdLinked)
    setPaymentIqdLinked(draft.paymentIqdLinked)
    setSaleNote(draft.saleNote)
    setActiveDraftId(draft.id)
    setDraftsOpen(false)
    window.setTimeout(() => customerInputRef.current?.focus(), 0)
  }, [])

  const removeDraftById = useCallback(
    (draftId: string) => {
      persistDrafts(drafts.filter((d) => d.id !== draftId))
      if (activeDraftId === draftId) setActiveDraftId(null)
    },
    [activeDraftId, drafts, persistDrafts],
  )

  const saveCurrentAsDraft = useCallback(() => {
    if (cart.length === 0) {
      setError(t('pos.cartEmptyError'))
      return
    }
    const nextDraft: PosDraft = {
      id: String(Date.now()),
      createdAt: new Date().toISOString(),
      customerQuery: customerQuery.trim(),
      selectedCustomerId,
      cart,
      discountIqd,
      discountUsd,
      amountPaidIqd,
      amountPaidUsd,
      paymentUsdLinked,
      paymentIqdLinked,
      saleNote,
    }
    persistDrafts([nextDraft, ...drafts])
    setError(null)
    resetForNextSale()
  }, [
    amountPaidIqd,
    amountPaidUsd,
    cart,
    customerQuery,
    discountIqd,
    discountUsd,
    drafts,
    paymentIqdLinked,
    paymentUsdLinked,
    persistDrafts,
    saleNote,
    selectedCustomerId,
    resetForNextSale,
    t,
  ])

  const subtotalUsd = useMemo(() => {
    return cart.reduce(
      (s, l) => s + l.quantity * parseDec(l.unitPriceUsd),
      0,
    )
  }, [cart])

  const discountIqdParsed = parseDec(normalizeMoneyInput(discountIqd))
  const discountUsdParsed = parseDec(normalizeMoneyInput(discountUsd))
  const discountFromIqdUsd =
    rate !== null && rate > 0 && !Number.isNaN(rate)
      ? discountIqdParsed / rate
      : 0
  const discountAmt = discountUsdParsed + discountFromIqdUsd
  const finalUsd = Math.max(0, subtotalUsd - discountAmt)
  const finalIqd =
    rate !== null && !Number.isNaN(rate) ? finalUsd * rate : null

  const paidIqd = parseDec(normalizeMoneyInput(amountPaidIqd))
  const paidUsd = parseDec(normalizeMoneyInput(amountPaidUsd))
  const paidIqdAsUsd =
    rate !== null && rate > 0 ? paidIqd / rate : 0
  /** هەمان بڕی پارە لە هەردوو خانەدا — تەنها یەک جار بژمێردرێتەوە */
  const paymentEquivalent =
    rate !== null &&
    rate > 0 &&
    paidIqd > 0 &&
    paidUsd > 0 &&
    Math.abs(paidUsd - paidIqdAsUsd) < 0.02
  const paymentSingleStream =
    paymentEquivalent &&
    (paymentUsdLinked || paymentIqdLinked)
  const paymentMirrored = paymentSingleStream
  // Keep preview math identical to checkout payload math.
  const checkoutPaidIqd = paymentMirrored
    ? paidIqd > 0
      ? paidIqd
      : 0
    : paidIqd > 0
      ? paidIqd
      : 0
  const checkoutPaidUsd = paymentMirrored
    ? 0
    : paidUsd > 0
      ? paidUsd
      : 0
  const paidUsdEq =
    checkoutPaidUsd + (rate !== null && rate > 0 ? checkoutPaidIqd / rate : 0)
  const balanceUsd = finalUsd - paidUsdEq
  /** Remaining for THIS invoice only (prior debt is shown separately). */
  const remainingThisSaleUsd = balanceUsd
  const remainingThisSaleIqd =
    rate !== null && !Number.isNaN(rate) ? remainingThisSaleUsd * rate : null

  const applyRemainderAsDiscountUsd = useCallback(() => {
    if (remainingThisSaleUsd <= 0.0001) return
    setDiscountUsd(formatDecimalTrim(discountUsdParsed + remainingThisSaleUsd))
  }, [discountUsdParsed, remainingThisSaleUsd])

  const onAmountPaidIqdChange = useCallback(
    (raw: string) => {
      setAmountPaidIqd(raw)
      if (!paymentIqdLinked || rate === null || rate <= 0) return
      const cleaned = normalizeMoneyInput(raw)
      if (!cleaned) {
        setAmountPaidUsd('')
        return
      }
      const iqd = parseFloat(cleaned)
      if (Number.isNaN(iqd) || iqd <= 0) {
        setAmountPaidUsd('')
        return
      }
      setAmountPaidUsd(formatDecimalTrim(iqd / rate))
    },
    [rate, paymentIqdLinked],
  )

  const onAmountPaidUsdChange = useCallback(
    (raw: string) => {
      setAmountPaidUsd(raw)
      if (!paymentUsdLinked || rate === null || rate <= 0) return
      const cleaned = normalizeMoneyInput(raw)
      if (!cleaned) {
        setAmountPaidIqd('')
        return
      }
      const usd = parseFloat(cleaned)
      if (Number.isNaN(usd) || usd <= 0) {
        setAmountPaidIqd('')
        return
      }
      setAmountPaidIqd(String(Math.round(usd * rate)))
    },
    [rate, paymentUsdLinked],
  )

  async function createCustomer() {
    await runCreateCustomer(async () => {
      setError(null)
      const custPayload: Record<string, unknown> = {
        name: newCustName.trim(),
        workplace: newCustWorkplace,
        address: newCustAddress,
        phone_1: newCustPhone1,
        phone_2: newCustPhone2,
        note: newCustNote,
      }
      if (me?.is_superuser && getGlobalView()) {
        const sid = localStorage.getItem('pos_shop_id')?.trim()
        if (sid) custPayload.shop = Number(sid)
      }
      const created = await apiJson<CustomerRow>('/api/customers/', {
        method: 'POST',
        body: JSON.stringify(custPayload),
      })
      setSelectedCustomerId(created.id)
      setSelectedCustomer(created)
      setCustomerQuery(created.name)
      setCustomerModalOpen(false)
    })
  }

  function openNewCustomerModal(initialName: string) {
    setNewCustName(initialName.trim())
    setNewCustWorkplace('')
    setNewCustAddress('')
    setNewCustPhone1('')
    setNewCustPhone2('')
    setNewCustNote('')
    setCustomerModalOpen(true)
  }

  async function checkout() {
    if (!rate || rate <= 0) {
      setError(t('pos.setRateBeforeCheckout'))
      return
    }
    if (cart.length === 0) {
      setError(t('pos.cartEmptyError'))
      return
    }
    const invalidLine = cart.some(
      (l) => l.quantity <= 0 || parseDec(l.unitPriceUsd) <= 0,
    )
    if (invalidLine) {
      setError(t('pos.enterQtyAndPrice'))
      return
    }
    if (showAddCustomer && selectedCustomerId === null) {
      setError(t('pos.registerUnknownCustomer'))
      openNewCustomerModal(customerQuery)
      return
    }
    if (me?.is_superuser && getGlobalView()) {
      const sid = localStorage.getItem('pos_shop_id')?.trim()
      if (!sid) {
        setError(t('pos.globalCheckoutNeedsShop'))
        return
      }
    }
    setSubmitting(true)
    setError(null)
    try {
      const isEdit = editingSaleId !== null
      const body: Record<string, unknown> = {
        customer: selectedCustomerId,
        occurred_at: isEdit ? editingOccurredAt || new Date().toISOString() : new Date().toISOString(),
        exchange_rate_usd_to_iqd: String(rate),
        invoice_discount_usd: discountAmt > 0 ? discountAmt.toFixed(4) : '0',
        /** Mirrored fields = same cash; backend sums USD + IQD/rate — send one stream only */
        amount_paid_iqd: String(checkoutPaidIqd),
        amount_paid_usd: String(checkoutPaidUsd),
        note: saleNote,
        lines: cart.map((l) => ({
          ...(l.product.manual_entry
            ? { manual_name: l.product.name }
            : { product: l.product.id }),
          quantity: l.quantity,
          unit_price_usd: l.unitPriceUsd,
        })),
      }
      if (me?.is_superuser && getGlobalView()) {
        const sid = localStorage.getItem('pos_shop_id')?.trim()
        if (sid) body.shop = Number(sid)
      }
      const sale = await apiJson<SaleListRow>(
        isEdit ? `/api/sales/${editingSaleId}/` : '/api/sales/',
        {
          method: isEdit ? 'PUT' : 'POST',
          body: JSON.stringify(body),
        },
      )
      setReceiptSummary({
        subtotalUsd,
        discountUsd: discountAmt,
        finalUsd,
        finalIqd,
        paidUsdEq,
        balanceUsd,
      })
      setLastReceipt(sale)
      setSaleSuccessMode(isEdit ? 'edit' : 'new')
      if (isEdit) {
        setSearchParams(
          (p) => {
            if (!p.has('edit')) return p
            const n = new URLSearchParams(p)
            n.delete('edit')
            return n
          },
          { replace: true },
        )
        setEditingSaleId(null)
        setEditingOccurredAt('')
        loadedEditKeyRef.current = ''
      }
      setSaleSuccessOpen(true)
      if (activeDraftId) {
        removeDraftById(activeDraftId)
      }
      if (receiptSettings?.direct_print) {
        window.setTimeout(() => {
          void printReceipt()
        }, 180)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pos.checkoutFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  async function loadSaleForReturn() {
    const receipt = returnReceiptNumber.trim()
    if (!receipt) {
      setError(t('pos.returnReceiptRequired'))
      return
    }
    setLoadingReturnSale(true)
    setError(null)
    try {
      const data = await apiJson<Paginated<SaleListRow> | SaleListRow[]>(
        `/api/sales/?receipt_number=${encodeURIComponent(receipt)}`,
      )
      const rows = Array.isArray(data) ? data : data.results
      const first = rows[0] ?? null
      setReturnSale(first)
      if (!first) {
        setReturnQuantities({})
        setError(t('pos.returnSaleNotFound'))
        return
      }
      const initial: Record<number, string> = {}
      for (const ln of first.lines) initial[ln.id] = ''
      setReturnQuantities(initial)
    } catch (e) {
      setReturnSale(null)
      setReturnQuantities({})
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setLoadingReturnSale(false)
    }
  }

  const loadSaleForReturnById = useCallback(async (saleId: number) => {
    setLoadingReturnSale(true)
    setError(null)
    try {
      const first = await apiJson<SaleListRow>(`/api/sales/${saleId}/`)
      setReturnSale(first)
      setReturnReceiptNumber(formatSaleReceiptNumber(first.receipt_number))
      const initial: Record<number, string> = {}
      for (const ln of first.lines) initial[ln.id] = ''
      setReturnQuantities(initial)
    } catch (e) {
      setReturnSale(null)
      setReturnQuantities({})
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setLoadingReturnSale(false)
    }
  }, [t])

  async function submitReturn() {
    if (!returnSale) {
      setError(t('pos.returnSaleNotFound'))
      return
    }
    const lines = returnSale.lines
      .map((ln) => ({
        sale_line_id: ln.id,
        quantity: Math.max(0, Math.floor(parseDec(returnQuantities[ln.id] ?? '0'))),
        sold: ln.quantity,
      }))
      .filter((x) => x.quantity > 0)

    if (lines.length === 0) {
      setError(t('pos.returnNoLines'))
      return
    }
    const invalid = lines.find((x) => x.quantity > x.sold)
    if (invalid) {
      setError(t('pos.returnQtyTooHigh'))
      return
    }

    // UX request: close the return modal immediately on confirm click.
    setReturnModalOpen(false)
    const saleId = returnSale.id
    const noteValue = returnNote.trim()
    const payloadLines = lines.map(({ sale_line_id, quantity }) => ({ sale_line_id, quantity }))
    setReturnSale(null)
    setReturnQuantities({})
    setReturnReceiptNumber('')
    setReturnNote('')

    setSubmittingReturn(true)
    setError(null)
    try {
      const res = await apiJson<SaleReturnResponse>('/api/sales/return-products/', {
        method: 'POST',
        body: JSON.stringify({
          sale_id: saleId,
          note: noteValue,
          lines: payloadLines,
        }),
      })
      setError(t('pos.returnSuccess').replace('{usd}', formatMoneyCompact(res.total_refund_usd)))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSubmittingReturn(false)
    }
  }

  function normalizeShortcut(shortcut: string): string {
    return shortcut.trim().toLowerCase().replace(/\s+/g, '')
  }

  function matchShortcut(event: KeyboardEvent, shortcut: string): boolean {
    const expected = normalizeShortcut(shortcut)
    if (!expected) return false
    const parts: string[] = []
    if (event.ctrlKey) parts.push('ctrl')
    if (event.altKey) parts.push('alt')
    if (event.shiftKey) parts.push('shift')
    if (event.metaKey) parts.push('meta')
    parts.push(event.key.toLowerCase())
    return parts.join('+') === expected || event.key.toLowerCase() === expected
  }

  useEffect(() => {
    const shortcut = shopSettings?.complete_sale_shortcut?.trim()
    if (!shortcut) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const typingTarget =
        tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(target?.isContentEditable)
      if (typingTarget) return
      if (submitting || editingSaleLoading || cart.length === 0) return
      if (matchShortcut(event, shortcut)) {
        event.preventDefault()
        void checkout()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shopSettings?.complete_sale_shortcut, submitting, editingSaleLoading, cart.length, checkout])

  useEffect(() => {
    if (!me || !canAccessShopData) return
    const id = window.setTimeout(() => {
      customerInputRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [me, canAccessShopData])

  useEffect(() => {
    if (!returnSaleParam) return
    if (!/^\d+$/.test(returnSaleParam)) return
    const saleId = Number(returnSaleParam)
    if (!Number.isFinite(saleId) || saleId <= 0) return
    setReturnModalOpen(true)
    setReturnNote('')
    void loadSaleForReturnById(saleId)
    setSearchParams(
      (p) => {
        if (!p.has('return_sale')) return p
        const next = new URLSearchParams(p)
        next.delete('return_sale')
        return next
      },
      { replace: true },
    )
  }, [loadSaleForReturnById, returnSaleParam, setSearchParams])

  function resetForNextSale() {
    setSearchParams(
      (p) => {
        if (!p.has('edit')) return p
        const n = new URLSearchParams(p)
        n.delete('edit')
        return n
      },
      { replace: true },
    )
    setEditingSaleId(null)
    setEditingOccurredAt('')
    loadedEditKeyRef.current = ''
    setCart([])
    setSelectedCustomerId(null)
    setSelectedCustomer(null)
    setCustomerQuery('')
    setCustomerHits([])
    setProductQuery('')
    setSearchHits([])
    setSearchOpen(false)
    setDiscountIqd('')
    setDiscountUsd('')
    setAmountPaidIqd('')
    setAmountPaidUsd('')
    setPaymentUsdLinked(true)
    setPaymentIqdLinked(true)
    setSaleNote('')
    setActiveDraftId(null)
    setSaleSuccessOpen(false)
    window.setTimeout(() => customerInputRef.current?.focus(), 0)
  }

  async function renderReceiptHtml() {
    const sale = lastReceipt
    const sum = receiptSummary
    if (!sale || !sum) return ''
    return buildReceiptHtml({
      sale,
      sum,
      receiptSettings,
      customerNameDisplay: customerQuery || '—',
    })
  }

  async function printReceipt() {
    const html = await renderReceiptHtml()
    if (html) printReceiptHtml(html)
    resetForNextSale()
  }

  async function printBlankReceipt() {
    const html = await buildBlankReceiptHtml({
      receiptSettings,
      lineCount: 15,
      exchangeRateUsdToIqd: rate,
    })
    printReceiptHtml(html)
  }

  const showAddCustomer =
    customerQuery.trim().length > 0 &&
    !customerHits.some(
      (c) => c.name.toLowerCase() === customerQuery.trim().toLowerCase(),
    )

  if (authPending) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900">
        <PageAuthLoading />
      </div>
    )
  }

  if (showLogin) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 dark:text-slate-100">
        <header className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="mx-auto flex max-w-lg items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 underline-offset-4 hover:underline"
            >
              <ArrowLeft className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden />
              {t('nav.home')}
            </Link>
            <div className="flex items-center gap-1">
              <Globe2 className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              <select
                value={lang}
                onChange={(e) =>
                  setLang(e.target.value as 'en' | 'ar' | 'ku')
                }
                className="rounded-lg border border-slate-200 px-2 py-1 text-start text-xs"
                aria-label={t('common.language')}
              >
                <option value="en">{t('lang.en')}</option>
                <option value="ar">{t('lang.ar')}</option>
                <option value="ku">{t('lang.ku')}</option>
              </select>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-lg px-4 py-10">
          <h1 className="text-start text-xl font-semibold text-slate-900">
            {t('pos.signInTitle')}
          </h1>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <input
              type="email"
              autoComplete="username"
              placeholder={t('pos.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-start"
              required
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder={t('pos.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-start"
              required
            />
            {error && (
              <p className="text-start text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white"
            >
              {t('pos.continue')}
            </button>
          </form>
        </main>
      </div>
    )
  }

  return (
    <>
      <div className="no-print min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {needsShop && (
        <p className="mx-auto max-w-6xl px-4 pt-3 text-start text-sm text-amber-800">
          {t('pos.needsShopHint')}
        </p>
      )}
      {editingSaleLoading && editParam && (
        <p className="mx-auto max-w-6xl px-4 pt-3 text-start text-sm text-slate-600 dark:text-slate-400">
          {t('common.loading')}
        </p>
      )}
      {editingSaleId !== null && !editingSaleLoading && (
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-start text-sm text-amber-950 shadow-sm dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="min-w-0 flex-1">
              {t('pos.editingSaleBanner').replace('{id}', String(editingSaleId))}
            </p>
            <button
              type="button"
              onClick={() => resetForNextSale()}
              className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-slate-800"
            >
              {t('pos.cancelEditSale')}
            </button>
          </div>
        </div>
      )}

      {me && hasPerm(me, 'view_sale') && (
        <div className="no-print border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            {rate !== null && rate > 0 && !Number.isNaN(rate) ? (
              <div className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 px-3 py-2 text-start shadow-sm dark:border-violet-600/40 dark:from-violet-950/40 dark:to-indigo-950/40">
                <span className="text-sm font-semibold tabular-nums text-violet-900 dark:text-violet-200">
                  {lang === 'ku'
                    ? `نرخ: 100 $ = ${Math.round(rate * 100).toLocaleString()} IQD`
                    : t('pos.paymentRateLine').replace(
                        '{iqd100}',
                        Math.round(rate * 100).toLocaleString(),
                      )}
                </span>
                <button
                  type="button"
                  onClick={openRateEditor}
                  className="rounded-md border border-violet-300 bg-white/80 px-2 py-1 text-[11px] font-medium text-violet-700 hover:bg-white dark:border-violet-500/40 dark:bg-violet-950/40 dark:text-violet-200"
                >
                  {t('pos.apply')}
                </button>
              </div>
            ) : (
              <div className="inline-flex min-h-11 max-w-full flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-start shadow-sm dark:border-amber-600/40 dark:bg-amber-950/30">
                <span className="min-w-0 text-sm font-medium text-amber-950 dark:text-amber-100">
                  {t('pos.rateMissingBanner')}
                </span>
                <button
                  type="button"
                  onClick={openRateEditor}
                  className="shrink-0 rounded-md border border-amber-400 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-500/50 dark:bg-amber-950/50 dark:text-amber-50 dark:hover:bg-amber-900/40"
                >
                  {t('pos.setRateButton')}
                </button>
              </div>
            )}
            <div className="ms-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraftsOpen(true)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                {t('pos.drafts')}
                {drafts.length > 0 ? (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    {drafts.length}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => navigate('/sales-returns')}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
              >
                {t('pos.productReturn')}
              </button>
              <button
                type="button"
                onClick={() => void printBlankReceipt()}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 shadow-sm transition hover:bg-violet-100 dark:border-violet-500/40 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50"
              >
                {t('pos.blankReceipt')}
              </button>
              <Link
                to="/sales"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <History className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                {t('pos.salesHistory')}
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 max-lg:pb-36 lg:grid-cols-2 lg:pb-6">
        <section className="flex flex-col gap-4">
          <div ref={customerSearchWrapRef} className="relative">
            <label className="mb-1 block text-start text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('pos.customer')}
            </label>
            <div className="flex items-stretch gap-2">
              <input
                ref={customerInputRef}
                value={customerQuery}
                onChange={(e) => {
                  setCustomerQuery(e.target.value)
                  setSelectedCustomerId(null)
                  setSelectedCustomer(null)
                  setCustomerSearchOpen(true)
                }}
                onFocus={() => setCustomerSearchOpen(true)}
                onBlur={(e) => {
                  const next = e.relatedTarget as Node | null
                  if (
                    next &&
                    Array.from(customerSearchHitRefsRef.current.values()).some(
                      (el) => el === next || el.contains(next),
                    )
                  ) {
                    return
                  }
                  window.setTimeout(() => setCustomerSearchOpen(false), 100)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault()
                    if (customerHits.length === 0 || selectedCustomerId !== null) return
                    focusCustomerSearchOption(e.key === 'ArrowDown' ? 'next' : 'prev')
                    return
                  }
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  if (customerHits.length > 0 && selectedCustomerId === null) {
                    const focused = getFocusedCustomerSearchOption()
                    selectCustomerFromSearch(focused ?? customerHits[0])
                  }
                  setCustomerSearchOpen(false)
                  focusAfterCustomerPick()
                }}
                placeholder={t('pos.searchCustomerPlaceholder')}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white py-2.5 ps-3 pe-3 text-start text-sm shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              {showAddCustomer && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => openNewCustomerModal(customerQuery)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700 shadow-sm transition hover:bg-violet-100 dark:border-violet-500/40 dark:bg-violet-950/50 dark:text-violet-300 dark:hover:bg-violet-900/50"
                  title={t('pos.addCustomer').replace('{name}', customerQuery.trim())}
                  aria-label={t('pos.addCustomer').replace('{name}', customerQuery.trim())}
                >
                  <UserPlus className="h-5 w-5" aria-hidden />
                </button>
              )}
            </div>
            {customerSearchOpen &&
              customerHits.length > 0 &&
              selectedCustomerId === null && (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-800">
                {customerHits.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      ref={setCustomerSearchHitRef(c.id)}
                      tabIndex={-1}
                      className="w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-700/80"
                      onClick={() => selectCustomerFromSearch(c)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          selectCustomerFromSearch(c)
                          focusAfterCustomerPick()
                          return
                        }
                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                          e.preventDefault()
                          focusCustomerSearchOption(
                            e.key === 'ArrowDown' ? 'next' : 'prev',
                          )
                        }
                      }}
                    >
                      {c.name}
                      {c.phone_1 ? (
                        <span className="text-slate-400"> · {c.phone_1}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {me?.role === 'employee' &&
              selectedCustomer?.requires_attention &&
              selectedCustomer.note.trim() && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-start text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="font-semibold">{t('pos.customerAttentionTitle')}</p>
                <p className="mt-0.5 whitespace-pre-wrap">{selectedCustomer.note}</p>
              </div>
            )}
          </div>

          <div ref={productSearchWrapRef} className="relative">
            <label className="sr-only" htmlFor="pos-product-search">
              {t('pos.searchProductAria')}
            </label>
            {/* Enter does not advance focus here: cashiers add many lines from search. */}
            <input
              id="pos-product-search"
              ref={productSearchRef}
              value={productQuery}
              onChange={(e) => {
                setProductQuery(e.target.value)
                setSearchOpen(true)
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  const query = productQuery.trim()
                  e.preventDefault()
                  if (!query) return
                  focusProductSearchOption(e.key === 'ArrowDown' ? 'next' : 'prev')
                  return
                }
                if (e.key === 'Enter') {
                  const query = productQuery.trim()
                  if (!query) return
                  e.preventDefault()
                  const exactHit = searchHits.find(
                    (p) => p.name.trim().toLowerCase() === query.toLowerCase(),
                  )
                  if (exactHit) {
                    addProduct(exactHit)
                  } else {
                    addManualLine(query)
                  }
                  return
                }
                if (e.key !== 'Tab' || e.shiftKey) return
                if (productQuery.trim().length === 0) return
                e.preventDefault()
                if (searchHits.length > 0) {
                  const firstId = searchHits[0].id
                  window.requestAnimationFrame(() => {
                    productSearchHitRefsRef.current.get(firstId)?.focus()
                  })
                }
              }}
              placeholder={t('pos.searchPlaceholder')}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 ps-4 pe-3 text-start shadow-sm outline-none ring-violet-500/20 focus:ring-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
            {searchOpen && (
              <ul
                className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
                role="listbox"
              >
                {productQuery.trim().length > 0 && (
                  <li>
                    <button
                      type="button"
                      ref={setProductSearchHitRef(MANUAL_SEARCH_OPTION_ID)}
                      onClick={() => addManualLine(productQuery)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                          e.preventDefault()
                          focusProductSearchOption(e.key === 'ArrowDown' ? 'next' : 'prev')
                          return
                        }
                      }}
                      title={t('pos.addManualLine')}
                      className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-violet-200 bg-violet-50 px-3 py-2 text-start hover:bg-violet-100"
                    >
                      <span className="truncate font-medium text-violet-900">
                        {productQuery.trim()}
                      </span>
                      <span className="shrink-0 rounded-full border border-violet-400 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                        {t('pos.addManualLine')}
                      </span>
                    </button>
                  </li>
                )}
                {searchHits.map((p, hitIndex) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      ref={setProductSearchHitRef(p.id)}
                      onClick={() => addProduct(p)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                          e.preventDefault()
                          focusProductSearchOption(
                            e.key === 'ArrowDown' ? 'next' : 'prev',
                          )
                          return
                        }
                        if (e.key !== 'Tab' || e.shiftKey) return
                        if (hitIndex < searchHits.length - 1) return
                        e.preventDefault()
                        productSearchRef.current?.focus()
                      }}
                      title={t('pos.addToCart')}
                      className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-start hover:bg-violet-50"
                    >
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {receiptSettings?.show_item_images !== false && p.image_url ? (
                          <img
                            src={resolveMediaUrl(p.image_url) ?? ''}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-slate-400">
                            <ImageOff className="h-6 w-6" />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-900">
                          {p.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {t('pos.stock')}{' '}
                          <span
                            className={
                              p.current_stock_quantity < 0
                                ? 'font-medium text-rose-600 dark:text-rose-400'
                                : p.current_stock_quantity === 0
                                  ? 'font-medium text-amber-600 dark:text-amber-400'
                                  : ''
                            }
                          >
                            {p.current_stock_quantity}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-start text-sm font-semibold text-slate-900">
              {t('pos.cart')}
            </h2>
            {cart.length === 0 ? (
              <p className="mt-4 text-start text-sm text-slate-500">
                {t('pos.noItems')}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {cart.map((l, lineIndex) => (
                  <li
                    key={l.product.id}
                    className={`flex flex-wrap items-center gap-3 py-3 ${
                      l.product.manual_entry
                        ? 'rounded-lg border border-violet-300 bg-violet-50/60 px-2'
                        : ''
                    }`}
                  >
                      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {receiptSettings?.show_item_images !== false && l.product.image_url ? (
                        <img
                          src={resolveMediaUrl(l.product.image_url) ?? ''}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-slate-400">
                          <ImageOff className="h-6 w-6" />
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1 text-start">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {l.product.name}
                      </p>
                      {l.product.manual_entry ? (
                        <p className="mt-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">
                          {t('pos.manualLineTag')}
                        </p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <input
                          ref={setCartQtyRef(l.product.id)}
                          type="text"
                          inputMode="numeric"
                          value={l.quantity > 0 ? String(l.quantity) : ''}
                          onChange={(e) => {
                            const digitsOnly = e.target.value.replace(/\D+/g, '')
                            updateLineQty(
                              l.product.id,
                              digitsOnly ? Number.parseInt(digitsOnly, 10) : 0,
                            )
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return
                            e.preventDefault()
                            focusNextEmptyInputFrom(
                              e.currentTarget,
                              () => cartPriceRefsRef.current.get(l.product.id)?.focus(),
                            )
                          }}
                          className="w-20 rounded border border-slate-200 px-2 py-1 text-center text-sm tabular-nums"
                          aria-label={t('pos.qtyAria')}
                          placeholder="0"
                        />
                        <input
                          ref={setCartPriceRef(l.product.id)}
                          type="text"
                          inputMode="decimal"
                          value={l.unitPriceUsd}
                          onChange={(e) =>
                            updateLinePrice(l.product.id, e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return
                            e.preventDefault()
                            const next = cart[lineIndex + 1]
                            focusNextEmptyInputFrom(e.currentTarget, () => {
                              if (next) {
                                cartQtyRefsRef.current.get(next.product.id)?.focus()
                              } else {
                                paymentUsdInputRef.current?.focus()
                              }
                            })
                          }}
                          className="w-24 rounded border border-slate-200 px-2 py-1 text-end text-sm tabular-nums"
                          aria-label={t('pos.unitPriceUsdAria')}
                        />
                        <span className="text-xs text-slate-500">
                          {t('common.currencyUsd')}
                        </span>
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => updateLineQty(l.product.id, 0)}
                          className="ms-auto text-slate-400 hover:text-red-600"
                          aria-label={t('pos.remove')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="flex max-lg:order-last flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2
              className={`flex items-center gap-2 text-start text-sm font-semibold text-slate-900 dark:text-slate-100 ${
                rate !== null && rate > 0 && !Number.isNaN(rate) ? 'mt-2' : ''
              }`}
            >
              <Wallet className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
              {t('pos.payment')}
            </h2>

            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="usd-in"
                    className="text-start text-xs font-medium text-slate-600"
                  >
                    {t('pos.amountReceivedUsd')}
                  </label>
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
                </div>
                <input
                  id="usd-in"
                  ref={paymentUsdInputRef}
                  value={amountPaidUsd}
                  onChange={(e) => onAmountPaidUsdChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    focusNextEmptyInputFrom(
                      e.currentTarget,
                      () => paymentIqdInputRef.current?.focus(),
                    )
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-start tabular-nums dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  inputMode="decimal"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="iqd-in"
                    className="text-start text-xs font-medium text-slate-600"
                  >
                    {t('pos.amountReceivedIqd')}
                  </label>
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
                </div>
                <input
                  id="iqd-in"
                  ref={paymentIqdInputRef}
                  value={amountPaidIqd}
                  onChange={(e) => onAmountPaidIqdChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    focusNextEmptyInputFrom(
                      e.currentTarget,
                      () => discountInputRef.current?.focus(),
                    )
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-start tabular-nums dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  inputMode="numeric"
                />
                {rate !== null &&
                  paidIqd > 0 &&
                  !paymentIqdLinked &&
                  !normalizeMoneyInput(amountPaidUsd) && (
                  <p className="mt-1 text-start text-xs text-slate-500">
                    {t('pos.paidIqdApproxLine')
                      .replace('{amount}', formatMoneyCompact(paidIqdAsUsd))
                      .replace('{currency}', t('common.currencyUsd'))
                      .replace('{rateHint}', t('pos.atTodaysRate'))}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="disc-usd"
                  className="text-start text-xs font-medium text-slate-600"
                >
                  {t('pos.discountUsd')}
                </label>
                <input
                  id="disc-usd"
                  ref={discountUsdInputRef}
                  value={discountUsd}
                  onChange={(e) => setDiscountUsd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    focusNextEmptyInputFrom(
                      e.currentTarget,
                      () => discountInputRef.current?.focus(),
                    )
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-start tabular-nums dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  inputMode="decimal"
                />
              </div>
              <div>
                <label
                  htmlFor="disc"
                  className="text-start text-xs font-medium text-slate-600"
                >
                  {t('pos.discountIqd')}
                </label>
                <input
                  id="disc"
                  ref={discountInputRef}
                  value={discountIqd}
                  onChange={(e) => setDiscountIqd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    focusNextEmptyInputFrom(
                      e.currentTarget,
                      () => noteTextareaRef.current?.focus(),
                    )
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-start tabular-nums dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label
                  htmlFor="note"
                  className="text-start text-xs font-medium text-slate-600"
                >
                  {t('pos.note')}
                </label>
                <textarea
                  id="note"
                  ref={noteTextareaRef}
                  value={saleNote}
                  onChange={(e) => setSaleNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    if (e.shiftKey) return
                    e.preventDefault()
                    const mobile = window.matchMedia('(max-width: 767px)').matches
                    if (mobile) completeSaleMobileRef.current?.focus()
                    else completeSaleDesktopRef.current?.focus()
                  }}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-start text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <h2 className="text-start text-sm font-semibold">{t('pos.summary')}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4 text-start">
                <dt>{t('pos.subtotalUsd')}</dt>
                <dd className="font-mono tabular-nums">
                  {formatMoneyCompact(subtotalUsd)}
                </dd>
              </div>
              {discountAmt > 0 ? (
                <div className="flex justify-between gap-4 text-start">
                  <dt>{t('pos.discount')}</dt>
                  <dd className="font-mono tabular-nums">
                    −{formatMoneyCompact(discountAmt)} {t('common.currencyUsd')}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-start font-medium dark:border-slate-700">
                <dt>{t('pos.totalUsd')}</dt>
                <dd className="font-mono tabular-nums">{formatMoneyCompact(finalUsd)}</dd>
              </div>
              <div className="flex justify-between gap-4 text-start">
                <dt>{t('pos.totalIqd')}</dt>
                <dd className="font-mono tabular-nums">
                  {finalIqd !== null ? Math.round(finalIqd).toLocaleString() : '—'}
                </dd>
              </div>
              {selectedCustomerId !== null &&
                !customerPriorDebtLoading &&
                customerPriorDebtUsd > 0.0001 && (
                <div className="flex justify-between gap-4 text-start text-xs text-slate-500 dark:text-slate-400">
                  <dt>{t('pos.priorDebtUsd')}</dt>
                  <dd className="font-mono tabular-nums">
                    {formatMoneyCompact(customerPriorDebtUsd)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-start dark:border-slate-700">
                <dt className="flex flex-wrap items-center gap-1.5 self-start">
                  <span>{t('pos.remainingUsd')}</span>
                  {remainingThisSaleUsd > 0.0001 ? (
                    <button
                      type="button"
                      disabled={submitting}
                      title={t('pos.remainderDiscountHint')}
                      onClick={applyRemainderAsDiscountUsd}
                      className="rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-violet-700 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200 dark:hover:bg-violet-900/60"
                    >
                      {t('pos.remainderDiscountBtn')}
                    </button>
                  ) : null}
                </dt>
                <dd className="text-end font-mono tabular-nums text-red-600 dark:text-red-400">
                  <div>
                    {formatMoneyCompact(remainingThisSaleUsd)}
                    {remainingThisSaleUsd > 0.0001
                      ? ` ${t('pos.debtSuffix')}`
                      : ''}
                  </div>
                  {remainingThisSaleIqd !== null && (
                    <div className="mt-0.5 text-xs font-medium">
                      {Math.round(remainingThisSaleIqd).toLocaleString()}{' '}
                      {t('common.currencyIqd')}
                    </div>
                  )}
                </dd>
              </div>
            </dl>
            {error && (
              <p className="mt-3 text-start text-sm text-red-300">{error}</p>
            )}
            <button
              type="button"
              tabIndex={-1}
              disabled={submitting || cart.length === 0 || editingSaleId !== null}
              onClick={saveCurrentAsDraft}
              className="mt-3 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {t('pos.saveDraft')}
            </button>
            <button
              ref={completeSaleDesktopRef}
              type="button"
              tabIndex={-1}
              disabled={submitting || needsShop || editingSaleLoading}
              onClick={() => void checkout()}
              className="mt-4 hidden min-h-12 w-full rounded-xl bg-violet-500 py-3 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-50 md:block"
            >
              {submitting
                ? t('pos.saving')
                : editingSaleId !== null
                  ? t('pos.saveSaleChanges')
                  : t('pos.completeSale')}
            </button>
          </div>
        </aside>
      </div>

      {canAccessShopData && (
        <div
          className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.1)] backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 md:hidden"
          style={{
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          }}
        >
          <div className="mx-auto flex max-w-6xl items-stretch gap-3">
            <div className="flex min-w-0 flex-1 flex-col justify-center text-start">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {t('pos.totalUsd')}
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-slate-900">
                {formatMoneyCompact(finalUsd)}
              </span>
            </div>
            <button
              ref={completeSaleMobileRef}
              type="button"
              tabIndex={-1}
              disabled={submitting || needsShop || editingSaleLoading}
              onClick={() => void checkout()}
              className="inline-flex min-h-12 min-w-[9rem] flex-[2] items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-violet-500 disabled:opacity-50"
            >
              {submitting
                ? t('pos.saving')
                : editingSaleId !== null
                  ? t('pos.saveSaleChanges')
                  : t('pos.checkout')}
            </button>
          </div>
        </div>
      )}

      {draftsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pos-drafts-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDraftsOpen(false)
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 id="pos-drafts-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t('pos.drafts')}
              </h2>
              <button
                type="button"
                onClick={() => setDraftsOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('pos.cancel')}
              </button>
            </div>
            {drafts.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('pos.noDrafts')}</p>
            ) : (
              <ul className="max-h-[60vh] space-y-2 overflow-auto">
                {drafts.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-slate-700 dark:text-slate-200">
                        <p className="font-medium">
                          {d.customerQuery || t('pos.customer')} · {d.cart.length} {t('sales.lines')}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(d.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => applyDraft(d)}
                          className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-700/40 dark:bg-violet-950/40 dark:text-violet-300"
                        >
                          {t('pos.loadDraft')}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDraftById(d.id)}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-700/40 dark:text-rose-300 dark:hover:bg-rose-950/40"
                        >
                          {t('crud.delete')}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {returnModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pos-return-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReturnModalOpen(false)
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 id="pos-return-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t('pos.productReturn')}
              </h2>
              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('pos.cancel')}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={returnReceiptNumber}
                onChange={(e) => setReturnReceiptNumber(e.target.value.replace(/\D+/g, ''))}
                inputMode="numeric"
                placeholder={t('pos.returnReceiptNumber')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => void loadSaleForReturn()}
                disabled={loadingReturnSale}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {loadingReturnSale ? t('common.loading') : t('pos.loadSale')}
              </button>
            </div>

            {returnSale ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  #{formatSaleReceiptNumber(returnSale.receipt_number) || '—'} ·{' '}
                  {returnSale.customer_name || '—'}
                </p>
                <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-3 py-2 text-start">{t('pos.thReceiptItem')}</th>
                        <th className="px-3 py-2 text-center">{t('pos.qtyAria')}</th>
                        <th className="px-3 py-2 text-center">{t('pos.returnQty')}</th>
                        <th className="px-3 py-2 text-end">USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnSale.lines.map((ln) => (
                        <tr key={ln.id} className="border-t border-slate-100 dark:border-slate-700">
                          <td className="px-3 py-2">{ln.product_name || ln.manual_name}</td>
                          <td className="px-3 py-2 text-center font-mono">{ln.quantity}</td>
                          <td className="px-3 py-2 text-center">
                            <input
                              value={returnQuantities[ln.id] ?? ''}
                              onChange={(e) =>
                                setReturnQuantities((prev) => ({
                                  ...prev,
                                  [ln.id]: e.target.value.replace(/\D+/g, ''),
                                }))
                              }
                              inputMode="numeric"
                              className="w-20 rounded border border-slate-200 px-2 py-1 text-center dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2 text-end font-mono">{formatMoneyCompact(ln.unit_price_usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <textarea
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  placeholder={t('pos.note')}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void submitReturn()}
                    disabled={submittingReturn}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {submittingReturn ? t('inv.saving') : t('pos.returnSubmit')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {customerModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-cust-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2
              id="new-cust-title"
              className="text-lg font-semibold text-slate-900"
            >
              {t('pos.newCustomer')}
            </h2>
            <div className="mt-4 space-y-3">
              <input
                ref={newCustNameRef}
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  focusNextEmptyInputFrom(
                    e.currentTarget,
                    () => newCustWorkplaceRef.current?.focus(),
                  )
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-start"
                placeholder={t('pos.placeholderName')}
              />
              <input
                ref={newCustWorkplaceRef}
                value={newCustWorkplace}
                onChange={(e) => setNewCustWorkplace(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  focusNextEmptyInputFrom(
                    e.currentTarget,
                    () => newCustAddressRef.current?.focus(),
                  )
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-start"
                placeholder={t('pos.placeholderWorkplace')}
              />
              <input
                ref={newCustAddressRef}
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  focusNextEmptyInputFrom(
                    e.currentTarget,
                    () => newCustPhone1Ref.current?.focus(),
                  )
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-start"
                placeholder={t('pos.placeholderAddress')}
              />
              <input
                ref={newCustPhone1Ref}
                value={newCustPhone1}
                onChange={(e) => setNewCustPhone1(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  focusNextEmptyInputFrom(
                    e.currentTarget,
                    () => newCustPhone2Ref.current?.focus(),
                  )
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-start"
                placeholder={t('pos.placeholderPhone1')}
              />
              <input
                ref={newCustPhone2Ref}
                value={newCustPhone2}
                onChange={(e) => setNewCustPhone2(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  focusNextEmptyInputFrom(
                    e.currentTarget,
                    () => newCustNoteRef.current?.focus(),
                  )
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-start"
                placeholder={t('pos.placeholderPhone2')}
              />
              <textarea
                ref={newCustNoteRef}
                value={newCustNote}
                onChange={(e) => setNewCustNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  if (e.shiftKey) return
                  e.preventDefault()
                  newCustSaveRef.current?.focus()
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-start"
                placeholder={t('pos.placeholderNote')}
                rows={2}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setCustomerModalOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                {t('pos.cancel')}
              </button>
              <button
                ref={newCustSaveRef}
                type="button"
                tabIndex={-1}
                onClick={() => void createCustomer()}
                disabled={creatingCustomer || !newCustName.trim()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {creatingCustomer ? t('pos.saving') : t('pos.save')}
              </button>
            </div>
          </div>
        </div>
      )}
      {saleSuccessOpen && (
        <div
          className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sale-success-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="sale-success-title" className="text-center text-lg font-semibold text-slate-900">
              {saleSuccessMode === 'edit' ? t('pos.saleChangesSaved') : t('pos.saleSuccess')}
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500">
              #{formatSaleReceiptNumber(lastReceipt?.receipt_number) || '—'}
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => void printReceipt()}
                className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500"
              >
                {t('pos.printReceipt')}
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={resetForNextSale}
                className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t('pos.newSale')}
              </button>
            </div>
          </div>
        </div>
      )}
      {rateEditorOpen && (
        <div
          className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pos-rate-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <h2 id="pos-rate-title" className="text-start text-base font-semibold text-slate-900 dark:text-slate-100">
              {t('inv.rateDialogTitle')}
            </h2>
            <p className="mt-1 text-start text-sm text-slate-600 dark:text-slate-400">
              {t('inv.rateDialogHint')}
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={ratePer100Input}
              onChange={(e) => setRatePer100Input(e.target.value)}
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-start tabular-nums dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder={t('inv.ratePlaceholder')}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRateEditorOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('inv.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void saveRateFromPos()}
                disabled={savingRate}
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {savingRate ? t('inv.saving') : t('inv.save')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {lastReceipt && receiptSummary && (
        <div
          id="receipt-print"
          data-receipt-format="A4"
          className="mx-auto mt-6 max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:mt-0 print:max-w-none print:rounded-none print:shadow-none"
        >
          <h2 className="text-center text-xl font-bold text-slate-900">{t('pos.receipt')}</h2>
          <p className="mt-1 text-center text-xs text-slate-500">
            #{formatSaleReceiptNumber(lastReceipt.receipt_number) || '—'} ·{' '}
            {lastReceipt.occurred_at
              ? new Date(String(lastReceipt.occurred_at)).toLocaleString()
              : ''}
          </p>
          <p className="text-center text-xs text-slate-500">
            {t('pos.receiptRateLine').replace(
              '{rate}',
              String(
                Math.round(
                  Number(lastReceipt.exchange_rate_usd_to_iqd ?? 0) * 100,
                ),
              ),
            )}
          </p>
          <table className="mt-6 w-full text-start text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="pb-2 ps-0 font-medium">{t('pos.thReceiptItem')}</th>
                <th className="pb-2 pe-0 text-end font-medium">{t('pos.thReceiptQtyUsd')}</th>
              </tr>
            </thead>
            <tbody>
              {(
                (lastReceipt.lines as {
                  id?: number
                  product_name?: string
                  product: number | null
                  manual_name?: string
                  quantity: number
                  unit_price_usd: string
                }[]) || []
              ).map((ln) => (
                <tr key={ln.id ?? `${ln.product}-${ln.quantity}`} className="border-b border-slate-100">
                  <td className="py-2.5">
                    {ln.product_name ??
                      ln.manual_name ??
                      t('pos.productNumber').replace('{id}', String(ln.product))}
                  </td>
                  <td className="py-2.5 text-end tabular-nums">
                    {ln.quantity} × ${formatMoneyCompact(ln.unit_price_usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">{t('pos.subtotalReceipt')}</dt>
              <dd className="font-mono tabular-nums">
                {formatMoneyCompact(receiptSummary.subtotalUsd)}
              </dd>
            </div>
            {receiptSummary.discountUsd > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">{t('pos.discountReceipt')}</dt>
                <dd className="font-mono tabular-nums">
                  −{formatMoneyCompact(receiptSummary.discountUsd)} {t('common.currencyUsd')}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 font-semibold">
              <dt>{t('pos.finalUsdReceipt')}</dt>
              <dd className="font-mono tabular-nums">
                {formatMoneyCompact(receiptSummary.finalUsd)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">{t('pos.finalIqdReceipt')}</dt>
              <dd className="font-mono tabular-nums">
                {receiptSummary.finalIqd !== null
                  ? Math.round(receiptSummary.finalIqd).toLocaleString()
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">{t('pos.remainingUsd')}</dt>
              <dd className="text-end font-mono tabular-nums text-red-600 dark:text-red-400">
                <div>
                  {formatMoneyCompact(receiptSummary.balanceUsd)}
                  {receiptSummary.balanceUsd > 0.0001 ? ` ${t('pos.debtSuffix')}` : ''}
                </div>
                {rate !== null && !Number.isNaN(rate) && (
                  <div className="mt-0.5 text-xs font-medium">
                    {Math.round(receiptSummary.balanceUsd * rate).toLocaleString()}{' '}
                    {t('common.currencyIqd')}
                  </div>
                )}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => void printReceipt()}
            className="no-print mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" aria-hidden />
            {t('pos.printReceipt')}
          </button>
        </div>
      )}
    </>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from '../context/LocaleContext'
import { useSession } from '../context/SessionContext'
import { apiJson } from '../lib/api'
import { hasPerm } from '../lib/permissions'
import { formatSaleReceiptNumber } from '../lib/shopReceiptNumbers'
import type { Paginated, SaleListRow, SaleReturnResponse } from '../types/api'

export function SalesReturnsPage() {
  const { t } = useLocale()
  const { me, loading } = useSession()
  const [rows, setRows] = useState<SaleListRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [productName, setProductName] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedSale, setSelectedSale] = useState<SaleListRow | null>(null)
  const [lockedReceiptId, setLockedReceiptId] = useState<number | null>(null)
  const [returnNote, setReturnNote] = useState('')
  const [returnQuantities, setReturnQuantities] = useState<Record<number, string>>({})

  const canUseReturns = useMemo(
    () => Boolean(me && hasPerm(me, 'view_sale', 'add_sale')),
    [me],
  )

  const loadSales = useCallback(async () => {
    if (!canUseReturns) return
    setHistoryLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const params = new URLSearchParams()
      if (productName.trim()) params.set('product_name', productName.trim())
      if (customerName.trim()) params.set('customer_name', customerName.trim())
      if (receiptNumber.trim()) params.set('receipt_number', receiptNumber.trim())
      if (dateFrom.trim()) params.set('date_from', dateFrom.trim())
      if (dateTo.trim()) params.set('date_to', dateTo.trim())
      const qs = params.toString()
      const url = qs ? `/api/sales/?${qs}` : '/api/sales/'
      const data = await apiJson<Paginated<SaleListRow> | SaleListRow[]>(url)
      setRows(Array.isArray(data) ? data : data.results)
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setHistoryLoading(false)
    }
  }, [canUseReturns, customerName, dateFrom, dateTo, productName, receiptNumber, t])

  const visibleRows = useMemo(() => {
    if (lockedReceiptId == null) return rows
    return rows.filter((row) => row.id === lockedReceiptId)
  }, [lockedReceiptId, rows])

  const selectSale = useCallback(async (sale: SaleListRow) => {
    setError(null)
    setSuccess(null)
    setLockedReceiptId(sale.id)
    setSelectedSale(sale)
    setReturnNote('')
    const initial: Record<number, string> = {}
    for (const ln of sale.lines) {
      const sold = Number(ln.quantity) || 0
      const alreadyReturned = Number(ln.returned_quantity ?? 0) || 0
      const maxQty = Math.max(0, sold - alreadyReturned)
      if (maxQty > 0) initial[ln.id] = ''
    }
    setReturnQuantities(initial)
    try {
      const details = await apiJson<SaleListRow>(`/api/sales/${sale.id}/`)
      setSelectedSale(details)
      const refill: Record<number, string> = {}
      for (const ln of details.lines) {
        const sold = Number(ln.quantity) || 0
        const alreadyReturned = Number(ln.returned_quantity ?? 0) || 0
        const maxQty = Math.max(0, sold - alreadyReturned)
        if (maxQty > 0) refill[ln.id] = ''
      }
      setReturnQuantities(refill)
    } catch {
      // keep lightweight row as selected when details call fails
    }
  }, [])

  async function submitReturn() {
    if (!selectedSale) {
      setError(t('salesReturns.needSale'))
      return
    }
    const lines = selectedSale.lines
      .map((ln) => {
        const qty = Math.max(0, Math.floor(Number(returnQuantities[ln.id] ?? '0')))
        const sold = Number(ln.quantity) || 0
        const alreadyReturned = Number(ln.returned_quantity ?? 0) || 0
        const maxQty = Math.max(0, sold - alreadyReturned)
        return { sale_line_id: ln.id, quantity: qty, maxQty }
      })
      .filter((x) => x.quantity > 0)
    if (lines.length === 0) {
      setError(t('salesReturns.needLines'))
      return
    }
    if (lines.some((x) => x.quantity > x.maxQty)) {
      setError(t('salesReturns.qtyTooHigh'))
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await apiJson<SaleReturnResponse>('/api/sales/return-products/', {
        method: 'POST',
        body: JSON.stringify({
          sale_id: selectedSale.id,
          note: returnNote.trim(),
          lines: lines.map((x) => ({ sale_line_id: x.sale_line_id, quantity: x.quantity })),
        }),
      })
      setSuccess(t('pos.returnSuccess').replace('{usd}', String(res.total_refund_usd)))
      setSelectedSale(null)
      setLockedReceiptId(null)
      setReturnNote('')
      setReturnQuantities({})
      await loadSales()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!canUseReturns) return
    void loadSales()
  }, [canUseReturns, loadSales])

  if (loading) {
    return <div className="p-6 text-sm text-slate-600 dark:text-slate-300">{t('common.loading')}</div>
  }

  if (!me) {
    return (
      <div className="p-6 text-sm text-slate-700 dark:text-slate-200">
        <p>{t('crud.permissionDenied')}</p>
      </div>
    )
  }

  if (!canUseReturns) {
    return (
      <div className="p-6 text-sm text-slate-700 dark:text-slate-200">
        <p>{t('crud.permissionDenied')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('nav.salesReturns')}</h1>

      <div className="mt-4 space-y-4">
        {lockedReceiptId == null && (
          <form
            className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            onSubmit={(e) => {
              e.preventDefault()
              void loadSales()
            }}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <input
                type="search"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t('sales.filterCustomerName')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="search"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder={t('sales.filterProductName')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="search"
                inputMode="numeric"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value.replace(/\D+/g, ''))}
                placeholder={t('sales.filterReceiptNumber')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={historyLoading}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {historyLoading ? t('common.loading') : t('sales.applyFilters')}
              </button>
            </div>
          </form>
        )}

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-700/40 dark:bg-rose-950/20 dark:text-rose-300">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            {success}
          </p>
        ) : null}

        {lockedReceiptId == null && (
          <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40">
                <tr>
                  <th className="px-3 py-2 text-start">#</th>
                  <th className="px-3 py-2 text-start">{t('sales.filterCustomerName')}</th>
                  <th className="px-3 py-2 text-start">{t('sales.dateFrom')}</th>
                  <th className="px-3 py-2 text-end">{t('sales.lines')}</th>
                  <th className="px-3 py-2 text-end">{t('companiesPage.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-slate-500 dark:text-slate-300">
                      {t('common.loading')}
                    </td>
                  </tr>
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                      {t('sales.empty')}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((sale) => (
                    <tr key={sale.id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-3 py-2 font-mono">
                        #{formatSaleReceiptNumber(sale.receipt_number) || '—'}
                      </td>
                      <td className="px-3 py-2">{sale.customer_name || '—'}</td>
                      <td className="px-3 py-2">{new Date(sale.occurred_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-end">{sale.lines.length}</td>
                      <td className="px-3 py-2 text-end">
                        <button
                          type="button"
                          onClick={() => void selectSale(sale)}
                          className="inline-flex rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                        >
                          {t('salesReturns.selectReceipt')}
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
                {t('sales.filterCustomerName')}
              </span>
              <input
                value={selectedSale?.customer_name ?? ''}
                readOnly
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('sales.filterReceiptNumber')}
              </span>
              <input
                value={selectedSale ? formatSaleReceiptNumber(selectedSale.receipt_number) : ''}
                readOnly
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono tabular-nums dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('sales.dateFrom')}
              </span>
              <input
                value={selectedSale ? new Date(selectedSale.occurred_at).toLocaleString() : ''}
                readOnly
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('pos.note')}
              </span>
              <textarea
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                rows={2}
                placeholder={t('pos.note')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-600">
            <div className="mb-2 hidden grid-cols-12 gap-2 px-1 text-[11px] font-semibold text-slate-900 sm:grid dark:text-slate-100">
              <span className="sm:col-span-6">{t('jard.product')}</span>
              <span className="sm:col-span-3">{t('purchaseReturns.maxReturnQty')}</span>
              <span className="sm:col-span-3">{t('pos.returnQty')}</span>
            </div>
            <div className="space-y-3">
              {!selectedSale ? (
                <p className="text-sm text-slate-500">{t('salesReturns.selectReceiptHint')}</p>
              ) : (
                selectedSale.lines
                  .map((ln) => {
                    const sold = Number(ln.quantity) || 0
                    const alreadyReturned = Number(ln.returned_quantity ?? 0) || 0
                    const maxQty = Math.max(0, sold - alreadyReturned)
                    return { ln, maxQty }
                  })
                  .filter((x) => x.maxQty > 0)
                  .map(({ ln, maxQty }) => (
                    <div
                      key={ln.id}
                      className="grid gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-12 dark:border-slate-700"
                    >
                      <div className="sm:col-span-6">
                        <input
                          value={ln.product_name || ln.manual_name || `#${ln.id}`}
                          readOnly
                          className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
                        />
                      </div>
                      <input
                        className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm tabular-nums sm:col-span-3 dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
                        value={String(maxQty)}
                        readOnly
                      />
                      <input
                        className="min-h-11 rounded-lg border border-slate-200 px-2 py-1 text-sm tabular-nums sm:col-span-3 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        value={returnQuantities[ln.id] ?? ''}
                        onChange={(e) =>
                          setReturnQuantities((prev) => ({
                            ...prev,
                            [ln.id]: e.target.value.replace(/\D+/g, ''),
                          }))
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
            <button
              type="button"
              disabled={submitting || !selectedSale}
              onClick={() => void submitReturn()}
              className="min-h-11 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {submitting ? t('inv.saving') : t('salesReturns.submit')}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedSale(null)
                setLockedReceiptId(null)
                setReturnNote('')
                setReturnQuantities({})
              }}
              className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm dark:border-slate-600 dark:text-slate-200"
            >
              {t('purchasePage.resetForm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

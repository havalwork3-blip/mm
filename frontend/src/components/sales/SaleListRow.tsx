import { Pencil, Printer } from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'

import {
  buildReceiptHtml,
  computeReceiptSummaryFromSale,
  printReceiptHtml,
} from '../../lib/receiptHtml'
import { formatSaleReceiptNumber } from '../../lib/shopReceiptNumbers'
import type { ReceiptSettingsRow, SaleListRow as SaleRow } from '../../types/api'
import { formatMoney } from '../../utils/inventoryFormat'

type Props = {
  sale: SaleRow
  t: (key: string) => string
  receiptSettings: ReceiptSettingsRow | null
  canEditInPos: boolean
}

function lineSubtotalUsd(sale: SaleRow): number {
  const lines = Array.isArray(sale.lines) ? sale.lines : []
  return lines.reduce((acc, ln) => {
    const q = Number(ln.quantity)
    const p = parseFloat(String(ln.unit_price_usd))
    if (Number.isNaN(q) || Number.isNaN(p)) return acc
    return acc + q * p
  }, 0)
}

function paidUsdEquivalent(sale: SaleRow): number {
  const rate = parseFloat(String(sale.exchange_rate_usd_to_iqd))
  const paidUsd = parseFloat(String(sale.amount_paid_usd)) || 0
  const paidIqd = parseFloat(String(sale.amount_paid_iqd)) || 0
  if (!Number.isFinite(rate) || rate <= 0) return paidUsd
  return paidUsd + paidIqd / rate
}

export const SaleListRow = memo(function SaleListRowCard({
  sale,
  t,
  receiptSettings,
  canEditInPos,
}: Props) {
  const saleLines = useMemo(
    () => (Array.isArray(sale.lines) ? sale.lines : []),
    [sale.lines],
  )
  const subtotal = useMemo(() => lineSubtotalUsd(sale), [sale])
  const discount = parseFloat(String(sale.invoice_discount_usd)) || 0
  const finalUsd = Math.max(0, subtotal - discount)
  const paidIqd = parseFloat(String(sale.amount_paid_iqd)) || 0
  const paidEq = useMemo(() => paidUsdEquivalent(sale), [sale])
  const balanceUsd = finalUsd - paidEq
  const prevDebt = parseFloat(String(sale.previous_debt_usd ?? '0')) || 0
  const customerName = sale.customer_name?.trim() || '—'
  const customerPhone = sale.customer_phone?.trim() || ''
  const customerAddress = sale.customer_address?.trim() || ''
  const hasReturns = Boolean(sale.has_returns)
  const returnedTotalUsd = parseFloat(String(sale.returned_total_usd ?? '0')) || 0
  const receiptNo = formatSaleReceiptNumber(sale.receipt_number)

  const handlePrint = useCallback(() => {
    if (!receiptSettings) return
    void (async () => {
      const sum = computeReceiptSummaryFromSale(sale)
      const html = await buildReceiptHtml({
        sale: sale as unknown as Record<string, unknown>,
        sum,
        receiptSettings,
        customerNameDisplay: customerName === '—' ? '—' : customerName,
      })
      printReceiptHtml(html)
    })()
  }, [receiptSettings, sale, customerName])

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className="space-y-3 border-b border-slate-100 pb-3 dark:border-slate-600">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
            #{receiptNo || '—'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {new Date(sale.occurred_at).toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
            <span className="font-medium text-slate-600 dark:text-slate-400">
              {t('pos.customer')}:{' '}
            </span>
            {customerName}
            {customerPhone ? (
              <span className="text-slate-500"> · {customerPhone}</span>
            ) : null}
          </p>
          {customerAddress ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{customerAddress}</p>
          ) : null}
          {hasReturns ? (
            <p className="mt-1 inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-900/30 dark:text-emerald-200">
              {t('sales.returnedTag')} {formatMoney(returnedTotalUsd)} USD
            </p>
          ) : null}
        </div>
        {/* Own row: avoids RTL + overflow-x-hidden clipping a sibling flex column */}
        <div className="flex flex-wrap items-center gap-2" dir="ltr">
          <button
            type="button"
            onClick={handlePrint}
            disabled={!receiptSettings}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 shadow-sm hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/40"
            title={t('pos.printReceipt')}
          >
            <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('pos.printReceipt')}
          </button>
          {canEditInPos && !sale.has_returns ? (
            <Link
              to={`/pos?edit=${sale.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/40"
              title={t('sales.editInPos')}
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('sales.editReceipt')}
            </Link>
          ) : canEditInPos && sale.has_returns ? (
            <span
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 opacity-80 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
              title={t('sales.editBlockedReturns')}
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('sales.editReceipt')}
            </span>
          ) : (
            <span
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 opacity-80 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
              title={t('sales.editNeedsPermission')}
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('sales.editReceipt')}
            </span>
          )}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-700/40 dark:bg-emerald-900/20">
          <dt className="mb-1 text-slate-500 dark:text-slate-400">{t('sales.receivedAmountUsd')}</dt>
          <dd className="font-mono text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
            {formatMoney(paidEq)}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
          <dt className="mb-1 text-slate-500 dark:text-slate-400">{t('pos.amountReceivedIqd')}</dt>
          <dd className="font-mono text-sm tabular-nums text-slate-900 dark:text-slate-100">
            {Math.round(paidIqd).toLocaleString()}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 dark:border-slate-600 dark:bg-slate-900">
          <dt className="mb-1 font-medium text-slate-700 dark:text-slate-300">
            {t('pos.remainingUsd')}
          </dt>
          <dd
            className={`font-mono text-sm font-semibold tabular-nums ${
              balanceUsd > 0.0001
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {formatMoney(balanceUsd)}
            {balanceUsd > 0.0001 ? ` ${t('pos.debtSuffix')}` : ''}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
          <dt className="mb-1 text-slate-500 dark:text-slate-400">
            {t('pos.priorDebtUsd')}
          </dt>
          <dd className="font-mono text-sm tabular-nums text-slate-700 dark:text-slate-300">
            {formatMoney(prevDebt)}
          </dd>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 sm:col-span-2 dark:border-amber-700/40 dark:bg-amber-900/20">
          <dt className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{t('sales.netTotalUsd')}</dt>
          <dd className="font-mono text-base font-bold tabular-nums text-amber-800 dark:text-amber-200">
            {formatMoney(finalUsd)}
          </dd>
        </div>
      </dl>

      {sale.note ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
          <span className="font-medium text-slate-500 dark:text-slate-400">
            {t('pos.note')}:{' '}
          </span>
          {sale.note}
        </p>
      ) : null}

      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-600">
        <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
          {t('sales.lines')} ({saleLines.length})
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full border-collapse text-xs text-slate-800 dark:text-slate-200">
            <thead className="bg-slate-100 dark:bg-slate-800/80">
              <tr>
                <th className="border-b border-e border-slate-300 px-2 py-2 text-start font-semibold dark:border-slate-700">
                  {t('jard.product')}
                </th>
                <th className="border-b border-e border-slate-300 px-2 py-2 text-center font-semibold dark:border-slate-700">
                  {t('pos.qtyAria')}
                </th>
                <th className="border-b border-e border-slate-300 px-2 py-2 text-end font-semibold dark:border-slate-700">
                  {t('pos.unitPriceUsdAria')}
                </th>
                <th className="border-b border-slate-300 px-2 py-2 text-end font-semibold dark:border-slate-700">
                  {t('pos.totalUsd')}
                </th>
              </tr>
            </thead>
            <tbody>
              {saleLines.map((ln) => {
                const lineTot = Number(ln.quantity) * parseFloat(String(ln.unit_price_usd))
                return (
                  <tr key={ln.id} className="odd:bg-white even:bg-slate-50/70 dark:odd:bg-slate-800 dark:even:bg-slate-800/60">
                    <td className="border-b border-e border-slate-200 px-2 py-2 text-sm dark:border-slate-700">
                      <div>{ln.product_name}</div>
                      {(ln.returned_quantity ?? 0) > 0 ? (
                        <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                          {t('sales.returnedQty').replace('{qty}', String(ln.returned_quantity ?? 0))}
                        </div>
                      ) : null}
                    </td>
                    <td className="border-b border-e border-slate-200 px-2 py-2 text-center font-mono tabular-nums dark:border-slate-700">
                      {ln.quantity}
                    </td>
                    <td className="border-b border-e border-slate-200 px-2 py-2 text-end font-mono tabular-nums dark:border-slate-700">
                      {formatMoney(parseFloat(String(ln.unit_price_usd)))}
                    </td>
                    <td className="border-b border-slate-200 px-2 py-2 text-end font-mono tabular-nums dark:border-slate-700">
                      {Number.isFinite(lineTot) ? formatMoney(lineTot) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  )
})

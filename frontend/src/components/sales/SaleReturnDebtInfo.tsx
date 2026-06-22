import { useLocale } from '../../context/LocaleContext'
import { formatMoneyCompact } from '../../lib/formatMoney'
import type { SaleListRow } from '../../types/api'
import { customerHasOutstandingDebt, parseUsdAmount, saleIsCredit } from '../../lib/saleReturnRefund'

type Props = {
  sale: SaleListRow
}

export function SaleReturnDebtInfo({ sale }: Props) {
  const { t } = useLocale()
  const creditSale = saleIsCredit(sale)
  const customerDebt = parseUsdAmount(sale.customer_outstanding_balance_usd)
  const invoiceUnpaid = parseUsdAmount(sale.unpaid_balance_usd)

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-950/50">
      {sale.customer_name ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-slate-600 dark:text-slate-400">{t('salesReturns.customerDebt')}</span>
          <span
            className={
              customerHasOutstandingDebt(sale)
                ? 'font-semibold text-amber-800 dark:text-amber-200'
                : 'text-slate-500 dark:text-slate-400'
            }
          >
            {formatMoneyCompact(String(customerDebt))} USD
          </span>
        </div>
      ) : null}
      {creditSale ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400">
            {t('salesReturns.invoiceUnpaid')}
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              {t('salesReturns.creditSaleBadge')}
            </span>
          </span>
          <span className="font-semibold text-amber-800 dark:text-amber-200">
            {formatMoneyCompact(String(invoiceUnpaid))} USD
          </span>
        </div>
      ) : null}
    </div>
  )
}

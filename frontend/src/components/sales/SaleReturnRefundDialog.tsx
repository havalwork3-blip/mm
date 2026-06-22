import { useLocale } from '../../context/LocaleContext'
import { formatMoneyCompact } from '../../lib/formatMoney'
import type { SaleReturnRefundMethod } from '../../lib/saleReturnRefund'

type Props = {
  open: boolean
  refundUsd: number
  canDeductDebt: boolean
  submitting?: boolean
  onChoose: (method: SaleReturnRefundMethod) => void
  onCancel: () => void
}

export function SaleReturnRefundDialog({
  open,
  refundUsd,
  canDeductDebt,
  submitting = false,
  onChoose,
  onCancel,
}: Props) {
  const { t } = useLocale()
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sale-return-refund-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel()
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <h2
          id="sale-return-refund-title"
          className="text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          {t('salesReturns.refundMethodTitle')}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t('salesReturns.refundMethodHint')}
        </p>
        <p className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 dark:border-violet-700/40 dark:bg-violet-950/30 dark:text-violet-100">
          {t('salesReturns.estimatedRefund').replace('{usd}', formatMoneyCompact(String(refundUsd)))}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={submitting || !canDeductDebt}
            onClick={() => onChoose('debt_reduction')}
            className="min-h-11 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('salesReturns.refundDebtReduction')}
          </button>
          {!canDeductDebt ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {t('salesReturns.refundDebtDisabled')}
            </p>
          ) : null}
          <button
            type="button"
            disabled={submitting}
            onClick={() => onChoose('cash')}
            className="min-h-11 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {t('salesReturns.refundCash')}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="min-h-11 rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {t('customerDebts.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

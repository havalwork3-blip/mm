import { useLocale } from '../../context/LocaleContext'

export function SaleLossBadge({
  soldAtZero,
  soldAtLoss,
  compact = false,
}: {
  soldAtZero?: boolean
  soldAtLoss?: boolean
  compact?: boolean
}) {
  const { t } = useLocale()
  if (!soldAtLoss && !soldAtZero) return null
  const label = soldAtZero ? t('sales.soldAtZeroLoss') : t('sales.soldAtLoss')
  return (
    <span
      className={[
        'inline-flex shrink-0 items-center rounded-full font-semibold ring-1',
        compact
          ? 'px-1.5 py-0.5 text-[10px]'
          : 'px-2 py-0.5 text-[11px]',
        soldAtZero
          ? 'bg-amber-100 text-amber-950 ring-amber-300/80 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-700/60'
          : 'bg-rose-100 text-rose-900 ring-rose-300/80 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-800/60',
      ].join(' ')}
      title={label}
    >
      {label}
    </span>
  )
}

import { useLocale } from '../context/LocaleContext'

export function PageAuthLoading({ label }: { label?: string }) {
  const { t } = useLocale()
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center gap-3 text-slate-500 dark:text-slate-400"
      role="status"
      aria-live="polite"
    >
      <div
        className="h-7 w-7 animate-spin rounded-full border-2 border-violet-500 border-t-transparent"
        aria-hidden
      />
      <span className="text-sm">{label ?? t('common.loading')}</span>
    </div>
  )
}

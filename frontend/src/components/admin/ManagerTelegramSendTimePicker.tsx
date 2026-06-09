import { useLocale } from '../../context/LocaleContext'

type Props = {
  hour24: number
  minute: number
  onChange: (hour24: number, minute: number) => void
  className?: string
}

export function ManagerTelegramSendTimePicker({ hour24, onChange, className = '' }: Props) {
  const { t } = useLocale()
  const hour = Math.max(0, Math.min(23, Math.floor(Number(hour24)) || 0))

  return (
    <div className={className}>
      <label className="block">
        <span className="sr-only">{t('qrAdmin.managerTelegramSendTime')}</span>
        <select
          dir="ltr"
          value={String(hour)}
          onChange={(e) => {
            const h = Number.parseInt(e.target.value, 10)
            onChange(Number.isFinite(h) ? h : 0, 0)
          }}
          className="min-h-12 w-full max-w-md cursor-pointer appearance-auto rounded-lg border-2 border-violet-300 bg-white px-4 py-2.5 text-base font-semibold tabular-nums text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-violet-600 dark:bg-slate-900 dark:text-slate-50"
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, '0')}:00
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
        {t('qrAdmin.managerTelegramSendTimeListHint')}
      </p>
    </div>
  )
}

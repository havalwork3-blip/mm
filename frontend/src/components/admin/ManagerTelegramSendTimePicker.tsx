import { useMemo } from 'react'
import { useLocale } from '../../context/LocaleContext'
import {
  formatMinuteOption,
  from24Hour,
  timeKeyFromParts,
  timePartsFromKey,
  type TimeOption,
} from '../../lib/time12h'

type Props = {
  hour24: number
  minute: number
  onChange: (hour24: number, minute: number) => void
  className?: string
}

function buildTimeOptions(extraHour?: number, extraMinute?: number): TimeOption[] {
  const keys = new Set<number>()
  for (let h = 0; h < 24; h += 1) {
    for (let m = 0; m < 60; m += 5) {
      keys.add(timeKeyFromParts(h, m))
    }
  }
  if (extraHour != null && extraMinute != null) {
    keys.add(timeKeyFromParts(extraHour, extraMinute))
  }
  return [...keys]
    .sort((a, b) => a - b)
    .map((key) => {
      const { hour24, minute } = timePartsFromKey(key)
      const { hour12, ampm } = from24Hour(hour24)
      return {
        key,
        hour24,
        minute,
        label: `${hour12}:${formatMinuteOption(minute)} ${ampm}`,
      }
    })
}

export function ManagerTelegramSendTimePicker({ hour24, minute, onChange, className = '' }: Props) {
  const { t } = useLocale()
  const options = useMemo(
    () => buildTimeOptions(hour24, minute),
    [hour24, minute],
  )
  const selectedKey = timeKeyFromParts(hour24, minute)

  return (
    <div className={className}>
      <label className="block">
        <span className="sr-only">{t('qrAdmin.managerTelegramSendTime')}</span>
        <select
          dir="ltr"
          value={String(selectedKey)}
          onChange={(e) => {
            const { hour24: h, minute: m } = timePartsFromKey(Number.parseInt(e.target.value, 10))
            onChange(h, m)
          }}
          className="min-h-12 w-full max-w-md cursor-pointer appearance-auto rounded-lg border-2 border-violet-300 bg-white px-4 py-2.5 text-base font-semibold tabular-nums text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-violet-600 dark:bg-slate-900 dark:text-slate-50"
        >
          {options.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
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

import { Lock, Unlock } from 'lucide-react'

import { iqdToUsdString, normalizeMoneyInput, parseDec, usdToIqdString } from '../lib/moneyInput'

type Props = {
  usdLabel: string
  iqdLabel: string
  usdValue: string
  iqdValue: string
  onUsdChange: (usd: string, iqd: string) => void
  onIqdChange: (iqd: string, usd: string) => void
  usdLinked: boolean
  iqdLinked: boolean
  onToggleUsdLink: () => void
  onToggleIqdLink: () => void
  rate: number | null
  usdPlaceholder?: string
  iqdPlaceholder?: string
  disabled?: boolean
  compact?: boolean
  linkActiveTitle?: string
  linkInactiveTitle?: string
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm tabular-nums dark:border-slate-600 dark:bg-slate-800'
const lockBtnCls =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'

export function UsdIqdDualInput({
  usdLabel,
  iqdLabel,
  usdValue,
  iqdValue,
  onUsdChange,
  onIqdChange,
  usdLinked,
  iqdLinked,
  onToggleUsdLink,
  onToggleIqdLink,
  rate,
  usdPlaceholder,
  iqdPlaceholder,
  disabled,
  compact,
  linkActiveTitle = 'Linked',
  linkInactiveTitle = 'Unlinked',
}: Props) {
  function handleUsd(raw: string) {
    const cleaned = normalizeMoneyInput(raw)
    if (!usdLinked || rate == null || rate <= 0) {
      onUsdChange(raw, iqdValue)
      return
    }
    if (!cleaned) {
      onUsdChange(raw, '')
      return
    }
    const usd = parseDec(cleaned)
    if (usd <= 0) {
      onUsdChange(raw, '')
      return
    }
    onUsdChange(raw, usdToIqdString(usd, rate))
  }

  function handleIqd(raw: string) {
    const cleaned = normalizeMoneyInput(raw)
    if (!iqdLinked || rate == null || rate <= 0) {
      onIqdChange(raw, usdValue)
      return
    }
    if (!cleaned) {
      onIqdChange(raw, '')
      return
    }
    const iqd = parseDec(cleaned)
    if (iqd <= 0) {
      onIqdChange(raw, '')
      return
    }
    onIqdChange(raw, iqdToUsdString(iqd, rate))
  }

  const gap = compact ? 'gap-2' : 'gap-3'

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${gap}`}>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-medium text-slate-500">{usdLabel}</span>
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={onToggleUsdLink}
            className={lockBtnCls}
            aria-pressed={usdLinked}
            title={usdLinked ? linkActiveTitle : linkInactiveTitle}
          >
            {usdLinked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>
        </div>
        <input
          type="text"
          inputMode="decimal"
          dir="ltr"
          disabled={disabled}
          value={usdValue}
          placeholder={usdPlaceholder}
          onChange={(e) => handleUsd(e.target.value)}
          className={`mt-1 ${inputCls}`}
        />
      </div>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-medium text-slate-500">{iqdLabel}</span>
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={onToggleIqdLink}
            className={lockBtnCls}
            aria-pressed={iqdLinked}
            title={iqdLinked ? linkActiveTitle : linkInactiveTitle}
          >
            {iqdLinked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>
        </div>
        <input
          type="text"
          inputMode="numeric"
          dir="ltr"
          disabled={disabled}
          value={iqdValue}
          placeholder={iqdPlaceholder}
          onChange={(e) => handleIqd(e.target.value)}
          className={`mt-1 ${inputCls}`}
        />
      </div>
    </div>
  )
}

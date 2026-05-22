import { ArrowRight } from 'lucide-react'

import { accentAlpha } from './storefrontTheme'

type Props = {
  label: string
  onClick: () => void
  accent?: string
  /** onAccent = white icon on colored header; accent = gradient chip; surface = neutral */
  variant?: 'onAccent' | 'accent' | 'surface'
  showLabel?: boolean
  className?: string
}

export function StorefrontBackButton({
  label,
  onClick,
  accent = '#FF5A00',
  variant = 'surface',
  showLabel = true,
  className = '',
}: Props) {
  const iconClass =
    variant === 'onAccent'
      ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white transition hover:bg-white/30 sm:h-11 sm:w-11'
      : variant === 'accent'
        ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition hover:brightness-110 sm:h-11 sm:w-11'
        : 'sf-surface-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition hover:opacity-90 sm:h-11 sm:w-11'

  const iconStyle =
    variant === 'accent'
      ? {
          background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
          boxShadow: `0 4px 14px ${accentAlpha(accent, 0.35)}`,
        }
      : undefined

  const labelClass =
    variant === 'onAccent'
      ? 'truncate text-sm font-bold text-white sm:text-base'
      : 'truncate text-sm font-bold text-slate-800 sm:text-base'

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex min-w-0 max-w-full items-center gap-2 text-start transition active:scale-[0.98]',
        className,
      ].join(' ')}
      aria-label={label}
    >
      <span className={iconClass} style={iconStyle}>
        <ArrowRight className="h-5 w-5 rotate-180 rtl:rotate-0" aria-hidden />
      </span>
      {showLabel ? <span className={labelClass}>{label}</span> : null}
    </button>
  )
}

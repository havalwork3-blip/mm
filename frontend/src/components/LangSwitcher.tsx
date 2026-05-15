import { ChevronDown, Globe2 } from 'lucide-react'
import type { Lang } from '../i18n/strings'

type Props = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
  className?: string
  /** Smaller control for dense sidebars */
  compact?: boolean
  /** Dark pill for sidebar footer on slate backgrounds */
  variant?: 'light' | 'dark'
  /** Render as icon-only trigger */
  iconOnly?: boolean
}

export function LangSwitcher({
  lang,
  setLang,
  t,
  className = '',
  compact,
  variant = 'light',
  iconOnly = false,
}: Props) {
  const isDark = variant === 'dark'

  const shell =
    isDark
      ? 'border-slate-600/80 bg-slate-800/95 shadow-inner ring-1 ring-white/[0.06] hover:border-violet-500/45 hover:shadow-md hover:ring-violet-400/15'
      : 'border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 shadow-sm ring-1 ring-slate-900/[0.05] hover:border-violet-200 hover:shadow-md hover:ring-violet-500/10'

  const icon = isDark ? 'text-violet-400' : 'text-violet-600'
  const chevron = isDark ? 'text-slate-500 group-hover:text-violet-300/90' : 'text-slate-400 group-hover:text-violet-600/80'
  const select = isDark
    ? 'text-slate-100 focus:ring-violet-400/35'
    : 'text-slate-800 focus:ring-violet-500/30'

  const size = iconOnly
    ? 'h-10 w-10 justify-center rounded-xl px-0 py-0'
    : compact
      ? 'min-h-11 gap-2 rounded-2xl px-2.5 py-1.5'
      : 'min-h-10 gap-2 rounded-2xl px-3 py-2'

  const textSize = compact ? 'text-xs font-medium' : 'text-sm font-medium'
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const chevronSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <div
      className={`group relative inline-flex max-w-full items-center border transition-colors duration-200 ${shell} ${size} ${className}`}
    >
      {iconOnly && (
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
          aria-label={t('common.language')}
        >
          <option value="en">{t('lang.en')}</option>
          <option value="ar">{t('lang.ar')}</option>
          <option value="ku">{t('lang.ku')}</option>
        </select>
      )}
      <Globe2 className={`shrink-0 ${icon} ${iconSize}`} aria-hidden />
      <div className={`relative ${iconOnly ? 'hidden' : 'min-w-0 flex-1'}`}>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          className={`w-full min-w-0 cursor-pointer appearance-none rounded-lg border-0 bg-transparent py-0.5 ps-0 pe-7 text-start ${textSize} ${select} outline-none ring-offset-0 transition focus:outline-none focus:ring-2 focus:ring-offset-0 ${isDark ? 'ring-offset-slate-900' : 'ring-offset-white'}`}
          aria-label={t('common.language')}
        >
          <option value="en">{t('lang.en')}</option>
          <option value="ar">{t('lang.ar')}</option>
          <option value="ku">{t('lang.ku')}</option>
        </select>
        {!iconOnly && (
          <ChevronDown
            className={`pointer-events-none absolute end-0 top-1/2 -translate-y-1/2 shrink-0 ${chevron} ${chevronSize}`}
            aria-hidden
          />
        )}
      </div>
    </div>
  )
}

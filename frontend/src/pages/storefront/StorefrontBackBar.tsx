import { ArrowRight } from 'lucide-react'

import { accentAlpha } from './storefrontTheme'

type Props = {
  label: string
  onClick: () => void
  accent?: string
  className?: string
  sticky?: boolean
}

export function StorefrontBackBar({
  label,
  onClick,
  accent = '#FF5A00',
  className = '',
  sticky = true,
}: Props) {
  return (
    <div
      className={[
        sticky ? 'sf-back-bar-wrap sticky z-[25] -mx-1 mb-2 py-1 top-[calc(3.75rem+env(safe-area-inset-top))] lg:top-[7.25rem]' : 'mb-2',
        className,
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onClick}
        className="sf-back-bar sf-back-bar--prominent group flex w-full max-w-md items-center gap-3 rounded-2xl px-3 py-2.5 text-start text-sm font-extrabold shadow-md ring-1 transition active:scale-[0.98] sm:px-4 sm:py-3 sm:text-base"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition group-hover:brightness-110 sm:h-11 sm:w-11"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
            boxShadow: `0 4px 14px ${accentAlpha(accent, 0.35)}`,
          }}
        >
          <ArrowRight className="h-5 w-5 rotate-180 rtl:rotate-0" aria-hidden />
        </span>
        <span className="truncate text-slate-800">{label}</span>
      </button>
    </div>
  )
}

import { Plus, ShoppingBag } from 'lucide-react'
import { useRef, type MouseEvent } from 'react'

import { triggerCartFly } from './cartFlyAnimation'
import { accentAlpha } from './storefrontTheme'

type Props = {
  accent: string
  label: string
  inCart: number
  onAdd: () => void
  compact?: boolean
  className?: string
}

export function StorefrontAddToCartButton({
  accent,
  label,
  inCart,
  onAdd,
  compact = false,
  className = '',
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null)

  function handleClick(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onAdd()
    triggerCartFly(btnRef.current, accent)
  }

  if (compact) {
    return (
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        className={[
          'sf-add-cart-btn absolute bottom-1.5 end-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md transition active:scale-90',
          className,
        ].join(' ')}
        style={{
          background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
          boxShadow: `0 4px 14px ${accentAlpha(accent, 0.4)}`,
        }}
        aria-label={label}
        title={label}
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </button>
    )
  }

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={handleClick}
      className={[
        'sf-add-cart-btn flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-extrabold text-white shadow-md transition active:scale-[0.98] sm:text-sm',
        className,
      ].join(' ')}
      style={{
        background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
        boxShadow: `0 6px 18px ${accentAlpha(accent, 0.35)}`,
      }}
      aria-label={label}
    >
      <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
      {inCart > 0 ? `${label} (${inCart})` : label}
    </button>
  )
}

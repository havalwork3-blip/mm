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
  imageUrl?: string | null
}

export function StorefrontAddToCartButton({
  accent,
  label,
  inCart,
  onAdd,
  compact = false,
  className = '',
  imageUrl = null,
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null)

  function handleClick(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onAdd()
    triggerCartFly(btnRef.current, accent, { imageUrl })
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
          backgroundColor: accent,
          boxShadow: `0 4px 12px ${accentAlpha(accent, 0.35)}`,
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
        'sf-add-cart-btn flex h-9 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-bold text-white transition active:scale-[0.98] sm:text-xs',
        className,
      ].join(' ')}
      style={{
        backgroundColor: accent,
        boxShadow: `0 2px 8px ${accentAlpha(accent, 0.25)}`,
      }}
      aria-label={label}
    >
      <ShoppingBag className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">
        {inCart > 0 ? `${label} (${inCart})` : label}
      </span>
    </button>
  )
}

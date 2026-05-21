import { Heart } from 'lucide-react'

import { useStorefrontFavoritesStore } from '../../store/storefrontFavoritesStore'
import { accentAlpha } from './storefrontTheme'

type Props = {
  shopId: number
  productId: number
  accent: string
  addLabel: string
  removeLabel: string
  className?: string
}

export function StorefrontFavoriteButton({
  shopId,
  productId,
  accent,
  addLabel,
  removeLabel,
  className = '',
}: Props) {
  const isFavorite = useStorefrontFavoritesStore((s) => s.isFavorite(shopId, productId))
  const toggle = useStorefrontFavoritesStore((s) => s.toggle)

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(shopId, productId)
      }}
      className={[
        'sf-fav-btn flex h-9 w-9 items-center justify-center rounded-full shadow-md ring-1 backdrop-blur-md transition active:scale-90',
        isFavorite ? 'text-white' : 'bg-white/90 text-slate-500 ring-white/60 hover:text-rose-500',
        className,
      ].join(' ')}
      style={
        isFavorite
          ? {
              backgroundColor: accent,
              boxShadow: `0 4px 14px ${accentAlpha(accent, 0.45)}`,
            }
          : undefined
      }
      aria-label={isFavorite ? removeLabel : addLabel}
      aria-pressed={isFavorite}
    >
      <Heart
        className={['h-4 w-4', isFavorite ? 'fill-current' : ''].join(' ')}
        aria-hidden
      />
    </button>
  )
}

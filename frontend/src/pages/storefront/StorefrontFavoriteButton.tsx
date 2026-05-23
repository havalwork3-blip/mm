import { Heart } from 'lucide-react'

import { useStorefrontFavoritesStore } from '../../store/storefrontFavoritesStore'

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
  accent: _accent,
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
        isFavorite
          ? 'bg-rose-500 text-white ring-rose-300/80 shadow-[0_4px_14px_rgba(244,63,94,0.45)]'
          : 'bg-white/95 text-slate-500 ring-white/80 hover:bg-rose-50 hover:text-rose-600 hover:ring-rose-200/80',
        className,
      ].join(' ')}
      aria-label={isFavorite ? removeLabel : addLabel}
      aria-pressed={isFavorite}
    >
      <Heart
        className={['h-4 w-4 transition-colors', isFavorite ? 'fill-current text-white' : ''].join(' ')}
        aria-hidden
      />
    </button>
  )
}

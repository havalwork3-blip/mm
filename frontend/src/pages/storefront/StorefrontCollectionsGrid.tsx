import {
  ArrowLeft,
  BadgePercent,
  Flame,
  Heart,
  PackageCheck,
  Sparkles,
} from 'lucide-react'

import type { StorefrontProductCollection } from '../../api/storefrontApi'
import { accentAlpha } from './storefrontTheme'

export type CollectionTile = {
  id: StorefrontProductCollection
  title: string
  hint: string
  icon: typeof Flame
  gradient: string
}

type Props = {
  accent: string
  tiles: CollectionTile[]
  viewAllLabel: string
  onSelectCollection: (id: StorefrontProductCollection) => void
  onViewAllProducts: () => void
}

export function StorefrontCollectionsGrid({
  accent,
  tiles,
  viewAllLabel,
  onSelectCollection,
  onViewAllProducts,
}: Props) {
  return (
    <div className="mt-8">
      <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => onSelectCollection(tile.id)}
              className="sf-collection-tile group relative overflow-hidden rounded-2xl p-4 text-start text-white shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]"
              style={{
                background: tile.gradient,
                boxShadow: `0 10px 28px ${accentAlpha(accent, 0.22)}`,
              }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm transition group-hover:bg-white/30">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <p className="mt-3 text-[15px] font-extrabold leading-tight">{tile.title}</p>
              <p className="mt-1 text-[11px] font-medium leading-snug text-white/85">{tile.hint}</p>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onViewAllProducts}
        className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-3xl py-4 text-[15px] font-extrabold text-white shadow-xl transition hover:brightness-105 active:scale-[0.99]"
        style={{
          background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
          boxShadow: `0 12px 36px ${accentAlpha(accent, 0.38)}`,
        }}
      >
        {viewAllLabel}
        <ArrowLeft className="h-5 w-5 rotate-180 rtl:rotate-0" aria-hidden />
      </button>
    </div>
  )
}

export const COLLECTION_ICONS = {
  bestsellers: Flame,
  new_arrivals: Sparkles,
  on_sale: BadgePercent,
  available_now: PackageCheck,
  favorites: Heart,
} as const

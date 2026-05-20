import type { PublicStorefrontCategory } from '../../api/storefrontApi'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
import { useLocale } from '../../context/LocaleContext'
import { accentAlpha } from './storefrontTheme'

const GRADIENTS = [
  'linear-gradient(135deg, #ff5a00 0%, #ff9340 50%, #ffb347 100%)',
  'linear-gradient(135deg, #0ea5e9, #38bdf8)',
  'linear-gradient(135deg, #8b5cf6, #c084fc)',
]

type Props = {
  category: PublicStorefrontCategory
  accent: string
  productCountLabel: string
}

export function CategoryHero({ category, accent, productCountLabel }: Props) {
  const { lang } = useLocale()
  const label = categoryDisplayName(category, lang)
  const img = resolveMediaUrl(
    category.image_url ?? category.products.find((p) => p.image_url)?.image_url ?? null,
  )
  const count = category.products.length
  const grad = GRADIENTS[category.id % GRADIENTS.length]

  return (
    <div className="sf-category-hero relative mx-4 mb-4 overflow-hidden rounded-3xl shadow-lg sm:mx-6 md:mx-8">
      <div className="relative aspect-[2.2/1] min-h-[140px] w-full sm:aspect-[2.8/1] sm:min-h-[160px]">
        {img ? (
          <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: grad }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{label}</h2>
          <p className="mt-1 text-sm text-white/90">
            {productCountLabel.replace('{n}', String(count))}
          </p>
        </div>
        <div
          className="absolute end-4 top-4 rounded-full px-3 py-1 text-xs font-bold text-white backdrop-blur-sm"
          style={{ backgroundColor: accentAlpha(accent, 0.85) }}
        >
          {label.charAt(0)}
        </div>
      </div>
    </div>
  )
}

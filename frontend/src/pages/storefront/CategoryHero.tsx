import type { PublicStorefrontCategory } from '../../api/storefrontApi'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
import { useLocale } from '../../context/LocaleContext'
import { accentAlpha, SF_INSET_X } from './storefrontTheme'

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
    <div className={`${SF_INSET_X} sf-category-hero relative mb-5 mt-2 overflow-hidden rounded-3xl sm:mt-3`}>
      <div
        className="sf-hero-frame relative aspect-[2.2/1] min-h-[150px] w-full sm:aspect-[2.6/1] sm:min-h-[170px]"
        style={{ boxShadow: `0 16px 40px ${accentAlpha(accent, 0.2)}` }}
      >
        {img ? (
          <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: grad }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-3xl">
            {label}
          </h2>
          <p className="mt-1.5 text-sm font-medium text-white/85">
            {productCountLabel.replace('{n}', String(count))}
          </p>
        </div>
      </div>
    </div>
  )
}

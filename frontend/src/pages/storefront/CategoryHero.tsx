import { useState } from 'react'
import { ImageIcon } from 'lucide-react'

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
  const img = resolveMediaUrl(category.image_url)
  const count = category.products.length
  const grad = GRADIENTS[category.id % GRADIENTS.length]
  const [imgFailed, setImgFailed] = useState(false)
  const showImg = Boolean(img) && !imgFailed

  return (
    <div className={`${SF_INSET_X} sf-category-hero relative mb-5 mt-2 overflow-hidden rounded-3xl sm:mt-3`}>
      <div
        className="sf-hero-frame relative aspect-[2.4/1] min-h-[168px] w-full sm:aspect-[2.8/1] sm:min-h-[200px] md:min-h-[220px]"
        style={{ boxShadow: `0 16px 40px ${accentAlpha(accent, 0.2)}` }}
      >
        {showImg ? (
          <img
            src={img!}
            alt={label}
            className="absolute inset-0 h-full w-full object-cover object-center"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: grad }}
          >
            <span className="text-5xl font-black text-white/30 sm:text-6xl">{label.charAt(0)}</span>
            {!img ? null : (
              <ImageIcon className="absolute h-10 w-10 text-white/40" aria-hidden />
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-md sm:text-3xl">
            {label}
          </h2>
          <p className="mt-1.5 text-sm font-medium text-white/90">
            {productCountLabel.replace('{n}', String(count))}
          </p>
        </div>
      </div>
    </div>
  )
}

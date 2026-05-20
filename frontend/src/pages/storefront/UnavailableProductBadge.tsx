import { Ban, PackageX } from 'lucide-react'

import type { PublicStorefrontProduct } from '../../api/storefrontApi'
import { unavailableLabel } from './productAvailability'

type Props = {
  product: PublicStorefrontProduct
  labels: { outOfStock: string; discontinued: string; unavailable: string }
  size?: 'sm' | 'md' | 'lg'
}

export function UnavailableProductBadge({ product, labels, size = 'sm' }: Props) {
  const text = unavailableLabel(product, labels)
  const Icon = product.unavailable_reason === 'discontinued' ? PackageX : Ban

  const sizeClass =
    size === 'lg'
      ? 'px-4 py-2 text-sm gap-2'
      : size === 'md'
        ? 'px-3 py-1.5 text-xs gap-1.5'
        : 'px-2 py-0.5 text-[10px] gap-1'

  return (
    <span className={`inline-flex items-center rounded-full bg-slate-900/85 font-bold text-white shadow-lg backdrop-blur-sm ${sizeClass}`}>
      <Icon className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} aria-hidden />
      {text}
    </span>
  )
}

export function UnavailableProductBanner({
  product,
  labels,
  hint,
}: Props & { hint: string }) {
  return (
    <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-4 text-center shadow-sm">
      <div className="mb-2 flex justify-center">
        <UnavailableProductBadge product={product} labels={labels} size="lg" />
      </div>
      <p className="text-sm leading-relaxed text-amber-900/90">{hint}</p>
    </div>
  )
}

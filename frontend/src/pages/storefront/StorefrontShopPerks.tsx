import { Headphones, MousePointerClick, Truck } from 'lucide-react'

import { accentAlpha } from './storefrontTheme'

type Props = {
  accent: string
  deliveryFast: string
  orderEasy: string
  support: string
}

export function StorefrontShopPerks({ accent, deliveryFast, orderEasy, support }: Props) {
  const items = [
    { icon: Truck, label: deliveryFast },
    { icon: MousePointerClick, label: orderEasy },
    { icon: Headphones, label: support },
  ]

  return (
    <div className="sf-perks mb-8 grid grid-cols-3 gap-2 sm:gap-3">
      {items.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="sf-perk-card flex flex-col items-center gap-2 rounded-2xl px-2 py-3.5 text-center shadow-sm ring-1 ring-slate-200/60 sm:px-3 sm:py-4"
          style={{ backgroundColor: accentAlpha(accent, 0.06) }}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10"
            style={{ backgroundColor: accentAlpha(accent, 0.14), color: accent }}
          >
            <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
          </span>
          <p className="text-[10px] font-bold leading-snug text-slate-700 sm:text-[11px]">{label}</p>
        </div>
      ))}
    </div>
  )
}

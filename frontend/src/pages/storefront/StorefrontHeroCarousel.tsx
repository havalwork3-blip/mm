import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type { PublicStorefrontBanner } from '../../api/storefrontApi'
import { resolveMediaUrl } from '../../lib/api'
import { accentAlpha, SF_INSET_X } from './storefrontTheme'

type Props = {
  banners: PublicStorefrontBanner[]
  accent: string
  rotateSeconds: number
  fallbackTitle: string
  fallbackSubtitle: string
  onCategoryClick?: (categoryId: number) => void
}

export function StorefrontHeroCarousel({
  banners,
  accent,
  rotateSeconds,
  fallbackTitle,
  fallbackSubtitle,
  onCategoryClick,
}: Props) {
  const slides = banners.filter((b) => b.image_url || b.title || b.subtitle)
  const [index, setIndex] = useState(0)
  const count = slides.length

  const next = useCallback(() => {
    if (count <= 1) return
    setIndex((i) => (i + 1) % count)
  }, [count])

  const prev = useCallback(() => {
    if (count <= 1) return
    setIndex((i) => (i - 1 + count) % count)
  }, [count])

  useEffect(() => {
    setIndex(0)
  }, [count])

  useEffect(() => {
    if (count <= 1) return
    const ms = Math.max(2, Math.min(60, rotateSeconds)) * 1000
    const id = window.setInterval(next, ms)
    return () => window.clearInterval(id)
  }, [count, rotateSeconds, next])

  if (count === 0) {
    return (
      <div
        className={`${SF_INSET_X} mt-4 overflow-hidden rounded-2xl p-4 text-white sm:mt-5 sm:rounded-3xl sm:p-6`}
        style={{
          background: `linear-gradient(120deg, ${accent} 0%, ${accent}dd 50%, #ff9340 100%)`,
          boxShadow: `0 10px 28px ${accentAlpha(accent, 0.28)}`,
        }}
      >
        <p className="text-base font-bold leading-snug sm:text-lg md:text-xl">{fallbackTitle}</p>
        {fallbackSubtitle ? (
          <p className="mt-1 text-xs text-white/85 sm:text-sm">{fallbackSubtitle}</p>
        ) : null}
      </div>
    )
  }

  const slide = slides[index]
  const img = resolveMediaUrl(slide.image_url)

  function handleClick() {
    if (slide.link_type === 'url' && slide.link_url) {
      window.open(slide.link_url, '_blank', 'noopener,noreferrer')
      return
    }
    if (slide.link_type === 'category' && slide.category_id != null) {
      onCategoryClick?.(slide.category_id)
    }
  }

  const clickable = slide.link_type === 'url' || slide.link_type === 'category'

  return (
    <div className={`relative ${SF_INSET_X} mt-4 sm:mt-5`}>
      <div
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? handleClick : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleClick()
                }
              }
            : undefined
        }
        className={[
          'relative aspect-[2/1] w-full max-h-[min(50vh,280px)] overflow-hidden rounded-2xl bg-slate-200 shadow-lg sm:aspect-[2.4/1] sm:max-h-[min(45vh,360px)] sm:rounded-3xl md:aspect-[2.8/1] md:max-h-[400px] lg:max-h-[420px]',
          clickable ? 'cursor-pointer' : '',
        ].join(' ')}
        style={{ boxShadow: `0 10px 28px ${accentAlpha(accent, 0.2)}` }}
      >
        {img ? (
          <img src={img} alt={slide.title || ''} className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center p-4 text-white"
            style={{
              background: `linear-gradient(120deg, ${accent}, ${accent}cc)`,
            }}
          >
            <div className="text-center">
              {slide.title ? <p className="text-lg font-bold">{slide.title}</p> : null}
              {slide.subtitle ? <p className="mt-1 text-sm text-white/90">{slide.subtitle}</p> : null}
            </div>
          </div>
        )}
        {(slide.title || slide.subtitle) && img ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-3 pt-8">
            {slide.title ? <p className="text-sm font-bold text-white">{slide.title}</p> : null}
            {slide.subtitle ? (
              <p className="text-xs text-white/90">{slide.subtitle}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute start-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute end-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <div className="mt-2 flex justify-center gap-1.5">
            {slides.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setIndex(i)}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index ? 18 : 6,
                  backgroundColor: i === index ? accent : accentAlpha(accent, 0.25),
                }}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

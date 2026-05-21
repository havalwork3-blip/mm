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

function SlideContent({
  slide,
  accent,
  img,
}: {
  slide: PublicStorefrontBanner
  accent: string
  img: string | null
}) {
  if (img) {
    return (
      <>
        <img src={img} alt={slide.title || ''} className="sf-hero-img h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/5" />
        {(slide.title || slide.subtitle) ? (
          <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-12">
            {slide.title ? (
              <p className="text-base font-extrabold text-white drop-shadow-sm sm:text-lg">{slide.title}</p>
            ) : null}
            {slide.subtitle ? (
              <p className="mt-0.5 text-xs text-white/90 sm:text-sm">{slide.subtitle}</p>
            ) : null}
          </div>
        ) : null}
      </>
    )
  }
  return (
    <div
      className="flex h-full w-full items-center justify-center p-6 text-white"
      style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)` }}
    >
      <div className="text-center">
        {slide.title ? <p className="text-xl font-extrabold">{slide.title}</p> : null}
        {slide.subtitle ? <p className="mt-1 text-sm text-white/90">{slide.subtitle}</p> : null}
      </div>
    </div>
  )
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
        className={`sf-hero-frame ${SF_INSET_X} mt-4 overflow-hidden rounded-3xl p-6 text-white sm:mt-5 sm:p-8 lg:mt-6 lg:rounded-2xl lg:p-10`}
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 40%, #1a1a2e 100%)`,
          boxShadow: `0 16px 48px ${accentAlpha(accent, 0.3)}`,
        }}
      >
        <p className="text-lg font-extrabold leading-snug sm:text-xl">{fallbackTitle}</p>
        {fallbackSubtitle ? (
          <p className="mt-2 text-sm text-white/85">{fallbackSubtitle}</p>
        ) : null}
      </div>
    )
  }

  function handleClick(slide: PublicStorefrontBanner) {
    if (slide.link_type === 'url' && slide.link_url) {
      window.open(slide.link_url, '_blank', 'noopener,noreferrer')
      return
    }
    if (slide.link_type === 'category' && slide.category_id != null) {
      onCategoryClick?.(slide.category_id)
    }
  }

  return (
    <div className={`relative ${SF_INSET_X} mt-4 sm:mt-5 lg:mt-6`}>
      <div className="sf-hero-frame relative aspect-[2.1/1] w-full max-h-[min(48vh,300px)] overflow-hidden rounded-3xl bg-slate-200 sm:aspect-[2.5/1] sm:max-h-[min(42vh,380px)] md:max-h-[400px] lg:aspect-[3/1] lg:max-h-[420px] lg:rounded-2xl">
        {slides.map((slide, i) => {
          const img = resolveMediaUrl(slide.image_url)
          const clickable = slide.link_type === 'url' || slide.link_type === 'category'
          const isActive = i === index
          return (
            <div
              key={slide.id}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable && isActive ? 0 : undefined}
              onClick={clickable && isActive ? () => handleClick(slide) : undefined}
              onKeyDown={
                clickable && isActive
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleClick(slide)
                      }
                    }
                  : undefined
              }
              className={[
                'sf-hero-slide absolute inset-0 transition-opacity duration-700 ease-in-out',
                isActive ? 'sf-hero-slide-active z-10 opacity-100' : 'z-0 opacity-0',
                clickable && isActive ? 'cursor-pointer' : 'pointer-events-none',
              ].join(' ')}
              aria-hidden={!isActive}
            >
              <SlideContent slide={slide} accent={accent} img={img} />
            </div>
          )
        })}
      </div>

      {count > 1 ? (
        <div className="mt-3 flex justify-center gap-2">
          {slides.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setIndex(i)}
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: i === index ? 24 : 8,
                backgroundColor: i === index ? accent : accentAlpha(accent, 0.3),
              }}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

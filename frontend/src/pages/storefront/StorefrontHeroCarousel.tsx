import { useCallback, useEffect, useRef, useState } from 'react'

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

const SWIPE_THRESHOLD_RATIO = 0.16
const EDGE_RESISTANCE = 0.32

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
    const hasCaption = Boolean(slide.title || slide.subtitle)
    return (
      <div className="sf-hero-media flex h-full w-full items-center justify-center bg-slate-900">
        <img
          src={img}
          alt={slide.title || ''}
          className="sf-hero-img h-full w-full object-contain object-center"
          draggable={false}
          decoding="async"
        />
        {hasCaption ? (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-12">
              {slide.title ? (
                <p className="text-base font-extrabold text-white drop-shadow-sm sm:text-lg">{slide.title}</p>
              ) : null}
              {slide.subtitle ? (
                <p className="mt-0.5 text-xs text-white/90 sm:text-sm">{slide.subtitle}</p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
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

function isRtl(): boolean {
  return document.documentElement.dir === 'rtl'
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
  const [dragPx, setDragPx] = useState(0)
  const [snap, setSnap] = useState(true)
  const [autoPaused, setAutoPaused] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ active: false, startX: 0, startIndex: 0, moved: false })
  const count = slides.length

  const pauseAuto = useCallback(() => {
    setAutoPaused(true)
  }, [])

  const next = useCallback(() => {
    if (count <= 1) return
    setIndex((i) => (i + 1) % count)
  }, [count])

  useEffect(() => {
    setIndex(0)
    setDragPx(0)
  }, [count])

  useEffect(() => {
    if (count <= 1 || autoPaused) return
    const ms = Math.max(2, Math.min(60, rotateSeconds)) * 1000
    const id = window.setInterval(next, ms)
    return () => window.clearInterval(id)
  }, [count, rotateSeconds, next, autoPaused])

  useEffect(() => {
    if (!autoPaused) return
    const id = window.setTimeout(() => setAutoPaused(false), 8000)
    return () => window.clearTimeout(id)
  }, [autoPaused, index])

  function resolveSwipeTarget(startIndex: number, deltaX: number, width: number): number {
    const threshold = width * SWIPE_THRESHOLD_RATIO
    if (Math.abs(deltaX) < threshold) return startIndex
    const rtl = isRtl()
    const towardNext = rtl ? deltaX > 0 : deltaX < 0
    if (towardNext) return Math.min(count - 1, startIndex + 1)
    return Math.max(0, startIndex - 1)
  }

  function clampDrag(startIndex: number, deltaX: number): number {
    if (startIndex === 0 && deltaX > 0) return deltaX * EDGE_RESISTANCE
    if (startIndex === count - 1 && deltaX < 0) return deltaX * EDGE_RESISTANCE
    return deltaX
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (count <= 1) return
    frameRef.current?.setPointerCapture(e.pointerId)
    dragRef.current = { active: true, startX: e.clientX, startIndex: index, moved: false }
    setSnap(false)
    pauseAuto()
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return
    const raw = e.clientX - dragRef.current.startX
    if (Math.abs(raw) > 6) dragRef.current.moved = true
    setDragPx(clampDrag(dragRef.current.startIndex, raw))
  }

  function finishPointer(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return
    if (frameRef.current?.hasPointerCapture(e.pointerId)) {
      frameRef.current.releasePointerCapture(e.pointerId)
    }
    const width = frameRef.current?.offsetWidth ?? 1
    const deltaX = e.clientX - dragRef.current.startX
    const target = resolveSwipeTarget(dragRef.current.startIndex, deltaX, width)
    setIndex(target)
    setDragPx(0)
    setSnap(true)
    dragRef.current.active = false
    pauseAuto()
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    finishPointer(e)
  }

  function onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    finishPointer(e)
  }

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
    if (dragRef.current.moved) return
    if (slide.link_type === 'url' && slide.link_url) {
      window.open(slide.link_url, '_blank', 'noopener,noreferrer')
      return
    }
    if (slide.link_type === 'category' && slide.category_id != null) {
      onCategoryClick?.(slide.category_id)
    }
  }

  const trackTransform = `translateX(calc(${-index * 100}% + ${dragPx}px))`

  return (
    <div className={`relative ${SF_INSET_X} mt-3 sm:mt-4 lg:mt-5`}>
      <div
        ref={frameRef}
        className={[
          'sf-hero-frame sf-hero-swipe relative aspect-[2.15/1] w-full overflow-hidden rounded-2xl bg-slate-900 sm:aspect-[2.35/1] sm:rounded-3xl md:aspect-[2.5/1] lg:aspect-[2.6/1] lg:rounded-2xl xl:aspect-[2.75/1]',
          count > 1 ? 'sf-hero-swipe-active cursor-grab active:cursor-grabbing' : '',
        ].join(' ')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{ touchAction: 'pan-y' }}
        aria-roledescription="carousel"
        aria-label={slides[index]?.title || fallbackTitle}
      >
        <div
          className={['sf-hero-track flex h-full w-full', snap ? 'sf-hero-track-snap' : ''].join(' ')}
          style={{ transform: trackTransform }}
        >
          {slides.map((slide) => {
            const img = resolveMediaUrl(slide.image_url)
            const clickable = slide.link_type === 'url' || slide.link_type === 'category'
            return (
              <div
                key={slide.id}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => handleClick(slide) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleClick(slide)
                        }
                      }
                    : undefined
                }
                className={[
                  'sf-hero-slide relative h-full w-full shrink-0 grow-0 basis-full select-none',
                  clickable ? 'cursor-pointer' : '',
                ].join(' ')}
              >
                <SlideContent slide={slide} accent={accent} img={img} />
              </div>
            )
          })}
        </div>
      </div>

      {count > 1 ? (
        <div
          className="mt-3 flex justify-center gap-2"
          aria-hidden
        >
          {slides.map((b, i) => (
            <span
              key={b.id}
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: i === index ? 24 : 8,
                backgroundColor: i === index ? accent : accentAlpha(accent, 0.3),
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

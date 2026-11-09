import { useEffect, useRef } from 'react'
import { useTheme } from '../../context/ThemeContext'
import DotGrid from './DotGrid'

/** Scroll distance (px) over which the blur grows from "top only clear" to "fully blurred". */
const BLUR_SCROLL_RANGE = 450
/** Max blur strength (px). */
const MAX_BLUR = 10
/** Portion of the viewport (top) that stays sharp when the page is at the very top. */
const CLEAR_TOP_PERCENT = 40

type AppBackgroundProps = {
  /** Force dark dot colors regardless of the app theme (e.g. always-dark CMS screens). */
  dark?: boolean
  /** Override the solid background color behind the dots. */
  bgColor?: string
}

/**
 * Fixed, full-screen animated dot-grid background for the whole system.
 * - Sits behind all content (negative z-index, no pointer events).
 * - The top of the screen is sharp; a blur fades in toward the bottom,
 *   and as the user scrolls down the blur gradually spreads over the whole background.
 */
export function AppBackground({ dark: forceDark, bgColor }: AppBackgroundProps = {}) {
  const { resolvedMode } = useTheme()
  const blurRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = blurRef.current
    if (!el) return
    let raf = 0
    const apply = () => {
      raf = 0
      const p = Math.min(1, Math.max(0, window.scrollY / BLUR_SCROLL_RANGE))
      // Clear zone at the top shrinks as you scroll; blur ramps in below it.
      const clearStop = CLEAR_TOP_PERCENT * (1 - p)
      const fullStop = clearStop + (100 - clearStop) * (1 - p * 0.75)
      el.style.setProperty('--mm-bg-clear', `${clearStop}%`)
      el.style.setProperty('--mm-bg-full', `${fullStop}%`)
      el.style.setProperty('--mm-bg-blur', `${(MAX_BLUR * (0.5 + p * 0.5)).toFixed(2)}px`)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply)
    }
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const dark = forceDark ?? resolvedMode === 'dark'

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 bg-[var(--app-bg-color,#f1f5f9)] print:hidden"
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      <DotGrid
        baseColor={dark ? '#334155' : '#cbd5e1'}
        activeColor={dark ? '#e2e8f0' : '#475569'}
        shape="circle"
        dotSize={4}
        gap={18}
        proximity={110}
        strength={0.8}
        bounce={0.25}
        tension={0.4}
        returnDuration={0.95}
        shockRadius={300}
        shockStrength={4}
        swell={0.8}
        stretch={0.1}
        glow={0.5}
        fade={0}
        intro
      />
      <div ref={blurRef} className="mm-bg-blur" />
    </div>
  )
}

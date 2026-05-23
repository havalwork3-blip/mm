import type { CSSProperties, ReactNode } from 'react'

import {
  sectionPanelGradient,
  sectionPanelRgb,
  sectionPanelShadow,
  type StorefrontSectionKey,
} from './storefrontSectionTheme'

export type StorefrontSectionAppearance = 'classic' | 'blend'

type Props = {
  sectionKey: StorefrontSectionKey
  title: ReactNode
  subtitle?: ReactNode
  headerAside?: ReactNode
  children: ReactNode
  className?: string
  /** classic = rounded box + shadow (default). blend = flat bottom, no shadow. */
  appearance?: StorefrontSectionAppearance
  /** Override panel background (e.g. merchant category colors). */
  backgroundGradient?: string
}

export function StorefrontSectionPanel({
  sectionKey,
  title,
  subtitle,
  headerAside,
  children,
  className = '',
  appearance = 'blend',
  backgroundGradient,
}: Props) {
  const gradient = backgroundGradient ?? sectionPanelGradient(sectionKey)
  const isClassic = appearance === 'classic'
  const panelStyle = {
    background: gradient,
    '--sf-section-rgb': sectionPanelRgb(sectionKey),
    ...(isClassic ? { boxShadow: sectionPanelShadow(sectionKey) } : {}),
  } as CSSProperties

  return (
    <section className={`sf-section-panel-wrap ${className}`.trim()}>
      <div
        className={[
          'sf-section-panel relative overflow-hidden',
          isClassic
            ? 'sf-section-panel--classic rounded-[1.35rem] lg:rounded-[1.5rem]'
            : 'rounded-t-[1.35rem] lg:rounded-t-[1.5rem]',
        ].join(' ')}
        style={panelStyle}
      >
        <span className="sf-section-panel-shine pointer-events-none absolute inset-0" aria-hidden />

        <div className="relative px-3.5 pb-4 pt-3.5 sm:px-5 sm:pb-5 sm:pt-4 lg:px-6 lg:pb-6 lg:pt-5">
          <div className="sf-section-panel-header mb-3.5 flex items-start gap-2.5 sm:mb-4">
            <span
              className="mt-0.5 h-6 w-1 shrink-0 rounded-full bg-white/95 shadow-sm lg:h-7"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <h2 className="sf-heading text-base font-extrabold tracking-tight text-white drop-shadow-md sm:text-lg lg:text-xl">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-0.5 text-[11px] font-medium text-white/90 drop-shadow-sm sm:text-xs lg:text-sm">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {headerAside ? <div className="shrink-0 pt-0.5">{headerAside}</div> : null}
          </div>

          <div className="sf-section-panel-body">{children}</div>
        </div>
      </div>
    </section>
  )
}

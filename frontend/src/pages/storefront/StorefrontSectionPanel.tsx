import type { CSSProperties, ReactNode } from 'react'

import {
  sectionIconTint,
  sectionPanelGradient,
  sectionPanelRgb,
  sectionPanelShadow,
  type StorefrontSectionKey,
} from './storefrontSectionTheme'

export type StorefrontSectionAppearance = 'modern' | 'classic' | 'blend'

type Props = {
  sectionKey: StorefrontSectionKey
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  headerAside?: ReactNode
  children: ReactNode
  className?: string
  /** modern = clean white card (default). classic/blend = legacy gradient panel. */
  appearance?: StorefrontSectionAppearance
  /** Override panel background (e.g. merchant category colors). Forces classic style. */
  backgroundGradient?: string
}

export function StorefrontSectionPanel({
  sectionKey,
  title,
  subtitle,
  icon,
  headerAside,
  children,
  className = '',
  appearance = 'modern',
  backgroundGradient,
}: Props) {
  const useLegacy = appearance === 'classic' || appearance === 'blend' || Boolean(backgroundGradient)
  const tint = sectionIconTint(sectionKey)

  if (useLegacy) {
    const gradient = backgroundGradient ?? sectionPanelGradient(sectionKey)
    const isClassic = appearance === 'classic' || Boolean(backgroundGradient)
    const panelStyle = {
      background: gradient,
      '--sf-section-rgb': sectionPanelRgb(sectionKey),
      ...(isClassic ? { boxShadow: sectionPanelShadow(sectionKey) } : {}),
    } as CSSProperties

    return (
      <section className={`sf-section-panel-wrap ${className}`.trim()}>
        <div
          className={[
            'sf-section-panel sf-section-panel--legacy relative overflow-hidden',
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

  return (
    <section className={`sf-section-panel-wrap ${className}`.trim()}>
      <div className="sf-section-panel sf-section-panel--modern overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.04)]">
        <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
          <div className="sf-section-panel-header mb-4 flex items-center gap-3">
            {icon ? (
              <span
                className="sf-section-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 [&>svg]:h-[18px] [&>svg]:w-[18px] sm:[&>svg]:h-5 sm:[&>svg]:w-5"
                style={{ backgroundColor: tint.bg, color: tint.fg }}
                aria-hidden
              >
                {icon}
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 className="sf-heading text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-sm">{subtitle}</p>
              ) : null}
            </div>
            {headerAside ? <div className="shrink-0">{headerAside}</div> : null}
          </div>

          <div className="sf-section-panel-body">{children}</div>
        </div>
      </div>
    </section>
  )
}

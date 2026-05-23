import type { CSSProperties, ReactNode } from 'react'

import { sectionPanelGradient, sectionPanelRgb, type StorefrontSectionKey } from './storefrontSectionTheme'

type Props = {
  sectionKey: StorefrontSectionKey
  title: ReactNode
  subtitle?: ReactNode
  headerAside?: ReactNode
  children: ReactNode
  className?: string
}

export function StorefrontSectionPanel({
  sectionKey,
  title,
  subtitle,
  headerAside,
  children,
  className = '',
}: Props) {
  const gradient = sectionPanelGradient(sectionKey)
  const panelStyle = {
    background: gradient,
    '--sf-section-rgb': sectionPanelRgb(sectionKey),
  } as CSSProperties

  return (
    <section className={`sf-section-panel-wrap ${className}`.trim()}>
      <div
        className="sf-section-panel relative overflow-hidden rounded-t-[1.35rem] lg:rounded-t-[1.5rem]"
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

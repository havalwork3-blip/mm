import type { ReactNode } from 'react'

import { sectionPanelGradient, sectionPanelShadow, type StorefrontSectionKey } from './storefrontSectionTheme'

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
  const shadow = sectionPanelShadow(sectionKey)

  return (
    <section className={`sf-section-panel-wrap ${className}`.trim()}>
      <div
        className="sf-section-panel relative overflow-hidden rounded-[1.35rem] ring-1 ring-black/[0.04] lg:rounded-[1.5rem]"
        style={{ background: gradient, boxShadow: shadow }}
      >
        <span className="sf-section-panel-shine pointer-events-none absolute inset-0" aria-hidden />
        <span className="sf-section-panel-fade pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/70 to-transparent sm:h-28" aria-hidden />

        <div className="relative px-3 pb-3.5 pt-3.5 sm:px-4 sm:pb-4 sm:pt-4 lg:px-5 lg:pb-5 lg:pt-5">
          <div className="sf-section-panel-header mb-3 flex items-start gap-2.5 lg:mb-4">
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

          {children}
        </div>
      </div>
    </section>
  )
}

import { ChevronRight, ExternalLink, Ghost, Phone, Sparkles } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { useLocale } from '../context/LocaleContext'
import { publicApiJson, resolveMediaUrl } from '../lib/api'
import type { PublicQrCustomLink, PublicQrLandingResponse, PublicQrPresetLink } from '../types/api'

const sans = { fontFamily: "'Outfit', system-ui, sans-serif" } as const

function BrandGlyph({ id }: { id: string }) {
  const common = 'h-[18px] w-[18px] shrink-0 opacity-[0.92]'
  switch (id) {
    case 'instagram':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      )
    case 'facebook':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      )
    case 'youtube':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      )
    case 'whatsapp':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      )
    case 'telegram':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 1.332-.533 2.404-.763 3.276-.736.428.022 1.015.241 1.465.593z" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12.525.02c1.31-.02 2.61-.01 3.918-.02.08 1.53.63 3.09 1.75 4.22 1.12 1.12 2.7 1.68 4.24 1.74v3.69c-1.88-.05-3.67-.67-5.24-1.68v7.69c0 4.31-3.49 7.8-7.8 7.8-1.63 0-3.15-.5-4.41-1.35-.03-.02-.06-.04-.09-.06-.95-.66-1.76-1.52-2.38-2.51-1.14-1.79-1.35-3.96-.87-5.97.48-2.01 1.74-3.77 3.52-4.89 1.78-1.12 3.91-1.47 5.97-1.05v4.13c-1.08-.33-2.26-.22-3.25.31-.99.53-1.73 1.42-2.07 2.47-.34 1.05-.22 2.19.33 3.14.55.95 1.44 1.65 2.49 1.94 1.05.29 2.18.14 3.11-.41.93-.55 1.58-1.44 1.81-2.49.05-.24.08-.49.08-.74V0h2.02z" />
        </svg>
      )
    case 'snapchat':
      return <Ghost className={`${common} fill-none stroke-current`} strokeWidth={2} aria-hidden />
    case 'x':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      )
    case 'website':
      return <ExternalLink className={common} strokeWidth={2} aria-hidden />
    default:
      return <Sparkles className={common} aria-hidden />
  }
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : `tel:${phone.trim()}`
}

/** One calm style for every preset social row — readability first. */
function presetRowClass(): string {
  return [
    'group flex min-h-[3.25rem] items-center gap-3 rounded-2xl border px-4 py-3',
    'border-white/[0.07] bg-white/[0.03] text-[#f4f0ea]',
    'transition-colors duration-200',
    'hover:border-white/12 hover:bg-white/[0.06]',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  ].join(' ')
}

export function QrCodeSocialLandingPage() {
  const { t } = useLocale()
  const [data, setData] = useState<PublicQrLandingResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void publicApiJson<PublicQrLandingResponse>('/api/public/qr-landing/')
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : t('qrLanding.loadError'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const accent = data?.accent_color?.trim() || '#c9a962'
  const logoSrc = resolveMediaUrl(data?.logo_url ?? null)
  const [heroLogoFailed, setHeroLogoFailed] = useState(false)

  useEffect(() => {
    setHeroLogoFailed(false)
  }, [logoSrc])

  const presets = data?.preset_links ?? []
  const customs = data?.custom_links ?? []
  const phone = (data?.phone ?? '').trim()
  const hasAnyLink = presets.length + customs.length > 0

  const rootStyle = {
    '--page-accent': accent,
    fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  } as CSSProperties & { '--page-accent': string }

  return (
    <div
      className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#090807] text-[#f5f1ea]"
      style={rootStyle}
    >
      {/* Quiet backdrop: one soft glow + barely-there vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(80% 55% at 50% -10%, color-mix(in srgb, var(--page-accent) 22%, transparent), transparent 52%),
            radial-gradient(120% 90% at 50% 100%, rgba(0,0,0,0.55), transparent 45%)
          `,
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/40 to-transparent" />

      <div className="relative z-10 mx-auto flex w-full max-w-[420px] flex-1 flex-col px-5 pb-14 pt-12 sm:px-8 sm:pt-16">
        {loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-white/[0.06]"
              style={{ borderTopColor: 'color-mix(in srgb, var(--page-accent) 75%, white)' }}
              aria-hidden
            />
            <p className="text-[13px] font-medium tracking-[0.2em] text-white/40 uppercase" style={sans}>
              {t('qrLanding.loading')}
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-1 flex-col items-center justify-center px-2 text-center">
            <p
              className="max-w-sm rounded-2xl border border-red-400/20 bg-red-950/35 px-5 py-4 text-[14px] leading-relaxed text-red-100/90"
              style={sans}
            >
              {error}
            </p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Hero — airy, no heavy frames */}
            <header className="flex flex-col items-center text-center">
              <div className="relative mb-7">
                <div
                  className="absolute inset-0 scale-110 rounded-full blur-3xl opacity-40"
                  style={{
                    background: `radial-gradient(circle, color-mix(in srgb, ${accent} 45%, transparent), transparent 68%)`,
                  }}
                  aria-hidden
                />
                <div
                  className="relative mx-auto flex h-[108px] w-[108px] items-center justify-center rounded-full bg-[#12100e]"
                  style={{
                    boxShadow: `
                      inset 0 1px 0 rgba(255,255,255,0.06),
                      0 0 0 1px color-mix(in srgb, ${accent} 35%, rgba(255,255,255,0.06)),
                      0 20px 50px -24px rgba(0,0,0,0.75)
                    `,
                  }}
                >
                  {logoSrc && !heroLogoFailed ? (
                    <img
                      src={logoSrc}
                      alt=""
                      className="h-[76%] w-[76%] rounded-full object-cover"
                      onError={() => setHeroLogoFailed(true)}
                    />
                  ) : (
                    <Sparkles
                      className="h-11 w-11 text-[color-mix(in_srgb,var(--page-accent)_88%,white)]"
                      strokeWidth={1.15}
                      aria-hidden
                    />
                  )}
                </div>
              </div>

              <h1 className="max-w-[18ch] text-balance text-[2.125rem] font-semibold leading-[1.12] tracking-tight text-[#fffcf7] sm:text-[2.375rem]">
                {data.headline}
              </h1>

              {data.tagline ? (
                <p
                  className="mx-auto mt-4 max-w-[28ch] text-pretty text-[15px] font-light leading-relaxed text-white/50 sm:text-[16px]"
                  style={sans}
                >
                  {data.tagline}
                </p>
              ) : (
                <p className="mx-auto mt-5 text-[11px] font-medium tracking-[0.28em] text-white/30 uppercase" style={sans}>
                  {t('qrLanding.luxTag')}
                </p>
              )}

              {phone ? (
                <a
                  href={telHref(phone)}
                  className="mx-auto mt-8 inline-flex items-center gap-2.5 rounded-full border border-white/[0.09] bg-white/[0.04] px-4 py-2 text-[14px] text-white/88 transition hover:bg-white/[0.07]"
                  style={{
                    ...sans,
                    borderColor: `color-mix(in srgb, ${accent} 28%, rgba(255,255,255,0.1))`,
                  }}
                >
                  <Phone className="h-4 w-4 shrink-0 opacity-80" style={{ color: accent }} aria-hidden />
                  <span dir="ltr">{phone}</span>
                </a>
              ) : null}
            </header>

            {/* Links — preset: minimal unified chips; custom: keep brand bg from API */}
            <nav className="mt-12 w-full" aria-label={t('qrLanding.socialNav')} style={sans}>
              {!hasAnyLink ? (
                <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-10 text-center text-[14px] text-white/40">
                  {t('qrLanding.noLinks')}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {presets.map((link: PublicQrPresetLink) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={presetRowClass()}
                      style={
                        {
                          outlineColor: `color-mix(in srgb, ${accent} 55%, transparent)`,
                        } as CSSProperties
                      }
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white"
                        style={{ color: `color-mix(in srgb, ${accent} 92%, white)` }}
                      >
                        <BrandGlyph id={link.id} />
                      </span>
                      <span className="min-w-0 flex-1 text-start text-[15px] font-medium tracking-tight text-[#faf7f2]">
                        {link.label}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/35 transition group-hover:text-white/55" aria-hidden />
                    </a>
                  ))}

                  {customs.length > 0 && presets.length > 0 ? (
                    <p className="py-3 text-center text-[10px] font-medium tracking-[0.35em] text-white/25 uppercase">
                      {t('qrLanding.moreLinks')}
                    </p>
                  ) : null}

                  {customs.map((link: PublicQrCustomLink) => {
                    const bg = link.bg_color?.trim() || '#151311'
                    const customLogo = resolveMediaUrl(link.logo_url)
                    return (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex min-h-[3.35rem] items-center gap-3 rounded-2xl border border-white/[0.08] px-4 py-3 transition hover:border-white/[0.14]"
                        style={{
                          backgroundColor: bg,
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        }}
                      >
                        {customLogo ? (
                          <img
                            src={customLogo}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                          />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/25 ring-1 ring-white/10">
                            <Sparkles className="h-4 w-4 text-white/45" aria-hidden />
                          </span>
                        )}
                        <span className="min-w-0 flex-1 text-start text-[15px] font-medium tracking-tight text-white/[0.94]">
                          {link.label}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-white/35 group-hover:text-white/55" aria-hidden />
                      </a>
                    )
                  })}
                </div>
              )}
            </nav>

            
          </>
        )}
      </div>
    </div>
  )
}

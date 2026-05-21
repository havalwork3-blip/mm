import { ExternalLink, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'

import { resolveMediaUrl } from '../../lib/api'
import { useLocale } from '../../context/LocaleContext'
import { useStorefrontShop } from './StorefrontShopContext'
import { storefrontStrings } from './storefrontStrings'
import { resolveAccent, SF_MAIN } from './storefrontTheme'

function InfoShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={`${SF_MAIN} py-6`}>
      <h1 className="text-xl font-extrabold text-slate-900">{title}</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600">{children}</div>
    </div>
  )
}

export function StorefrontContactPage() {
  const { lang } = useLocale()
  const s = storefrontStrings(lang)
  const { appearance } = useStorefrontShop()
  const accent = resolveAccent(appearance.accent_color)

  const rows = [
    { icon: Phone, label: s.customerPhone, value: appearance.contact_phone, href: appearance.contact_phone ? `tel:${appearance.contact_phone}` : null },
    {
      icon: MessageCircle,
      label: 'WhatsApp',
      value: appearance.contact_whatsapp,
      href: appearance.contact_whatsapp
        ? `https://wa.me/${appearance.contact_whatsapp.replace(/\D/g, '')}`
        : null,
    },
    {
      icon: Mail,
      label: s.customerName,
      value: appearance.contact_email,
      href: appearance.contact_email ? `mailto:${appearance.contact_email}` : null,
    },
  ].filter((r) => r.value)

  return (
    <InfoShell title={s.contactUs}>
      {rows.length === 0 ? (
        <p className="text-slate-500">{s.infoEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.label}>
              {row.href ? (
                <a
                  href={row.href}
                  className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 font-semibold text-slate-800 shadow-sm transition hover:border-slate-200"
                  style={{ color: accent }}
                  target={row.href.startsWith('http') ? '_blank' : undefined}
                  rel="noreferrer"
                >
                  <row.icon className="h-5 w-5 shrink-0" />
                  <span>{row.value}</span>
                </a>
              ) : (
                <span className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                  <row.icon className="h-5 w-5 text-slate-400" />
                  {row.value}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </InfoShell>
  )
}

export function StorefrontAboutPage() {
  const { lang } = useLocale()
  const s = storefrontStrings(lang)
  const { appearance } = useStorefrontShop()
  const title = appearance.about_title || s.aboutUs
  const body = appearance.about_body

  return (
    <InfoShell title={title}>
      {body ? (
        <div className="whitespace-pre-wrap rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          {body}
        </div>
      ) : (
        <p className="text-slate-500">{s.infoEmpty}</p>
      )}
    </InfoShell>
  )
}

export function StorefrontFaqPage() {
  const { lang } = useLocale()
  const s = storefrontStrings(lang)
  const { appearance } = useStorefrontShop()
  const items = appearance.faq_items ?? []

  return (
    <InfoShell title={s.faq}>
      {items.length === 0 ? (
        <p className="text-slate-500">{s.infoEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li
              key={`${i}-${item.question}`}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <p className="font-bold text-slate-900">{item.question}</p>
              {item.answer ? (
                <p className="mt-2 whitespace-pre-wrap text-slate-600">{item.answer}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </InfoShell>
  )
}

export function StorefrontLocationPage() {
  const { lang } = useLocale()
  const s = storefrontStrings(lang)
  const { appearance, shopName } = useStorefrontShop()
  const img = resolveMediaUrl(appearance.location_image_url ?? null)

  return (
    <InfoShell title={s.shopLocation}>
      <p className="text-base font-bold text-slate-900">{shopName}</p>
      {appearance.shop_address ? (
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          {appearance.shop_address}
        </p>
      ) : null}
      {img ? (
        <img
          src={img}
          alt=""
          className="w-full max-w-lg rounded-2xl border border-slate-100 object-cover shadow-sm"
        />
      ) : null}
      {appearance.location_url ? (
        <a
          href={appearance.location_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
        >
          <ExternalLink className="h-4 w-4" />
          {s.openMap}
        </a>
      ) : !appearance.shop_address && !img ? (
        <p className="text-slate-500">{s.infoEmpty}</p>
      ) : null}
    </InfoShell>
  )
}
